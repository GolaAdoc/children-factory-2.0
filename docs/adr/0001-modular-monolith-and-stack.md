# ADR 0001: Modular monolith and stack

## Status
Accepted

## Context
about 100 DAU and about 5 concurrent users; priorities from AGENTS.md; one small VPS.

## Decision
a NestJS modular monolith with modules catalog, cart, orders, auth, complaints and no cross-module table access except via module services. Single instance. Next.js App Router. Postgres 16 with Prisma. Docker Compose on one VPS behind Cloudflare and Nginx. Stage-gated build: P0 to P2 Postgres only, Redis at P3, Nginx and edge at P23 to P25. Abuse controls are sequenced (OTP gating in Stage 5, Cloudflare and Nginx limits in Stage 7).

## Consequences
simple deploys and one process to debug; module boundaries preserve a future extraction path; a single VPS is a single point of failure, accepted at this scale.

## Alternatives rejected
microservices, Kubernetes, serverless functions, each with a one-line reason tied to scale and priority 3.
