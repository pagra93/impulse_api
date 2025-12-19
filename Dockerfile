# ═══════════════════════════════════════════════════════════════════════════
# IMPULSE API - Dockerfile para Coolify
# ═══════════════════════════════════════════════════════════════════════════

FROM node:20-alpine

# Crear directorio de la app
WORKDIR /app

# Copiar package.json y package-lock.json
COPY package*.json ./

# Instalar dependencias
RUN npm ci --only=production

# Copiar código fuente
COPY . .

# Compilar TypeScript
RUN npm run build

# Exponer puerto
EXPOSE 3000

# Comando de inicio
CMD ["npm", "start"]

