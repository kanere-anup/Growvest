# Partner Lifecycle

> Identity, KYC, partner type changes, sales POC. Code-grounded; every claim has a file:line ref to `~/Desktop/git/partnerships/`.

---

## Where the partner identity actually lives

A first surprise. The `partnerships` service does **not** own a `partners` table. The source of truth for "is this merchant a partner, and of what type?" is `account-service`'s `merchants` table, which has a `partner_type` column. Partnerships consumes CDC from there.

The partnerships service holds a **read view** for its own joins:

```go
// pkg/merchant/model.go:16-36 (✅ verified)
type Merchant struct {
    ID          string
    Name        string
    PartnerType string   // mirrored from account-service via CDC
    CreatedAt   int64
    ...
}
```

What partnerships *does* own as first-class entities:
- `partner_kyc_access_state` (KYC approval workflow per partner) — see Section "KYC State Machine" below
- `partner_configs` (pricing tier, TDS%, payment methods)
- `partner_migration_audit` (history of partner type transitions; see `08_…_migration.md`)
- `partner_config_audit` (history of partner_config changes)
- Sales POC info — but this is **fetched on-demand** from Superleap, not stored locally

---

## Partner types

Defined as string constants (✅ verified at `internal/common/constants.go:19-22`):

| Constant | Value |
|---|---|
| `Reseller` | `"reseller"` |
| `FullyManaged` | `"fully_managed"` |
| `PurePlatform` | `"pure_platform"` |
| `Aggregator` | `"aggregator"` |

These match the values that come over CDC from `account-service`. Each partner type implies a different commission/onboarding/KYC workflow, but the partnerships repo treats the type mostly as a string filter (no central state machine).

---

## KYC state machine

The partner-side KYC approval lives in `partner_kyc_access_state`.

**Schema** (✅ verified at `internal/database/migrations/20241203205754_create_partner_kyc_access_state.go:14-31`):

| Column | Type | Note |
|---|---|---|
| `id` | char(14) | PK, Razorpay ID format |
| `entity_id` | char(14) | The entity being onboarded (sub-merchant id, typically) |
| `entity_type` | varchar(50) | e.g., merchant |
| `partner_id` | char(14) | Owning partner |
| `state` | varchar(20) | See enum below |
| `approve_token` | varchar(50) | Magic-link token for approval |
| `reject_token` | varchar(50) | Magic-link token for rejection |
| `token_expiry` | int | unix sec |
| `rejection_count` | tinyint | tracks repeat rejections |
| `created_at`, `updated_at`, `deleted_at` | int | soft delete |

**State enum** (✅ verified at `internal/partner/kyc/access_state/model.go:14-21`):

```
"pending_approval"   ← initial
"pending"
"approved"           ← terminal-success
"rejected"           ← terminal-fail (but allows re-submission via rejection_count)
```

**Dual-write mode switch.** State writes route through a mode-aware upsert at `internal/partner/kyc/access_state/dual_write_upsert.go`:

```go
// pseudo-shape, real call site:
cf.DualWriteByMode(ctx, experimentMode, &DualWritePayload{...})
```

`experimentMode` is one of the standard `common.Mode` values (`internal/common/constants.go:15-18`):
- `ModeReverseShadow` (`"reverse-shadow"`)
- `ModeCuttOff` (`"cutoff"`) — note the **double-t typo** preserved in code
- `ModeShadow` (`"shadow"`)
- `ModeDualWrite` (`"dual-write"`)

The mode determines which backing store (legacy or new) gets written, and whether reads come from one or both. This is a transitional pattern — see `08_…_migration.md` for migration context.

---

## The Twirp surface

Service: **`PartnerAPI`**, defined at `proto/partnerships/partner/v1/partner_api.proto:7-13`.

| RPC | Handler | Purpose |
|---|---|---|
| `CreateWorkflowAndSyncForMerchantKyc` | `internal/partner/server.go:31-93` | Kick off PGOS workflow + sync user details for a sub-merchant entering KYC under this partner |
| `EnableRegion` | `internal/partner/server.go:96-129` | Enable a geographic region for the partner; emits webhooks |
| `GetRegions` | `internal/partner/server.go:132-161` | Read currently-enabled regions |
| `HandlePartnerWebhooks` | `internal/partner/server.go:165-192` | Re-enqueue partner webhooks (typically for retry) |
| `GetReportVisibility` | `internal/partner/server.go:…` | Returns whether the partner can see specific reports |

> **What's missing.** There is **no `CreatePartner` RPC here**. Partner creation happens in account-service (or its upstream) and propagates through CDC. Partnerships only handles partner-related *workflows*, not partner-record creation. This is consistent with the identity ownership model above.

---

## Onboarding flow: `CreateWorkflowAndSyncForMerchantKyc`

This is the main flow you'll see called when a sub-merchant under a partner enters KYC. It lives at `internal/partner/core.go:61-205` (✅ verified).

```
Caller (Razorpay API monolith, Twirp request)
   │
   ▼
1. core.CreateWorkflowAndSyncForMerchantKyc()
   ├─ pgosClient.CreateWorkflow()       (pkg/pgos/pgos_client.go:89)
   │     └─ POST to PGOS — creates a KYC workflow row
   ├─ apiClient.UpsertUserDetails()      (write user details to monolith)
   ├─ apiClient.GetUserDetails()         (read back to validate)
   ├─ merchantService.GetMerchantDetails()
   └─ pgosClient.OnboardingSave()        (pkg/pgos/pgos_client.go:136)
         └─ POST to PGOS — saves form fields
```

If any of those calls fail, the whole RPC returns an error to the caller; **no partial-progress recovery is built into this handler.** PGOS may have its own retry, but partnerships does not retry these calls itself — they're part of the synchronous request path.

### EnableRegion + HandlePartnerWebhooks (outbox pattern)

In contrast, region enablement uses the outbox pattern:

```go
// internal/partner/core.go:262-273 (paraphrased, ✅ verified)
db.Transaction(func(tx) error {
    write region enabled state
    outbox.Send(ctx, EnableRegionPayload{...})
    return nil
})
```

The outbox row is then dispatched asynchronously by the GORM outbox plugin (`internal/database/plugins/outbox_events.go:46-77`) on commit, and processed by `internal/outboxer/enable_region_handler.go`. See `07_outbox_and_kafka.md` for relay details.

`HandlePartnerWebhooks` works similarly — it enqueues one outbox job per region, with payload `HandlePartnerWebhooksPayload`. Full detail of those handlers is in `07`.

---

## KYC integration (PGOS + BVS)

### PGOS client

`pkg/pgos/pgos_client.go` (✅ verified):

| Method | File:line | Purpose |
|---|---|---|
| `CreateWorkflow()` | line 89 | Creates a KYC workflow on PGOS for a (merchant, partner) pair |
| `OnboardingSave()` | line 136 | Saves filled-in onboarding fields to PGOS |
| `GetMerchantOnboardingDetails()` | line 191 | Reads PGOS state for a merchant |

Request builders that produce the right payload for the partner-KYC subflow (✅ verified at `pkg/pgos/model.go`):
- `NewCreateWorkflowRequestForMerchantKYC()` (line 9)
- `NewOnboardingSaveRequestForMerchantKYC()` (line 27)

### BVS (Business Verification Service) integration

Lighter-touch — partnerships listens to BVS *events* rather than calling BVS directly for partner workflows:

```go
// internal/job_kafka/bvs_consent_document_event.go:16-60 (✅ verified)
// Kafka topic: stage-prts-bvs-consent-document-events  (config/default.toml:34)
// Handler: ProcessBVSConsentDocumentAckEvent
//   → consent.Core.ProcessBVSConsentDocumentAckEvent(ctx, bvsMessageData)
// Retry: MaxRetries=0, Timeout=60s
```

There's also BVS SDK init via `internal/provider/bvs/provider.go:InitializeBvsSdk()`, used elsewhere in the consent flow (see `06_merchant_access.md`).

### KYC form save event

```go
// internal/job_kafka/kyc_save_events.go (✅ verified)
// Kafka topic: kyc_form_save_events  (config/default.toml line for kyc_form_save_events)
// Handler signature: (e *KycSaveEventJob) Handle(ctx context.Context) error  // line 111
// Action: deps.EventAuditServer.CreateEventAudit()
// Filter: source must equal PGOS                          (line 171)
// Retry: MaxRetries=3, Timeout=1s                          (lines 104-105)
```

This consumer purely produces audit log entries; it doesn't mutate KYC state.

---

## Partner type change events

The most interesting consumer in the partner domain. When `account-service` updates a merchant's `partner_type` (e.g., reseller → aggregator), Maxwell CDC emits an event, and partnerships processes it.

```go
// internal/job_kafka/partner_type_change_events.go (✅ verified)
// Topic config:    partner_type_change_event   (config/default.toml:35)
// Actual topic:    mysql_cdc_events_*_account_service_merchants  (Maxwell-prefixed)
// Handler:         (job *PartnerTypeChangeEventJob) Handle()    line 120
```

**Filter** at `IsPartnerTypeChanged()` (line 58):
- The CDC `old` map must contain `partner_type`
- The new value must be non-empty
- Otherwise the event is skipped (avoids re-acting on unrelated merchant updates)

**Action** at `syncPartnerTypeChange()` (line 128):
1. Splitz check: `deps.SplitzProvider.IsExperimentEnabled(ctx, SuperleapKafkaMigrationExpID, merchantID, nil, false)` — **if disabled, returns early without doing anything** (line 131-136).
2. If enabled: `deps.SuperleapClient.SyncPartnerType(ctx, &superleap.SyncPartnerTypeRequest{...})` — pushes the new partner type to Superleap CRM.

Retry config: `MaxRetries: 1, Timeout: 60s` (lines 109-110). So if Superleap is down, we get exactly two attempts, then the event is dead-lettered to whatever the goutils worker framework does with it.

> ❗ **Failure mode worth understanding.** If the Splitz experiment is disabled, partner type changes silently *never* sync to Superleap. There is no audit trail in the partnerships DB that the event was received and skipped — only the standard structured log. If the experiment is later enabled but the events are already past Kafka retention, those changes will be silently lost. The intended recovery path is the migration backfill batch job (`internal/batch_jobs/partner_migration_backfill.go`); see `08_…_migration.md`.

---

## Sales POC

```go
// internal/partner/sales_poc/service.go:13-24 (✅ verified)
type Service struct { superleapClient *superleap.SuperleapClient }

func (s *Service) GetSalesPOC(ctx, merchantID) (*partnersalespocv1.GetSalesPOCResponse, error) {
    return s.superleapClient.GetSalesPOC(ctx, merchantID)
}
```

Pass-through to Superleap. Partnerships does not store sales POC info locally.

---

## Failure Modes & Recovery

Specific to partner-lifecycle operations.

| Failure | What happens | Recovery |
|---|---|---|
| `CreateWorkflowAndSyncForMerchantKyc` — PGOS down | Returns error to caller; no partial state in partnerships DB | Caller (typically API monolith) is expected to retry the Twirp call. ❗ *No idempotency key* on the partnerships side, so a second retry will create a fresh PGOS workflow if the first one half-succeeded. |
| Partner type change event — Superleap call fails | `MaxRetries: 1` then dead-letter | `internal/batch_jobs/partner_migration_backfill.go` provides a CSV-driven backfill path |
| Partner type change event — Splitz disabled | Event silently skipped, no audit | Re-run partner_migration_backfill with full CSV |
| KYC access state dual-write — one of two stores fails | Depends on `Mode`. In `ModeDualWrite`, transaction rolls back if either fails. In `ModeShadow`, primary succeeds and shadow failure is logged but not blocking. | Replay via outbox |
| BVS consent event consumer fails | `MaxRetries: 0` — single attempt, immediate dead-letter on failure | ❗ *No automatic retry path*. Manual replay required. This is the most fragile consumer in the partner domain. |
| KYC form save audit fails | `MaxRetries: 3` with 1s timeout | Self-healing within 3 attempts; otherwise audit lost |

### Idempotency notes

- **No `IdempotencyKey` field** found in any partner-domain struct (`❗ not found at internal/partner/*.go`). The partnerships service relies on:
  - Account-service-issued canonical merchant IDs (so the same merchant can't be processed under two IDs)
  - Database unique constraints where they exist (e.g., `partner_kyc_access_state.id` PK)
  - Mutex locks (mostly in commission flows, not partner flows)

If you hit a "duplicate workflow created in PGOS" issue, the deduplication needs to happen on the PGOS side or the calling service — partnerships will not detect it.

---

## Confidence

- ✅ Verified: partner types, KYC state schema + enum, Twirp method list, PGOS client method names + line numbers, all Kafka topic names cited from `config/default.toml`, retry counts, Splitz experiment names.
- ⚠️ Inferred: behavior of `ModeShadow` for KYC dual-write (analogous to commission shadow mode but not directly read).
- ❗ Needs verification: DLQ destination after `MaxRetries: 0` on BVS consent consumer; whether goutils/worker has a default DLQ or just drops.
