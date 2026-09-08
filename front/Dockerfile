FROM node:20-alpine

WORKDIR /app

# Copie des définitions de dépendances
COPY package.json package-lock.json* ./

# Installation propre des dépendances (y compris Vite)
RUN npm install

# Copie du code source
COPY . .

EXPOSE 3000

ENV PORT=3000 \
    HOSTNAME="0.0.0.0"

# Démarrage du serveur Vite en mode développement
CMD ["npm", "run", "dev"]
