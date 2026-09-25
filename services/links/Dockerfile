# ---- deps: production dependencies only (includes the prisma CLI for migrations) ----
FROM node:24-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# ---- build: full deps, compile TS, generate the client ----
FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ENV DATABASE_URL="postgresql://user:password@localhost:5432/db"
RUN npx prisma generate && npm run build
RUN find src/generated/prisma -maxdepth 1 -type f ! -name "*.ts" -exec cp {} dist/generated/prisma/ \;

# ---- runtime ----
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/spec ./spec
COPY package*.json ./
USER node
EXPOSE 3000
CMD ["node", "dist/server.js"]