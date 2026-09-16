# PRD : SYNK

> **Version :** 1.0.0-beta  
> **Statut :** MVP  
> **Auteur :** Mohmo

---

## 1. Vision & Objectif

### 1.1. Le problème
Regarder une vidéo à distance avec des amis est souvent pénible :
- Il faut installer des extensions de navigateur qui buggent ou demandent trop de permissions.
- Il faut créer un compte obligatoire avant même de pouvoir tester.
- La vidéo finit toujours par se décaler de plusieurs secondes à cause des variations de connexion.
- Les plateformes gratuites existantes sont polluées de publicités.

### 1.2. La solution : SYNK
SYNK est un site web simple et rapide qui permet de regarder des vidéos ensemble en temps réel.
On colle un lien, on partage l'URL à ses amis, et la lecture se synchronise pour tout le monde directement dans le navigateur, sans inscription et sans publicité.

### 1.3. Ce qui fait la différence
- **Zéro friction :** Un salon se crée en 1 clic. Aucun compte requis.
- **Synchronisation fluide :** La vidéo reste calée automatiquement entre tous les écrans (moins de 200 ms d'écart).
- **Sobre et efficace :** Une interface sombre et épurée centrée sur la vidéo et le chat.

---

## 2. Utilisateurs Cibles

1. **Amis et proches :** Regarder YouTube, Twitch ou des séries ensemble à distance tout en discutant.
2. **Groupes et collègues :** Écouter de la musique ou suivre une présentation en même temps.
3. **Portfolio :** Présenter un projet propre et bien structuré avec du temps réel moderne (WebSockets, FastAPI, React, Redis).

---

## 3. Périmètre du Projet

### 3.1. Inclus dans la version actuelle (MVP)
- **Salons instantanés :** Création en 1 clic avec code unique, fermeture automatique après 10 minutes d'inactivité.
- **Utilisation sans compte :** Un simple pseudo suffit, avec clé secrète d'hôte conservée dans le navigateur.
- **Lecteur synchronisé :** Play, Pause et avance rapide pour tous sur YouTube, Twitch, Vimeo et vidéos directes (.mp4, .m3u8).
- **Recalage automatique :** Les nouveaux arrivants se calent directement à la bonne seconde, avec bouton "Rattraper" en cas de ralentissement réseau.
- **Contrôle de la salle :** Choix entre Mode Hôte (seul le créateur contrôle) et Mode Libre (tout le monde contrôle).
- **Passation d'hôte :** Si l'hôte quitte la salle, un autre membre prend automatiquement le relais.
- **Chat et membres :** Messages textuels en direct et indicateur de ping.

### 3.2. Prévu pour les prochaines versions (V2)
- Comptes utilisateurs et historique des salons.
- Playlist partagée (file d'attente de vidéos).
- Salons vocaux.

---

## 4. Règles de Fonctionnement

| Situation | Ce qui doit se passer | Comportement du système |
| :--- | :--- | :--- |
| **Arrivée d'un participant** | Il doit voir la vidéo à la bonne seconde sans couper les autres. | Le serveur lui envoie la position exacte et l'état de lecture. |
| **Tout petit décalage (< 0.5s)** | Décalage normal imperceptible. | On ne force aucun saut pour préserver le confort audio. |
| **Décalage moyen (0.5s à 2s)** | La vidéo doit se recoller discrètement. | Le lecteur s'aligne automatiquement sur la bonne seconde. |
| **Gros retard réseau (> 2s)** | L'utilisateur a pris du retard. | Un bouton discret "Rattraper" apparaît pour se recaler en 1 clic. |
| **L'hôte quitte le salon** | La salle ne doit pas rester bloquée. | Le rôle d'hôte est automatiquement confié au membre le plus ancien. |
| **Salon vide** | Ne pas encombrer la mémoire du serveur. | Le salon s'efface après 10 minutes d'inactivité. |

---

## 5. Critères de Validation

- **Synchronisation :** Moins de 200 ms d'écart entre les écrans sur une connexion standard.
- **Vitesse :** Chargement de la page d'accueil sous 1 seconde.
- **Fiabilité :** 100% des tests validés sur le backend.
- **Compatibilité :** Affichage fluide sur mobile, tablette et ordinateur.
