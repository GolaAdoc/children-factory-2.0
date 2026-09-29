# Auth Flow

Status: PROVISIONAL

Note: The diagrams describe the target state. Redis arrives at Stage 1.

```mermaid
sequenceDiagram
    participant C as Browser (Next.js)
    participant A as API (NestJS)
    participant P as PostgreSQL
    participant R as Redis

    Note over C,R: Block 1: Email and password sign-in
    C->>A: submit email and password
    A->>P: load user and password hash
    A->>A: verify Argon2id
    alt invalid case
        A-->>C: generic 401
    else valid case
        A->>R: store refresh record
        A-->>C: access JWT and refresh token
    end
```

```mermaid
sequenceDiagram
    participant C as Browser (Next.js)
    participant A as API (NestJS)
    participant P as PostgreSQL
    participant R as Redis
    participant G as Google

    Note over C,G: Block 2: Google OAuth
    C->>A: start Google sign-in
    A-->>C: redirect to Google
    C->>G: consent
    G-->>C: redirect with code
    C->>A: return code
    A->>G: exchange code
    G-->>A: identity token
    A->>P: find or create user and identity
    A->>R: store refresh record
    A-->>C: access JWT and refresh token
```

```mermaid
sequenceDiagram
    participant C as Browser (Next.js)
    participant A as API (NestJS)
    participant P as PostgreSQL
    participant R as Redis

    Note over C,R: Block 3: Guest session
    C->>A: request guest session
    A->>P: create guest principal (see OQ-1)
    A-->>C: guest access JWT
    Note over A: No Redis refresh record is created
```

```mermaid
sequenceDiagram
    participant C as Browser (Next.js)
    participant A as API (NestJS)
    participant P as PostgreSQL
    participant R as Redis

    Note over C,R: Block 4: Refresh and logout
    C->>A: present refresh token
    A->>R: look up refresh record
    alt Redis unavailable
        A-->>C: 503 refresh unavailable, fail closed
    else record missing or expired
        A-->>C: 401 re-authenticate
    else record valid
        A->>R: rotate record
        A-->>C: new access JWT and refresh token
    end

    C->>A: logout
    A->>R: delete refresh record
    A-->>C: ok
```

## Assumptions

- A-1: Refresh tokens are stored only in Redis. On a Redis outage, refresh fails closed and users re-authenticate. Postgres-backed reads are unaffected. Requires owner confirmation before P3/P4.
- A-2: Only a hash of the refresh token is stored in Redis (proposed; finalized in P4).
- A-3: Access-JWT validation is stateless and never queries Redis, so a Redis outage does not break authenticated requests for Postgres-backed data (Rule 6).
