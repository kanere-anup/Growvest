# Redis at Razorpay

> What Redis is actually used for across services. Connection roles, TTL conventions, key patterns.

Redis at Razorpay is used for four distinct concerns: **caching, distributed locking, session storage, and rate limiting**. Different services use it differently; the configs make this clear.

---

## Roles

| Role | Where | Why |
|---|---|---|
| **Distributed mutex** | partnerships, ledger, settlements, pg-router, route | Idempotency on Kafka consumers + concurrent business operations |
| **Cache** | Every service | Reduce DB pressure on hot reads (merchant config, pricing rules, etc.) |
| **Session / token cache** | api, dashboard, auth-service | OAuth token signer cache, browser session state |
| **Rate limiting** | edge (Kong), pg-router | Per-merchant request throttling, OTP rate limits |
| **Queue (occasional)** | stork (local dev) | SQS substitute in dev environment |

---

## API monolith (✅ verified)

Most aggressive Redis user.

```php
// api/config/cache.php:63-95 (✅ verified)
// Multiple stores defined, each backed by a different Redis cluster:
'mutex_redis'         // distributed locks
'throttle'            // rate limit
'secure'              // PCI-scope cache
'query_cache_redis'   // SQL query result cache
'session_redis_v2'    // browser session state
```

```php
// api/config/database.php:743-863 (✅ verified)
// 5+ Redis cluster definitions:
'default', 'query_cache', 'mutex', 'session', 'session_v2', 'throttle', 'entity_origin'

// Connection params:
//   persistent: true
//   timeout: 1-5s
//   read_write_timeout: 1s
```

The `entity_origin` connection is interesting — it caches the merchant→entity-source mapping that the Spine system uses for routing reads.

There's also a `lag_check` driver (`api/config/database.php:71-72`) that uses Redis to flag the read replica's `MASTER_PERCENT` — it controls whether reads go to writer or reader based on replication lag.

---

## pg-router (✅ verified)

```toml
# pg-router/config/default-live.toml:541-548 (✅ verified)
[Cache]
driver = "redis"
mode = "standalone"
host = "qa.cache.np.razorpay.vpc"
port = 6379
database = 0

# config/default-live.toml:357-360 (OffersEngineSDK)
mode = "cluster"
host = "cluster.cache.np.razorpay.vpc:6379"
```

Two distinct Redis instances — standalone for general cache, cluster for the OffersEngineSDK (higher throughput needed).

---

## partnerships (✅ verified)

Mutex is the dominant role.

```go
// partnerships/internal/provider/mutex/mutex.go:26-35 (✅ verified)
// Mutex client with Redis datastore
// TTL: 60s per goutils/mutex v2
```

Cache TTLs are short (5 minutes for invoice cache and ledger expression cache). Key patterns:
- `prts:cc:<payment_id>` — commission creation mutex (60s TTL)
- `prts:invoice_after_id` — batch job cursor (3-hour TTL, see `batch_jobs/commission_invoice_generate.go:21`)

---

## dashboard (✅ verified)

```php
// dashboard/config/cache.php:59-68 (✅ verified)
// Two stores: 'default' and 'session_redis'
// Session uses an explicit session connection (not the default cache)
```

Lighter usage — mostly session state for the merchant browser.

---

## Other services (briefly)

- **auth-service**: Redis caches token signing material (`signer cache` per service README).
- **dcs**: Redis as a cache layer in front of Aurora — and for v1 feature flags before they were migrated to Aurora-backed v2.
- **stork**: Suppression lists (don't-send-email-to-this-address registry) and per-channel rate limiting.
- **route**: Redis for cache + mutex (`go.mod` includes go-redis).
- **ledger**: Mutex + cache (`goutils/mutex`, `redis-go`). The `(transactor_id, transactor_event)` mutex on journal create lives here.

---

## Connection topology

Razorpay has multiple Redis clusters for separation of concerns. Common host patterns:
- `qa.cache.np.razorpay.vpc` — non-prod cache cluster
- `cluster.cache.np.razorpay.vpc` — non-prod cluster-mode (for higher-throughput services)
- `*.prod.razorpay.vpc` — prod equivalents (in env-specific configs)

The "np" stands for non-prod. Prod hosts will follow the same `<role>.cache.<env>.razorpay.vpc` pattern.

---

## TTL conventions

✅ Verified across services:

| Use | TTL |
|---|---|
| Distributed mutex (commission creation, journal create, etc.) | 60 seconds |
| Pre-signed S3 URLs (invoice download) | 15 minutes (`partnerships/internal/commissions/commission_invoice/core.go:57`) |
| Batch cursor (invoice batch job) | 3 hours |
| Domain caches (merchant config, pricing) | typically 5 minutes |
| Session state | hours-to-days (depending on session config) |
| Token signer cache | matches token TTL |
| pg-router DynamoDB TTL (not Redis but adjacent) | 30 days (2,592,000s) |

---

## Failure Modes

| Failure | Behavior | Recovery |
|---|---|---|
| Redis unreachable for cache | Cache miss → service falls back to DB. Slower but functional. | Self-healing on Redis recovery |
| Redis unreachable for mutex | Two patterns observed: (a) **fail-open** — proceed without lock (rare, dangerous); (b) **fail-closed** — return error to caller. The default in `goutils/mutex` is fail-closed for safety. | Self-healing on recovery |
| Redis cluster failover | Reads briefly fail; standby promotes within seconds | Standard Redis sentinel / cluster failover |
| Mutex TTL expires before retry | Second attempt sees no lock → may create duplicate. **This is the partnerships commission-creation theoretical risk** (see `partnerships/03_commission_engine_overview.md` §Failure Modes). | Job-level idempotency would close it; current state relies on Kafka delivery semantics |
| Session Redis down | Users log out; degraded UX | Warm cache miss is acceptable for sessions |

---

## Key invariants

- **Same Redis cluster ≠ same logical use.** The same Redis instance often serves multiple `database` numbers (the `database = 0` in pg-router config) for distinct purposes. Don't assume key-name uniqueness across services.
- **No service should rely on Redis for durability.** Everything in Redis is rebuildable from MySQL / Postgres / DynamoDB. If Redis is wiped, services degrade but recover.
- **Mutex TTLs are short by design.** A long TTL would block legitimate retries during a process crash. 60s is the platform default for business-key locks.

---

## Confidence

- ✅ Verified: api config (cache.php, database.php), pg-router config TOML, partnerships mutex code + key patterns, dashboard config, TTL constants for invoices.
- ⚠️ Inferred: prod Redis cluster hostnames (cited values are non-prod); fail-closed default behavior of goutils/mutex.
- ❗ Needs verification: which `database = N` is in use for which logical workload across services.
