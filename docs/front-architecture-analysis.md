# État des Lieux de l'Architecture Front (mankinds-app vs Synk) & Proposition Cible

> **Date :** Mars 2026  
> **Projet de référence analysé :** `mankinds-app/front` (`/home/mohamed/M2DATA/stage/mankinds-app/front`)  
> **Projet cible :** `Synk/front` (`/home/mohamed/M2DATA/Synk/front`)  
> **Auteur :** Antigravity (Pair Programming Architect)

---

## 1. Synthèse de l'Analyse de `mankinds-app/front`

### 1.1. Stack Technique
- **Bundler & Runtime :** Vite 6 + React 19 + TypeScript.
- **Routage :** Client-side SPA via `react-router-dom` v7 (`createBrowserRouter`).
- **Styling & Design System :** Tailwind CSS v4 (`@tailwindcss/vite`), `tw-animate-css`, Radix UI primitives (`@radix-ui/react-*`), Phosphor Icons & Lucide Icons.
- **Gestion d'État :** Zustand v5 avec découpage par domaines (`authStore`, `taskStore`, `sidebarStore`, `copilotStore`, etc.).
- **Data Fetching & Réseau :** Axios (avec instance centralisée `APIClient.ts` et rafraîchissement automatique de token JWT par singleton promise), TanStack React Query v5.
- **Formulaires & Validations :** `react-hook-form`, validation et parsing custom.
- **Internationalisation :** `i18next` + `react-i18next` (FR / EN avec détection de langue et synchronisation profil).

---

### 1.2. Organisation des Dossiers dans `mankinds-app/front/src`

```text
src/
├── components/           # Composants partagés et quelques composants métiers
│   ├── ui/               # 46+ composants atomiques Shadcn UI (Button, Dialog, Card, Tabs, etc.)
│   ├── sidebar/          # Navigation latérale, sélecteur de système
│   ├── copilot/          # Widget interactif Copilot (panneaux, bulles, confirmation)
│   ├── system/           # Onglets de navigation système
│   ├── connection/       # Tiroirs et formulaires de connecteurs
│   ├── risk/             # Tiroirs et cartes de risques
│   ├── description/      # Tiroirs et cartes de description
│   └── *.tsx             # ~30 composants orphelins à la racine (Modals, Guards, Buttons...)
├── views/                # Pages / écrans routés (21 sous-dossiers thématiques)
│   ├── home/             # Vue d'accueil
│   ├── system/           # Vues détaillées d'un système (Overview, Dataset, Risk, etc.)
│   ├── systems/          # Liste des systèmes IA
│   ├── diagnostic/       # Questionnaire et formulaires d'audit
│   ├── authentification/ # Login, Register, Forgot Password...
│   └── ...
├── layouts/              # Gabarits structurels (AppLayout, AuthLayout, ExternalLayout)
├── hooks/                # 28 hooks custom (useSystemAPI, useAuthAPI, useCopilot, etc.)
├── stores/               # 14 stores Zustand (authStore, taskStore, sidebarStore...)
├── services/             # Client HTTP Axios (APIClient.ts) avec gestion du refresh token
├── types/                # Types globaux et spécifiques (global.ts, copilot.ts)
├── i18n/                 # Configuration et traductions i18n
├── utils/                # Fonctions utilitaires pures (dates, organisation, scoring)
└── constants.ts          # Constantes d'environnement, URLs d'API et énumérations
```

---

### 1.3. Points Forts de l'Architecture de `mankinds-app`

1. **Design System robuste et complet (`components/ui/`) :**
   - Basé sur les primitives Radix UI non-stylées, garantissant accessibilité (a11y), navigation au clavier et gestion du focus.
   - Hautement personnalisable via `tailwind-merge` (`cn()`) et `class-variance-authority` (`cva`).
   - 46 composants cohérents (boutons, tiroirs `Sheet`, modales `Dialog`, menus déroulants, infobulles, badges, accordéons).

2. **Système de Tokens Visuels Clair (`App.css` + `tailwind.config.ts`) :**
   - Variables CSS dédiées aux surfaces (`--color-surface-primary`, `--color-surface-dark-*`), typographies (`Geist`, `Geist Mono`), et couleurs d'accent (`--color-mankinds`).
   - Prise en charge native du Dark/Light mode avec variables oklch / hex.

3. **Gestion d'État Réactive et Isolée (Zustand) :**
   - Stores dédiés et découplés (`authStore`, `sidebarStore`, `copilotStore`, `systemCacheStore`).
   - Évite les re-renders massifs grâce aux sélecteurs fins de Zustand (`useCopilotStore(s => s.isOpen)`).

4. **Sécurité et Résilience Réseau (`APIClient.ts`) :**
   - Pattern de rafraîchissement de token JWT avec verrou (`refreshPromise`) empêchant les requêtes concurrentes de provoquer des cascades de déconnexion.

---

### 1.4. Faiblesses et Anti-patterns Observés dans `mankinds-app` (À NE PAS REPRODUIRE)

1. **Vues Monolithiques Énormes :**
   - Fichiers `SystemOverview.tsx` (40 Ko, ~1000 lignes), `SystemEvaluation.tsx` (32 Ko), `SystemDescription.tsx` (31 Ko).
   - Ces vues mélangent orchestration de page, appels d'API directs, états de formulaires multiples et JSX massif sans découpage en sous-composants dédiés.

2. **Frontière floue entre `components/` et `views/` :**
   - `src/components/` contient à la fois des composants réutilisables génériques (`components/ui/`), des composants métiers globaux (`sidebar/`), et des composants très spécifiques à une vue donnée (`components/connection/`, `components/risk/`).
   - Cela fragmente une même fonctionnalité sur 5 dossiers distincts (`src/views/system/`, `src/components/risk/`, `src/stores/riskFormStore.ts`, `src/hooks/useRiskAPI.ts`).

3. **Racine de `components/` encombrée :**
   - Trente composants coexistent en vrac à la racine de `components/` (`ActivationRoute.tsx`, `AddSystemBloc.tsx`, `BuyCreditsDialog.tsx`, `DeleteModal.tsx`, `ErrorBloc.tsx`, `JSONBloc.tsx`, etc.).

---

## 2. Diagnostic Critique du Front Actuel de Synk (`Synk/front`)

### 2.1. Contexte Architectural : Next.js App Router vs Vite SPA
Alors que `mankinds-app` utilise Vite + React Router (SPA classique), **Synk utilise Next.js 14 avec l'App Router**.
Dans Next.js App Router :
- Les dossiers sous `src/app/` définissent les segments d'URL.
- Chaque dossier peut contenir des fichiers conventionnels : `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`.
- Par défaut, les composants sont des **Server Components**, sauf mention explicite de `"use client"`.

---

### 2.2. Analyse du Problème : `src/app/room/[id]/page.tsx`

L'utilisateur a relevé à juste titre :  
> *"Typiquement un exemple que j'ai vu directement à premiere vue, je crois pas que [id] (folder dans front) respecte les best practices."*

L'inspection de `Synk/front/src/app/room/[id]/page.tsx` confirme plusieurs violations majeures des bonnes pratiques :

| Problème identifié | Impact sur le code | Bonne pratique recommandée |
| :--- | :--- | :--- |
| **Monolithe de 400 lignes dans `page.tsx`** | Tout est groupé dans un seul fichier : lecteur vidéo, contrôles de lecture, barre de recherche de média, onglets chat/participants, liste des messages, saisie de chat, ping, verrou d'hôte. | `page.tsx` doit être un orchestrateur minimal ou un point d'entrée passant les paramètres à une vue ou à des sous-composants modulaires. |
| **Logique d'onboarding sauvage (`window.prompt`)** | Ligne 56 : `prompt("Entrez votre pseudo pour rejoindre ce salon :", "")` bloque le thread UI, est inesthétique, non accessible et incompatible avec le design immersif esport. | Remplacer par un composant de dialogue moderne (`JoinRoomDialog` ou `GuestNameModal`) rendu élégamment si aucun pseudo n'est stocké en session. |
| **Absence de Design System partagé** | Tous les boutons, champs de saisie, badges et modales sont écrits avec des chaînes Tailwind inline dupliquées (`bg-zinc-900 border border-zinc-800 ...`). | Importer des briques atomiques réutilisables (`Button`, `Input`, `Badge`, `Tabs`, `Dialog`). |
| **Couplage lourd des états dans un seul hook** | `useSyncRoom` renvoie 12 variables et callbacks qui sont forés en cascade dans le JSX géant sans abstraction. | Introduire un Store Zustand dédié (`useRoomStore`) ou un Context Provider (`RoomProvider`) pour isoler l'état du salon (participants, playback, chat) et éviter les re-renders intempestifs. |
| **Absence d'états de chargement et d'erreur Next.js** | Un `if (!isReady) return <div>CHARGEMENT...</div>` bloque le rendu complet sans exploiter `loading.tsx` ou `Suspense`. | Utiliser `loading.tsx` et des composants skeleton pour une UX fluide. |

---

## 3. Proposition d'Architecture Front pour Synk

Pour allier la **rigueur du Design System de mankinds-app** et les **meilleures pratiques de Next.js 14 App Router**, nous adoptons une **architecture Feature-Driven (modulaire par domaine)**.

### 3.1. Arborescence Cible Recommandée

```text
Synk/front/src/
├── app/                                # ROUTAGE NEXT.JS (Orchestrateurs légers uniquement)
│   ├── layout.tsx                      # RootLayout (polices Geist, métadonnées, Toaster global)
│   ├── globals.css                     # Tokens CSS, styles Tailwind, scrollbars personnalisées
│   ├── page.tsx                        # Page d'accueil (Créer / Rejoindre un salon)
│   ├── room/
│   │   └── [id]/
│   │       ├── page.tsx                # Orchestrateur de salon épuré (< 50 lignes)
│   │       ├── loading.tsx             # Skeleton loader automatique de la room
│   │       ├── error.tsx               # Gestion d'erreur locale (salon introuvable, déconnexion)
│   │       └── not-found.tsx           # Page 404 dédiée
│   └── not-found.tsx                   # Page 404 générale
│
├── components/
│   ├── ui/                             # DESIGN SYSTEM & COMPOSANTS PARTAGÉS (Inspiration mankinds-app)
│   │   ├── button.tsx                  # Boutons (variants: default, primary/cyan, outline, ghost, destructive)
│   │   ├── input.tsx                   # Champ de saisie tech esport
│   │   ├── dialog.tsx                  # Modales (Radix Dialog / Tailwind)
│   │   ├── tabs.tsx                    # Onglets (Chat vs Participants)
│   │   ├── badge.tsx                   # Badges d'état (LIVE, HÔTE, PING, SYNCHRO)
│   │   ├── tooltip.tsx                 # Infobulles d'aide
│   │   ├── slider.tsx                  # Barre de défilement temporelle / volume
│   │   ├── sonner.tsx                  # Notifications Toasts système ultra-légères
│   │   ├── avatar.tsx                  # Avatar utilisateur avec initiales / couleur
│   │   ├── dropdown-menu.tsx           # Menus contextuels (options d'hôte, expulsion, mute)
│   │   └── separator.tsx               # Lignes de séparation fines
│   │
│   └── common/                         # Composants d'interface transverses
│       ├── Navbar.tsx                  # Header universel (Logo, état live, ping, room code)
│       ├── BrandLogo.tsx               # Logo Synk animé
│       └── StatusPill.tsx              # Indicateur d'état réseau / WebSocket
│
├── features/                           # DÉCOUPAGE PAR DOMAINE MÉTIER (Feature-Sliced)
│   ├── home/                           # Logique et composants de la page d'accueil
│   │   ├── components/
│   │   │   ├── CreateRoomCard.tsx      # Formulaire de création instantanée
│   │   │   ├── JoinRoomCard.tsx        # Formulaire avec saisie de code
│   │   │   └── HeroSection.tsx         # Titre, tagline, badges de features
│   │   └── hooks/
│   │       └── useRoomCreation.ts      # Logique HTTP d'appel API /api/v1/rooms
│   │
│   └── room/                           # Logique et composants du salon de visionnage
│       ├── components/
│       │   ├── RoomView.tsx            # Conteneur principal du salon (Layout 2 colonnes)
│       │   ├── RoomHeader.tsx          # Barre supérieure (URL input, partage, verrou)
│       │   ├── VideoStage.tsx          # Conteneur vidéo + surimpression d'état
│       │   ├── VideoPlayer.tsx         # Intégration YouTube IFrame API robuste
│       │   ├── PlaybackControls.tsx    # Barre de contrôle (Play, Pause, Seek, Time, Volume)
│       │   ├── RoomSidebar.tsx         # Panneau latéral (Tabs Chat / Membres)
│       │   ├── ChatPanel.tsx           # Flux des messages + input de chat
│       │   ├── ParticipantsPanel.tsx   # Liste des membres connectés + actions modérateur
│       │   ├── JoinRoomModal.tsx       # Modale d'accueil pour invité sans pseudo (remplace window.prompt)
│       │   └── RoomSettingsModal.tsx   # Options du salon (verrouillage, permissions)
│       ├── hooks/
│       │   ├── useSyncRoom.ts          # Hook WebSocket de synchronisation
│       │   └── useVideoPlayer.ts       # Hook de contrôle précis du player vidéo
│       └── stores/
│           └── roomStore.ts            # Store Zustand pour l'état réactif du salon
│
├── lib/
│   ├── utils.ts                        # Utilitaire `cn()` (clsx + tailwind-merge)
│   └── api.ts                          # Client fetch / axios configuré pour le backend Synk
│
└── types/
    ├── room.ts                         # RoomState, Participant, PlaybackState, RoomSettings
    └── events.ts                       # Événements WebSocket client <-> serveur typés
```

---

## 4. Définition des Composants Partagés & Identité Visuelle (Design System Synk)

Pour conférer à Synk son identité visuelle distincte inspirée du **LoL Esports / Dark Tech**, les composants partagés reposent sur une charte stricte.

### 4.1. Tokens Visuels Fondamentaux

| Propriété | Token | Valeur | Usage |
| :--- | :--- | :--- | :--- |
| **Fond immersif** | `bg-background` | `#09090b` (zinc-950) | Fond de page sombre pour faire ressortir la vidéo |
| **Surfaces / Cartes** | `bg-surface` | `#18181b` (zinc-900) | Panneaux, cartes, sidebar, barres de contrôle |
| **Bordures nettes** | `border-border` | `#27272a` (zinc-800) | Bordures ultra-fines de 1px |
| **Accent Primaire** | `cyan-400` / `cyan-500` | `#22d3ee` / `#06b6d4` | Boutons d'action clé, états actifs, curseurs |
| **Accent Secondaire** | `emerald-400` | `#34d399` | Succès, ping faible, utilisateur synchronisé |
| **Accent Alerte** | `rose-500` | `#f43f5e` | Ping critique, désynchronisation, expulsion |
| **Typographie Corps** | Sans-serif | `Geist`, `Inter`, `sans-serif` | Textes généraux, chat, formulaires |
| **Typographie Tech** | Monospace | `Geist Mono`, `JetBrains Mono` | Pseudos, timecodes, ping, codes de salon, boutons uppercase |
| **Rayon de bordure** | Sharp / Minimal | `0px` ou `2px` (`rounded-none` / `rounded-sm`) | Esthétique esport anguleuse sans bords arrondis mous |

---

### 4.2. Liste des Composants Partagés (`src/components/ui/`)

1. **`Button` (`button.tsx`)** :
   - Basé sur `cva` avec variantes :
     - `primary` : fond cyan-500, texte zinc-950 gras, hover cyan-400, lueur subtile.
     - `secondary` : fond zinc-900, bordure zinc-800, texte zinc-200, hover bg-zinc-800.
     - `outline` : transparent, bordure zinc-800, hover border-cyan-500 hover text-cyan-400.
     - `ghost` : transparent, hover bg-zinc-900.
     - `destructive` : fond red-950/40, bordure red-800, texte red-400.

2. **`Input` (`input.tsx`)** :
   - Fond `bg-zinc-900`, bordure `border-zinc-800`, texte `text-zinc-100 font-mono text-xs`.
   - Focus border cyan-500, sans outline natif.

3. **`Dialog` (`dialog.tsx`)** :
   - Modale centrée avec overlay semi-transparent `bg-black/80 backdrop-blur-sm`.
   - Conteneur `bg-zinc-900 border border-zinc-800` anguleux.
   - Crucial pour remplacer `window.prompt()` par un `JoinRoomModal` professionnel.

4. **`Tabs` (`tabs.tsx`)** :
   - Onglets pour basculer entre **CHAT** et **MEMBRES** dans la sidebar.
   - État actif : soulignement cyan-400 ou fond cyan-500/10 text-cyan-400.

5. **`Badge` (`badge.tsx`)** :
   - `LIVE` (vert clignotant / cyan), `HÔTE` (or ou cyan avec icône couronne), `PING` (indicateur millisecondes).

6. **`Slider` (`slider.tsx`)** :
   - Remplacement de la barre de seek actuelle bricolée en `div` par un slider accessible et contrôlable précisément.

7. **`Sonner` / `Toaster` (`sonner.tsx`)** :
   - Toasts systèmes non-intrusifs pour notifier les événements : *"Alice a mis en pause à 04:15"*, *"Bob a rejoint le salon"*.

8. **`Tooltip` (`tooltip.tsx`)** :
   - Infobulles discrètes pour les boutons d'action (Copier le lien, Verrouiller le salon, Plein écran).

---

## 5. Plan d'Action Exécuté
1. **Socle UI partagé (`components/ui/`) :** `button.tsx`, `input.tsx`, `dialog.tsx`, `badge.tsx`, `tabs.tsx`, `slider.tsx`, `tooltip.tsx`, `sonner.tsx`.
2. **Store d'état réactif (`stores/roomStore.ts`) :** État du salon découplé avec Zustand.
3. **Composants modulaires du salon (`views/room/components/`) :** Extraction de `VideoPlayer`, `PlaybackControls`, `RoomHeader`, `RoomSidebar`, `ChatPanel`, `ParticipantsPanel`, `JoinRoomModal`.
4. **Suppression définitive de `[id]` :** Migration vers Vite + React Router avec route déclarative `/room/:roomId` dans `App.tsx`.

---

## 6. Bilan de la Migration Réussie

La stack de `Synk/front` a été alignée avec succès sur celle de `mankinds-app` :
- **Environnement :** Vite 6 + React 18 + React Router v6 + Tailwind CSS + Radix UI + Zustand + Sonner.
- **Routage :** Propre, déclaratif en code (`<Route path="/room/:roomId" element={<RoomView />} />`).
- **Dossier `[id]` :** Totalement éradiqué.
- **Modale Invité :** `window.prompt()` remplacé par `JoinRoomModal` accessible et stylisé.
- **Compilation :** `tsc -b && vite build` s'exécute en ~3.3s avec 0 erreur.

