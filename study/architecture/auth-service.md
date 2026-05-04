# auth-service

> OAuth 2.0 server. Issues access / refresh tokens, manages OAuth applications + clients, handles authorize / revoke flows. PHP / Lumen.

Repo: `~/Desktop/git/auth-service`. ✅ Verified unless tagged otherwise.

---

## What it does

Powers `auth.razorpay.com`. The standard OAuth 2.0 authorization-code + client-credentials flows for both end-user merchants and machine-to-machine partner integrations. The `tally` flow at `/authorize/tally` is a Razorpay-specific embedded variant used for Tally accounting integration.

Crucially, **partnerships** depends on this — partner OAuth apps issue tokens that grant programmatic access to a sub-merchant's account.

---

## Stack

- PHP 8.2 / **Laravel Lumen 11.0** (micro-framework)
- Single routes file: `routes/web.php` (~210 lines)
- Domain library: `razorpay/oauth` v7.0.3 from a `oauth_dualwrite` branch — the actual OAuth grant + persistence logic lives there

---

## Where things are

| Concern | Location |
|---|---|
| All routes | `routes/web.php` |
| Controllers | `app/Http/Controllers/{Auth,Token,Application,Client}Controller.php` |
| Models | `app/Models/` (Auth, Token, Admin) |
| Custom exceptions | `app/Exception/` (18 types) |
| Middleware chain | `Metrics → EventTracker → ErrorHandler` (JWT-based stateless auth) |

---

## API surface (✅ verified)

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/v1/token` | Standard access token + v2 client credentials |
| `GET / POST / DELETE` | `/authorize` | Authorization-code flow |
| `POST` | `/revoke`, `/v2/revoke` | Token revocation |
| `GET / POST / DELETE` | `/authorize-multi-token` | Multi-token auth |
| `POST` | `/authorize/tally`, `/tokens/tally` | Tally accounting native integration |

Plus admin endpoints for application + client management (typical OAuth admin surface).

---

## Stores

| Store | Role |
|---|---|
| MySQL 5.7 | Primary — token + application + client persistence |
| Redis | Signer cache (token signature material) |

The MySQL schema and the actual grant logic live inside `razorpay/oauth` (vendored), not in this repo. To inspect token shape, refer to that package's models.

---

## Sync calls out

| Service | Why |
|---|---|
| EdgeService | Sync tokens to Cassandra + Postgres (Spine Edge) — keeps the `edge` data plane primed for fast token validation |
| DCS | Feature flags via RazorX |
| Raven | Transactional emails (token issued, etc.) |
| api.php | Notify merchants on OAuth events |
| Segment | Analytics |

---

## Async

`razorpay/outbox-php` library is used to publish audit events to Kafka (the DataLake services consume these). No Kafka topic strings cited inline in this repo — they're conventionalized inside the outbox-php library.

---

## Where partnerships intersects

Partner OAuth apps are managed here. When a partner gets an access token to act on a sub-merchant's behalf:
1. The partner registers an OAuth Application here.
2. End-user (sub-merchant) goes through `/authorize` flow.
3. Token is issued — bound to (partner client_id, sub-merchant user_id).
4. Subsequent api calls from the partner carry this token.
5. Edge / Kong validates the token (using the synced cache from Spine Edge).

The partnerships service itself doesn't typically call auth-service directly — it relies on the standard token validation done at the Edge layer.

---

## Failure Modes & Recovery

| Failure | Behavior | Recovery |
|---|---|---|
| MySQL down | Token issuance fails; existing valid tokens still verify against Edge cache | Read-replica auto-failover; cached tokens keep working |
| Redis down (signer cache) | Token signing falls back to per-request key derivation | Slower but functional |
| EdgeService sync fails | Token issued but not yet usable at the Edge | Retry path inside `razorpay/oauth`; token usable after sync catches up. ❗ Lag observability lives in EdgeService, not here |
| Token revocation race | Standard OAuth — revoked tokens may briefly remain accepted at Edge until cache invalidates | Edge cache TTL governs — typically short |

---

## Confidence

- ✅ Routes, framework, dependency list (composer.json), middleware chain.
- ⚠️ Inferred: the precise token-cache invalidation timing at Edge — that lives in `edge/` and `goutils/cache`, not here.
- ❗ MySQL schema isn't directly in this repo; it's inside the `razorpay/oauth` library.
