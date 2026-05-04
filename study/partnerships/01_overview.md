# Partnerships Service — Overview

> **Tier 1 deep dive.** This is the umbrella doc. Every section here points to a more specific doc (02–08) for the full code-grounded detail.

Repo root: `~/Desktop/git/partnerships`. All `path/to/file.go:line` refs are relative to that root unless prefixed with `~/Desktop/git/<repo>/`.

---

## What this service is

A Go 1.25 microservice that owns **everything to do with partners** in Razorpay's ecosystem:

- The partner identity layer (partner type, KYC state, sales POC)
- The partner ↔ sub-merchant relationship (access map, invites, consent)
- The **commission engine** (calculate fees on every payment captured under a sub-merchant, attribute them to the partner)
- The **invoice lifecycle** (group commissions monthly, render PDF, push to settlements)
- A growing **migration surface** away from a Salesforce-based legacy stack toward Superleap (in-flight, dual-write)

It is NOT the partner identity store of record — that lives in `account-service` (`merchants` table, with a `partner_type` column). Partnerships consumes CDC from there. The struct in `pkg/merchant/model.go:16-36` is partnerships' read view of a partner-merchant.

---

## Top-level layout (✅ verified)

| Dir | Purpose |
|---|---|
| `cmd/api` | Twirp + HTTP server, port 9400 |
| `cmd/kafka_worker` | Kafka consumer worker (7+ job types) |
| `cmd/worker` | SQS-backed async worker |
| `cmd/batch` | One-off / cron-triggered batch jobs |
| `cmd/migration` | Goose DB migrations |
| `internal/` | 43+ domain packages (see below) |
| `pkg/` | 33 external client wrappers + utilities |
| `proto/` | 25+ Twirp service proto definitions |
| `rpc/` | Generated Twirp client/server stubs |
| `slit/` | Integration test suite (SLIT framework) |
| `config/` | TOML configs per env |

### Domain modules (`internal/`)

Grouped by concern. Each module typically has `model.go`, `repo.go`, `core.go` (business logic), `server.go` (Twirp handler), and a `*_test.go`.

**Partner identity & lifecycle** — see `02_partner_lifecycle.md`
- `partner/` (13 files) — `CreateWorkflowAndSyncForMerchantKyc`, region enablement, webhooks
- `partner/kyc/access_state/` — partner KYC state with dual-write modes
- `partner/sales_poc/` — read-through to Superleap for sales POC info
- `partner_config/` — pricing tier, TDS, payment method, feature flags per partner
- `partner_config_audit/`, `partner_migration_audit/` — change history

**Sub-merchant access & onboarding** — see `06_merchant_access.md`
- `merchant/` — sub-merchant lifecycle
- `merchant/invites/` — invite-accept-then-onboard flow
- `merchant/los/` — capital / LOS product enablement
- `merchant_access_map/` — the partner-to-merchant edge table
- `merchant_application/` — feature applications
- `consent/` (15 files) — consent state + BVS document handling
- `settings/` — feature toggles per partner
- `entityorigin/` — origin tracking

**Commissions** — see `03_commission_engine_overview.md` + `04_commission_calculation_paths.md`
- `commissions/commission/` — root commission entity, capture
- `commissions/commission/calculator/` — dual-mode (legacy + CC SDK) calculation
- `commissions/commission_invoice/` — see `05_invoice_lifecycle.md`
- `commissions/commission_analytics/` — analytics queries (Trino)
- `commissions/ledger/` — Ledger SDK integration
- `commissions/source/` — `payment` / `refund` source classification

**Async / outbox** — see `07_outbox_and_kafka.md`
- `outboxer/` — 14 handler files (transactional event publishing)
- `job_kafka/` — 7 Kafka consumer types
- `job/` — SQS jobs (API outbox retry, submerchant config update retry)
- `api_outbox/` — separate "API outbox" for non-transactional async API calls
- `batch_jobs/` — cron / one-shot jobs

**Migration** — see `08_salesforce_to_superleap_migration.md`
- `batch_jobs/partner_migration_backfill.go` — CSV → audit table backfill
- `batch_jobs/data_comparator/`, `data_fetcher/` — migration validation tooling
- `partner_migration_audit/` — audit table + Twirp API
- + outboxer handler `superleap_sub_merchant_link_handler.go` (Superleap link sync)
- + Kafka consumer `cdc_dual_write.go` (Superleap CDC ingestion)

**Cross-cutting**
- `routes/` — registers 25+ Twirp services + HTTP routes (`internal/routes/routes.go`)
- `boot/` — DI, config load, dependency wiring
- `database/` — GORM, Goose migrations, the outbox-events plugin (`database/plugins/outbox_events.go`)
- `provider/` (41 files) — sync clients to: ledger, settlement, pgos, bvs, dcs, gimli, harvester, terminals, wda, splitz, stork, freshdesk, scrooge, account_service, authservice, partnership_service, api_client (monolith), s3Client, elasticsearch, trino, **superleap**

---

## Data flow at a glance

```mermaid
flowchart LR
  classDef sync fill:#E0F0FF,stroke:#1F6FEB
  classDef async fill:#E8E0FF,stroke:#5A2BB6
  classDef store fill:#F0F0F0,stroke:#555

  Dashboard[Dashboard\napps/partnership]:::sync
  API[Razorpay API\nmonolith]:::sync

  subgraph Part[partnerships service]
    direction TB
    Twirp[Twirp + HTTP\ncmd/api]:::sync
    KafkaW[Kafka worker\ncmd/kafka_worker]:::async
    SQSW[SQS worker\ncmd/worker]:::async
    Batch[Batch / cron\ncmd/batch]:::async
    OutboxRelay[Outbox relay\ngoutils/outbox/v4]:::async
  end

  Ledger[ledger]:::sync
  Settle[settlements]:::sync
  PGOS[pg-onboarding-service]:::sync
  BVS[BVS]:::sync
  Stork[stork]:::sync
  Superleap[Superleap CRM]:::sync
  Splitz[Splitz]:::sync

  MySQL[(MySQL\npartner_kyc_access_state\ncommissions\ncommission_invoice\nmerchant_access_map\nmerchant_invites\nconsents\npartner_migration_audit\noutbox_jobs / api_outbox)]:::store
  TiDB[(TiDB / WDA)]:::store
  Trino[(Trino)]:::store
  S3[(S3\npdfs/commission/)]:::store

  KafkaBus{{Kafka}}:::async

  Dashboard --> Twirp
  API --> Twirp

  Twirp --> Ledger
  Twirp --> Stork
  Twirp --> PGOS
  Twirp --> BVS
  Twirp --> Splitz
  Twirp --- MySQL

  KafkaBus -->|stage_live_payment_events| KafkaW
  KafkaBus -->|mysql_cdc_events_*_account_service_merchants| KafkaW
  KafkaBus -->|kyc_form_save_events| KafkaW
  KafkaBus -->|stage-prts-bvs-consent-document-events| KafkaW
  KafkaBus -->|internal_db_*_ledger_*_outbox_jobs_partnerships| KafkaW
  KafkaBus -->|dev-internal_api_api_entity_origins<br/>(Superleap CDC)| KafkaW

  KafkaW --> MySQL
  KafkaW --> Superleap
  KafkaW --> Ledger

  MySQL -->|GORM plugin| OutboxRelay
  OutboxRelay --> Settle
  OutboxRelay --> Superleap

  SQSW --> MySQL
  Batch --> MySQL
  Batch --> Trino
  Batch --> S3
  Batch --> Stork

  MySQL <--> TiDB
```

---

## What's transitional / messy

This is critical context. The service is mid-flight on three overlapping migrations.

### 1. Salesforce → Superleap (✅ verified, in-flight)
The whole partner identity / sales-POC layer is being moved from Salesforce to a Razorpay-internal CRM called Superleap. Right now the system is in **dual-write**, not cutover.

Evidence:
- `internal/job_kafka/cdc_dual_write.go` — consumes Superleap CDC topic and replays inserts/updates/deletes into the partnerships MySQL via `pkg/cdc/repo.go`.
- `internal/outboxer/superleap_sub_merchant_link_handler.go:145` — calls `SyncPartnerLead()` on Superleap whenever a `merchant_access_map` row is created.
- `internal/job_kafka/partner_type_change_events.go:131-139` — gated by Splitz experiment `SuperleapKafkaMigrationExpID`; if disabled, no Superleap sync.
- No "cutover-complete" flag found anywhere. See `08_salesforce_to_superleap_migration.md` for the full picture.

### 2. Legacy commission calculator → Charge Collections SDK (✅ verified, gated)
Commission fee calculation has two implementations co-existing. Mode is chosen via Splitz experiment `PrtsCommissionCalculatorExpID` (`internal/commissions/commission/core.go:987-1006`). Modes (`internal/common/constants.go:15-18`):
- `ModeReverseShadow` = "reverse-shadow"
- `ModeCuttOff` = "cutoff" (note the **double-t typo** in the code constant name)
- `ModeShadow` = "shadow"
- `ModeDualWrite` = "dual-write"

A second, related Splitz flag `commission_ledger_reverse_shadow` (DCS feature, `internal/commissions/ledger/service.go:261-264`) controls whether reverse-shadow mode also creates ledger journal entries.

Detail in `04_commission_calculation_paths.md`.

### 3. Partner KYC dual-write (✅ verified, in-flight)
`internal/partner/kyc/access_state/dual_write_upsert.go` — accepts a `common.Mode` parameter and routes writes to different backends (legacy table vs new `partner_kyc_access_state` table). Same Mode enum as commission calculator.

### Other rough edges
- `api_outbox` table has **no `status` column** (`internal/database/migrations/20230823205449_api_outbox.go:13-43`) — only `retry_count`. Failure state is implied by retry_count + max retries threshold (`internal/api_outbox/core.go:251`). ⚠️ This means a "permanently failed" API outbox row looks identical to one that's been retried a lot. There's no terminal status to filter on.
- `outbox_jobs` schema is opaque from the partnerships repo — managed by `goutils/outbox/v4` library. The migration file at `internal/database/migrations/20230814015033_create_outbox_jobs.go:1-10` only delegates to `goutils/outbox/v4/sql/mysql`. To inspect schema you have to read `goutils`.
- The `commissions` table has **no unique constraint** on `(source_id, source_type, type)`. Idempotency for commission creation relies entirely on a 60-second mutex lock on `prts:cc:<payment_id>` (`internal/job_kafka/create_commissions_job.go`). If the lock TTL expires before retry, duplicate commissions are theoretically possible. ❗ needs verification (whether anyone has hit this).

---

## Feature flags / experiments

All routed through `goutils/splitz` via `internal/provider/splitz/`. Known experiments (✅ verified from grep):

| Experiment ID (Go field name) | Where used | What it controls |
|---|---|---|
| `PrtsCommissionCalculatorExpID` | `internal/commissions/commission/core.go:995` | Selects calculator mode (legacy / CC SDK / shadow / dual-write) |
| `PrtsCommissionInvoiceExpId` | `internal/commissions/commission_invoice/core.go:1081` | Auto-approval of invoices for selected partners |
| `SuperleapKafkaMigrationExpID` | `internal/job_kafka/partner_type_change_events.go:131-136` | Whether partner-type-change CDC events trigger Superleap sync |
| `SuperleapMigrationExpID` | `internal/outboxer/superleap_sub_merchant_link_handler.go:107` | Whether `merchant_access_map` creates trigger Superleap `SyncPartnerLead` |
| `CommissionReversalForRefundsExpID` | `internal/commissions/commission/core.go:472-479` | Whether refunds create reversal commissions |

DCS feature flags (separate from Splitz, evaluated via `provider/dcs`):

| Flag name (string) | Where used | What it controls |
|---|---|---|
| `commission_ledger_reverse_shadow` | `internal/commissions/ledger/service.go:261-264` | In dual-write mode, also create ledger journal entries |

---

## Failure Modes & Recovery (cross-service)

This is the umbrella view; each subdomain doc has its own deeper failure section.

| Failure | What happens | Recovery |
|---|---|---|
| Kafka consumer fails | Per-job `MaxRetries` (0–3 depending on job, `internal/job_kafka/*.go`). After exhaustion, framework dead-letters; **no DLQ topic config visible in repo** — handled in `goutils/worker/v3`. ❗ Check goutils for actual DLQ semantics. | Manual replay or wait for next CDC event |
| Outbox DB→Kafka relay fails | Managed by `goutils/outbox/v4`. Failure semantics not visible in partnerships repo. | Library-managed retry (configurable elsewhere) |
| Synchronous downstream call fails (Ledger, PGOS, Superleap, BVS) | Most are wrapped in errors; some flows write to the `api_outbox` table for async retry (`internal/api_outbox/core.go:22-46`) | `internal/batch_jobs/api_outbox_retry.go:18-34` runs every 10 minutes, retries rows whose `updated_at < now-10min` |
| Mutex unlock fails after commission creation | Logged but not blocking — the lock auto-expires at TTL (60s) | None needed; subsequent retry will see existing row |
| Duplicate Kafka delivery | Mutex lock on `prts:cc:<payment_id>` prevents simultaneous processing; a unique constraint violation on insert returns `nil` (treated as success) (`internal/job_kafka/create_commissions_job.go:121`). | Self-healing |
| Settlement release outbox event fails | Invoice stays in `Processed` state, settlement pending | Outbox retry by goutils framework |
| PDF generation / S3 upload fails | Returns `ErrS3UploadFailure` (`internal/commissions/commission_invoice/core.go:903`); invoice generation halts | Batch job rerun with `ForceRegenerate` flag (`internal/batch_jobs/commission_invoice_generate.go:69`) |

---

## Confidence

- §"Top-level layout" — ✅ Verified from `ls`-level scan + per-file reads.
- §"Data flow" — ✅ Verified for cited topics, Kafka jobs, outboxer handlers, and downstream calls.
- §"What's transitional / messy" — ✅ Verified each claim from the cited files.
- §"Feature flags" — ✅ Verified each call site.
- §"Failure Modes" — ✅ Verified for items with file:line refs; ❗ DLQ semantics need a `goutils/worker/v3` read.
