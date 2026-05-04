# edge

> Razorpay's API gateway. Kong / OpenResty (Lua) with 20+ custom plugins for auth, rate limiting, geo-routing, CSRF, JWT, and consumer identification.

Repo: `~/Desktop/git/edge`. Lua / OpenResty / Kong API Gateway.

---

## What it does

Every external HTTP request to Razorpay terminates at edge. It handles:
- TLS termination (upstream of edge in actual prod path)
- Routing to the right backend service (api / pg-router / partnerships / etc.)
- Authentication enforcement (OAuth tokens, API keys)
- Authorization policy (via `kong-plugin-authz-enforcer` gRPC checks)
- Rate limiting
- Geo-routing (per-country traffic placement)
- Idempotency consumer identification
- WAF / security plugins

The actual route definitions are NOT in this repo — they're in **`terraform-kong`** (see `deployment/terraform_kong.md`). edge ships the **plugins**, terraform-kong ships the **routes that use them**.

---

## Repo structure (✅ verified)

| Dir | Purpose |
|---|---|
| `kong-plugins/` | 20+ custom Kong plugins (Lua) |
| `kong-pongo/` | Kong plugin test framework |
| `kong-utils/` | Shared utilities |
| `konga/` | Kong admin UI |
| `GeoLite2-Country.mmdb` | MaxMind GeoIP database (for geo-routing) |
| `kong.conf` | Kong base configuration |

---

## Notable plugins

✅ Verified by directory presence in `kong-plugins/`:

| Plugin | What it does |
|---|---|
| `kong-plugin-authz-enforcer` | gRPC-based authorization policy check (against an external authz service) |
| `kong-plugin-consumer-identification` | Idempotency-key handling — identifies request consumers and short-circuits duplicates |
| `kong-plugin-geo-router` | Routes traffic by client country (uses GeoLite2 mmdb file) |
| Plus: auth, JWT, CSRF, logging, rate-limiting, security plugins | Standard Kong-style plugin chain |

The exact list (~20+) is enumerable by `ls kong-plugins/`. Each plugin has its own folder with `handler.lua`, `schema.lua`, and tests.

---

## Stack

- **OpenResty** (nginx + LuaJIT)
- **Kong** as the framework
- **PostgreSQL** as Kong's internal config DB (Kong default; not Razorpay-specific)
- **Redis** (optional, for rate-limiting state)

---

## How it integrates with the rest of the platform

| Touch point | Where |
|---|---|
| Token validation | Reads from Edge cache (data plane) populated by `auth-service` |
| Authz checks | Calls authz service via gRPC plugin |
| Rate limiting | Reads merchant rate limits from DCS (likely; standard Razorpay pattern) |
| Geo-routing | Local mmdb read; stateless |
| Logging | Forwards to Coralogix / Datadog / standard log sink |

The route definitions in `terraform-kong/prod/*.tf` reference these plugins by name — terraform applies them per-service-route.

---

## Failure Modes & Recovery

| Failure | Behavior | Recovery |
|---|---|---|
| Plugin Lua error | Kong logs + may reject request depending on plugin's failure mode | Each plugin has `enabled = true/false` config in terraform-kong; can be force-disabled |
| Authz gRPC unreachable | Depending on plugin config — fail-closed (reject request) or fail-open (let through with logging) | Failure mode is per-route in terraform-kong; standard practice is fail-open for non-critical, fail-closed for sensitive |
| Kong PostgreSQL unreachable | Existing in-memory config keeps serving; **no new config can be applied** | Kong's data-plane isolation; control-plane recovers when DB returns |
| Redis (rate-limit) unreachable | Rate limits not enforced (depends on plugin config); requests pass through | Self-healing |
| GeoLite2 file outdated | Geo-routing decisions based on stale IP→country map | Periodically refreshed; out-of-date is a soft issue |

---

## Where this fits in the system map

Refer to [`architecture/system_map.md`](system_map.md) §2:

```
external HTTP → edge (Kong) → {api, pg-router, partnerships, dashboard, ...}
```

Every doc in this knowledge base that mentions "the request hits Edge" is talking about this repo + the Kong instance(s) it deploys.

---

## Confidence

- ✅ Verified: directory structure, listed plugin names, presence of GeoLite2 file.
- ⚠️ Inferred: the precise integration points to DCS / authz (consistent with platform pattern, but not verified in the Lua code).
- ❗ Needs verification: full plugin enumeration (`ls kong-plugins/` would give exact count and names).
