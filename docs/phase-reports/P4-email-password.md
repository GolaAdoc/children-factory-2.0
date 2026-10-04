# Phase 4: Email/password

## Executive summary
This phase implements the initial authentication system with standard email and password credentials. It establishes the `users` table and the `AuthModule`.

## Modules modified
- `apps/api/src/auth` (new module)
- `apps/api/src/app.module.ts` (added AuthModule)
- `apps/api/prisma/schema.prisma` (added User model and UserRole enum)
- `apps/api/test/auth.e2e-spec.ts` (added e2e tests)

## Technical implementation
- Password hashing is implemented using Argon2id.
- JWT access tokens are signed using `@nestjs/jwt`.
- Custom database CHECK constraints and expression indexes ensure data integrity for email casing and risk flags.
- E2E tests enforce strict formatting of error bodies to prevent leaking stack traces or internal details.
- Added `JWT_ACCESS_SECRET` and `JWT_ACCESS_TTL_SECONDS`.

## Visual evidence
<!-- UI placeholder -->
