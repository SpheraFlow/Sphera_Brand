FROM node:20-bookworm AS deps
WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma
COPY scripts ./scripts
RUN npm ci
RUN npx prisma generate

FROM deps AS development
ENV NODE_ENV=development
EXPOSE 3001
CMD ["npm", "run", "dev"]

FROM deps AS builder
COPY . .
RUN npm run build

FROM node:20-bookworm AS production
WORKDIR /app

RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser

COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

ENV NODE_ENV=production
USER appuser
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/health || exit 1

CMD ["node", "dist/src/server.js"]
