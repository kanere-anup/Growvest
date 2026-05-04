# Razorpay System Analysis — Knowledge Base

> Code-grounded documentation of Razorpay's architecture, with deepest detail on the **partnerships** domain and the **end-to-end UPI payment flow**.

This knowledge base was generated from a deep read of 36 local repositories under `~/Desktop/git/`. Every claim cites a file path, often with a line number. Confidence tags (✅ verified / ⚠️ inferred / ❗ needs verification) appear throughout so you can tell what's solid evidence vs. extrapolation.

---

## How to read this

- **Start at the [system map](architecture/system_map.md)** if you've never seen the platform before. It catalogs every repo, communication patterns, datastore footprint, and a high-level Mermaid diagram.
- **Jump to a specific topic** via the index below.
- **Diagrams** live in [`diagrams/`](diagrams/) as standalone `.mmd` files (Mermaid source) — the same diagrams are also embedded inline in their parent docs, so you don't have to render anything separately to read.

### Confidence tags

| Tag | Meaning |
|---|---|
| ✅ | Verified from code with file:line refs |
| ⚠️ | Inferred from indirect evidence (SDK presence, docs, naming) |
| ❗ | Needs verification — flagged for follow-up |

Each doc has a "Confidence" section at the end summarizing where the strongest evidence is and where the gaps are.

---

## What's here

### Phase 1 — System Discovery

- [`architecture/system_map.md`](architecture/system_map.md) — full repo classification (5 tiers, 36 repos), service-to-service comms map, datastore footprint, sync vs async patterns, embedded high-level Mermaid diagram, verification backlog
- [`diagrams/system_diagram.mmd`](diagrams/system_diagram.mmd) — standalone Mermaid source

### Phase 2 Tier 1 — Partnerships (deepest detail)

The partnerships domain is the highest-priority deep dive. All 8 docs are code-grounded with file:line citations.

- [`partnerships/01_overview.md`](partnerships/01_overview.md) — high-level architecture, transitional/messy parts, all feature flags, data flow diagram
- [`partnerships/02_partner_lifecycle.md`](partnerships/02_partner_lifecycle.md) — partner identity, types, KYC state machine, partner type changes, sales POC
- [`partnerships/03_commission_engine_overview.md`](partnerships/03_commission_engine_overview.md) — components, the dual-mode calculator, mode switching architecture
- [`partnerships/04_commission_calculation_paths.md`](partnerships/04_commission_calculation_paths.md) — actual fee math, CC SDK inputs/outputs, refund reversals, edge cases, tests as contract
- [`partnerships/05_invoice_lifecycle.md`](partnerships/05_invoice_lifecycle.md) — generation batch, approval, PDF + S3, settlement release
- [`partnerships/06_merchant_access.md`](partnerships/06_merchant_access.md) — partner ↔ sub-merchant access map, invites, consent, LOS
- [`partnerships/07_outbox_and_kafka.md`](partnerships/07_outbox_and_kafka.md) — outbox tables, GORM plugin, 7 Kafka consumers with verbatim topic names
- [`partnerships/08_salesforce_to_superleap_migration.md`](partnerships/08_salesforce_to_superleap_migration.md) — the in-flight dual-write migration, current state

### Phase 2 Tier 1 — End-to-end payments (UPI)

- [`payments/payment_flow_upi.md`](payments/payment_flow_upi.md) — the canonical UPI capture flow traced across api → pg-router → gateway → ledger → settlements; failure modes; brief variation notes for cards/netbanking/wallets
- [`diagrams/upi_payment_sequence.mmd`](diagrams/upi_payment_sequence.mmd) — standalone sequence diagram source

### Phase 2 Tier 2 — Service-level docs

- [`architecture/auth-service.md`](architecture/auth-service.md) — OAuth 2.0 server
- [`architecture/account-service.md`](architecture/account-service.md) — merchant identity source-of-truth
- [`architecture/pg-router.md`](architecture/pg-router.md) — payment routing service
- [`architecture/ledger.md`](architecture/ledger.md) — double-entry accounting
- [`architecture/edge.md`](architecture/edge.md) — Kong API gateway
- [`architecture/settlements.md`](architecture/settlements.md) — settlement eligibility + creation
- [`architecture/route.md`](architecture/route.md) — Razorpay Route (transfer / split product)
- [`architecture/dashboard.md`](architecture/dashboard.md) — merchant frontend (15 federated apps)

### Phase 2 Tier 3 — Tools, infra, deployment

- [`tools/kafka.md`](tools/kafka.md) — topic naming, outbox pattern, CDC sources, per-service consumer/producer reference
- [`tools/redis.md`](tools/redis.md) — connection roles (cache / mutex / session / rate limit), TTL conventions, key patterns
- [`tools/databases.md`](tools/databases.md) — datastore inventory, Goose migrations, MySQL / Postgres / TiDB / DynamoDB / Trino / etc.
- [`deployment/kubernetes.md`](deployment/kubernetes.md) — kube-manifests structure, multi-region, canary pattern
- [`deployment/terraform_kong.md`](deployment/terraform_kong.md) — Kong routing config, Atlantis CI, route variants
- [`deployment/cicd.md`](deployment/cicd.md) — GitHub Actions, SLIT, E2E, Spinnaker, Devstack, Atlantis

---

## Surprises worth knowing

A few things that aren't obvious from the code alone but came out of the deep reads. If you remember nothing else, remember these:

1. **Partnerships does NOT own partner identity.** The `merchants` table in `account-service` does. Partnerships consumes CDC and holds a read view.
2. **The `commissions` table has no unique constraint** on `(source_id, source_type, type)`. Idempotency is a 60-second mutex on `prts:cc:<payment_id>`. If retry is delayed >60s, theoretically duplicate commissions are possible.
3. **BVS consent consumer has `MaxRetries: 0`** — single delivery failure = data loss. Most fragile consumer in the partnerships domain.
4. **The `api_outbox` table has no terminal "failed" status** column. Retry counts increment forever; permanently-failed rows look identical to ones being retried.
5. **The Salesforce → Superleap migration is dual-write, NOT cutover.** No "cutover-complete" boolean exists in code. Outbound syncs are gated by Splitz experiments — disabled experiments silently skip events with no audit row.
6. **Two Mode constants are named identically across domains** (`ModeReverseShadow`, `ModeCuttOff` (typo!), `ModeShadow`, `ModeDualWrite` from `internal/common/constants.go:15-18`). They're used in commission calculator, invoice processor, and partner KYC dual-write — same enum, different domains. The pattern is recurring.
7. **Settlements consumes payment events via the `payment-events` topic, NOT a `stage_live_payment_events` topic** (the latter exists but the production consumer is `cmd/ledger_processor` reading from `payment-events`). Phase 1's claim was misleading; the deep scan corrected it.
8. **`api_outbox` is partitioned by `created_at` range.** Maxvalue partition acts as overflow. This is unusual enough to call out.
9. **Image tags are commit SHAs.** Deploys = updating SHA in `kube-manifests/<env>/<service>/values.yaml`. Trivially auditable but means you need both repo + manifest repo to fully pin a deployment.

---

## Verification backlog

Items I flagged as `❗ needs verification` while writing. Resolving any of these would tighten the knowledge base.

| # | Item | Where flagged |
|---|---|---|
| 1 | Where exactly `eligibleFrom` (settlement timestamp) is computed | `architecture/settlements.md`, `payments/payment_flow_upi.md` |
| 2 | Production Kafka topic names (most cited values are stage) | `tools/kafka.md`, multiple service docs |
| 3 | Schema of `outbox_jobs` (managed by `goutils/outbox/v4` library, not visible in repos) | `partnerships/07_outbox_and_kafka.md`, `tools/kafka.md` |
| 4 | DLQ destination after `MaxRetries: 0` (where do messages go?) | `partnerships/07_outbox_and_kafka.md`, `tools/kafka.md` |
| 5 | Whether goutils' Kafka worker provides default DLQ or just drops | `tools/kafka.md` |
| 6 | Splitz vs RazorX overlap (auth-service uses RazorX; rest use Splitz) | `architecture/system_map.md` §6, `architecture/auth-service.md` |
| 7 | Cutover state of Salesforce→Superleap (when does it complete?) | `partnerships/08_…_migration.md` |
| 8 | Cron schedule for invoice generation (lives in kube-manifests / Spinnaker, not in repo) | `partnerships/05_invoice_lifecycle.md` |
| 9 | TDS application site (calculator does NOT apply TDS — where does it?) | `partnerships/04_commission_calculation_paths.md` |
| 10 | Consumer group names for partnerships' Kafka consumers | `partnerships/07_outbox_and_kafka.md` |
| 11 | The producer of `settlements-refund-transaction-create` topic | `architecture/settlements.md` |
| 12 | Existence of central GitHub Actions composite-action library | `deployment/cicd.md` |
| 13 | Argo CD vs Spinnaker exact boundaries (who applies what) | `deployment/cicd.md` |
| 14 | dashboard's Twirp-over-HTTP proxy mechanism in api monolith | `architecture/dashboard.md` |
| 15 | Edge → DCS / authz gRPC integration details (lives in Lua plugins, not deeply read) | `architecture/edge.md` |

---

## Out of scope (deliberate)

What this knowledge base does NOT cover (yet):

- Card payment flow detail (only contrasted briefly in the UPI doc)
- Netbanking flow detail (same)
- Wallet flow detail (same)
- Recurring / subscription flow
- Razorpay Route transfer flow detail (Tier 2 only)
- The `datahub` data lake internals
- The `frontend-care` customer-support module internals
- POS / terminals deep dive
- Capital / lending product domain
- Wallet (Razorpay-issued) internals
- All `goutils` internals (referenced but not deep-read)
- Kong control-plane operational details (data plane / `edge` plugins are covered)
- Banking / nodal account flows

These are good Phase 3 candidates if you want to extend.

---

## Repo coverage

Of the 36 local repos under `~/Desktop/git/`:

**Deeply covered:** `partnerships`, `api` (UPI flow), `pg-router` (UPI flow + service overview), `ledger`, `settlements`, `route`, `auth-service`, `account-service`, `edge`, `dashboard`, `kube-manifests`, `terraform-kong`.

**Mentioned in system map + tools/infra docs:** `stork`, `cmma`, `wda-service`, `reporting`, `payments-card`, `terminals`, `pg-onboarding-service`, `dcs`, `onboarding-sdk`, `charge-collections-sdk`, `datahub`, `dynamo-cdc-v2`, `maxwell-microservice`, `proto`, `goutils`, `inventory-manifests`, `alert-rules`, `security-tools`, `end-to-end-tests`, `frontend-care`, `mcp`, `claude-plugins`.

---

Last generated: 2026-04-30 (Phase 1 + Phase 2 Tiers 1, 2, 3 complete).
