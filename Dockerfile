# ==========================================
# STEG 1: Installer avhengigheter
# ==========================================
FROM node:22-alpine AS deps
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci

# ==========================================
# STEG 2: Bygg kildekode og generer standalone
# ==========================================
FROM node:22-alpine AS builder
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production
ENV DATABASE_URL="file:/app/data/padel.db"

RUN npx prisma generate
RUN npm run build
RUN cp -r public .next/standalone/ && cp -r .next/static .next/standalone/.next/

# ==========================================
# STEG 3: Kjøretidsbilde (Runner)
# ==========================================
FROM node:22-alpine AS runner
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app

ENV NODE_ENV=production
ENV TZ=Europe/Oslo
ENV DATABASE_URL="file:/app/data/padel.db"
ENV PORT=3000

# Opprett dedikert datamappe for SQLite-volum
RUN mkdir -p /app/data

# Kopier Prisma-skjema og avhengigheter for 'prisma db push'
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Kopier Next.js standalone-bygg og statiske filer
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

# Synkroniser databasestrukturen og start Standalone-serveren
CMD ["sh", "-c", "npx prisma db push && node server.js"]

