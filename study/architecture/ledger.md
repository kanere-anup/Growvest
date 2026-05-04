# ledger

> Double-entry accounting for **all of Razorpay's products** — payments, capital, wallet, banking. Every money movement that needs to balance gets a journal here.

Repo: `~/Desktop/git/ledger`. Go 1.23 with toolchain 1.23.8. Twirp + protobuf.

---

## Why "ledger" — and what it is not

This is a real double-entry general ledger:
- **Account**: an addressable balance. Types: merchant, settlement, balance, fee, nodal, reserve.
- **Journal**: an atomic accounting event with multiple **ledger_entries** (legs), each a debit or credit on one account. The legs sum to zero.
- **Tenant**: a product partition (PG, X = Capital, PG_US, PG_SG, X_MY).

It is NOT:
- A merchant balance dashboard (that's downstream consumers).
- A settlement engine (that's `settlements`).
- A payment processor (that's `pg-router`).

It exists so every product can ask "what was the state of account X at time T?" with a verifiable, append-only history.

---

## Binaries (✅ verified)

| Binary | Purpose |
|---|---|
| `cmd/api/main.go` | Twirp server |
| `cmd/worker/main.go` | Async worker |
| `cmd/migration/main.go` | DB schema migrations (Postgres + MySQL) |
| `cmd/scheduler/main.go` | Time-based job execution (env: JOURNAL_IDS, TRANSACTOR_IDS, TENANT, CHUNK_SIZE, MERCHANT_ID) |
| `cmd/outbox_relay/main.go` | Outbox → Kafka/SNS publisher |
| `cmd/data_backfill/main.go` | Backfill mode "partial" (specific txn IDs) or default (all merchants); `USE_CASE` env var |
| `cmd/data_comparator/main.go` | Validates backfilled data correctness |
| `cmd/idempotency_partition_manager/main.go` | Creates N partition tables for idempotency table sharding (`PARTITION_COUNT` env) |

---

## Internal structure (✅ verified — 13 packages)

| Package | Purpose |
|---|---|
| `internal/account/` | Account entity (`model.go:53-62`) — MerchantID, Status, Balance (`*money.Money`), MinBalance, NegativeBalance, AccountDetail nested |
| `internal/account_discovery/` | Resolves account by (fundAccountType, accountType, merchantID, currency) using formula configs (`core.go:34-80`) |
| `internal/journal/` | Core journal logic (`core.go:205-349`); double-entry write |
| `internal/outbox/` | Transactional outbox emit |
| `internal/scheduled_jobs/` | Async balance updates etc. |
| `internal/makeshift/` | Dual-write migration shim |
| `internal/dashboard/` | Dashboard / balance summary queries |
| `internal/idempotency_partition_manager/` | Partition lifecycle |
| `internal/database/` | GORM + driver setup |
| `internal/job/` | Background work |
| `internal/provider/` | External clients |
| `internal/trace/` | Telemetry |
| `internal/config/` | Config loading |

---

## Twirp APIs (✅ verified pattern)

Generated under `proto/`:

| Service | Methods |
|---|---|
| `AccountAPI` (`/twirp/rzp.ledger.account.v1.AccountAPI/...`) | Create, FetchById, UpdateBalance, List |
| `JournalAPI` (`/twirp/rzp.ledger.journal.v1.JournalAPI/...`) | Create, CreateInBulk, FetchById, FetchByTransactor, FetchByIdAndCreatedAt |
| `AccountDiscoveryAPI` | Discover |
| `AccountDetailAPI` | (nested under account) |
| `SplitAccountAPI` | (nested under account) |
| `DashboardAPI` | balance + summary queries |

The `Create` method on JournalAPI is the central one — see `internal/journal/server.go:37-124`.

---

## Journal create — the central flow

```go
// internal/journal/server.go:37-124 (✅ verified)
func (s *Server) Create(ctx, req) (*Resp, error) {
    // Mutex on (transactor_event, transactor_id) — idempotency lock
    err := TakeMutexLock(ctx, req.GetTransactorEvent(), req.GetTransactorId(), acquirerID)  // line 53
    if err == ErrorResourceAlreadyAcquired { return twirp.InvalidArgument }
    defer ReleaseMutexLock()                                                                 // line 60

    // Validate
    if err := ValidateCreateRequest(req); err != nil { ... }                                  // line 70

    // Core call
    return s.core.Create(ctx, req)                                                            // line 92
}
```

```go
// internal/journal/core.go:205-349 (✅ verified)
func (c *Core) Create(ctx, req *common.JournalCreateRequest) {
    ledger := c.LedgerBuilderCore.BuildLedger(...)  // line 224 — builds the journal + entries

    db.Transaction(func(tx) error {
        // Save journal row + ledger_entries + outbox row in single tx (lines 242-321)
        if c.CheckIfOutboxPushEnabled(ctx) {
            payload := journalToProtoResponse(...)              // line 281
            c.OutboxCore.SendToOutbox(broker, topic, payload)   // line 310
        }
        return nil
    })  // rolls back all on any error                          // lines 322-333

    // Publish journal-created SNS event (line 344)
}
```

### Idempotency

Mutex key: `(TransactorID, TransactorEvent)`. For a UPI payment capture, this pair is `(api_txn_id, "payment_capture")`. The same pair will not produce two journals.

The `idempotency_partition_manager` shards the idempotency state table — it's high-volume.

---

## Account discovery

`internal/account_discovery/core.go:34-80` (✅ verified):

```go
func (c *Core) GetAccountByConfig(ctx, fundAccountType, accountType, merchantID, currency) {
    // Replaces variables from ledger config
    // Applies merchant config rules
    // Validates request params (lines 62-65)
    // Returns single account or ErrAccountDiscoveryFailure (line 58-67)
}
```

This is how a journal builder, given product context, resolves WHICH account to debit/credit. The "formula" comes from seed config (ledger_config), so account selection is data-driven, not hardcoded.

---

## Outbox + scheduler

```go
// cmd/outbox_relay/main.go:6-17 (✅ verified)
boot.InitOutboxRelay(ctx, env, tenant)
```

Publishes outbox messages to Kafka or SNS. Tenant-aware — each product partition gets its own relay.

```go
// pkg/outbox/core.go:60-92 (✅ verified)
SendToOutbox(broker, topic, payload):
   case "kafka": pushToKafkaOutbox(...)
   case "sns":   pushToSNSOutbox(...)
```

Topics (✅ verified at `config/default.toml:415, 424, 438-443`):
- SNS: `arn:aws:sns:us-east-1:000000000000:journal-created`
- Kafka: env-driven `LEDGER_QUEUEKAFKA_KAFKA_TOPIC`

---

## Tenants

✅ Verified at `internal/common/constant.go`:

```
TenantPG    = "PG"        // payments
TenantX     = "X"          // capital
TenantXMY   = "X_MY"
TenantPGUS  = "PG_US"
TenantPGSG  = "PG_SG"
TenantTest  = "Test"
```

Extracted from request context at `journal/core.go:76`:
```go
tenant := ctx.Value(contextkeys.Tenant).(string)
```

Each journal is tagged with its tenant — this is how the same ledger DB serves multiple products without cross-product leak.

---

## Stores

| Store | Role |
|---|---|
| **PostgreSQL** | Primary (`config/bvt-live.toml:5` `dialect=postgres`); journals, ledger_entries, accounts |
| MySQL | Secondary (some tables, compatibility) |
| Redis | Mutex (`goutils/mutex`) + cache |
| AWS DynamoDB | Optional state (`aws-sdk-go`) |

---

## Migration / dual-write tooling

The `internal/makeshift/` package + the `cmd/data_backfill/` and `cmd/data_comparator/` tooling exist to support **historical data migration** of journals into the current schema. The `MakeshiftTxn` worker is referenced in `journal/core.go:290` as the consumer of out-of-band journal creates.

This is a vestige of an earlier ledger migration; if you see "makeshift" in logs while debugging, it's not the live capture path — it's backfill / reconciliation.

---

## Failure Modes & Recovery

| Failure | Behavior | Recovery |
|---|---|---|
| Mutex acquisition contention | First request wins; subsequent ones get `ErrorResourceAlreadyAcquired` (Twirp `InvalidArgument`) | Caller retries; second attempt sees existing journal |
| Account discovery returns no row | `ErrAccountDiscoveryFailure` | Operator must check ledger_config seed data; usually a config issue |
| Single-tx commit fails (any of: journal write, ledger_entries, outbox row) | All roll back together | Self-healing — caller retries |
| Outbox row written but relay never publishes | Eventually consistent retry inside relay | If relay process is down, alert via standard observability |
| Balance update lag (async) | Account row's balance is stale | `scheduled_jobs` reconciles; transient drift expected |
| Maxwell/Debezium CDC stuck | Journal events don't reach downstream consumers (e.g., settlements' `ledger_processor`) | Platform-level — out of ledger's hands |
| Migration / makeshift conflict | An out-of-band backfilled journal exists for a transactor that the live path expects to handle | The makeshift worker is supposed to be idempotent; ⚠️ verify before running |

---

## Confidence

- ✅ Verified: binary list, package list, Twirp service names + key method names, journal core.Create flow, mutex idempotency, tenant constants, outbox config, account model.
- ⚠️ Inferred: exact list of methods on each Twirp service (would need full proto read).
- ❗ Needs verification: where SNS topics ARN values come from in prod (the cited value is local/test).
