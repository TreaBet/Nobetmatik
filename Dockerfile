# Aşama 1: Build (Derleme)
FROM node:22-alpine AS build

WORKDIR /app

# Paketleri yükle
COPY package*.json ./
RUN npm install

# Kaynak kodları kopyala ve build al
COPY . .
# TypeScript kontrolünü (tsc) atlayıp direkt build almak için:
RUN npx vite build

# Aşama 2: Production (Sunum)
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
