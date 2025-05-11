FROM node:18-alpine

WORKDIR /usr/src/app

# Copia manifesti
COPY package*.json ./

# Installa dipendenze di produzione
RUN npm install --omit=dev --legacy-peer-deps

# Copia il resto del codice
COPY . .

# Build dell'applicazione
RUN npm run build

# Avvia app
CMD ["node", "dist/main"]