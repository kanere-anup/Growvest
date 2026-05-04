# account-service

> Source of truth for **business / merchant accounts**. Owns the `merchants` table that everyone (partnerships, pg-router, ledger consumers, etc.) reads from via CDC.

Repo: `~/Desktop/git/account-service`. Go 1.23, gRPC + grpc-gateway + Twirp.

---

## Why it matters

Merchant identity in Razorpay starts here. The `merchants` table this service writes to is what flows through Maxwell CDC to the `mysql_cdc_events_*_account_service_merchants` topic — which is consumed by partnerships, settlements, pg-router, and others. If account-service gets a write wrong, half the platform sees the wrong thing 30 seconds later.

---

## Binaries

| Binary | Purpose |
|---|---|
| `cmd/api/main.go` | gRPC :8080 + grpc-gateway HTTP :8081 |
| `cmd/migration/` | DB init / schema migration |
| `cmd/worker/` | Async job processor |

---

## Internal structure

- `internal/asv/` — **A**ccount **S**er**v**ice domain logic (service, repo, validator)
- `internal/outbox/handlers/` — Kafka producers via outbox pattern
  - `AccountUpdateKafkaPushHandler`
  - `MerchantUpdateKafkaPushHandler`
- `internal/data_sync/` — Parity / reconciliation with upstream systems (Spine, Edge)
- `internal/kafka/` — consumers for parity events

---

## API surface (✅ verified pattern, exact methods inferred from generated proto)

The service exposes both gRPC (port 8080) and HTTP (port 8081 via grpc-gateway). Twirp and gRPC are both present per `go.mod`.

Representative flows:
- `CreateAccount` — create a new business account
- `UpdateAccount` — mutate (this is what triggers the most-watched CDC event)
- `VerifyMerchant` — compliance / KYC verification step
- `FetchAccountDetails` — read

Auth: JWT (gRPC metadata) + Passport v4 (`goutils/passport/v4`).

---

## Sync calls out

| Service | Why |
|---|---|
| DCS | Dynamic config / feature flags |
| Authz | Role-based access control |
| Splitz | Experiments |
| Edge / Spine | Account sync via `goutils/spine` |

---

## Async (Kafka)

**Produces** (via outbox handlers in `internal/outbox/handlers/`):
- `account.updated` events
- `merchant.updated` events

These topics are also exposed to Maxwell CDC consumers downstream — so a single merchant row update produces:
1. The outbox-driven `merchant.updated` event (deliberate, designed payload)
2. The Maxwell-driven `mysql_cdc_events_*_account_service_merchants` row-level CDC

Most downstream consumers (e.g., partnerships' partner type change handler) listen to the **Maxwell CDC**, not the outbox event, because CDC has guarantee-level coverage even for ad-hoc DB changes.

**Consumes**:
- Parity / reconciliation topics from `internal/kafka/`

---

## Stores

| Store | Role |
|---|---|
| MySQL | Primary (GORM) |
| Redis | Caching, distributed locks |
| Aurora | Used via `goutils/spine` for parity reads |

---

## Where partnerships intersects

This is the bridge between the rest of the platform and the partnerships domain:

1. **Partner identity is here.** A merchant becomes a "partner" by having `partner_type` set on their `merchants` row. account-service mutates that column.
2. **Maxwell CDC carries the change.** Stage topic: `mysql_cdc_events_stage_account_service_merchants`.
3. **Partnerships consumes it** via `partner_type_change_events.go` and `merchant_activation_events.go` (see `partnerships/02_partner_lifecycle.md`).
4. Partnerships does NOT write back to the merchants table — its writes are local-only (or via the partnerships ↔ Superleap migration path).

---

## Failure Modes & Recovery

| Failure | Behavior | Recovery |
|---|---|---|
| MySQL primary failover | Writes briefly fail; reads from replica | Replica catches up; outbox row written transactionally so no event-loss |
| Outbox row commits but Kafka publish lags | Standard outbox pattern — relay retries until success | Eventually consistent |
| Maxwell CDC stuck | Every downstream that depends on `merchants` CDC drifts | This is a platform-level outage; mitigation is at the Maxwell side |
| Conflicting writes (e.g., concurrent partner_type change + KYC update) | Last-write-wins at the row level; CDC events fire in commit order | Downstream consumers see two events; should be idempotent on `partner_id` |

---

## Confidence

- ✅ Verified: bin list, internal structure, outbox handler names, downstream consumer patterns (partnerships).
- ⚠️ Inferred: precise gRPC method list (would need to read generated `.pb.go` files); Aurora vs MySQL exact split.
- ❗ Needs verification: outbox topic names verbatim from `cmd/api/main.go` config.
