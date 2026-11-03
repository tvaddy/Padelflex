FROM node:20-alpine
WORKDIR /app

# Nødvendige biblioteker for Alpine / Prisma
RUN apk add --no-cache openssl libc6-compat

# Kopier avhengigheter og installér
COPY package*.json ./
COPY prisma ./prisma/
RUN npm install

# Kopier kildekode, generér Prisma Client og bygg Next.js
COPY . .
RUN npx prisma generate
RUN npm run build

# Opprett datamappe for SQLite-volum
RUN mkdir -p /app/data

ENV NODE_ENV=production
EXPOSE 3000

# Kjører db push for SQLite og starter appen
CMD ["sh", "-c", "npx prisma db push && npm start"]
