# Synk — Synchronisation Vidéo Collaborative Temps Réel

Synk est une plateforme de watch party permettant à des utilisateurs distants de regarder des vidéos en parfaite synchronisation temporelle (précision < 200 ms).

---

## 🚀 Démarrage Rapide avec Docker Compose

L'ensemble de la stack (**Frontend Next.js**, **Backend FastAPI** et **Redis**) se lance en une seule commande :

```bash
# Démarrer tous les services en arrière-plan
docker compose up -d

# Voir les logs en direct de tous les services
docker compose logs -f

# Arrêter tous les services
docker compose down
```

### Services disponibles :

| Service | Rôle | URL | Port |
| :--- | :--- | :--- | :--- |
| **Frontend** | Application Web Next.js 14 (Hot Reload) | [http://localhost:3000](http://localhost:3000) | `3000` |
| **Backend** | API FastAPI & WebSocket (Hot Reload) | [http://localhost:8000](http://localhost:8000) | `8000` |
| **Swagger** | Documentation interactive de l'API | [http://localhost:8000/docs](http://localhost:8000/docs) | `8000` |
| **Redis** | Base in-memory & Pub/Sub multi-workers | `localhost:6379` | `6379` |

---

## 🛠️ Développement Local (sans Docker)

### Backend :
```bash
cd back
uv sync
PYTHONPATH=src uv run pytest          # Lancer les tests unitaires et d'intégration
PYTHONPATH=src uv run uvicorn main:app --reload --port 8000
```

### Frontend :
```bash
cd front
npm install
npm run dev                           # Démarrer sur http://localhost:3000
npm run build                         # Valider la compilation
```
