# Outbox + Kafka

> All async paths in partnerships: outbox tables, the GORM plugin that fills them, the handler dispatch table, and the 7 Kafka consumers. Verbatim topic names included.

Repo root: `~/Desktop/git/partnerships`. Cite paths are relative.

---

## Three async mechanisms (don't confuse them)

| Mechanism | Where rows live | When used | Library |
|---|---|---|---|
| **Event outbox** (the GORM plugin one) | `outbox_jobs`, `event_outbox`, `ledger_outbox` | Transactionally publish events on DB writes (commission_invoice, partner_config, etc.) | `goutils/outbox/v4` + `internal/database/plugins/outbox_events.go` |
| **API outbox** | `api_outbox` | Async API calls to external services (e.g., ledger journal create) where the outcome must be reconciled | partnerships-internal: `internal/api_outbox/` |
| **SQS jobs** | (queue, not DB) | Worker-managed async jobs (some retry batches, etc.) | `goutils/worker/v3` |

Plus the **Kafka consumers** (`internal/job_kafka/`) which are *inbound* — they consume events from other services.

---

## Outbox tables

### `outbox_jobs` (✅ verified at `internal/database/migrations/20230814015033_create_outbox_jobs.go:1-10`)

The migration delegates to `goutils/outbox/v4/sql/mysql`:

```go
goose.AddMigration(mysql.Up, mysql.Down)
```

**Schema is opaque from this repo.** To see the columns you'd have to read the goutils package. The library convention is `id, payload_name, payload, retry_count, status, created_at, updated_at` (✗ not directly verified here).

### `api_outbox` (✅ verified at `internal/database/migrations/20230823205449_api_outbox.go:13-43`)

| Column | Type |
|---|---|
| `id` | char(14) |
| `action` | varchar(100) |
| `payload` | text |
| `retry_count` | int default 0 |
| `created_at` | bigint |
| `updated_at` | bigint |
| `deleted_at` | bigint nullable |

**Partitioned by `created_at` range** (line 23). PK `(id, created_at)` (line 22). Maxvalue partition for overflow (line 33).

> Notable: **no `status` column**. Failure state is implied by `retry_count` exceeding a threshold (`internal/api_outbox/core.go:251`). There is no terminal "permanently failed" status to filter on.

### `ledger_outbox` (✅ verified at `internal/database/migrations/20260301000000_create_ledger_outbox.go:13-29`)

| Column | Type |
|---|---|
| `id` | varchar(255) |
| `payload_name` | varchar(255) |
| `payload_serialized` | text |
| `is_encrypted` | bool |
| `priority` | int default 1 |
| `is_deleted` | bool |
| `created_at`, `updated_at` | bigint |
| `deleted_at` | bigint nullable |
| `retry_count` | int default 0 |

PK `(id)`. Index `idx_is_deleted_created_at`.

### `event_outbox` (✅ verified at `internal/database/migrations/20260323000000_create_event_outbox.go:13-29`)

| Column | Type |
|---|---|
| `id` | char(14) |
| `entity_id` | char(14) |
| `entity_type` | char(20) |
| `payload_name` | varchar(100) |
| `payload` | text |
| `is_deleted` | bool |
| `deleted_at` | bigint |
| `created_at`, `updated_at` | bigint |
| `retry_count` | int default 0 |
| `priority` | int |

PK `(id, created_at)` (partitioned). Indexes `event_outbox_entity_id_idx`, `event_outbox_payload_name_idx`.

---

## How rows get written: the GORM plugin

✅ Verified at `internal/database/plugins/outbox_events.go:46-77`.

The plugin registers GORM callbacks on `Create`, `Update`, `Delete` so that any write to a "syncable" table also produces an outbox row in the same transaction.

Syncable tables (✅ verified at `database/plugins/outbox_events.go:17-22`):
- `merchant_access_map`
- `merchant_applications`
- `partner_configs`
- `partner_kyc_access_state`

Per-table outbox payload mapping is built into `s.createEntries(db, operation)` (lines 52-77). Each call generates the right payload type + name and inserts it into the outbox table within the active GORM transaction.

This is the cleanest part of the async story: **if the parent row commit succeeds, the outbox row is guaranteed to be there too** — no separate write needed.

The relay loop (which pulls outbox rows and ships them to handlers / Kafka) is inside `goutils/outbox/v4` and not visible in the partnerships repo.

---

## Outbox handlers (`internal/outboxer/`, ✅ verified file list)

| File | Domain | Trigger | Destination |
|---|---|---|---|
| `commission_handler.go` | Commission | `CommissionCreationPayload` (from outbox row, written when Kafka job fails) | calls `commissionCore.CreateCommissionByJob()` (line 47) |
| `commission_invoice_handler.go` | Invoice | `CommissionInvoiceCreationPayload` | calls `invoiceServer.GenerateCommissionInvoice()` (line 46) |
| `enable_region_handler.go` | Partner | `EnableRegionPayload` | partner-side region webhooks (not deeply read) |
| `handle_partner_webhooks_handler.go` | Partner | `HandlePartnerWebhooksPayload` | webhook delivery |
| `merchant_access_map_handler.go` | Access map | `merchant_access_map` (CREATE/UPDATE/DELETE) | calls `client.UpsertMerchantAccessMap()` / `DeleteMerchantAccessMap()` (lines 65, 71) |
| `merchant_access_map_global_handler.go` | Access map | (a different filter / scope from the above) | not deeply read |
| `merchant_application_handler.go` | Merchant application | merchant_applications writes | not deeply read |
| `oauth_consent_handler.go` | OAuth consent | OauthConsent write | not deeply read |
| `partner_config_handler.go` | Partner config | `partner_configs` writes | calls `client.UpsertPartnerConfig()` / `DeletePartnerConfig()` (lines 62, 68) |
| `partner_kyc_access_state_handler.go` | Partner KYC state | `partner_kyc_access_state` writes | not deeply read |
| `settlement_release_handler.go` | Invoice → settlement | `SettlementReleasePayload` | calls settlements service |
| `submerchant_config_update_handler.go` | Sub-merchant config | from `MerchantActivationEventJob` (15-min delay) | updates settlement schedule + holiday config |
| `superleap_sub_merchant_link_handler.go` | Migration | `merchant_access_map` CREATE | calls `superleapClient.SyncPartnerLead()` (line 145) — see `08_…_migration.md` |
| `sqs_handler.go` | (cross-cutting) | bridges outbox → SQS for some flows | not deeply read |

### Constants file

`internal/outboxer/constants.go:1-14` (✅ verified) — each payload type has a name constant, used both as the action / topic key and to dispatch to the handler:

```
MerchantAccessMapOutboxPayloadName
MerchantApplicationOutboxPayloadName
PartnerConfigOutboxPayloadName
SubMerchantConfigOutboxPayloadName
PartnerKycAccessStateOutboxPayloadName
SuperleapSubMerchantLinkOutboxPayloadName
SettlementReleaseOutboxPayloadName
OauthConsentCreateOutboxPayloadName
HandlePartnerWebhooksOutboxPayloadName
```

---

## Kafka consumers (`internal/job_kafka/`)

The 7 consumers, with verbatim topic strings from `config/default.toml:29-36` (✅ verified):

| Consumer file | TOML key | Topic value (dev/stage) | Source service | Handler | MaxRetries | Timeout |
|---|---|---|---|---|---|---|
| `create_commissions_job.go` | `commission_create` | `stage_live_payment_events` | PG Router (payment.captured) | `(*CreateCommissionsJob).Handle` (line 72) | 1 | 60s |
| `cdc_dual_write.go` | `cdc_dual_write` | `dev-internal_api_api_entity_origins` | Superleap CDC | `(*CdcDualWrite).Handle` (line 47) | 3 | 10s |
| `partner_type_change_events.go` | `partner_type_change_event` | `partner_type_change_event` (mapped to `mysql_cdc_events_*_account_service_merchants`) | account-service CDC via Maxwell | `(*PartnerTypeChangeEventJob).Handle` (line 120) | 1 | 60s |
| `merchant_activation_events.go` | `merchant_activation_event` | `mysql_cdc_events_stage_account_service_merchants` | account-service CDC via Maxwell | `(*MerchantActivationEventJob).Handle` (line 88) | 1 | 60s |
| `kyc_save_events.go` | `kyc_form_save` | `dev-kyc_form_save_events` (or env-suffixed) | PGOS | `(*KycSaveEventJob).Handle` (line 111) | 3 | 1s |
| `bvs_consent_document_event.go` | `bvs_consent_document_event` | `stage-prts-bvs-consent-document-events` | BVS | `(*Handler).Handle` (line 52) | 0 | 60s |
| `ledger_acknowledgment_event.go` | `ledger_acknowledgment` | `internal_db_stage_ledger_payments_test_outbox.public.outbox_jobs_partnerships` | ledger outbox CDC | `(*LedgerAcknowledgmentJob).Handle` (line 79) | 3 | 30s |

Topic naming patterns:
- `stage_live_*_events` — domain events from PG / payments
- `mysql_cdc_events_*_<table>` — Maxwell-emitted CDC from MySQL
- `internal_db_*_<service>_*_outbox.public.outbox_jobs_*` — Debezium-emitted CDC from another service's Postgres outbox table
- `dev-*` — partnership's own dev-prefixed topics (Superleap CDC, etc.)

> Topic names with `stage_*` are obviously stage-environment values from `default.toml`. Production values will differ — look at the env-specific TOML overrides (e.g., `default-live.toml`) for prod truth.

---

## Consumer registration

✅ Verified at `internal/boot/handler.go:468-479`:

```go
// internal/boot/handler.go:468-479
func RegisterKafkaJobs(deps Deps) {
    // ...
    kafkaJob.RegisterKafkaJobs(KafkaWorker, config.Conf.KafkaJob, deps)   // line 478
}
```

Each consumer's `init()` function self-registers (e.g., `internal/job_kafka/create_commissions_job.go:38-40`).

The `KafkaWorker` is initialized in `internal/boot/boot.go:461-479` from either `config.Conf.QueueKafka` or `config.Conf.Msk` (the new path).

❗ **Consumer group name is not visible in the cited config.** Either:
- It's set inside `goutils/worker/v3` from a derived value (e.g., service name), or
- It's in an environment-specific config not opened by the agents

For ops triage, you'd need to know this to identify partnerships consumers in MSK metrics. ❗ Worth tracking down.

---

## API outbox (the *other* outbox)

This is partnerships' own retry queue for non-Kafka async API calls.

### Use case

When a flow needs to make an external API call but can't afford to fail the request (typical case: ledger journal create that must eventually succeed even if ledger is briefly down), the call is queued in `api_outbox` and a worker retries.

### Core API

✅ Verified at `internal/api_outbox/core.go:22-46`:

```go
type Core struct {
    repo APIOutboxRepo
    config Config        // contains MaxRetries
}

// Insert a new row
core.Send(ctx, action, payload)

// Mark complete (caller does this after the API call eventually succeeds)
core.Acknowledge(ctx, id)

// Retry — invoked by the batch job
core.Retry(ctx)
```

### Retry batch job

✅ Verified at `internal/batch_jobs/api_outbox_retry.go:18-34`:

```go
const apiOutboxRetryJobName = "api_outbox_retry_job"   // line 32

func (a *APIOutboxRetryJob) Execute(ctx) error {
    // Selects api_outbox rows where updated_at < now - 10 minutes
    return a.apiOutbox.Retry(ctx)   // line 24
}
```

Retries any row whose `updated_at` is older than 10 minutes. The batch is intended to run on a 10-min cron in prod.

### LedgerAcknowledgment closes the loop

When a ledger journal eventually persists (via the ledger service's own outbox path), partnerships sees the CDC event:

```go
// internal/job_kafka/ledger_acknowledgment_event.go (✅ verified)
// Topic: internal_db_stage_ledger_payments_test_outbox.public.outbox_jobs_partnerships
// Handler: (j *LedgerAcknowledgmentJob).Handle(ctx) error    line 79
// Behavior:
//   - Skip non-INSERT events (line 59)
//   - Atomic update: commission status + api_outbox.Acknowledge in one transaction
// MaxRetries: 3, Timeout: 30s
```

This consumer is the **distributed transaction completion** mechanism: by the time it runs, ledger has committed, partnerships marks both the commission and the api_outbox row as done. If it never runs (Kafka topic backed up, ledger never wrote, etc.), the api_outbox retry job will keep retrying.

---

## SQS jobs (`internal/job/`)

Less central to the design. The two visible ones (✅ verified by name in evidence):

- `api_outbox_retry` — uses the api_outbox retry batch
- `submerchant_config_update_retry` — retries submerchant config updates that failed

These run on `goutils/worker/v3` SQS-backed queues. Detail not deeply explored.

---

## Failure semantics summary

### Per-mechanism

| Mechanism | "Permanent failure" semantics | DLQ |
|---|---|---|
| Kafka consumer (per-job MaxRetries) | After exhaustion, delegated to `goutils/worker/v3` | ❗ DLQ topic name not visible in repo. Likely a default-named DLQ from goutils |
| Event outbox (`goutils/outbox/v4`) | Library-managed; retry_count column suggests retries are counted | ❗ Unknown — internal to library |
| API outbox | `retry_count` increments; after `MaxRetries`, ❗ implicit "failed" state with no terminal status column | None |
| SQS jobs | `goutils/worker/v3` semantics | Unknown without library read |

### Per-consumer retry counts

| Consumer | Retries | What this means |
|---|---|---|
| `create_commissions_job` | 1 | One retry, then OnError handler writes to outbox for async retry |
| `cdc_dual_write` | 3 | Up to 4 attempts |
| `partner_type_change_events` | 1 | Single retry — relies on backfill batch job for catch-up |
| `merchant_activation_events` | 1 | Single retry — relies on subsequent CDC events |
| `kyc_save_events` | 3 | Generous retry; events are audit-only |
| `bvs_consent_document_event` | **0** | **No retry — single attempt only.** Most fragile. |
| `ledger_acknowledgment_event` | 3 | Critical — closes the api_outbox loop |

### Idempotency

| Operation | Mechanism | Notes |
|---|---|---|
| Commission creation | 60s mutex on `prts:cc:<payment_id>` | No DB unique constraint as backstop |
| Partner type change sync | None visible | Relies on Splitz gating + downstream Superleap idempotency |
| Merchant access map create | DB row PK | If retried with same content, row already exists |
| BVS consent ack | None | The lack of retry + lack of idempotency = data loss risk |
| Invoice generation | `(merchant_id, month, year)` not unique-constrained, but `regenerate_if_exists` flag in payload defaults to false | Effective idempotency via flag, not DB |

---

## Failure Modes & Recovery (specific to outbox/kafka)

| Failure | Behavior | Recovery |
|---|---|---|
| Outbox row created but relay never picks it up (library bug or worker down) | Stays in `outbox_jobs` indefinitely | Operator restart of relay; ❗ no built-in alerting visible in partnerships repo |
| Kafka consumer pod crashes mid-process | Offset not committed → message redelivered | Standard Kafka semantics; idempotency depends on per-job logic |
| `bvs_consent_document_event` consumer dead-lettered | Single attempt, then drops | ❗ Manual remediation only. Strong candidate for a follow-up: increase MaxRetries to ≥3 |
| api_outbox row stuck (retry_count high, action not recoverable) | Retried forever every 10 minutes | ❗ No automatic give-up. An operator has to soft-delete the row |
| Ledger CDC topic backed up | LedgerAcknowledgmentJob falls behind → commissions stay unreconciled → api_outbox keeps retrying | Self-healing once topic catches up; high-watermark monitoring would help (❗ not visible in repo) |
| Outbox plugin transaction rollback | Outbox row rolls back with the parent — no orphan | This is the design goal; should never produce inconsistency |
| Partner type change Splitz disabled | Events processed but skipped silently | Backfill via `partner_migration_backfill` batch job |
| MaxRetries=0 consumer DLQs | Event lost | Manual replay or accept the loss |

---

## Confidence

- ✅ Verified: all migration schemas (api_outbox, ledger_outbox, event_outbox), all Kafka consumer file:line refs and retry counts, all topic strings from `config/default.toml`, outboxer handler list and dispatch lines, GORM plugin syncable tables list, registration site at `boot/handler.go:478`.
- ⚠️ Inferred: `outbox_jobs` exact schema (since the migration delegates to goutils); semantics of MaxRetries=0 dead-lettering (depends on goutils/worker behavior).
- ❗ Needs verification: production Kafka topic names (these are stage values); consumer group name; DLQ topic names; whether goutils provides default DLQ or just drops messages.
