# ---- deps: production dependencies only ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# ---- build: full deps, compile TS, generate the client, migrate a local db ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ENV DATABASE_URL="file:./dev.db"
RUN npx prisma generate && npm run build
RUN find src/generated/prisma -maxdepth 1 -type f ! -name "*.ts" -exec cp {} dist/generated/prisma/ \;
RUN npx prisma migrate deploy

# ---- runtime: prod deps + compiled output + a ready-to-use SQLite db ----
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV DATABASE_URL="file:./dev.db"
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/spec ./spec
COPY package*.json ./
EXPOSE 3000
CMD ["node", "dist/server.js"]