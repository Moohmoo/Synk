# Synk — Backend API

Backend asynchrone haute performance pour la synchronisation multimédia temps réel (WebSockets + Redis).

## 🚀 Démarrage rapide avec `uv`

### 1. Installation des dépendances
```bash
uv sync
```

### 2. Configuration d'environnement
```bash
cp .env.example .env
```

### 3. Lancement du serveur de développement
```bash
uv run uvicorn main:app --app-dir src --reload --port 8000
```

## 🧪 Tests & Qualité de code
```bash
# Exécuter les tests
uv run pytest

# Linter le code
uv run ruff check .
```

## 📦 Gestion des dépendances
```bash
# Ajouter une dépendance
uv add <nom_du_package>

# Ajouter une dépendance de développement
uv add --dev <nom_du_package>
```
