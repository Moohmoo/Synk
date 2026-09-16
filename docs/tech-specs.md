# Spécifications Techniques & Justifications d'Architecture — SYNK

> **Document Version :** 1.0.0-beta  
> **Cible :** Architecture logicielle, Performance temps réel, Résilience distribuée

---

## 1. Stack Technologique Complète

```text
┌──────────────────────────────────────────────────────────────────────────┐
│                             FRONTEND STACK                               │
│  • React 18.3 (Hooks, Portals)         • Vite 6.2 (Bundler esbuild/Rollup)│
│  • TypeScript 5.7 (Typage strict)      • Tailwind CSS 3.4 (Design System) │
│  • Zustand 5.0 (State Management)      • Radix UI Primitives (a11y)       │
│  • Socket.IO Client 4.8 (Temps réel)   • Axios (Client REST normalisé)    │
└────────────────────────────────────┬─────────────────────────────────────┘
                                     │ HTTP REST + WebSocket WSS
┌────────────────────────────────────┴─────────────────────────────────────┐
│                             BACKEND STACK                                │
│  • Python 3.12 (Typage PEP 585/604)    • FastAPI 0.115 (API Asynchrone)   │
│  • Python-SocketIO 5.12 (WebSockets)   • Uvicorn (Serveur ASGI ASGI/uvloop)│
│  • Pydantic v2 (Validation & Schemas)  • uv (Gestionnaire de dépendances) │
└────────────────────────────────────┬─────────────────────────────────────┘
                                     │ Protocole RESP (In-Memory)
┌────────────────────────────────────┴─────────────────────────────────────┐
│                             DATA & CACHE LAYER                           │
│  • Redis 7.0 (In-Memory Datastore, Pub/Sub multi-instances, TTL natif)   │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Justification des Choix Technologiques (Trade-offs)

### 2.1. Frontend : Vite + React SPA vs Next.js SSR

| Critère | Choix : Vite + React SPA | Alternative : Next.js (SSR / App Router) | Justification |
| :--- | :--- | :--- | :--- |
| **Adéquation Métier** | Excellente (Application dynamique privée) | Moyenne (Conçue pour le SEO et le contenu public) | Les salons de visionnage sont des sessions éphémères privées. Le SSR n'apporte aucun gain SEO et complexifie la gestion des connexions WebSocket persistantes. |
| **Poids & Vitesse** | Build Vite en ~8s, bundle optimisé | Complexité de build et surcoût serveur Next.js | Vite offre un HMR instantané en dev et un bundle statique facilement distribuable sur CDN (Vercel/Cloudflare). |

### 2.2. Gestion d'État : Zustand vs Redux Toolkit

* **Pourquoi Zustand :**
  * **Empreinte minimale (< 1 KB) :** Pas de boilerplate lourd, pas de reducers ou d'actions verbeuses.
  * **Accès hors composants :** Permet de lire et mettre à jour l'état directement depuis les callbacks réseau et WebSocket sans `Provider` React.
  * **Performances :** Sélecteurs granulaires évitant tout re-render intempestif sur les mises à jour fréquentes du lecteur (ping, timestamp).

### 2.3. Backend : FastAPI (Python 3.12) vs Node.js / Express

| Critère | Choix : FastAPI | Alternative : Node.js / Express | Justification |
| :--- | :--- | :--- | :--- |
| **Typage & Validation** | Pydantic v2 natif en C (ultra-rapide) | Nécessite des libs tierces (Zod, Joi) | Contrats d'API fiables à 100%, sérialisation JSON instantanée et documentation OpenAPI/Swagger générée automatiquement. |
| **Asynchronisme** | `asyncio` natif + `uvloop` | Event loop V8 | Performances comparables à Node.js avec une syntaxe plus robuste pour l'ingénierie et la manipulation de flux multimédias. |
| **Extensibilité future** | Écosystème IA / Python | JavaScript / TypeScript | Facilite l'intégration ultérieure de modèles de traitement multimédia ou d'IA (sous-titrage Whisper, reconnaissance de flux). |

### 2.4. Couche Données : Redis 7 vs PostgreSQL / MySQL

* **Pourquoi Redis exclusif pour le MVP :**
  * **Latence sub-milliseconde :** Stockage 100 % in-memory indispensable pour les checks de salon et mises à jour d'état temps réel.
  * **TTL Natif (Auto-nettoyage) :** Les salons expirent automatiquement au bout de 2 heures ou 10 minutes d'abandon sans script cron ou worker de nettoyage tiers.
  * **Pub/Sub intégré :** Prêt pour un scaling horizontal multi-serveurs : plusieurs instances FastAPI peuvent communiquer via le canal Redis Pub/Sub sans broker supplémentaire (Kafka/RabbitMQ).

---

## 3. Modèle de Données Redis (Schéma Déterministe)

L'état d'un salon est centralisé sous deux clés Redis associées à un TTL synchronisé :

### 3.1. Clé d'État : `room:{room_id}`
```json
{
  "room_id": "k8F-2mX",
  "created_at": 1772450000.0,
  "host_id": "usr_99a8b7",
  "settings": {
    "is_locked": false
  },
  "playback": {
    "media_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "provider": "youtube",
    "media_id": "dQw4w9WgXcQ",
    "is_playing": true,
    "current_time": 142.5,
    "duration": 212.0,
    "last_updated_at": 1772450120.5
  },
  "participants": [
    {
      "user_id": "usr_99a8b7",
      "username": "Alice",
      "is_host": true,
      "joined_at": 1772450000.0,
      "ping": 18
    }
  ]
}
```

### 3.2. Clé de Sécurité Hôte : `room:{room_id}:host_token`
* **Type :** `String` (Hachage cryptographique opaque)
* **Usage :** Authentifie l'hôte légitime pour les requêtes sensibles (suppression du salon, prise de contrôle).

---

## 4. Stratégie de Déploiement & Environnement

* **Frontend :** Déploiement statique Edge (Vercel) avec forçage HTTPS strict (HSTS, CSP `upgrade-insecure-requests`).
* **Backend :** Conteneur Docker Linux léger (`python:3.12-slim` + binaire officiel `uv`).
* **Redis :** Instance gérée (Upstash / Redis Cloud ou conteneur `redis:7-alpine`).
