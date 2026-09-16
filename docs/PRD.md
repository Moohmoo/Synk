# PRD : SYNK

> **Version :** 1.0.0-beta  
> **Statut :** MVP  
> **Auteur :** Mohmo

---

## 1. Vision & Objectif

### 1.1. Le problème
Regarder une vidéo à distance avec quelqu'un est souvent pénible :
- **Le décompte "3, 2, 1, Play" :** Le faire au micro sur Discord ou WhatsApp ne marche jamais et crée des échos ou du retard.
- **La pause casse tout :** Dès qu'une personne met pause ou a un ralentissement de connexion, tout le monde est décalé.
- **Les extensions ne marchent pas sur mobile :** Les outils existants imposent une extension de navigateur inutilisable sur smartphone ou tablette.
- **Trop de contraintes :** La plupart des sites imposent une création de compte ou polluent l'écran de bannières publicitaires.

### 1.2. La solution : SYNK
Un site web instantané, sans inscription et sans publicité :
1. On colle le lien d'une vidéo (YouTube, Twitch, etc.).
2. On envoie le lien du salon à ses amis.
3. Tout le monde regarde la vidéo calée à la même seconde, sur ordinateur comme sur téléphone.

---

## 2. Utilisateur Cible

Toute personne souhaitant partager un moment vidéo à distance (amis, couples, proches) sans avoir à installer d'application ni créer de compte.

---

## 3. Fonctionnalités

### 3.1. Ce que fait l'application
- **Salons instantanés :** Création en 1 clic avec un code unique. Le salon se ferme tout seul après 10 minutes d'inactivité.
- **Zéro inscription :** Un simple pseudo suffit. Le créateur du salon conserve automatiquement ses droits d'administration.
- **Lecteur synchronisé :** Play, Pause et déplacement dans la vidéo pour tous les participants sur YouTube, Twitch, Vimeo et liens directs (.mp4).
- **Recalage automatique :** Si un ami rejoint en cours de route ou si sa connexion ralentit, la vidéo se recale automatiquement à la bonne seconde. Un bouton "Rattraper" apparaît si le retard est trop important.
- **Gestion des droits :** L'hôte peut verrouiller les contrôles (lui seul gère la lecture) ou laisser la salle en mode libre. Si l'hôte s'en va, un autre membre prend le relais.
- **Chat textuel :** Messagerie intégrée pour discuter pendant la vidéo, avec affichage du ping.

### 3.2. Pistes d'amélioration
- **File d'attente (playlist) :** Pouvoir ajouter plusieurs vidéos à la suite sans recoller un lien à chaque fois.
- **Sous-titres :** Meilleure détection des pistes de sous-titres selon la plateforme.

---

## 4. Règles de Fonctionnement

| Situation | Ce qui doit se passer | Comportement du système |
| :--- | :--- | :--- |
| **Arrivée en cours de vidéo** | La personne doit rejoindre sans couper les autres. | Le serveur lui donne immédiatement la bonne seconde et l'état de lecture. |
| **Micro-décalage (< 0.5s)** | Différence minime normale. | Aucun saut forcé pour ne pas saccader le son. |
| **Décalage moyen (0.5s à 2s)** | Recalage nécessaire. | Le lecteur réaligne la vidéo de manière transparente. |
| **Gros retard réseau (> 2s)** | La connexion de l'utilisateur a décroché. | Un bouton "Rattraper" apparaît pour se remettre à niveau en un clic. |
| **Départ de l'hôte** | Le salon ne doit pas être bloqué. | Les droits d'hôte sont transférés au membre actif suivant. |
| **Salon vide** | Libérer la mémoire du serveur. | Le salon est automatiquement supprimé après 10 minutes sans participant. |

---

## 5. Critères de Réussite

- **Synchronisation :** Moins de 200 ms d'écart entre les participants.
- **Instantané :** Prise en main immédiate en moins de 10 secondes.
- **Multiplateforme :** Fonctionne aussi bien sur mobile que sur grand écran.
