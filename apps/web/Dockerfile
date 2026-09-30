# syntax=docker/dockerfile:1
# Build context is the repository root (see docker-compose.yml).

FROM node:22-alpine AS build
RUN apk add --no-cache libc6-compat
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY apps/web/package.json apps/web/package-lock.json ./
RUN npm ci
COPY apps/web/tsconfig.json apps/web/next.config.ts ./
COPY apps/web/app ./app
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
# Docker sets HOSTNAME to the container id, which breaks loopback healthchecks. Bind all interfaces explicitly.
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
USER node
EXPOSE 3000
CMD ["node", "server.js"]
