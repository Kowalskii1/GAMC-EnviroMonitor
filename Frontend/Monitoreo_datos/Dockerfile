# Stage 1: Build
FROM node:22-alpine AS builder

# Carpeta de trabajo
WORKDIR /app

# Copiar package.json y package-lock.json
COPY package*.json ./

# Instalar dependencias
RUN npm ci

# Copiar todo el código fuente
COPY . .

# Construir la app para producción
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:stable-alpine

# Eliminar contenido default
RUN rm -rf /usr/share/nginx/html/*

# Copiar la build desde el stage anterior
COPY --from=builder /app/dist /usr/share/nginx/html

# Exponer puerto 80
EXPOSE 80

# Ejecutar Nginx en primer plano
CMD ["nginx", "-g", "daemon off;"]
