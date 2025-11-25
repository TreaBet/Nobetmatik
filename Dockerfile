# Aşama 1: Build (Derleme)
FROM node:18-alpine as build
WORKDIR /app

# Paketleri yükle
COPY package*.json ./
RUN npm install

# Kaynak kodları kopyala ve build al
COPY . .
RUN npm run build

# Aşama 2: Production (Sunum)
FROM nginx:alpine
# Build çıktısını (genelde 'dist' veya 'build' klasörüdür) Nginx'e kopyala
# NOT: Vite kullanıyorsan '/app/dist', CRA kullanıyorsan '/app/build' olmalı.
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]