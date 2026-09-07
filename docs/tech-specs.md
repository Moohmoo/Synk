# Technical Specifications (Tech Spec) — Synk

## 1. Architecture Globale

Le système repose sur une architecture temps réel découplée utilisant des WebSockets bidirectionnels et une couche de données en mémoire vive (Redis) pour gérer l'état distribué des salons.

```text
[ Client Web (React / SPA) ]
            │
            │  1. HTTP POST /api/rooms (Création)
            │  2. WSS /ws/{room_id} (Connexion temps réel)
            ▼
[ Backend (FastAPI / Asynchrone) ]
            │
    ┌───────┴────────────────────────┐
    │                                │
    ▼                                ▼
[ Redis Key-Value ]          [ Redis Pub/Sub ]
(État du salon, TTL)         (Diffusion inter-instances)
```

### 1.1. Arborescence du Projet Backend

```text
backend/
├── src/
│   ├── api/                  # Routes HTTP et gestionnaires WebSocket
│   │   ├── routes.py         # Endpoints REST (/api/rooms)
│   │   └── ws.py             # Handlers WebSocket & gestion des connexions
│   │
│   ├── services/             # Logique métier et calculs
│   │   ├── room_service.py   # Gestion du cycle de vie du salon
│   │   └── sync_service.py   # Calculs d'écart temporel (drift)
│   │
│   ├── schemas/              # Schémas Pydantic (validation & sérialisation)
│   │   ├── room.py           # Définition des états (Room, Participant, Playback)
│   │   └── events.py         # Schémas des messages WebSocket (in/out)
│   │
│   ├── core/                 # Configuration globale et composants transverses
│   │   ├── config.py         # Variables d'environnement et réglages
│   │   ├── redis.py          # Client et opérations Redis
│   │   └── security.py       # Rate limiting, validation des origines
│   │
│   └── main.py               # Point d'entrée de l'application FastAPI
│
├── tests/                    # Tests automatisés
│   ├── test_sync.py          # Tests unitaires des calculs de drift
│   └── test_api.py           # Tests d'intégration des endpoints et sockets
├── Dockerfile
└── requirements.txt
```

---

## 2. Modèle de Données (Redis Schema)

L'ensemble de l'état d'un salon est stocké dans une clé Redis sous la clé `room:{room_id}` avec un TTL (*Time-To-Live*) de 2 heures renouvelé à chaque activité.

### Structure de l'objet Salon (`RoomState`)

```json
{
  "room_id": "k8F-2mX9-L1q",
  "created_at": 1772450000000,
  "host_id": "usr_99a8b7",
  "settings": {
    "is_locked": false
  },
  "playback": {
    "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "video_id": "dQw4w9WgXcQ",
    "is_playing": true,
    "current_time": 142.5,
    "last_updated_at": 1772450120500
  },
  "participants": [
    {
      "id": "usr_99a8b7",
      "username": "Alice",
      "is_host": true,
      "joined_at": 1772450000000,
      "ping_ms": 24
    }
  ]
}
```

---

## 3. Contrats d'API REST

### 3.1. Création de salon

* **Route :** `POST /api/rooms`
* **Request Body :**

```json
{
  "username": "Alice"
}
```

* **Response Body (201 Created) :**

```json
{
  "room_id": "k8F-2mX9-L1q",
  "host_token": "tok_sec_8f93e2b1...",
  "user_id": "usr_99a8b7"
}
```

### 3.2. Vérification de salon

* **Route :** `GET /api/rooms/{room_id}`
* **Response Body (200 OK) :**

```json
{
  "exists": true,
  "participant_count": 3
}
```

---

## 4. Protocole et Événements WebSocket (WSS)

* **Point d'entrée unique :** `wss://api.synk.app/ws/{room_id}?token={optional_token}&username={username}`

### Structure de base des messages JSON

```json
{
  "event": "NOM_DE_LEVENEMENT",
  "payload": {},
  "timestamp": 1772450120500
}
```

### 4.1. Événements Client -> Serveur (Actions)

| Événement | Payload | Description |
|---|---|---|
| `PLAYBACK_PLAY` | `{"current_time": 42.0}` | L'utilisateur lance la lecture à une position donnée. |
| `PLAYBACK_PAUSE` | `{"current_time": 42.0}` | L'utilisateur met la vidéo en pause. |
| `PLAYBACK_SEEK` | `{"target_time": 125.4}` | L'utilisateur déplace le curseur de lecture. |
| `CHANGE_MEDIA` | `{"url": "https://..."}` | Chargement d'une nouvelle URL média. |
| `CHAT_MESSAGE` | `{"content": "Salut !"}` | Envoi d'un message textuel dans le salon. |
| `HEARTBEAT` | `{"client_sent_at": 1772450120000}` | Mesure du RTT / Latence réseau. |

### 4.2. Événements Serveur -> Client (Diffusions)

| Événement | Payload | Description |
|---|---|---|
| `ROOM_STATE_SYNC` | `{ RoomState }` | État complet envoyé lors de la connexion initiale. |
| `PLAYBACK_UPDATED` | `{"action": "PLAY", "current_time": 42.0, "triggered_by": "Alice"}` | Ordre de mise à jour de lecture diffusé à tous. |
| `PARTICIPANT_JOINED` | `{"user": {"id": "...", "username": "Bob"}}` | Notification d'un nouvel arrivant. |
| `PARTICIPANT_LEFT` | `{"user_id": "usr_...", "new_host_id": "usr_..."}` | Notification de départ et réattribution de l'hôte. |
| `CHAT_BROADCAST` | `{"id": "msg_1", "username": "Bob", "content": "Salut !", "time": "14:02"}` | Message de chat relayé. |
| `HEARTBEAT_ACK` | `{"client_sent_at": 1772450120000, "server_received_at": 1772450120015}` | Réponse pour calcul du ping local. |

---

## 5. Algorithme de Synchronisation Temporelle (Drift Compensation)

Stratégie de recalage à 3 seuils basée sur la position théorique de référence calculée par le client :

$$\text{Position Référence} = \text{current\_time} + (\text{Timestamp Actuel} - \text{last\_updated\_at}) \times \text{vitesse}$$

$$\Delta t = \vert{}\text{Position Locale} - \text{Position Référence}\vert{}$$

```text
       Δt < 200 ms               200 ms ≤ Δt ≤ 1500 ms              Δt > 1500 ms
┌─────────────────────────┐   ┌─────────────────────────┐   ┌─────────────────────────┐
│     Zone Parfaite       │   │    Micro-Décalage       │   │    Désynchronisation    │
│  -> Aucune action       │   │  -> Ajustement vitesse  │   │  -> Saut direct (Seek)  │
│                         │   │     (x0.95 ou x1.05)    │   │     sans transition     │
└─────────────────────────┘   └─────────────────────────┘   └─────────────────────────┘
```

---

## 6. Mesures de Sécurité & Robustesse

* **Validation des Origines & CORS :**
  * Rejet des handshakes WebSocket dont l'en-tête `Origin` ne correspond pas au domaine front-end.
  * Middleware CORS restreint exclusivement au domaine frontend sur l'API REST.
* **Taille maximale des messages (Payload Limit) :**
  * Rejet immédiat de tout paquet WebSocket dépassant 64 Ko pour protéger la mémoire vive.
* **Validation des entrées (Sanitization & Regex) :**
  * **Pseudo :** `^[a-zA-Z0-9_-]{2,20}$` (2 à 20 caractères, sans balises ni caractères de contrôle).
  * **Liens vidéo :** validation stricte du format YouTube côté serveur (`^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$`).
  * **Chat :** échappement automatique du HTML côté client (rendu en texte brut uniquement).
* **Rate Limiting & Protection DoS :**
  * Limitation à 5 messages par seconde par IP (extraction de l'IP réelle via `X-Forwarded-For`).
  * Déconnexion automatique du socket en cas d'abus répété.
* **Auto-nettoyage Redis :**
  * Suppression automatique de la clé du salon après 600 secondes (10 min) consécutives sans participant connecté.
