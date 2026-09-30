# syntax=docker/dockerfile:1
# Build context is the repository root (see docker-compose.yml).

FROM node:22-alpine AS base
# Prisma's query engine needs OpenSSL on Alpine.
RUN apk add --no-cache openssl
WORKDIR /app

FROM base AS build
COPY apps/api/package.json apps/api/package-lock.json ./
RUN npm ci --ignore-scripts
COPY apps/api/prisma ./prisma
COPY apps/api/tsconfig.json ./
COPY apps/api/src ./src
RUN npm run generate && npm run build

FROM base AS prod-deps
COPY apps/api/package.json apps/api/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && rm -rf node_modules/typescript node_modules/jest

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/dist ./dist
COPY apps/api/package.json ./package.json
USER node
EXPOSE 3001
CMD ["node", "dist/main.js"]
