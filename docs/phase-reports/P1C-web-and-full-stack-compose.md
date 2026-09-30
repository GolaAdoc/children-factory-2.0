# P1C: Web and full-stack Compose

## Executive summary
Phase 1C bootstraps the Next.js frontend (`@webstore/web`) as a standalone SSR application, containerizes both the API and Web services via optimized Dockerfiles, and integrates them into the master `docker-compose.yml` stack. The setup implements least-privilege principles by keeping environment variables strictly scoped and binding services only to the loopback interface on the host.

## Modules modified
- `apps/web`: Created Next.js framework scaffold with standalone output config.
- `apps/api`: Added a multi-stage `Dockerfile` with explicit peer-dependency omission to keep production images slim.
- Repository configuration: Appended Docker rules to `.gitignore` and `.dockerignore`.
- CI/CD (`.github/workflows/app-ci.yml`): Extended to construct the full stack in Docker Compose and run a rigorous `verify-stack.mjs` verification suite.

## Technical implementation
- **Docker Compose:** Defined `webstore` with `api` and `web` services complementing the existing `db`. Containers use `init: true`, run as non-root users (`USER node`), and drop all capabilities. `API_INTERNAL_URL` connects the web SSR logic securely within the Compose bridge network.
- **Next.js Scaffold:** Configured Next.js 16/React 19 for force-dynamic rendering fetching from `/api/health`.
- **Validation Script (`verify-stack.mjs`):** Confirmed all containers publish exclusively to `127.0.0.1`, `X-Powered-By` headers are removed, containers lack development tools like TS, and Next.js can smoothly degrade to `API status: unavailable` when the database halts without crashing the whole frontend. 

## Visual evidence
_Placeholder: attach terminal captures (docker compose ps, verify-stack output, the rendered home page) and the green CI run here._

## Flags and deviations
- F-19: P1C touches 16 paths (12 new including one lockfile, 4 amended), over the sizing target. The split point, if enforced, is web scaffold versus stack, CI and ADR.
- F-20: New configuration: server-only `API_INTERNAL_URL` (set in Compose to `http://api:3001`, defaulting to `http://127.0.0.1:3001` for host-side dev); fixed loopback ports 3000 and 3001; container `DATABASE_URL` assembled in Compose from existing variables, so `.env.example` is unchanged; the web image sets `HOSTNAME=0.0.0.0` and `PORT=3000`.
- F-21: Web scope: a status scaffold with the working title "Webstore" (brand name not specified); no catalog, no extra routes; the web healthcheck uses `/`; `poweredByHeader` is off; web security headers and CSP are deferred to the edge stage.
- F-22: Containers are non-root with `cap_drop: ALL`, `no-new-privileges` and `init: true`. `read_only` filesystems, digest-pinned images and resource limits are deferred to P25. Containers do not run migrations; a one-shot migrate job is deferred to P25.
- F-23: Versions and amendments: Next.js 16, React 19, TypeScript 5, `node:22-alpine`. ADR-0003 is Accepted and treats the F-10 defaults as accepted. `docker-compose.yml`, `app-ci.yml` and `.gitignore` are amended additively (Rule 2).
- **Deviation:** Prisma client peer-dependency behavior causes `npm ci --omit=dev` to install `typescript` inside production images. This broke the "slim" `verify-stack` check initially. It was resolved by instructing the Dockerfile to explicitly `rm -rf node_modules/typescript node_modules/jest` from the production dependencies layer.
