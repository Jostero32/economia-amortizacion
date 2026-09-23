FROM node:20-alpine

WORKDIR /app

# Instalar dependencias
COPY package*.json ./
RUN npm install --production

# Copiar código fuente
COPY . .

# Crear carpeta uploads y asegurar permisos
RUN mkdir -p uploads

EXPOSE 8080

CMD ["node", "src/server.js"]
