# Aşama 1: Build (Derleme)
FROM node:18-alpine AS build
LABEL org.opencontainers.image.source="https://github.com/TreaBet/Nobetmatik" \
      org.opencontainers.image.title="Nobetmatik Web" \
      org.opencontainers.image.description="Nobetmatik web arayüzü, Vite + React + Tailwind ile hazırlanmış." \
      org.opencontainers.image.version="17.0.0" \
      org.opencontainers.image.created="2025-11-27" \
      org.opencontainers.image.authors="TreaBet Team"

WORKDIR /app

# Paketleri yükle
COPY package*.json ./
RUN npm install

# Kaynak kodları kopyala ve build al
COPY . .
RUN npm run build

# Aşama 2: Production (Sunum)
FROM nginx:alpine
LABEL org.opencontainers.image.source="https://github.com/TreaBet/Nobetmatik" \
      org.opencontainers.image.title="Nobetmatik Web" \
      org.opencontainers.image.description="Nobetmatik web arayüzü, Nginx üzerinde production için optimize edilmiş." \
      org.opencontainers.image.version="17.0.0" \
      org.opencontainers.image.created="2025-11-27" \
      org.opencontainers.image.authors="TreaBet Team"

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
