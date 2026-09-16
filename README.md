# SYNK — Synchronisation Multimédia en Temps Réel

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg?logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-61dafb.svg?logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6.2-646cff.svg?logo=vite)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38b2ac.svg?logo=tailwind-css)](https://tailwindcss.com/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688.svg?logo=fastapi)](https://fastapi.tiangolo.com/)
[![Python](https://img.shields.io/badge/Python-3.12-3776ab.svg?logo=python)](https://www.python.org/)
[![Redis](https://img.shields.io/badge/Redis-7.0-dc382d.svg?logo=redis)](https://redis.io/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ed.svg?logo=docker)](https://www.docker.com/)

> **Elevator Pitch :** Synk est une Web App SaaS de synchronisation multimédia ultra-rapide permettant à plusieurs utilisateurs distants de visionner des flux vidéo en parfaite cohérence temporelle (< 200 ms d'écart), sans inscription, sans extension de navigateur et sans publicité.

---

## ⚡ Fonctionnalités Clés

* **Synchronisation chirurgicale (< 200 ms) :** Algorithme d'extrapolation temporelle avec compensation de l'horloge réseau (formule SNTP / RFC 4330).
* **Multi-fournisseurs (Strategy Pattern) :** Support natif de YouTube, Twitch, Vimeo et flux directs (MP4 / HLS).
* **Contrôle d'accès granulaire :** Mode Hôte exclusif (contrôles verrouillés) ou Mode Collaboratif libre.
* **Résilience & Présence temps réel :** WebSockets bidirectionnels, monitoring du ping individuel, détection de déconnexion et transfert d'hôte automatique.
* **Zéro friction :** Salons éphémères créés en 1 clic, persistance locale de session (`sessionStorage`/`localStorage`), partage direct par URL.
* **Architecture Mobile-first :** Interface adaptative conçue pour smartphones, tablettes et écrans larges avec tiroirs rétractables (*Sheets*).

---

## 🏗️ Architecture Globale

```text
[ Client Web (React 18 / Vite / Tailwind) ]
                     │
                     │  HTTP REST (Création / État)
                     │  WebSocket Socket.IO (Sync bidirectionnelle)
                     ▼
       [ Backend API (FastAPI / Asynchrone) ]
                     │
         ┌───────────┴───────────┐
         ▼                       ▼
  [ Redis Key-Value ]     [ Redis Pub/Sub ]
 (État salon, TTL 2h)    (Diffusion multi-workers)
```

---

## 🚀 Guide de Démarrage Rapide (Quickstart)

### Prérequis
* Docker & Docker Compose **OU** Node.js 20+ et Python 3.12+ avec `uv`.

### Option A : Lancement immédiat via Docker Compose (Recommandé)

```bash
# 1. Cloner le dépôt
git clone https://github.com/Moohmoo/Synk.git
cd Synk

# 2. Démarrer l'ensemble des conteneurs (Redis, Backend FastAPI, Frontend Vite)
docker compose up -d

# 3. Consulter les logs en direct
docker compose logs -f
```

**Services disponibles :**
* 🌐 **Frontend Web :** [http://localhost:3000](http://localhost:3000)
* ⚙️ **Backend API :** [http://localhost:8000](http://localhost:8000)
* 📖 **Swagger / OpenAPI :** [http://localhost:8000/docs](http://localhost:8000/docs)
* 🧠 **Redis Server :** `localhost:6379`

---

### Option B : Développement Local (Sans Docker)

#### 1. Backend (Python / FastAPI)
```bash
cd back
uv sync                                               # Installation des dépendances avec uv
PYTHONPATH=src uv run uvicorn main:app --reload --port 8000
```

#### 2. Frontend (React / Vite)
```bash
cd front
npm install                                           # Installation des dépendances
npm run dev                                           # Serveur de développement sur http://localhost:3000
```

#### 3. Exécution des Tests
```bash
# Tests unitaires & intégration Backend (Pytest)
docker exec synk-back /app/.venv/bin/pytest
# Ou en local :
cd back && PYTHONPATH=src uv run pytest

# Compilation et vérification TypeScript Frontend
cd front && npm run build
```

---

## 📚 Documentation Technique

L'intégralité des spécifications techniques et guides d'architecture est centralisée dans le dossier [`/docs`](./docs/) :

1. [**PRD (Product Requirements Document)**](./docs/PRD.md) : Vision produit, public cible, périmètre MVP vs V2.
2. [**Spécifications UI/UX & Design**](./docs/ui-ux-flows.md) : Charte *Minimalisme Mécanique*, palette Zinc/Cyan, ergonomie *Floating Island*.
3. [**Spécifications Techniques**](./docs/tech-specs.md) : Justifications de la stack, Redis schema, contrats d'API.
4. [**Architecture Frontend**](./docs/front-architecture.md) : Organisation modulaire, routing, gestion d'état Zustand.
5. [**Algorithme de Synchronisation**](./docs/core-sync-algorithm.md) : Horloge de référence, compensation du ping, machine d'état.

---

## 📄 Licence

Ce projet est sous licence MIT. Consultez le fichier [LICENSE](./LICENSE) pour plus de détails.
