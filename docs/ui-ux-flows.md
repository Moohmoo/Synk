# UI/UX Specifications & User Flows — Synk

## 1. Direction Artistique & Charte Graphique (Inspiration LoL Esports)

* **Ambiance générale :** Style « dark tech » épuré, aéré et immersif. Fond noir profond avec contrastes nets.
* **Palette de couleurs :**
  * **Fond principal :** Noir profond (`#050505` / Tailwind `bg-zinc-950`) pour fondre l'interface et faire ressortir la vidéo.
  * **Surfaces / Cartes :** Gris sombre subtil (`#0F0F11` / Tailwind `bg-zinc-900/60`) avec bordures ultra-fines (`#1E1E24` / `border-zinc-800`).
  * **Couleur d'accent (Brand) :** Cyan électrique (`#00E5FF` ou `#06B6D4` / Tailwind `text-cyan-400`, `bg-cyan-500`) pour les boutons d'action clés, les états actifs et les badges.
  * **Textes :** Blanc pur (`#FFFFFF`) pour les titres et gris neutre (`#A1A1AA` / `text-zinc-400`) pour les informations secondaires.
* **Typographie & Détails :**
  * Petits libellés de section en majuscules discrètes (`SALON`, `PARTICIPANTS`, `CHAT`).
  * Zéro ombre lourde, pas de fioritures : séparation nette par des lignes fines.
* **Responsive :** Optimisé en priorité pour Desktop (lecteur 70 % / panneau 30 %), avec disposition empilée sur Mobile.

---

## 2. Wireframes des Écrans

### 2.1. Page d'Accueil (`/`)

Page d'atterrissage ultra-épurée avec deux actions : créer un salon ou en rejoindre un via un code.

```text
+-----------------------------------------------------------------------+
|  [Logo] Synk                                              [GitHub ↗]  |
|                                                                       |
|                                                                       |
|                         Regardez ensemble.                            |
|                       Parfaitement synchronisés.                      |
|                                                                       |
|             +-------------------------------------------+             |
|             | Votre pseudo : [ Alice                  ] |             |
|             |                                           |             |
|             | [  Créer un salon instantané (1 clic)   ] |             |
|             +-------------------------------------------+             |
|                                                                       |
|                                 — OU —                                |
|                                                                       |
|             +-------------------------------------------+             |
|             | Code du salon : [ loup-bleu-42 ] [Rejoindre]|            |
|             +-------------------------------------------+             |
|                                                                       |
|                                                                       |
|  Open source • 100 % gratuit • Sans extension • Sans pub              |
+-----------------------------------------------------------------------+
```

### 2.2. Modale Invité — Arrivée via Lien Direct (/room/[roomId])

Quand un utilisateur clique sur un lien partagé sans avoir de session active :

```text
+-----------------------------------------------------------------------+
|                                                                       |
|                 +-----------------------------------+                 |
|                 |  Rejoindre le salon               |                 |
|                 |  "loup-bleu-42"                   |                 |
|                 |                                   |                 |
|                 |  Entrez votre pseudo :            |                 |
|                 |  [ Bob                          ] |                 |
|                 |                                   |                 |
|                 |  [ Entrer dans la session       ] |                 |
|                 +-----------------------------------+                 |
|                                                                       |
+-----------------------------------------------------------------------+
```

### 2.3. Salle de Visionnage — Desktop (/room/[roomId])

Disposition à deux colonnes : le lecteur à gauche (70 % de la largeur) et le panneau latéral à droite (30 %).

```text
+---------------------------------------------------------------------------------------+
| [Logo] Synk  |  Salon: loup-bleu-42  [Copier lien 🔗] | [● Synchro: 24ms]  [Quitter ✕]|
+-------------------------------------------------------------+-------------------------+
|                                                             | [👥 MEMBRES (3)] [💬 CHAT]|
|  +-------------------------------------------------------+  |-------------------------|
|  | [URL YouTube] [https://youtube.com/watch?v=](https://youtube.com/watch?v=)... [Charger] |  | • Alice (Hôte 👑)       |
|  +-------------------------------------------------------+  | • Bob                   |
|                                                             | • Chloé                 |
|  +-------------------------------------------------------+  |-------------------------|
|  |                                                       |  | Alice: Salut !  |
|  |                                                       |  | Bob a rejoint    |
|  |                                                       |  | * Alice a mis   |
|  |                   LECTEUR VIDÉO                       |  |   la vidéo en pause *   |
|  |                                                       |  | Chloé: On lance?|
|  |                                                       |  |                         |
|  |                                                       |  |                         |
|  +-------------------------------------------------------+  |                         |
|  | [▶ / ⏸] [ 04:12 / 12:30 ] [======•-------] [🔊 80%]   |  |                         |
|  +-------------------------------------------------------+  |                         |
|                                                             |-------------------------|
|  Toast système : ℹ️ Alice a mis la vidéo en pause à 04:12   | [Message...     ] [Env.]|
+-------------------------------------------------------------+-------------------------+
```

### 2.4. Salle de Visionnage — Mobile (`/room/[roomId]`)

Sur mobile, l'interface s'empile verticalement avec un système d'onglets sous la vidéo pour basculer entre le chat et la liste des membres.

```text
+-----------------------------------+
| Synk | loup-bleu-42   [🔗]  [●]  |
+-----------------------------------+
|                                   |
|          LECTEUR VIDÉO            |
|                                   |
+-----------------------------------+
| [▶] [ 04:12 / 12:30 ]    [🔊]     |
+-----------------------------------+
| [ 💬 Chat (2) ]  |  [ 👥 Membres (3) ] |
+-----------------------------------+
| Alice: Salut tout le monde|
| * Alice a mis en pause *  |
| Bob: Prêt !               |
|                                   |
|                                   |
+-----------------------------------+
| [Écrire un message...     ] [ > ] |
+-----------------------------------+
```

## 3. Composants d'État et Feedback Utilisateur

### 3.1. Indicateur de Synchronisation Réseau
Situé dans la barre supérieure, il informe l'utilisateur de l'état de sa connexion avec le salon :

| État | Visuel | Déclencheur |
|---|---|---|
| **Optimal** | `● Vert` (Synchro < 100 ms) | Connexion stable, décalage imperceptible. |
| **Recalage** | `● Orange` (Drift corrigé) | Décalage entre 500 ms et 1,5 s, accélération douce en cours. |
| **Désynchronisé** | `● Rouge` (Perte de signal) | Reconnexion WebSocket en cours ou latence critique (> 2 s). |

### 3.2. Toasts de Notification Système
Bannières temporaires semi-transparentes (durée : 3 secondes) qui apparaissent au-dessus du lecteur pour expliciter les actions distantes :
* *« Alice a mis la vidéo en pause »*
* *« Bob a avancé la lecture à 05:20 »*
* *« Chloé a chargé une nouvelle vidéo »*
* *« Vous êtes désormais l'hôte du salon »*

---

## 4. Matrice des Interactions & Réponses UI

| Action Utilisateur | Retour UI Immédiat | Notification Distante |
|---|---|---|
| **Clic sur « Copier lien »** | Changement du bouton en `Copié ! ✓` (cyan/vert) pendant 2 s | Aucun |
| **Changement d'URL vidéo** | Affichage d'un indicateur de chargement dans le lecteur | Toast système chez tous les invités + actualisation du lecteur |
| **Clic Pause / Play** | Changement instantané de l'icône du lecteur | Toast système + synchronisation immédiate de l'état |
| **Curseur déplacé (Seek)** | Curseur de lecture mis à jour | Recalage temporel des autres participants |
| **Envoi message chat** | Message affiché instantanément en local | Message poussé en bas du fil de discussion des autres membres |



