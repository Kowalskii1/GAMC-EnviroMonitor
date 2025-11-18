# Stage 1: Build
FROM node:18-alpine AS builder

WORKDIR /app

# Copiar package.json y package-lock.json desde la misma carpeta
COPY package*.json ./

# Instalar dependencias de producción
RUN npm ci --production

# Copiar todo el código fuente
COPY . .

# Stage 2: Producción ligera
FROM node:18-alpine

WORKDIR /app

# Copiar node_modules y código
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app ./

EXPOSE 3000

# Archivo principal correcto
CMD ["node", "server.js"]
