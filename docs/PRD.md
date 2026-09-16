# Product Requirements Document (PRD) — SYNK

> **Document Version :** 1.0.0-beta  
> **Statut :** En Production (MVP)  
> **Auteur :** Lead Developer & Product Owner

---

## 1. Vision & Positionnement

### 1.1. Problème
Visionner des contenus vidéo à distance entre amis, collègues ou communautés est aujourd'hui entravé par :
* L'obligation d'installer des extensions de navigateur tierces invasives et peu fiables.
* La création forcée de comptes utilisateur avant tout accès.
* Une désynchronisation constante due aux variations de latence réseau (*drift*).
* Des interfaces polluées par des publicités et des mécanismes lourds.

### 1.2. Solution : SYNK
**SYNK** est une application web SaaS open-source permettant de synchroniser instantanément la lecture multimédia via un simple lien de partage, directement dans le navigateur, avec une précision inférieure à 200 ms.

### 1.3. Proposition de Valeur
* **Zéro Friction :** Création de salon en 1 clic. Aucun compte requis.
* **Synchronisation Déterministe :** Recalage temporel automatique avec compensation d'horloge réseau.
* **Minimalisme & Performance :** Interface épurée focalisée à 100 % sur le média et le chat.

---

## 2. Utilisateurs Cibles & Cas d'Usage

1. **Amis & Familles distants :** Visionnage synchrone de séries, vidéos YouTube ou lives Twitch tout en échangeant sur le chat textuel.
2. **Étudiants & Équipes de travail :** Sessions d'écoute musicale collaborative (Lofi, podcasts, conférences) avec contrôle d'accès.
3. **Recruteurs & Pairs Développeurs (Vitrine Portfolio / CV) :** Démonstration d'une ingénierie logicielle robuste :
   * Gestion d'états distribués temps réel.
   * Architecture événementielle (WebSockets / Redis Pub-Sub).
   * Typage strict de bout en bout (TypeScript / Pydantic).

---

## 3. Périmètre Fonctionnel (Scope)

```text
┌──────────────────────────────────────────────────────────┐
│                      PÉRIMÈTRE MVP                       │
│  • Salons éphémères (URL-safe)  • Sync Play/Pause/Seek   │
│  • Auth session locale (pseudo) • YouTube/Twitch/Direct  │
│  • Host Lock (sécurité lecture) • Chat temps réel        │
│  • Auto-reconnexion WebSocket   • Nettoyage Redis auto   │
└────────────────────────────┬─────────────────────────────┘
                             │ V2 (Futur)
                             ▼
┌──────────────────────────────────────────────────────────┐
│                      HORS MVP (V2+)                      │
│  • File d'attente collaborative • Salons vocaux WebRTC   │
│  • Comptes persistants (Postgres)• Sous-titres custom    │
└──────────────────────────────────────────────────────────┘
```

### 3.1. Inclus dans le MVP (v1.0.0-beta)

* **Salons éphémères haute sécurité :**
  * Génération d'identifiants uniques cryptographiques (`secrets.token_urlsafe`).
  * Destruction automatique du salon après 10 minutes d'inactivité à vide (`ROOM_EMPTY_TTL_SECONDS = 600`).
* **Gestion des sessions sans mot de passe :**
  * Saisie immédiate d'un pseudo stocké dans la session locale (`localStorage`).
  * Token secret d'hôte (`host_token`) pour l'administration du salon.
* **Moteur de synchronisation multimédia :**
  * Contrôles synchrones : *Play*, *Pause*, *Seek* (recalage instantané).
  * Extraction multi-sources via Strategy Pattern : YouTube, Twitch, Vimeo, flux MP4/HLS.
  * Récupération automatique de la position exacte pour les arrivants tardifs.
  * Bouton contextuel « Rattraper » en cas de retard réseau supérieur à 2 secondes.
* **Gouvernance du salon :**
  * *Mode Hôte Exclusif :* L'hôte verrouille la lecture et le changement de média.
  * *Mode Libre :* Tous les participants peuvent piloter le lecteur.
  * *Élection automatique d'un nouvel hôte :* En cas de déconnexion de l'hôte d'origine.
* **Communication & Présence :**
  * Chat textuel avec horodatage et alertes système d'événements.
  * Compteur et liste des membres connectés avec indicateur de latence (ping ms).

### 3.2. Exclu du MVP (Planifié pour la V2)

* Authentification OAuth (Google / GitHub) et profils utilisateurs persistants.
* Téléchargement ou stockage direct de vidéos sur nos serveurs.
* Flux vocaux et vidéo WebRTC en direct (volontairement exclu pour maintenir une charge serveur minimale).
* File d'attente partagée (playlist collaborative).

---

## 4. Règles Métier Critiques

| Événement | Règle Métier | Action Système |
| :--- | :--- | :--- |
| **Arrivée d'un participant** | L'utilisateur doit s'aligner sans interrompre les autres. | Envoi de l'état serveur complet (`current_time`, `is_playing`, `media_url`). |
| **Micro-décalage (< 0.5s)** | Tolérance réseau acceptable. | Aucun seek forcé ; préservation d'une écoute audio fluide. |
| **Dérive modérée (0.5s - 2s)** | Recalage nécessaire. | Correction impérative de la propriété DOM `currentTime`. |
| **Lenteur réseau persistante (> 2s)** | Le client prend du retard. | Détection de désynchronisation et affichage du bouton « Rattraper ». |
| **Départ de l'hôte** | Le salon ne doit jamais rester orphelin. | Attribution du rôle d'hôte au participant actif le plus ancien. |
| **Salon vide** | Éviter la saturation mémoire de Redis. | Déclenchement du compte à rebours de 10 minutes avant suppression. |

---

## 5. Critères de Succès & Definition of Done (DoD)

* [x] **Précision temporelle :** Décalage inter-clients mesuré inférieur à 200 ms sur connexion normale.
* [x] **Temps de chargement initial :** Rendu de la page d'accueil sous 1 seconde (bundle Vite optimisé).
* [x] **Stabilité des tests :** 100 % de couverture des flux critiques côté backend (Pytest).
* [x] **Mobile-first :** Aucune régression visuelle de 320px à 4K.
