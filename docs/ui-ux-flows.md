# Interface & Design : SYNK

> **Version :** 1.0.0-beta  
> **Style :** Épuré et sombre  
> **Auteur :** Mohmo

---

## 1. Principes de Design

L'interface de SYNK est pensée pour être discrète et fonctionnelle, afin de laisser toute la place à la vidéo :

- **Priorité à la vidéo :** Les boutons et contrôles s'effacent automatiquement après 3 secondes de lecture pour ne pas gêner le visionnage.
- **Lisibilité :** Un fond très sombre avec une touche de couleur vive (Cyan) pour repérer immédiatement les actions importantes.
- **Légèreté :** Une mise en page directe, sans fioritures ni animations superflues, garantissant un affichage instantané.

---

## 2. Couleurs

| Rôle | Couleur | Utilisation |
| :--- | :--- | :--- |
| **Fond global** | Noir (`#000000`) | Arrière-plan général et fond du lecteur vidéo. |
| **Surfaces & Cartes** | Gris foncé (`#09090b` / `#18181b`) | Conteneur principal, volet latéral et tiroirs. |
| **Couleur active (Cyan)** | Cyan (`#0ac8b9`) | Boutons d'action, barre de lecture et logo. |
| **Texte principal** | Blanc (`#f4f4f5`) | Titres et éléments actifs. |
| **Texte secondaire** | Gris clair (`#a1a1aa`) | Horodatages, labels et descriptions. |

---

## 3. Typographie

- **Titres et interface :** `Inter` pour une lecture claire sur tous les écrans.
- **Chiffres et codes :** `Geist Mono` pour aligner les temps de lecture (`04:12 / 10:00`), les codes de salon (`#k8F2mX`) et le ping réseau (`18ms`).

---

## 4. Organisation des Pages

### 4.1. Page d'Accueil (`/`)

Sur grand écran, l'écran d'accueil présente la barre latérale à gauche et le module de connexion au centre :

```text
+-----------------------------------------------------------------------------------------+
| BARRE GAUCHE (Desktop)   |                    CANVAS PRINCIPAL                          |
|                          |                                                              |
| [Logo] SYNK              |                                                              |
|                          |                     Lancer une session                       |
| NAVIGATION               |            Créez un salon instantané et synchronisez         |
| - Accueil                |                     vos vidéos en temps réel.                |
|                          |                                                              |
|                          |                  [ Créer un salon | Rejoindre ]              |
|                          |                                                              |
|                          |          ┌───────────────────────────────────┬───────────┐   |
|                          |          │  Entrez votre pseudo...           │  CRÉER    │   |
|                          |          └───────────────────────────────────┴───────────┘   |
|                          |                                                              |
| PARAMÈTRES               |              [YouTube]  [Twitch: Soon]  [Direct: Soon]       |
| [FR / EN]                |                                                              |
+-----------------------------------------------------------------------------------------+
```

- **Un seul champ de saisie :** Sert à la fois à entrer son pseudo en mode création ou à coller un code en mode rejoindre.
- **Bascule instantanée :** Passage d'un clic entre "Créer" et "Rejoindre".

---

### 4.2. Salon de Visionnage (`/room/:roomId`)

Sur grand écran, la page s'articule en trois parties :

```text
+-----------------------------------------------------------------------------------------+
| BARRE GAUCHE   |                       CANVAS VIDÉO                     | PANNEAU DROIT |
|                |                                                        |               |
| [Logo] SYNK    |  ┌──────────────────────────────────────────────────┐  | [Membres] Chat|
|                |  │                                                  │  |───────────────|
| NAVIGATION     |  │                 Lecteur Vidéo 16:9               │  | Membres (2)   |
| - Accueil      |  │                (ou Dropzone si vide)             │  | - Alice (Hôte)|
|                |  │                                                  │  | - Bob         |
|                |  │ [Play] [04:12 / 10:00] [─────|─────] [Vol] [Max] │  |               |
|                |  └──────────────────────────────────────────────────┘  |               |
|                |                                                        |               |
|                |  Point Vert LIVE  Titre de la vidéo    [CONTRÔLE HÔTE] │───────────────|
|                |  ────────────────────────────────────────────────────  | Wifi 18ms     |
| PARAMÈTRES     |  [RÉGLAGES]  File d'attente (Soon)                     | #k8F2mX       |
| [FR / EN]      |  Option de verrouillage de la salle                    | [ Inviter ]   |
+-----------------------------------------------------------------------------------------+
```

- **Au centre :** Le lecteur vidéo avec commandes en transparence (play, pause, timeline, volume, plein écran) et les informations du média juste en dessous.
- **À droite :** La liste des participants connectés avec leur statut, et en bas le code du salon avec le ping et le bouton pour copier le lien d'invitation.

---

## 5. Adaptation Mobile

L'interface s'adapte automatiquement sans encombrer les petits écrans :

- **Sur ordinateur :** Barre latérale à gauche, lecteur au centre et panneau des membres à droite.
- **Sur mobile et tablette :**
  - La barre de navigation gauche se range derrière un bouton menu discret en haut à gauche.
  - Le panneau des membres s'ouvre d'un geste sous la vidéo via un tiroir coulissant.
  - Le curseur de volume est masqué pour utiliser directement les boutons physiques du smartphone.
