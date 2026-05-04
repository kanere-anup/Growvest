# settlements

> Decides WHEN a merchant gets paid. Consumes payment events (via the ledger journal stream), evaluates eligibility against a per-merchant schedule, and produces settlement transactions that eventually become bank-account credits via UTR.

Repo: `~/Desktop/git/settlements`. Go 1.24, Twirp.

---

## Mental model

```
ledger journals (capture / refund)
        │
        ▼ Kafka topic "payment-events"
   ledger_processor consumer  ──>  TransactionCore.Create
                                      │
                                      ▼
                              schedule lookup
                                      │
                                      ▼
                              Settlement.Create(req, eligibleFrom)
                                      │
                                      ▼
                              processor.Process()
                                      │
                                      ▼
                              settlement row → outbox → downstream
```

Settlements does not initiate money movement. It produces *eligible-for-payout* records that downstream banking processes consume.

---

## Binaries (✅ verified)

| Binary | Purpose |
|---|---|
| `cmd/api/main.go` | Twirp server (port from config) |
| `cmd/ledger_processor/main.go` | Kafka consumer for `payment-events` |
| `cmd/ledger_worker/main.go` | Settlement transaction worker |
| `cmd/ledger_processor_dlq/main.go` | DLQ for ledger processor |
| `cmd/workers/main.go` | Multiple worker types |
| `cmd/migration/main.go` | Postgres migrations |
| `cmd/soh_cron/main.go` | "State of Health" cron — marks transactions on hold |

---

## Internal structure (✅ verified — 40+ packages)

Key ones:

| Package | Purpose |
|---|---|
| `internal/settlement/` | Processor factory; settlement creation |
| `internal/settlement/factory.go` | Routes to one of 4 processors |
| `internal/settlement/default_settlement.go` | Default processor |
| `internal/settlement/aggregate_settlement.go` | Aggregates many txns into one settlement |
| `internal/transaction/` | Hold/release, refund, transaction model |
| `internal/schedule/` | Schedule resolution (T+0/T+1/T+2) |
| `internal/merchant_config/` | Per-merchant settlement type + schedule |
| `internal/holiday/` | Bank holiday calendar |
| `internal/entity_scheduler/` | Schedules execution windows |
| `internal/execution/` | Settlement execution lifecycle |
| `internal/event_framework/consumer/ledger_processor.go` | The payment events consumer |
| `internal/ledger_recon/` | Reconciliation against ledger |
| `internal/optimiser/` | Routing optimizer (for payout) |
| `internal/transfer/`, `internal/foh/` | Transfers, fund-on-hold |

---

## Twirp APIs (✅ verified pattern)

| Service | Methods |
|---|---|
| `SettlementAPI` | Create, Fetch, List |
| `TransactionAPI` | Hold, Release, FetchByMerchant |
| `MerchantConfigAPI` | Get/Update settlement config |
| `SettlementDelayAPI` | Query delay reasons |
| `DCSAuditAPI` | Audit trail |
| `MerchantNotificationAPI` | Notification state |
| `FOHApi` | Fund-on-hold logic |
| `ReasonMappingAPI` | Hold reason codes |

---

## How payment events arrive (✅ verified)

```go
// internal/event_framework/consumer/ledger_processor.go (✅ verified)
// Topic: "payment-events" (per inline comment at line 62)
// Payload: eventv2.Event with Payment, Terminal, Order, Merchant, JournalResponse

type LedgerProcessorJob struct {
    EventPayload *eventv2.Event   // line 22
}
```

The flow:
1. `ledger` posts a journal-created event (via outbox to Kafka).
2. `cmd/ledger_processor` consumes it from `payment-events`.
3. Extracts payment id + journal response.
4. Creates a settlement transaction via `transaction.Core`.
5. Eligibility evaluated against schedule + merchant config.

> **This resolves Open Question #1 from the UPI flow doc.** Settlements consumes payment-event Kafka messages via `ledger_processor`, NOT directly from a `stage_live_payment_events` topic. The Phase 1 scan that mentioned `stage_live_payment_events` was looking at a different consumer (likely the worker for charge-collections / affordability events). The primary path is `payment-events`, populated by ledger's outbox.

---

## Settlement creation (✅ verified)

```go
// internal/settlement/core.go:285-384
func (c *Core) Create(ctx, req, eligibleFrom int64) (Settlement, error) {
    // Acquire mutex on resource (lines 316-322)

    // Fetch merchant config (line 325)
    merchantConfig := merchantConfigCore.Get(ctx, merchantId, settlementTag)

    // Eligibility (line 339)
    reason, ok := merchantConfig.GetSettlementEnabledByParams(ctx, balanceType)
    if !ok { return ErrIneligible(reason) }

    // Process via factory (lines 360-362)
    return processorFactory.GetProcessor().Process(req, eligibleFrom, orgId)
}
```

### Processor factory

✅ Verified at `internal/settlement/factory.go:54-115`:

| Processor | When |
|---|---|
| `DefaultSettlement` | Standard merchants |
| `TransactionLevelSettlement` | One settlement per txn |
| `AggregateSettlement` | Many txns → one settlement |
| `OrgDefaultSettlement` | When `SettleToOrg` flag is set (organization-level settlement) |

Selection at `factory.go:93-115` — routes by `merchantConfig.GetTypes().GetActiveType()` and tag.

### DefaultSettlement

```go
// internal/settlement/default_settlement.go (✅ verified)
NewDefaultSettlement()  // line 13
// IProcessor interface
// Creates settlement via transactional ledger journal entry
// Soft-fail vs hard-fail (lines 37-41)
errSettlementCreateSoftFailure   // transient — retry via cron
errSettlementCreateFailure       // permanent — no-active-bank-account, validation, etc.
```

### AggregateSettlement

```go
// internal/settlement/aggregate_settlement.go (✅ verified)
// Extends defaultSettlement (line 30)
// Validates parent settlement flag before processing children (line 49)
// Slack notification on failure (line 64)
```

---

## Schedule resolution

✅ Verified at `internal/schedule/model.go:12-30`:

```go
type Schedule struct {
    Name        string
    DelayUnit   string  // HOUR / DAY / MONTH
    Delay       int64
    Periodicity string  // cron expression for batch runs
}
```

Periodicity validated as cron via `scheduler.ValidateCronExpression` (line 69).

The `eligibleFrom` int64 timestamp is computed upstream of `Settlement.Create` — ❗ **the exact computation site is still unresolved** (the agent search couldn't find it in the schedule package directly; likely lives in `merchant_config` or `entity_scheduler`).

---

## UPI / payment-method specifics

UPI is treated as a **domestic** schedule:
```go
// internal/merchant_config/config.go:138 (✅ verified)
Domestic + Delimiter + UPI    // → "domestic_upi"
```

Schedule types (✅ verified at lines 29-31):
- `domestic`
- `international`
- `pre_fund_withdrawal`

There's no UPI-specific branching in the settlement creation path — just per-method schedule lookup.

---

## Hold / Release

```go
// internal/transaction/model.go (✅ verified)
type Transaction struct {
    OnHold       bool          // SQL DEFAULT false
    OnHoldReason nulls.String
    ...
}

// Methods:
Release()  // sets on_hold=false, clears reason
Hold()     // sets on_hold=true, sets reason
```

Hold gets triggered by:
- `cmd/soh_cron` (state-of-health cron)
- Feature flag checks
- Bank account issues (no active account, KYC issues, etc.)

`internal/transaction/server.go` exposes a `Hold()` Twirp method that puts specified transactions on hold.

---

## Outbox / events produced

```go
// internal/boot/handler.go (✅ verified)
coldStorageWriter := producer.NewColdStorageWriter(ctx, provider.GetEventOutboxClient(ctx))
```

Settlement events are published via the pg-sdk outboxer pattern — same as pg-router. Settlement state transitions, audit events, and notification triggers all flow through this.

Specific topics ❗ not enumerated in the scan; resolvable by reading config in `default-live.toml` / `prod-live.toml` (consistent with platform pattern: `prod_live_settlement_events` etc.).

---

## Stores

| Store | Role |
|---|---|
| **PostgreSQL** | Primary; settlements, transactions, schedules — read replicas for fetches |
| Redis | Cache, channel state |
| S3 | Settlement reports + exports |

---

## Failure Modes & Recovery

| Failure | Behavior | Recovery |
|---|---|---|
| Settlement creation soft-fail | `errSettlementCreateSoftFailure` raised; settlement stays in pending state | `MaxFailedRetryAttempts: 1` (`core.go:65-68`); cron re-evaluates eligibility |
| Settlement creation hard-fail | `errSettlementCreateFailure` (e.g., no active bank account) | Manual remediation required (merchant updates bank, etc.) |
| Processor type mismatch | If `merchantConfig.GetTypes().GetActiveType()` returns a value not in `processorMap`, `GetProcessor()` returns nil → **panic on Process call** | ⚠️ Risk surface — config drift between merchant settlement type and registered processors |
| Ledger acknowledgement never arrives | Settlement stuck in PROCESSING | Manual retry via cron / dashboard tooling |
| Hold reason not in `ReasonMappingAPI` | Operator can see raw reason string but no localized message | Add reason mapping; not blocking |
| `payment-events` Kafka lag | Settlement creation delayed by topic lag | Standard Kafka health monitoring |
| Refund event handling | Settlements has refund handling in `internal/transaction/` but the production topic name (`settlements-refund-transaction-create` per Phase 1) ❗ wasn't pinned to a specific producer | Resolve before triaging refund issues |

---

## Confidence

- ✅ Verified: binary list, package list, processor factory + 4 processor types, default + aggregate processor entry points, payment-events consumer + payload struct, hold/release methods, schedule struct.
- ⚠️ Inferred: Twirp method exact list (would need full proto read); production outbox topic names.
- ❗ Needs verification: where `eligibleFrom` is computed (likely `merchant_config` or `entity_scheduler`); the producer of `settlements-refund-transaction-create`; processor-nil panic risk in production.
