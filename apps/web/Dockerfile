# ============================================================
#  Energy Copilot AI — Frontend Dockerfile (Next.js 15)
# ============================================================

FROM node:20-alpine AS base
WORKDIR /app

FROM base AS development
# В dev режиме зависимости устанавливаются при запуске
# через volume mount
COPY package*.json ./
RUN npm install
CMD ["npm", "run", "dev"]

FROM base AS builder
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM base AS production
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
CMD ["node", "server.js"]
