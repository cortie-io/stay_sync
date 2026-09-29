# stay-sync-frontend — Next.js production build. Replaces the old systemd `next dev` unit.
# NEXT_PUBLIC_* values are inlined at build time, so .env.local is copied into the builder stage.
FROM node:22-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx next build

FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.mjs ./next.config.mjs

EXPOSE 5173
CMD ["npx", "next", "start", "-p", "5173"]
