# Product Requirements Document (PRD) — Synk

## 1. Vision & Objectifs

### Problème
Regarder des vidéos ou écouter de la musique à distance avec des proches est souvent fastidieux : les outils existants imposent l'installation d'extensions de navigateur, sont pollués par des publicités intrusives, ou souffrent de décalages temporels constants (*drift*) sans mécanisme de resynchronisation fluide.

### Solution
**Synk** est une application web open source et 100 % gratuite qui permet à deux personnes (ou plus) de synchroniser instantanément la lecture de contenus multimédias (YouTube, flux audio) via un simple lien de partage, sans inscription, sans extension et sans publicité.

### Proposition de valeur
* **Zéro friction :** Création et partage de salon en un clic, accessible directement sur navigateur (desktop et mobile).
* **Synchronisation fluide :** Recalage temporel automatique et transparent pour compenser les variations de latence réseau.
* **Open source & Minimaliste :** Code propre, gratuit, axé sur la performance et le respect de la vie privée.

---

## 2. Utilisateurs cibles

* **Les amis / couples à distance :** Veulent regarder un épisode, une vidéo YouTube ou une conférence ensemble tout en discutant.
* **Les mélomanes / étudiants :** Veulent écouter la même session musicale (Lofi, playlists) en session de travail synchrone.
* **Les développeurs / curieux tech :** Cherchent une alternative open source légère, auto-hébergeable ou consultable sur GitHub.

---

## 3. Périmètre fonctionnel (Scope)

### 3.1. In Scope (MVP)
* **Salons éphémères :** Génération d'un salon via un identifiant unique aléatoire et sécurisé.
* **Accès invité sans compte :** Saisie d'un pseudo à l'entrée, sans mot de passe ni e-mail.
* **Lecteur synchronisé (YouTube) :**
  * Synchronisation en temps réel des actions : Lecture (*Play*), Pause, Navigation (*Seek*).
  * Alignement automatique de l'invité sur le temps de lecture actuel dès son arrivée.
  * Compensation automatique des micro-décalages réseau.
* **Contrôles de permissions :**
  * *Mode Hôte :* Seul le créateur contrôle la lecture.
  * *Mode Libre :* Tous les participants peuvent contrôler le lecteur.
* **Panneau latéral :**
  * Liste des utilisateurs connectés en temps réel.
  * Chat textuel instantané avec horodatage et notifications système (*« Bob a mis en pause »*).

### 3.2. Out of Scope (Exclu du MVP)
* Comptes utilisateurs persistants et profils enregistrés.
* Hébergement ou téléchargement direct de fichiers vidéo/audio lourds.
* Salons vocaux ou vidéo intégrés (WebRTC audio/vidéo).
* Système de paiement, d'abonnements ou d'annonces publicitaires.

---

## 4. Parcours utilisateur (User Flows)

### Flux 1 : Création et partage (Hôte)
1. L'utilisateur arrive sur la page d'accueil (`/`).
2. Il clique sur « Créer un salon » et renseigne son pseudo (ex. *Alice*).
3. L'application génère le salon et le redirige vers `/room/{roomId}`.
4. L'utilisateur colle un lien YouTube dans la barre de recherche du salon.
5. Il clique sur « Copier le lien » pour inviter des participants.

### Flux 2 : Connexion et synchronisation (Invité)
1. L'invité clique sur le lien partagé (`/room/{roomId}`).
2. Une modale s'affiche : il entre son pseudo (ex. *Bob*).
3. Le lecteur se charge et se cale instantanément sur la vidéo en cours au même timestamp qu'Alice.
4. Bob apparaît dans la liste des membres actifs du salon.

### Flux 3 : Interaction en direct
1. Alice clique sur « Pause » à 04:12.
2. Tous les participants passent en pause à 04:12 sous 100 ms.
3. Un message système s'affiche dans le chat : *« Alice a mis la vidéo en pause »*.

---

## 5. Règles métier & Gestion des cas limites (Edge Cases)

| Événement | Comportement attendu |
|---|---|
| **Arrivée tardive** | Le client reçoit l'état serveur complet (`current_time`, `is_playing`, `video_id`) et démarre directement au bon endroit. |
| **Départ de l'hôte** | Le rôle d'hôte est automatiquement transféré au participant connecté depuis le plus longtemps. |
| **Salon vide** | Si aucun participant n'est connecté pendant 10 minutes, le salon et ses données en mémoire sont détruits. |
| **Micro-décalage (< 1,5 s)** | Ajustement imperceptible de la vitesse de lecture (ex. x1.05 ou x0.95) pour recoller sans coupure sonore. |
| **Gros décalage (> 1,5 s)** | Saut direct (*Seek*) vers la position de référence du serveur. |
| **Actions concurrentes** | La règle du *Last-Write-Wins* (dernière action reçue par le serveur) prévaut et est diffusée à tous. |
| **Lien invalide** | Rejet côté serveur si l'URL ne correspond pas à un format YouTube valide, avec message d'erreur explicite. |

---

## 6. Roadmap future (Post-MVP)

* **V1 :** File d'attente collaborative (playlist partagée avec ajout de liens par tous les membres).
* **V2 :** Support multi-sources (SoundCloud, flux direct MP4/HLS, Twitch).
* **V3 :** Mode Blind Test / Quiz interactif basé sur les playlists partagées.

---

## 7. Critères de succès du MVP (Definition of Done)

* [ ] Un salon peut être créé et rejoint via une URL unique sans aucune authentification.
* [ ] Deux navigateurs distincts restent synchronisés à moins de 300 ms d'écart lors des actions play/pause/seek.
* [ ] Les messages de chat et notifications d'événements s'affichent instantanément (< 100 ms).
* [ ] Le projet démarre en local via une commande unique `docker compose up`.
* [ ] Le code métier pur est couvert par des tests unitaires automatisés.
