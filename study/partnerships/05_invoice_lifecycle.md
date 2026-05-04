# Commission Invoice Lifecycle

> Invoice generation (monthly batch), approval (auto/manual), PDF rendering, S3 upload, settlement release.

Repo root: `~/Desktop/git/partnerships`. Cite paths are relative to it.

---

## High-level flow

```
cron / cmd/batch
     │
     ▼
CommissionInvoiceGenerateJob.Execute()             batch_jobs/commission_invoice_generate.go:44
     │  (paginated over partners with feature enabled,
     │   1000 partners per page, 3-hour cursor TTL)
     │
     ▼  per partner: workerManager.Perform(GenerateInvoicePayload)
     │
     ▼  worker → outbox handler → server.GenerateCommissionInvoice()
GenerateCommissionInvoice(ctx, payload)            commission_invoice/server.go:119
     │  - Sum commissions for (partner_id, month, year)
     │  - Insert commission_invoice row in `Issued` state
     │  - Insert line_items (one per pricing_feature group)
     │  - line_item_tax (one per (line_item, tax_component))
     │
     ▼ status: Issued
     │  Splitz check: PrtsCommissionInvoiceExpId
     │
     ▼  if auto-approval enabled:
UpdateInvoiceStatus(Issued → UnderReview)
     │
     ▼
UpdateInvoiceStatus(UnderReview → Approved)        // auto, with metadata[autoApproval]
     │
     ▼  PDF render + S3 upload
     │  pdf_generator.GeneratePdfFromHTML()        commission_invoice/core.go:896
     │  s3Client.UploadBytesToS3()                  commission_invoice/core.go:901
     │  → bucket: invoiceConfig.S3BucketName
     │  → key:    pdfs/commission/<invoice_id>_<unix>.pdf
     │
     ▼
UpdateInvoiceStatus(Approved → Processed)
     │
     ▼  outbox.Send(SettlementReleasePayload)       dualwrite_process_invoice.go:214
     │  action = "settlement_release"
     │
     ▼
settlement_release_handler.go → settlements service
```

---

## Entity model

### `CommissionInvoice` struct (✅ verified at `internal/commissions/commission_invoice/model.go:27-37`)

```go
type CommissionInvoice struct {
    spine.SoftDeletableModel  // ID, CreatedAt, UpdatedAt, DeletedAt

    MerchantID  string                  // line 27 — the partner's merchant id (note: not partner_id)
    Month       uint32                  // line 28
    Year        uint32                  // line 29
    Status      Status                  // line 30
    GrossAmount int64                   // line 31 — paise, sum of fees
    TaxAmount   int64                   // line 32 — paise, sum of taxes
    BalanceID   string                  // line 33 — settlement balance id
    Notes       string                  // line 34
    Tnc         string                  // line 35 — terms & conditions text
    FileDetails datatype.JSON           // line 36 — { FileName, Location, BucketName, StorkFileId }
    LineItems   []lineItem.LineItem     // line 37 — fk: EntityID
}
```

### Status enum (✅ verified at `internal/commissions/commission_invoice/status.go:6-9`)

| Value | Meaning |
|---|---|
| `Issued` | Newly generated, awaiting review |
| `UnderReview` | Partner / ops team is reviewing |
| `Approved` | Approved, ready to settle |
| `Processed` | Settlement release dispatched |

**Allowed transitions** (`status.go:16-21`):

```
Issued       → UnderReview
UnderReview  → Approved
Approved     → Processed
```

No backward transitions, no skips, no `Failed` / `Cancelled`. This is a strictly forward-only state machine.

### `commission_invoice` table (✅ verified at `internal/database/migrations/20230630161725_create_commission_invoice.go:14-32`)

| Column | Type |
|---|---|
| `id` | char(14) PK |
| `merchant_id` | char(14) NOT NULL |
| `month` | int unsigned |
| `year` | int unsigned |
| `status` | varchar(32) |
| `gross_amount` | int unsigned |
| `tax_amount` | int unsigned |
| `balance_id` | char(14) |
| `notes` | text |
| `tnc` | text |
| `file_details` | json |
| `created_at`, `updated_at`, `deleted_at` | int / nullable |

**Indexes:** `commission_invoice_created_at_index`, `commission_invoice_merchant_id_index`.

> Note `month`/`year` are stored as separate uint columns. There is no period-uniqueness constraint at the DB level — `(merchant_id, month, year)` could in theory have duplicates. The batch-job side prevents this via the `regenerate_if_exists` flag (`commission_invoice/core.go:59`).

### `line_item` table (✅ verified at `internal/database/migrations/20230605101010_create_line_item.go:14-30`)

| Column | Type |
|---|---|
| `id` | char(14) PK |
| `name` | varchar(512) |
| `gross_amount` | bigint unsigned |
| `tax_amount` | bigint unsigned |
| `tax_rate` | int unsigned |
| `currency` | char(3) |
| `entity_id` | char(14) FK → commission_invoice.id |
| `entity_type` | varchar(32) |
| `created_at`, `updated_at`, `deleted_at` | int / nullable |

Index: `line_item_entity_id_index`.

### `line_item_tax` table (✅ verified at `internal/database/migrations/20230605101005_create_line_item_tax.go:14-29`)

| Column | Type |
|---|---|
| `id` | char(14) PK |
| `name` | varchar(512) |
| `rate` | int unsigned |
| `rate_type` | varchar(15) |
| `amount` | bigint |
| `tax_id` | char(14) |
| `line_item_id` | char(14) FK |
| `created_at`, `updated_at`, `deleted_at` | int / nullable |

Index: `line_item_tax_line_item_id_index`.

---

## Generation: the batch job

```go
// internal/batch_jobs/commission_invoice_generate.go (✅ verified)
const (
    MaxPartnerIdsCount = 1000                // line 20
    cursorCacheKey     = "prts:invoice_after_id"  // line 21
    cursorCacheTTL     = 3 * time.Hour       // line 22
)

func (c *CommissionInvoiceGenerateJob) Execute(ctx) error {  // line 44
    // 1. Fetch partners-with-feature from API monolith
    partners := c.apiClient.FetchPartnersWithCommissionInvoiceFeature(...)  // line 56
                                                          // paginated, cursor in Redis

    // 2. For each partner, build payload and dispatch
    for partner in partners {
        payload := GenerateInvoicePayload{
            PartnerID: partner.ID,
            Month:     defaultPrevMonth,    // line 67-70 — defaults to previous month
            Year:      defaultPrevYear,
            ForceRegenerate: false,         // line 69
        }
        c.workerManager.Perform(payload)    // line 83
    }
}
```

Triggered from `cmd/batch/main.go:20` — entry point for batch workers. Schedule isn't in the repo (it's defined in `kube-manifests` cron / Spinnaker pipeline, ❗ not verified inside partnerships repo).

The actual invoice creation happens in `GenerateCommissionInvoice()` at `commission_invoice/server.go:119` — sums commissions for `(partner_id, month, year)`, inserts the invoice row, line items, and line item taxes, all in a single transaction.

> The query that identifies which commissions to invoice isn't pasted here verbatim because it's inside `core.go` and constructed from the GORM repo abstraction. Practically: it filters by `(partner_id, billing_period_start, billing_period_end)` derived from `(month, year)` and joins `commissions` + `commission_components` to compute the per-feature breakdown. ⚠️ The exact filter on `status` (does it pick `created` and `captured`, or only `captured`?) is one to verify when you next dig in — the answer affects what happens to in-flight commissions at month-end.

---

## Approval

`CommissionInvoiceAPI` is a Twirp service with one mutating method:

```go
// internal/commissions/commission_invoice/server.go:130-150 (✅ verified)
func (s *Server) UpdateInvoiceStatus(ctx, request) (*Resp, error) {
    if err := ValidateUpdateStatusRequest(request); err != nil {  // line 135
        return nil, err
    }
    return s.core.UpdateInvoiceStatus(ctx, request)              // line 144
}
```

The validator enforces the state-transition table from `status.go:16-21`.

### Auto-approval

✅ Verified at `internal/commissions/commission_invoice/core.go:1081-1094`:

```go
func (c *Core) isPartnerAutoApprovalExperimentEnabled(ctx, partnerId) bool {
    // Splitz exp: PrtsCommissionInvoiceExpId
    variant, _ := splitz.GetVariant(...PrtsCommissionInvoiceExpId, ...)
    return variant.Name == "enabled"   // or similar
}
```

When enabled, the invoice processing path automatically transitions `Issued → UnderReview → Approved`, and the metadata flag `autoApproval` is included in the eventual `SettlementReleasePayload` (`reverseshadow_process_invoice.go:246`). When disabled, the invoice waits in `Issued` for an operator (or partner-side dashboard) to call `UpdateInvoiceStatus` manually.

### State path summary

| From | To | Trigger |
|---|---|---|
| (none) | Issued | `GenerateCommissionInvoice` succeeds |
| Issued | UnderReview | Auto (if Splitz enabled) or manual |
| UnderReview | Approved | Auto (if Splitz enabled) or manual |
| Approved | Processed | After PDF generation + settlement release outbox publish |

The "Processed" status emission of an outbox event is the formal handoff to the settlements service.

---

## PDF generation + S3 upload

```go
// internal/commissions/commission_invoice/core.go:892-903 (✅ verified)
htmlTemplates := map[string]string{
    "MY": "my_commission_invoice",   // Malaysia
    "IN": "commission_invoice",      // India
}
template := htmlTemplates[mode]                                    // line 64-67

pdfBytes, err := c.pdfGenerator.GeneratePdfFromHTML(template, data)  // line 896
if err != nil { return ErrPdfGeneration }

s3Key := fmt.Sprintf("%s_%d.pdf", invoice.ID, time.Now().Unix())   // line 900
err = c.s3Client.UploadBytesToS3(s3Key, pdfBytes,
                                  c.invoiceConfig.S3BucketName)    // line 901
if err != nil { return ErrS3UploadFailure }                        // line 903
```

Constants:
- S3 prefix: `pdfs/commission/` (`core.go:50`, ✅ verified)
- Pre-signed URL TTL: `15 * time.Minute` (`core.go:57`, ✅ verified)
- PDF date format: `02-01-2006` (`core.go:55`)

Pre-signed URL retrieval — for the merchant dashboard or email link:

```go
// internal/commissions/commission_invoice/core.go:322-346 (✅ verified)
func (c *Core) GetInvoicePreSignedUrl(ctx, invoiceID) (string, error) {
    url, err := c.s3Client.GeneratePresignedURLForGetObject(...)   // line 341
    if err != nil { return "", ErrS3PresignedURLGenerationFailure } // line 346
    return url, nil
}
```

---

## Settlement integration

The "this invoice owes the partner X paise" handoff to the settlements service.

```go
// internal/commissions/commission_invoice/dualwrite_process_invoice.go:204-214 (✅ verified)
payload := SettlementReleasePayload{
    InvoiceID: invoice.ID,
    Amount:    invoice.GrossAmount - invoice.TaxAmount,  // approximated; actual logic may include TDS
    BalanceID: invoice.BalanceID,
    Metadata: map[string]string{
        "autoApproval": strconv.FormatBool(autoApproval),
    },
}
outbox.Send(ctx, payload, "settlement_release")   // line 214
```

Action name: `"settlement_release"` (`dualwrite_process_invoice.go:150`).

The outbox handler that processes this is `internal/outboxer/settlement_release_handler.go`, which calls into the settlements service. Settlement state names referenced in `reverseshadow_process_invoice.go:22-23`:

```
createAndSettlement = "create_and_settlement"
settlement          = "settlement"
```

Distinct invoice processing files **per mode**:
- `commission_invoice/cutoff_process_invoice.go`
- `commission_invoice/dualwrite_process_invoice.go`
- `commission_invoice/reverseshadow_process_invoice.go`

Same Mode enum as the calculator (`internal/common/constants.go:15-18`). The selection follows the same Splitz pattern — likely the same `PrtsCommissionInvoiceExpId` flag controls invoice mode too. ⚠️ Inferred — verify by reading the dispatch in `core.go`.

---

## Outbox events on invoice status changes

✅ Verified at `internal/outboxer/commission_invoice_handler.go:1-62`:

```go
type CommissionInvoiceOutboxHandler struct { invoiceServer ... }

// Payload: CommissionInvoiceCreationPayload
// Trigger: written by GenerateCommissionInvoice and by retry pathways
func (h *CommissionInvoiceOutboxHandler) Handle(...) error {
    return h.invoiceServer.GenerateCommissionInvoice(ctx, payload.PartnerID, ...)  // line 46
}
```

Plus communication-level events emitted via `events.PushCommissionInvoiceEvent` (✅ verified):

| Status reached | Event published | Line |
|---|---|---|
| Issued | `PartnershipsCommissionInvoiceGenerated` | `core.go:1005` |
| UnderReview | `PartnershipsCommissionInvoiceApproved` | `core.go:1031` |
| Processed | `PartnershipsCommissionInvoiceProcessed` | `core.go:1069` |

These are consumed by Stork (notifications) — the partner gets an email when the invoice is generated, an internal user gets one when it's approved, etc.

---

## `FileDetails` JSON structure

Stored in the `commission_invoice.file_details` JSON column (✅ verified at `model.go:36-45`):

```go
type FileDetails struct {
    FileName     string
    Location     string  // s3 key
    BucketName   string
    StorkFileId  string  // optional, when uploaded for stork delivery
}
```

Retrieved via `(c *CommissionInvoice) GetFileDetails()` at `model.go:113-120`.

---

## Failure Modes & Recovery

| Failure | Behavior | Recovery |
|---|---|---|
| `pdfGenerator.GeneratePdfFromHTML` fails | Returns error; invoice stays in `Approved` (or whichever state was set immediately before PDF gen) | Re-run batch with `ForceRegenerate: true` (`batch_jobs/commission_invoice_generate.go:69`) |
| S3 upload fails | `ErrS3UploadFailure` (`core.go:903`); same as above — invoice stays in pre-Processed state | Same — `ForceRegenerate` re-runs PDF + upload |
| `outbox.Send(SettlementReleasePayload)` fails (transactional) | Whole "Approved → Processed" transition rolls back; invoice stays in `Approved` | Subsequent processing run will retry; outbox is transactional with status update |
| Settlement service rejects the release | Outbox row stays in `outbox_jobs` until the goutils outbox library retries | Library-managed retry. ❗ specifics in `goutils/outbox/v4` |
| Pre-signed URL generation fails | `ErrS3PresignedURLGenerationFailure` (`core.go:346`) — the invoice is still rendered + stored, just the download URL can't be generated right now | Retry the GET; URL regeneration is idempotent |
| Pagination cursor stale (>3h TTL) | Batch job re-fetches from start of partner list | Slightly redundant work for already-processed partners; the `regenerate_if_exists` flag is `false` by default, so existing invoices are skipped |
| Same-period regeneration without flag | Existing invoice for `(merchant_id, month, year)` is not rewritten — silently skipped | Pass `ForceRegenerate: true` in `GenerateInvoicePayload` |
| Invoice generation transaction partially commits (line items but no invoice row) | Should not happen — the entire write is one DB transaction | If it does, ⚠️ orphan line_items would exist; would require manual cleanup |
| Communication push (Stork) fails | The status-change event is published via the `events.PushCommissionInvoiceEvent` channel which routes through the outbox; failures retry there | Outbox library retry |
| `auto_approval` Splitz flips off mid-run | Some invoices already auto-approved; new ones stay in `Issued` | Acceptable — auto-approval is best-effort; manual approval is always possible |

### Permanent-failure detection (or lack thereof)

There is **no `Failed` status** in the invoice state machine (`status.go:6-9`). An invoice that has hit repeated S3 upload errors stays in `Approved` indefinitely until the next batch run with `ForceRegenerate`. The only signal that something is wrong is:
1. Coralogix logs from the worker
2. Alerting on the `outbox_jobs` table backing up
3. Partner-side complaint that the invoice never arrived

Operationally, ❗ a stuck `Approved` invoice should be detectable via a query like:
```sql
SELECT id, merchant_id, month, year, updated_at FROM commission_invoice
WHERE status = 'Approved' AND updated_at < UNIX_TIMESTAMP(NOW() - INTERVAL 1 DAY)
```

This is implicit — there's no built-in alert.

---

## Confidence

- ✅ Verified: model fields + line refs, status enum + transitions, batch job structure + constants, PDF + S3 paths and constants, communication events with line refs, FileDetails JSON shape.
- ⚠️ Inferred: precise commission-status filter (`created` vs `captured`) used by the invoice query; whether the same Splitz experiment gates both auto-approval and processing-mode.
- ❗ Needs verification: cron schedule (lives in kube-manifests / Spinnaker, not in repo); whether TDS deduction happens here or in the settlements service when the release event is consumed.
