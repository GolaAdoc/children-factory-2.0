# ERD — Conceptual (Provisional)

Status: PROVISIONAL

Conceptual model only. Phase 0 introduces no tables, no Prisma models and no migrations. Columns are intentionally omitted (AGENTS.md Rule 1). The phase that introduces an entity defines its columns and records any change here (Rule 2).

```mermaid
erDiagram
    USERS ||--o{ AUTH_IDENTITIES : "has"
    USERS ||--o{ ADDRESSES : "saves"
    USERS |o--o{ CARTS : "may own"
    USERS |o--o{ ORDERS : "may place"
    USERS |o--o{ COMPLAINTS : "files"
    USERS |o--o{ OTP_CHALLENGES : "verifies"
    CATEGORIES ||--o{ PRODUCTS : "groups"
    PRODUCTS ||--o{ PRODUCT_VARIANTS : "has"
    PRODUCTS ||--o{ PRODUCT_IMAGES : "shows"
    CARTS ||--o{ CART_ITEMS : "contains"
    PRODUCT_VARIANTS ||--o{ CART_ITEMS : "selected in"
    ORDERS ||--|{ ORDER_ITEMS : "contains"
    PRODUCT_VARIANTS ||--o{ ORDER_ITEMS : "purchased as"
    ORDERS ||--o{ ORDER_STATUS_HISTORY : "logs"
    ORDERS |o--o{ COMPLAINTS : "concerns"
    ORDERS ||--o{ NOTIFICATION_DELIVERIES : "triggers"
    PRODUCT_VARIANTS ||--o{ STOCK_HOLDS : "reserved by"
```

## Entity register

| Entity | Module | Earliest phase |
|---|---|---|
| CATEGORIES, PRODUCTS, PRODUCT_VARIANTS, PRODUCT_IMAGES | catalog | P2 |
| USERS, AUTH_IDENTITIES | auth | P4 |
| ADDRESSES, CARTS, CART_ITEMS, ORDERS, ORDER_ITEMS, ORDER_STATUS_HISTORY, STOCK_HOLDS | cart / orders | P12 |
| OTP_CHALLENGES, NOTIFICATION_DELIVERIES | auth / notifications | P15 |
| COMPLAINTS | complaints | TBD (OQ-3) |

## Not in Postgres

Refresh-token records live in Redis (ADR 0002, assumption A-1).

## Open questions

- OQ-1: Are guests stored as USERS rows, or is a cart keyed by an anonymous token?
- OQ-2: Is STOCK_HOLDS a table, and does a hold belong to a cart or an order?
- OQ-3: The master context assigns COMPLAINTS to no phase.
