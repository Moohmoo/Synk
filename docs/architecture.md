# Architecture : SYNK

> **Version :** 1.0.0-beta  
> **Auteur :** Mohmo

---

## 1. Vue d'Ensemble

SYNK fonctionne sur un modèle simple en trois parties :

```text
[ Client Web (Navigateur) ]
       │
       │ HTTP (Création de salon) + WebSocket (Synchronisation en direct)
       ▼
[ Serveur Backend (FastAPI) ]
       │
       │ Stockage temporaire en mémoire vive
       ▼
[ Base Redis (État des salons + Nettoyage automatique) ]
```

1. **Le Frontend (React) :** Affiche l'interface, joue la vidéo YouTube et écoute les actions de l'utilisateur (play, pause, avance).
2. **Le Backend (FastAPI) :** Reçoit les événements de chacun, vérifie qui a le droit de contrôler la vidéo, et renvoie la position exacte à tous les participants en direct.
3. **La Base Redis :** Garde en mémoire l'état du salon (seconde actuelle, qui est connecté) et supprime automatiquement la salle quand tout le monde est parti.

---

## 2. Organisation du Code

### 2.1. Frontend (`front/src`)

- `components/` : Boutons, navigation latérale et lecteur vidéo.
- `views/` : Les deux pages de l'application :
  - `home/` : Page d'accueil pour créer un salon ou entrer un code.
  - `room/` : Salon de visionnage avec le lecteur et la liste des membres.
- `hooks/` : La logique métier (recalage automatique de la vidéo, raccourcis clavier, connexion WebSocket).
- `stores/` : État visuel léger (savoir si le menu latéral est replié).
- `services/` : Fonctions pour communiquer avec l'API backend.

### 2.2. Backend (`back/src`)

- `api/` : Points d'accès web (créer un salon, vérifier si un code existe).
- `domains/room/` : Le cœur de l'application (gestion des participants, transmission des ordres de lecture et calcul du temps).
- `core/` : Configuration, sécurité anti-spam et connexion aux WebSockets.
- `db/` : Connexion directe avec Redis.

---

## 3. Choix Technologiques

### 3.1. React + Vite (plutôt que Next.js)
SYNK est une application privée de visionnage en temps réel. Elle n'a pas besoin de référencement Google (SEO) sur les salons privés. Une application React servie via Vite est beaucoup plus légère, démarre instantanément et simplifie la gestion des connexions WebSocket permanentes.

### 3.2. FastAPI (Python) (plutôt que Node.js / Express)
FastAPI permet d'écrire un code clair, typé et validé automatiquement (grâce à Pydantic). Il offre d'excellentes performances asynchrones tout en permettant d'ajouter facilement de futurs outils de traitement vidéo en Python.

### 3.3. Redis (plutôt que une base SQL comme PostgreSQL)
Les salons de visionnage sont par nature éphémères. Utiliser une base de données sur disque ralentirait les échanges et imposerait de créer des scripts de nettoyage réguliers. Avec Redis, tout reste en mémoire vive (ultra-rapide) et les salons inactifs s'effacent d'eux-mêmes sans intervention humaine.

### 3.4. Zustand (plutôt que Redux)
Zustand pèse moins de 1 Ko et ne demande aucune configuration complexe. Il gère parfaitement les quelques préférences d'affichage (menu ouvert ou fermé) sans ralentir l'application.

---

## 4. Données et Sécurité d'un Salon

Chaque salon actif est représenté dans Redis par deux informations :

1. **L'état du salon (`room:{id}`) :**
   - L'identifiant du salon et sa date de création.
   - La vidéo en cours (lien YouTube, position en secondes, état play/pause).
   - Les options (salon verrouillé par l'hôte ou libre pour tous).
   - La liste des participants connectés avec leur ping.
2. **La clé d'hôte (`room:{id}:host_token`) :**
   - Un jeton secret stocké uniquement dans le navigateur du créateur.
   - Permet de prouver qu'il est bien l'administrateur de la salle (pour verrouiller les commandes ou fermer le salon).

---

## 5. Nettoyage Automatique

Pour ne jamais saturer la mémoire du serveur :
- **Salon créé mais non rejoint :** Supprimé au bout de **5 minutes**.
- **Salon vide (tous les membres sont partis) :** Supprimé au bout de **10 minutes**.
- **Salon actif :** Prolonge automatiquement sa durée de vie de **2 heures** à chaque interaction.
