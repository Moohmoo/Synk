FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app/src

WORKDIR /app

# Installation de curl pour les healthchecks
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copie binaire uv ultra-rapide
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

# Copie des définitions de dépendances
COPY pyproject.toml ./

# Installation des dépendances dans l'environnement système du container
RUN uv pip install --system -r pyproject.toml

# Copie du code source
COPY . .

EXPOSE 8000

# Démarrage avec prise en compte du port dynamique (Render/Cloud ou 8000 par défaut)
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
