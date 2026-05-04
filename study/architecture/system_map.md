# Razorpay System Map

> **Phase 1 output.** Classification of locally available repos, their responsibilities, and how they communicate. Every claim is grounded in a file path inside `~/Desktop/git/`. Items not derivable from code are marked `⚠️ inferred` or `❗ needs verification`.

---

## 1. Repo Classification

Scanned 36 repos under `~/Desktop/git/`. Classified by role.

### Core / Critical (money + identity path)

| Repo | Lang | Purpose | Evidence |
|---|---|---|---|
| `api` | PHP 8.2 / Laravel 11 | The monolith. Orders, payments, merchants, gateway integrations | `api/composer.json`, `api/app/Http/Controllers/`, `api/app/Gateway/` |
| `pg-router` | Go 1.24.7 | Method-agnostic payment routing layer above gateways | `pg-router/cmd/api/main.go`, `pg-router/internal/payments/`, `pg-router/internal/orders/` |
| `pg-onboarding-service` | Go 1.25 | Merchant KYC + boarding (PGOS): autokyc, AMP cases, CKYC | `pg-onboarding-service/internal/autokyc/`, `internal/amp_case_creation/`, `internal/ckyc_upload/` |
| `route` | Go 1.24 | UPI / payment + transfer routing, idempotency | `route/cmd/route/main.go`, `route/internal/payment/`, `route/internal/transfer/` |
| `payments-card` | Go | Card payment service: tokenization, mandates, affordability, BIN | `payments-card/cmd/api/main.go`, `internal/affordability/`, `internal/mandate/`, `internal/bin_sdk_client/` |
| `terminals` | Go | POS terminal + device lifecycle, MCC, business type | `terminals/cmd/api/main.go`, `internal/business_type/`, `internal/Mcc/` |
| `ledger` | Go 1.23 | Double-entry ledger: accounts, journals, balances | `ledger/cmd/api/main.go`, `internal/account/`, `internal/journal/`, `internal/outbox/` |
| `settlements` | Go 1.24 | Merchant payout eligibility + delivery, refund/hold state | `settlements/cmd/api/main.go`, `cmd/ledger_processor/`, `cmd/workers/` |
| `auth-service` | PHP / Lumen | OAuth 2.0 server (auth.razorpay.com): tokens, clients | `auth-service/routes/web.php`, `app/Http/Controllers/{Auth,Token,Client}Controller.php` |
| `account-service` | Go 1.23 | Business account / merchant account lifecycle | `account-service/cmd/api/main.go`, `internal/asv/`, `internal/outbox/handlers/` |
| `dcs` | Go 1.25 | Dynamic Configuration Service: KV config + feature flag proxy | `dcs/cmd/server/main.go`, `internal/kv/`, `internal/proxy/`, `internal/auth/` |
| `partnerships` | Go 1.25 | Partner + sub-merchant + commission + invoice domain (HIGHEST PRIORITY for Tier 1) | `partnerships/cmd/api/main.go`, `internal/commissions/`, `internal/partner/`, `internal/merchant/` |
| `edge` | Lua / OpenResty / Kong | API gateway: auth, rate limit, WAF, routing | `edge/kong-plugins/`, `edge/kong.conf` |

### Supporting Services

| Repo | Lang | Purpose | Evidence |
|---|---|---|---|
| `stork` | Go 1.25 | Unified notifications: SMS, email, WhatsApp, push, webhooks | `stork/cmd/workers/{webhook,sms,whatsapp,email,pushnotification}/main.go`, `internal/smsrouter/`, `internal/emailch/` |
| `cmma` | Go 1.23 | Case Management & Merchant Activation, Camunda BPM-driven | `cmma/cmd/api/main.go`, `cmd/kafka-worker/main.go` (Camunda 7.15) |
| `wda-service` | Go 1.23 | Warm Data Access: query gateway over TiDB / Trino / ClickHouse / OpenSearch | `wda-service/cmd/api/main.go`, `internal/query-router/` |
| `reporting` | PHP / Lumen | 155+ entity reports (payouts, settlements, commissions) | `reporting/app/Jobs/GenerateReport.php`, `app/Http/Controllers/` |
| `charge-collections-sdk` | Go (lib) | Fee + tax calculation library; consumed by partnerships | imported in `partnerships/go.mod`, used in `partnerships/internal/commissions/commission/calculator/` |
| `onboarding-sdk` | TS / React 17 | Reusable onboarding UI components (npm package) | `onboarding-sdk/src/main.ts`, `package.json` |

### Data plumbing / CDC / Warehouse

| Repo | Lang | Purpose | Evidence |
|---|---|---|---|
| `maxwell-microservice` | Java | MySQL CDC daemon → Kafka topics `mysql_cdc_events_<db>_<table>` | `maxwell-microservice/` (config templates from S3) |
| `dynamo-cdc-v2` | Java / KCL 2.x | DynamoDB Streams CDC → Kafka or MySQL sink | `dynamo-cdc-v2/src/main/java/org/razorpay/`, multi-stream config |
| `datahub` | Scala/Java/Go/Python | Data lake: Spark, Trino, Pinot, S3 | per-component dirs in `datahub/` |

### Infra / DevOps

| Repo | Type | Purpose | Evidence |
|---|---|---|---|
| `kube-manifests` | Helm 3 templates | All cluster manifests across 12+ regions (prod, prod-edge, prod-hyd, etc.) | `kube-manifests/prod/`, `helmfile/helmfile.yaml` |
| `terraform-kong` | Terraform | Kong gateway routes/services/upstreams | `terraform-kong/prod/*.tf`, `module/*.tf`, `atlantis.yaml` |
| `alert-rules` | VMalert YAML | Prometheus / VictoriaMetrics alerting rules; Alertmanager HA | `alert-rules/rules/{prod-rules,nonprod-rules,prod-sg-rules,prod-us-rules}/` |
| `inventory-manifests` | Cartography YAML | Inventory of apps without their own repo (3DS, SDK clients, payment-pages) | `inventory-manifests/.cartography/` |
| `proto` | protobuf | Shared `.proto` definitions across ~90 services; Buf-managed | `proto/{abacus,accounts,authz,payments-card,settlements,stork,...}/`, `buf.yaml` |
| `goutils` | Go libs | 90 packages: telemetry, logger v3, kafka v2, sqlstorage, kvstore, outbox, cache, splitz client, etc. | `goutils/` (per-package READMEs) |
| `security-tools` | Mixed | 25+ scanners (semgrep, trivy, clamav, DDoS, sbom) | `security-tools/Dockerfile-*` |
| `end-to-end-tests` | Go + Argo Workflows | E2E suites for ~30 services; ReportPortal sink | `end-to-end-tests/tests/`, Dockerfile |

### Frontend / Tooling

| Repo | Type | Purpose | Evidence |
|---|---|---|---|
| `dashboard` | React 17 + Nx monorepo | Merchant dashboard with 15 federated micro-apps incl. `partnership` | `dashboard/apps/partnership/`, `apps/{shell,pos,onboarding-experience,...}/` |
| `frontend-care` | React 17 / Rollup npm pkg | Customer support / care UI (tickets, chat, grievances) | `frontend-care/src/{ticket-system,support,raise-grievance}/` |
| `mcp` | Go + Python | MCP servers (Coralogix logs, Spinnaker, E2E) for AI tooling | `mcp/{coralogix,spinnaker,e2e}/` |
| `claude-plugins` | Marketplace metadata | 18 official Razorpay plugins for Claude Code | `claude-plugins/plugins/`, `.claude-plugin/marketplace.json` |

---

## 2. Communication Patterns

Consistent patterns observed across Go services:

- **Sync (HTTP/RPC):** Twirp (partnerships, stork, wda-service, ledger), gRPC + grpc-gateway (account-service, dcs, route, terminals, ledger), gorilla/mux + Gin (pg-router, payments-card, terminals).
- **Async (Kafka):** all Go services use `goutils/event-streaming` v2 or `goutils/kafka` v2. Topic naming patterns:
  - `mysql_cdc_events_<db>_<table>` — Maxwell-emitted CDC (cited in `pg-router/config/default-live.toml:216-250`, `partnerships` consumes `mysql_cdc_events_*_account_service_merchants`)
  - `cdc_dynamodb_rzp_<service>_<mode>` — Dynamo CDC v2 output
  - `events.ledger.v2.{test|live}` — ledger events (`ledger/cmd/api/main.go`, outbox relay)
  - `stage_live_*_events`, `live_*_events` — domain events (settlements consumes `stage_live_payment_events`, `stage_live_route_events`, etc.)
- **Outbox pattern:** `goutils/outbox/v2`/`v4` ubiquitous (ledger, partnerships, payments-card, account-service). MySQL/Postgres → outbox table → relay worker → Kafka. Cited: `ledger/internal/outbox/`, `partnerships/internal/outboxer/` (47 files), `payments-card/cmd/outbox-relay-worker/`.
- **Pub/Sub (GCP):** ledger and api both have `cloud.google.com/go/pubsub` / `google/cloud-pubsub` (`ledger/go.mod`, `api/composer.json:82`). Usage scope ❗ needs verification.

### Authoritative service-to-service map

Built strictly from imports + config files I examined. Direction = caller → callee.

```
api (monolith)
 ├─ account-service           via account-service-php-sdk (api/composer.json:98)
 ├─ dcs                        via wda-php-sdk + dcs-php-sdk (api/composer.json:94,95)
 ├─ Spine (rules engine)       via razorpay/spine (api/composer.json:12)
 ├─ UPI clients                via razorpay/upi-clients (api/composer.json:27)
 └─ Kafka topics               order-update-event, send-notification-2-merchants-customers,
                               create-payment-transaction-event, create-ledger-journal-event,
                               commission-invoice-events-to-kafka  (api/config/kafka_consumer.php, config/app.php)

pg-router
 ├─ account-service (v2)        goutils/account-service/v2 (pg-router/go.mod:35)
 ├─ dcs                         goutils/dcs (pg-router/go.mod:39)
 ├─ cross-border-sdk            razorpay/cross-border-sdk (pg-router/go.mod:33)
 ├─ offers-engine (v2)          goutils/offers-engine/v2 (pg-router/go.mod:50)
 ├─ error-mapping-module        razorpay/error-mapping-module (pg-router/go.mod:34)
 └─ Kafka                       order-update-event, create-payment-transaction-event,
                                create-ledger-journal-event,
                                mysql_cdc_events_prod_pg_router_outbox_jobs
                                (pg-router/config/default-live.toml:216-250)

pg-onboarding-service
 ├─ account-service (v2)        goutils/account-service/v2 (pg-onboarding-service/go.mod:13)
 ├─ dcs                         goutils/dcs (go.mod:14)
 ├─ business-verification-svc   razorpay/business-verification-service-sdk-go (go.mod:12)
 ├─ matchengine                 goutils/matchengine (go.mod:20)
 └─ passport v4                 goutils/passport/v4 (go.mod:23)

ledger
 ├─ Kafka in: queueMakeshiftTxn (migration dual-write), transactor events
 ├─ Kafka out: events.ledger.v2.{test|live}
 ├─ outbox/v2                   goutils/outbox/v2 (ledger/go.mod:12)
 ├─ sns-outboxer                goutils/sns-outboxer (go.mod:14)
 └─ datastores: PostgreSQL (primary, config/bvt-live.toml:5 dialect=postgres),
                MySQL (secondary), Redis

settlements
 ├─ Kafka in (consumer):
 │    stage_live_payment_events, stage_live_charge_collections_events,
 │    stage_live_affordability_events, stage_live_growth_events,
 │    stage_live_route_events, stage_live_offers_events,
 │    stage-asv-account-update-events,
 │    internal_api_api-beta_bank_accounts,
 │    internal_db_stage_ledger_payments_test_outbox.public.outbox_jobs_settlements
 ├─ Kafka out (producer):
 │    settlements-refund-transaction-create,
 │    stage_live_transaction_record_events,
 │    stage_live_import_transaction_update
 └─ ledger: sync calls for journal queries

route (UPI)
 ├─ account-service             goutils/account-service (route/go.mod:8)
 ├─ dcs                         goutils/dcs (go.mod:9)
 ├─ spine                       goutils/spine (go.mod:13)
 ├─ splitz                      goutils/splitz (go.mod:14)
 ├─ passport v4                 goutils/passport/v4 (go.mod:10)
 └─ datastores: MySQL (payment, transfer, idempotency tables), TiDB,
                Redis, Elasticsearch (route/internal/tidb/migrations/)

payments-card
 ├─ account-service             goutils/account-service (payments-card/go.mod:14)
 ├─ spine                       goutils/spine (go.mod:8)
 ├─ cross-border-sdk            razorpay/cross-border-sdk (go.mod:13)
 ├─ charge-collections-sdk      razorpay/charge-collections-sdk (go.mod:12)
 ├─ config-proto                razorpay/config-proto (go.mod:15)
 ├─ outbox/v4                   goutils/outbox/v4 (go.mod:11)
 └─ Kafka via goutils/kafka v1.2.1 (go.mod:5)

terminals
 ├─ account-service (v2)        goutils/account-service/v2 (terminals/go.mod:8)
 ├─ business-verification-svc   razorpay/business-verification-service-sdk-go (go.mod:5)
 ├─ passport v4                 goutils/passport/v4 (go.mod:15)
 ├─ mozart, mozart/v3           goutils/mozart, mozart/v3 (go.mod:14,16)
 ├─ region                      goutils/region (go.mod:17)
 └─ event-streaming v2          goutils/event-streaming/{producer,consumer}/v2 (go.mod:9,10)

auth-service
 ├─ EdgeService (sync to Spine Edge / Cassandra+Postgres)
 ├─ DCS (feature flags via RazorX)
 ├─ Raven (email)
 ├─ Segment (analytics)
 └─ Api.php (merchant notifications)

account-service
 ├─ DCS, Authz, Splitz, Edge/Spine
 ├─ Kafka out (via outbox handlers):
 │    AccountUpdateKafkaPushHandler,
 │    MerchantUpdateKafkaPushHandler  (account-service/internal/outbox/handlers/)
 └─ JWT + Passport v4

dcs
 ├─ config-proto for schema
 ├─ Authz, Splitz
 ├─ Kafka producer for CDC sync to feature flag proxies (dcs/cmd/consumer/, internal/auditemitter/)
 └─ datastores: Aurora MySQL, Redis, DynamoDB (v1 flags), S3 (snapshots)

partnerships  ← see Tier-1 deep dive for full detail
 ├─ Sync clients (provider/, pkg/):
 │    ledger, pg_router, settlement, pgos, bvs, dcs, gimli, harvester,
 │    terminals, wda, splitz, stork, freshdesk, scrooge, account_service,
 │    authservice, partnership_service (merchant_service), api_client (monolith),
 │    s3Client, elasticsearch, trino, superleap (CDC client during migration)
 ├─ Kafka in (job_kafka/):
 │    create_commissions_job ← payment.captured-style events
 │    ledger_acknowledgment_event ← ledger outbox
 │    merchant_activation_events ← payment service
 │    partner_type_change_events ← mysql_cdc_events_*_account_service_merchants
 │    kyc_save_events, bvs_consent_document_event
 │    cdc_dual_write ← Superleap CDC (migration)
 ├─ Kafka out (outboxer/, 30 files):
 │    partner type changes, commission events, invoice events,
 │    merchant consent, activation events
 │    Notable: superleap_sub_merchant_link_handler (CDC migration)
 └─ datastores: MySQL (GORM, primary + reader replica), TiDB (WDA), Trino, Redis, ES

edge (Kong)
 ├─ kong-plugin-authz-enforcer (gRPC policy check)
 ├─ kong-plugin-consumer-identification (idempotency)
 └─ kong-plugin-geo-router (GeoLite2)

stork
 ├─ AWS SES, SNS, S3, FCM, Twilio, Gupshup, Plivo, MCarbon, Freshchat
 ├─ DCS for gateway routing rules
 ├─ Kafka out: stork.webhooks.v1 (async DB writes)
 ├─ Workers (cmd/workers/{webhook,sms,whatsapp,email,pushnotification})
 ├─ Scheduler (cmd/scheduler) re-queues pending/failed
 └─ datastores: PostgreSQL, Redis, AWS SQS

cmma
 ├─ Camunda 7.15 (process orchestration; ❗ process variables = source of truth, not CMMA tables)
 ├─ Splitz (gates activation case creation)
 ├─ Risk service
 ├─ Kafka in: cmma-case-events, stage-activation_form_submission_events
 └─ datastores: MySQL, Redis, Camunda DB

wda-service
 ├─ Backends: TiDB, Trino, ClickHouse, OpenSearch
 ├─ DCS (routing rules), Authz, Splitz
 └─ Twirp /twirp/rzp.common.wda.v1.QueryAPI/{ExecuteQuery,GetQueryStatus,GetQueryResult}

reporting
 ├─ MySQL (primary), TiDB (analytics), Spark (warehouse), PostgreSQL (query tracking)
 ├─ S3 (artifacts)
 ├─ Calls: api (entity lookups), Datum, Stork (notify), Scheduler, UFH (file storage)
 └─ Async job state machine: CREATED→PROCESSING→PROCESSED/FAILED

datahub  (multi-component)
 └─ Inputs: Kafka topics from many services, MySQL binlog via Maxwell,
            DynamoDB streams via dynamo-cdc-v2, S3 raw

maxwell-microservice
 └─ MySQL binlog → Kafka rzp.mysql_cdc_events_<db>_<table>  (stage MSK, prefixed)
                  → Kafka mysql_cdc_events_<db>_<table>      (prod Strimzi, no prefix)

dynamo-cdc-v2
 └─ DynamoDB Streams → Kafka cdc_dynamodb_rzp_<service>_<mode> (+ DLQ)
                       and/or direct MySQL writes (hybrid)
```

---

## 3. Datastore Footprint

| Store | Where used (cited) |
|---|---|
| **MySQL** (primary OLTP) | api, pg-router (`config/default-live.toml:24-56`), pg-onboarding-service, route (incl. TiDB), payments-card, terminals, partnerships, account-service (Aurora), dcs (Aurora), reporting, cmma |
| **PostgreSQL** | ledger (primary, `config/bvt-live.toml:5`), settlements (primary, replicas), stork, cmma, reporting (query tracking), edge (Kong internal) |
| **TiDB** | route (`internal/tidb/`), partnerships (WDA path, `pkg/wda/`), wda-service, reporting |
| **Redis** | nearly every Go service (caching, distributed mutex). Cluster mode in pg-router (`config:210`). |
| **DynamoDB** | pg-router (default TTL 2592000s, `config:12`), dcs (v1 feature flags), payments-card (optional), source for dynamo-cdc-v2 |
| **Trino** | partnerships (`pkg/trino/`), wda-service, datahub query layer, reporting analytics |
| **Elasticsearch / OpenSearch** | partnerships, route (optional), wda-service |
| **ClickHouse** | wda-service |
| **Pinot** | datahub (real-time OLAP, ⚠️ inferred from README) |
| **S3** | partnerships (invoice PDFs), stork (email templates), maxwell (configs), datahub raw, reporting |
| **AWS SQS** | stork (message queue), partnerships (`internal/job/`, async API outbox) |

---

## 4. Sync vs Async Flow Summary

**Sync (request/response):**
- Edge ingress: Kong (`edge/`) → service via Kong route (terraform-managed in `terraform-kong/prod/`)
- gRPC: account-service, dcs, route, terminals, ledger
- Twirp: partnerships, stork, wda-service, ledger, cmma, account-service (also)
- HTTP REST: api (Laravel), pg-router (gorilla/mux), payments-card (Gin), reporting (Lumen)
- Cross-service auth: JWT + Passport v4 in headers (auth-service issues, services validate)

**Async (event-driven):**
- **Kafka** is the dominant bus. `goutils/event-streaming` v2 is the standard.
- **CDC pipeline:** MySQL → Maxwell → `mysql_cdc_events_*` topics → consumers (partnerships consumes account-service CDC; pg-router CDC fed back to Kafka for outbox jobs).
- **Outbox:** Every transactional service uses an outbox table + relay worker to publish to Kafka. This is the "transactional Kafka write" pattern. Notable in `ledger/internal/outbox/`, `partnerships/internal/outboxer/`, `payments-card/cmd/outbox-relay-worker/`, `account-service/internal/outbox/handlers/`.
- **SQS** is used for partnerships' API outbox retries and stork's notification queue.
- **GCP Pub/Sub** appears in ledger and api dependency lists; usage scope ❗ needs verification.

---

## 5. High-Level Architecture (Mermaid)

See `system_diagram.mmd` (source) — also embedded inline below. Renders directly in GitHub / VS Code.

```mermaid
flowchart TB
  classDef monolith fill:#FFE4B5,stroke:#8B4513,color:#000
  classDef goSvc fill:#E0F0FF,stroke:#1F6FEB,color:#000
  classDef phpSvc fill:#FFE0E0,stroke:#B22222,color:#000
  classDef datastore fill:#F0F0F0,stroke:#555,color:#000
  classDef kafka fill:#E8E0FF,stroke:#5A2BB6,color:#000
  classDef ext fill:#FFF8DC,stroke:#A0522D,color:#000
  classDef fe fill:#E0FFE0,stroke:#2E7D32,color:#000

  Merchant([Merchant / Customer]):::ext

  subgraph Edge["Edge / Gateway"]
    EdgeKong[edge / Kong]:::goSvc
    AuthSvc[auth-service<br/>OAuth 2.0]:::phpSvc
  end

  subgraph FE["Frontends"]
    Dashboard[dashboard<br/>15 federated apps<br/>+ apps/partnership]:::fe
    Care[frontend-care]:::fe
  end

  subgraph CorePay["Payments core"]
    API[api<br/>PHP monolith]:::monolith
    PGR[pg-router]:::goSvc
    Route[route<br/>UPI / transfers]:::goSvc
    PCard[payments-card]:::goSvc
    Term[terminals<br/>POS]:::goSvc
    PGOS[pg-onboarding-service]:::goSvc
  end

  subgraph Identity["Identity / Config"]
    AccSvc[account-service]:::goSvc
    DCS[dcs<br/>config + flags]:::goSvc
  end

  subgraph Money["Money movement"]
    Ledger[ledger<br/>double-entry]:::goSvc
    Settle[settlements]:::goSvc
  end

  subgraph PartnersDomain["Partnerships domain"]
    Part[partnerships]:::goSvc
    CCSDK[charge-collections-sdk<br/>fee/tax library]:::goSvc
  end

  subgraph Support["Support services"]
    Stork[stork<br/>notifications]:::goSvc
    CMMA[cmma<br/>Camunda]:::goSvc
    WDA[wda-service]:::goSvc
    Report[reporting]:::phpSvc
  end

  subgraph DataPlane["Data plumbing"]
    Maxwell[maxwell-microservice<br/>MySQL CDC]:::goSvc
    DynaCDC[dynamo-cdc-v2<br/>Dynamo Streams CDC]:::goSvc
    DataHub[datahub<br/>Trino+Spark+S3]:::goSvc
  end

  subgraph Stores["Datastores"]
    MySQL[(MySQL)]:::datastore
    PG[(PostgreSQL)]:::datastore
    TiDB[(TiDB)]:::datastore
    Redis[(Redis)]:::datastore
    Dynamo[(DynamoDB)]:::datastore
    Trino[(Trino)]:::datastore
    ES[(ES / OpenSearch)]:::datastore
    S3[(S3)]:::datastore
  end

  KafkaBus{{Kafka<br/>events.ledger.v2 / mysql_cdc_events_* / cdc_dynamodb_rzp_* / stage_live_*_events}}:::kafka

  Merchant --> EdgeKong
  EdgeKong --> AuthSvc
  EdgeKong --> API
  EdgeKong --> PGR
  EdgeKong --> Part
  EdgeKong --> Dashboard
  EdgeKong --> Care

  Dashboard -->|/merchant/api/{mode}| API
  Dashboard -->|partnership app| Part

  API -->|gRPC SDK| AccSvc
  API -->|SDK| DCS
  API --> PGR
  API --> Stork

  PGR --> AccSvc
  PGR --> DCS
  PGR --> Route
  PGR --> PCard
  PGR --> PGOS
  PGOS --> AccSvc
  PGOS --> DCS
  Route --> AccSvc
  PCard --> AccSvc

  Part -->|sync provider clients| Ledger
  Part --> PGR
  Part --> AccSvc
  Part --> DCS
  Part --> WDA
  Part --> Stork
  Part --> Term
  Part --> Settle
  Part -->|fee calc| CCSDK

  Settle --> Ledger
  Report --> API
  Report --> Stork
  CMMA --> AccSvc

  %% Async bus
  API -.->|order-update-event<br/>create-payment-transaction-event<br/>create-ledger-journal-event| KafkaBus
  PGR -.-> KafkaBus
  Ledger -.->|events.ledger.v2| KafkaBus
  AccSvc -.->|outbox| KafkaBus
  Part -.->|outbox 30+ handlers| KafkaBus

  KafkaBus -.->|stage_live_*_events| Settle
  KafkaBus -.->|merchant_activation<br/>partner_type_change<br/>create_commissions| Part
  KafkaBus -.->|cdc_dual_write Superleap| Part

  MySQL -->|binlog| Maxwell
  Maxwell -.->|mysql_cdc_events_*| KafkaBus
  Dynamo -->|streams| DynaCDC
  DynaCDC -.->|cdc_dynamodb_rzp_*| KafkaBus

  KafkaBus --> DataHub

  %% Datastore wiring (compressed)
  API --- MySQL
  PGR --- MySQL
  PGR --- Redis
  PGR --- Dynamo
  Part --- MySQL
  Part --- TiDB
  Part --- Trino
  Part --- Redis
  Ledger --- PG
  Settle --- PG
  Stork --- PG
  Route --- TiDB
  Route --- MySQL
  AccSvc --- MySQL
  AccSvc --- Redis
  WDA --- TiDB
  WDA --- Trino
  WDA --- ES
```

---

## 6. Open Questions / Verification Backlog

These came up while scanning and are worth confirming during deeper dives:

- ❗ **Pub/Sub usage scope** in `api/composer.json:82` (`google/cloud-pubsub`) and `ledger/go.mod` (`cloud.google.com/go/pubsub`) — what topics, in what direction?
- ❗ **edge ↔ Kong DB**: Edge mostly references stateless plugins; Kong itself in prod likely uses Postgres but I haven't seen the prod config.
- ❗ **CMMA process IDs in TOML** change per Camunda BPMN deploy (per its README) — flagged for the Tier-2 doc.
- ❗ **Splitz vs RazorX:** auth-service mentions RazorX, others use Splitz. Are they the same system or two? Look in `goutils/splitz/` and the api repo's RazorX package.
- ❗ **api → ledger:** I see `create-ledger-journal-event` Kafka topic published by api but didn't trace the consumer. Likely `ledger`'s Kafka in path.
- ❗ **partnerships-salesforce-superleap migration:** the local Markdown migration plans (Feb 2026) describe an in-flight CDC dual-write. Code evidence is present (`partnerships/internal/job_kafka/cdc_dual_write.go`, `outboxer/superleap_sub_merchant_link_handler.go`). Status of cutover ❗ needs verification — will dig into the migration audit module during Tier-1.
- ❗ **end-to-end-tests** has suites for ~30 services; need to map which suites correspond to which Tier-1 flows we'll be documenting.

---

## 7. Confidence Tags Per Section

- §1 Repo classification — ✅ Verified (every row cites file/dir).
- §2 Communication patterns — ✅ Verified for cited topics + go.mod imports; some inter-service calls inferred from SDK presence are ⚠️.
- §3 Datastore footprint — ✅ Verified from config files cited.
- §4 Sync/async summary — ✅ Verified pattern observations; specific topic→consumer pairings sometimes ⚠️ where consumer code wasn't read.
- §5 Mermaid diagram — Aggregated from §1–§4. Edges are ⚠️ where the underlying call was inferred from SDK presence rather than a confirmed call site.
