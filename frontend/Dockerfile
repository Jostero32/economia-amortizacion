# =========================
# Build
# =========================
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

ARG VITE_BASE_PATH
ARG VITE_API_URL

ENV VITE_BASE_PATH=$VITE_BASE_PATH
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build


# =========================
# Production
# =========================
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html

ARG VITE_BASE_PATH

COPY nginx.conf /etc/nginx/conf.d/default.conf

# Inserta el prefijo público en nginx.conf (sin barra final).
# Sin prefijo se eliminan esas reglas para no crear un bucle de rewrite.
RUN BASE_PATH="${VITE_BASE_PATH%/}"; \
    if [ -n "$BASE_PATH" ]; then \
      sed -i "s#__BASE_PATH__#${BASE_PATH}#g" /etc/nginx/conf.d/default.conf; \
    else \
      sed -i '/# BEGIN_BASE_PATH/,/# END_BASE_PATH/d' /etc/nginx/conf.d/default.conf; \
    fi \
    && nginx -t

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]