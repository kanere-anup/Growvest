# Databases at Razorpay

> Which datastore each service uses, why it was chosen, and how migrations are managed.

---

## Datastore inventory

| Store | Where | Why |
|---|---|---|
| **MySQL** | api, pg-router, pg-onboarding-service, route (TiDB MySQL-compat), partnerships, account-service (Aurora flavor), dcs (Aurora), reporting, cmma | The Razorpay default OLTP store. Heavy use of GORM (Go) + Eloquent (PHP) |
| **PostgreSQL** | ledger (primary), settlements (primary, replicas), stork, cmma, reporting (query tracking) | Where transaction semantics + JSONB richness matter. Notably **ledger** is Postgres-first |
| **TiDB** | route (transfers, payments, idempotency), wda-service, partnerships (warm copy via WDA), reporting | High-throughput, MySQL-compatible distributed SQL. Picked when horizontal scaling matters |
| **DynamoDB** | pg-router (TTL'd state, 30 days), dcs (legacy v1 feature flags), payments-card (optional), source for `dynamo-cdc-v2` | When you want very fast key lookups + native TTL |
| **Trino** | partnerships (analytics), wda-service, datahub (query layer), reporting | Federated SQL over the data lake |
| **Elasticsearch / OpenSearch** | partnerships, route (optional), wda-service | Search + log analytics |
| **ClickHouse** | wda-service | Columnar OLAP for analytical queries |
| **Pinot** | datahub (real-time OLAP) | ⚠️ inferred from datahub README |
| **Aurora MySQL** | dcs, account-service | High-availability MySQL with Postgres-like features |
| **S3** | partnerships (PDFs), stork (templates), maxwell (configs), datahub (raw data), reporting (artifacts) | Blob storage |
| **Cassandra + Postgres** | edge (token validation cache via Spine Edge) | Read-optimized cache for token validation at edge |

---

## MySQL — the workhorse

### Configuration patterns

Every Go service sets up a writer + one or more readers. Example from pg-router (✅ verified at `config/default-live.toml:24-56`):

```
[Db.Writer]
host = "..."
charset = "utf8mb4"

[Db.Reader]
host = "..."  # read replica
```

Charset is consistently `utf8mb4` for Unicode safety.

### ID format

Almost every entity ID is **`char(14)`**. Razorpay uses 14-character UID generators (Spine library, see `goutils/uniqueid`). You'll see this in every migration:

```sql
id char(14) NOT NULL PRIMARY KEY
```

Foreign keys are also `char(14)` matching the parent ID.

### Soft-delete convention

Most tables include:
```sql
deleted_at int DEFAULT NULL    -- (or bigint depending on era)
```

The Spine ORM library (`razorpay/spine`) gives every model a `SoftDeletableModel` base struct. ⚠️ This means **default queries filter out soft-deleted rows automatically** — be careful when writing custom SQL that you don't accidentally include them, and conversely don't forget that `deleted_at IS NULL` is implicit in the ORM.

### Example schema — partnerships (✅ verified)

```sql
-- internal/database/migrations/20221010155829_create_commissions.go:15-42
CREATE TABLE commissions (
  id              char(14)   NOT NULL,
  source_id       char(14)   NOT NULL,
  source_type     varchar(60) NOT NULL,
  partner_id      char(14)   NOT NULL,
  -- ...
  status          varchar(60) NOT NULL,
  debit, credit   bigint(20) NOT NULL,
  currency        char(3)    NOT NULL,
  fee, tax        int(10)    NOT NULL,
  -- ...
  created_at, updated_at, deleted_at int,
  PRIMARY KEY (id),
  KEY commissions_source_id_index (source_id),
  KEY commissions_partner_id_created_at_index (partner_id, created_at)
);
```

### Migration tooling: Goose (Go) vs custom (PHP)

✅ Verified pattern across Go services (partnerships, ledger, pg-router, route):

```go
// internal/database/migrations/20250429154200_create_consents.go (✅ verified)
func init() {
    goose.AddMigration(up, down)
}

func up(tx *sql.Tx) error {
    _, err := tx.Exec("CREATE TABLE IF NOT EXISTS consents (...)")
    return err
}
```

Filename convention: `<UTC_timestamp>_<snake_name>.go`.

The PHP api monolith uses Laravel's migration framework instead.

### Migration runner

Each Go service has its own `cmd/migration/main.go` binary that runs Goose's CLI. This binary is run as a Kubernetes init container before the main service starts (✅ verified for partnerships per `cmd/migration/main.go` and the kube-manifests pattern).

### Partitioning

Some high-volume tables are partitioned by `created_at` range. ✅ Example: `partnerships/api_outbox` (`internal/database/migrations/20230823205449_api_outbox.go:13-43`). Maxvalue partition acts as overflow.

---

## PostgreSQL — for ledger & settlements

The ledger is **Postgres-primary**:

```toml
# ledger/config/bvt-live.toml:5 (✅ verified)
dialect = "postgres"
```

Why Postgres for ledger:
- Transactional semantics with strong isolation guarantees (matters for double-entry write atomicity)
- JSONB for flexible event/note payloads
- Better support for analytical functions used in reconciliation

Settlements is also Postgres-primary, with read replicas for query workloads.

### CDC from Postgres

Postgres outbox tables are watched by Debezium-style CDC. Example topic produced for partnerships' ledger consumer:

```
internal_db_stage_ledger_payments_test_outbox.public.outbox_jobs_partnerships
```

This is how the ledger's outbox table produces a stream that downstream services consume to reconcile journals.

---

## TiDB — when scale is the constraint

**route** is the most prominent TiDB user. Why:
- MySQL wire-compatible, so existing tooling works
- Horizontally scalable by adding TiKV nodes
- Transfers can spike 10x during marketplace events (festival sales etc.)

✅ Verified at `route/internal/tidb/migrations/`. Tables: `api_transfers`, `api_reversals`, `api_payments`, `idempotency_keys`.

**partnerships** uses TiDB **indirectly via WDA** (`wda-service`) for warm-data reads. The primary store stays MySQL; WDA is the analytical mirror.

---

## DynamoDB — TTL-driven

Used by **pg-router** for short-lived state. Default TTL: 2,592,000 seconds = 30 days (`config/default-live.toml:12`).

`dcs` historically used DynamoDB for v1 feature flags but has migrated to Aurora-backed v2 (only legacy reads remain).

`dynamo-cdc-v2` (Java/KCL) is the CDC pipeline that converts Dynamo Stream events to either Kafka or direct MySQL writes. It supports up to 5 streams per deployment with multi-schema mapping.

---

## Trino — federated SQL over the data lake

Used as a query layer over multiple sources:
- Spark-managed warehouse (Parquet on S3)
- Pinot (real-time OLAP)
- MySQL / Postgres metadata

Partnerships uses Trino for commission analytics queries (`pkg/trino/`). WDA uses it as one of its routing backends.

---

## Elasticsearch / OpenSearch

- partnerships (search + indexing)
- route (optional)
- wda-service (log search)
- reporting (analytics)

Uses vary; the common case is full-text search over merchant + payment metadata.

---

## ClickHouse

Used by **wda-service** as a backend for columnar analytical queries (think: "show me commission totals by payment method by month for partner X").

---

## Aurora MySQL

- **dcs** uses Aurora MySQL for its KV config storage (the v2 feature flag store).
- **account-service** uses Aurora for parity reads via `goutils/spine`.

Aurora gives Razorpay automated failover + read scaling without the operational overhead of managing MySQL replicas manually.

---

## Patterns

### Read replicas

Universal. Every Go service config has a Reader DSN distinct from the Writer. The lag-check pattern (visible in `api/config/database.php:71-72`) inspects replication lag and routes reads to writer when lag is too high.

### Connection pooling

Standard Go database/sql connection pooling. Specific pool sizes are config-driven and tuned per service.

### Outbox tables (mentioned for completeness — full detail in `tools/kafka.md`)

Universal. Every transactional service has an `outbox_jobs` (or similar) table that participates in the same DB transaction as business writes, then is shipped to Kafka by a relay process.

---

## Failure Modes (cross-cutting)

| Failure | Common pattern |
|---|---|
| Writer down | Auto-failover (Aurora / RDS Multi-AZ) within 30-90s. Outbox row not yet committed = no event leak |
| Reader replication lag | Lag-check driver routes reads back to writer; degraded perf but correct |
| Connection pool exhaustion | Service returns 5xx; graceful degradation |
| Schema migration partial failure | Goose's transaction-wrapped migrations should roll back; prolonged outage if migration deadlocks |
| Cross-DC traffic during failover | Higher latency; standard Razorpay multi-AZ deployment handles this |

---

## What's transitional / messy

- **dcs v1 → v2 migration**: dcs originally stored feature flags in DynamoDB; v2 uses Aurora MySQL. v1 read paths still exist for legacy consumers.
- **partnerships ↔ Superleap dual-write**: not a database choice per se, but a write-target choice (Salesforce-fed data vs. Superleap-fed data). See `partnerships/08_…_migration.md`.
- **partnerships outbox library opacity**: the `outbox_jobs` schema isn't visible in the partnerships repo — it's inside `goutils/outbox/v4`. To see exact columns, read goutils.

---

## Confidence

- ✅ Verified: store-to-service mapping (every entry from configs / migrations seen during scans), Goose migration pattern, ID format, charset, soft-delete convention, partition example, ledger Postgres dialect.
- ⚠️ Inferred: Pinot usage in datahub (README only); precise Aurora vs MySQL split for account-service.
- ❗ Needs verification: per-service connection pool sizes; cross-DC failover behavior in actual incidents.
