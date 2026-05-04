# Kubernetes — kube-manifests

> Where every Razorpay service's K8s deployment is defined. Helm-templated YAML, multi-region, multi-environment.

Repo: `~/Desktop/git/kube-manifests`. Helm 3 templates rendered to YAML.

---

## What's in here

This single repo holds K8s manifests for **every** prod, stage, and dev environment across multiple regions. It is the central place to look for "how is X service deployed?".

It does NOT hold:
- Service code (in each service's repo)
- Kong route definitions (in `terraform-kong`)
- Alert rules (in `alert-rules`)
- Inventory metadata for non-repo apps (in `inventory-manifests`)

---

## Top-level layout (✅ verified)

```
helmfile/
  helmfile.yaml              ← Helm orchestration (default cleanup, wait, timeout, history)
prod/                        ← main prod
prod-edge/                   ← edge prod
prod-edge-blue/              ← edge canary blue
prod-edge-green/             ← edge canary green
prod-wallet-green/, prod-wallet-white/  ← wallet variants
prod-sg-rules/, prod-us-rules/          ← regional alert overlays (yes, "rules" is a misnomer here)
prod-capital-*/              ← capital product clusters
prod-de-*/, prod-opti-jump-*/, prod-noncde-bm-v3-*/, prod-upisw-apb-*/  ← specialized
stage/                       ← staging
dev/                         ← dev
in/, hyd/, malaysia/, us/, sg/  ← regional sub-trees
cells/                       ← cell-based isolation deployments (POS-related)
billme-*/, dse-*/, ips-*/    ← niche product deployments
automation/, cde/, bvt/      ← infrastructure tooling environments
templates/                   ← shared K8s manifest templates
scripts/                     ← deployment tooling
images/                      ← documentation assets
```

---

## Helmfile config

✅ Verified at `helmfile/helmfile.yaml:1-100`:

```yaml
helmDefaults:
  cleanupOnFail: false
  wait: true
  timeout: 1200       # seconds
  historyMax: 1

environments:
  # devstack: ephemeral envs with TTL labels (default 8h)
  ...
```

`cleanupOnFail: false` is deliberate — it keeps failed releases around so operators can debug instead of K8s ripping them out.

`historyMax: 1` keeps memory low at the cost of fewer rollback points.

---

## Service deployment shape

Each service has a values file (Helm-rendered) under each environment dir. Example: partnerships in prod.

```yaml
# kube-manifests/prod/partnerships/values.yaml (✅ verified, fields shown)
image: "3d25f615236d3db074353bd059fd7e35aee812ef"   # commit SHA from CI
replicas:
  partnerships_live: 5
  partnerships_test: 1
resources:
  cpu_requests:    500m
  memory_requests: 200Mi
  memory_limits:   200Mi
ingress:
  type: traefik-external
  ingress_v2: enabled
  concierge_routing: enabled
workers:
  # 6 worker types (Kafka + SQS) with configurable replicas + concurrency
  ...
hpa:
  enabled: true
  min_replicas: 5
canary:
  baseline_weight: 96
  canary_weight: 2
  dark_weight: 2
```

### Why `image` is a commit SHA

Each repo's CI builds an image tagged with the commit SHA and pushes it to the registry. Deploy = update the SHA in this values.yaml + apply. This makes deploys atomic and trivially auditable (PR diff shows the SHA change).

### Canary weights

The `96/2/2` split (baseline / canary / dark) is the standard partnerships rollout shape. `dark` traffic is mirrored to a third deployment that returns nothing to the caller — used to validate new code under prod load without affecting users.

---

## Ingress

Most services use **Traefik** as the ingress controller:
- `traefik-external` — public-facing
- `traefik-internal` — east-west (service-to-service inside the cluster)
- `traefik-v2` — newer version middleware path

Traefik plus `concierge_routing` (a Razorpay-internal layer) handle ingress + service-discovery decisions.

DNS config per service typically pins `dnsPolicy: ClusterFirst` with explicit `ndots` overrides — keeps DNS lookups predictable inside the cluster.

---

## HPA

Horizontal Pod Autoscaler is enabled for most services with `min_replicas` set in values. Razorpay tunes this per service based on traffic patterns. Partnerships' `min_replicas: 5` is set high enough to absorb traffic spikes without cold-start overhead.

---

## Multi-region deployments

The clear pattern:
- `prod/` — primary cluster (typically AP-South)
- `prod-sg-rules/`, `prod-us-rules/` — regional clusters with per-region rule overlays
- `prod-edge-*/` — edge ingress clusters per AZ / region
- `in/`, `hyd/`, `malaysia/`, `us/`, `sg/` — region-specific sub-trees

This is how Razorpay routes traffic close to merchant + customer geography. Geo-routing happens at edge (`edge/kong-plugins/kong-plugin-geo-router`) using the `GeoLite2-Country.mmdb` file.

---

## Workers

Most Razorpay services run multiple deployments per binary type:
- `<service>` — the main API server
- `<service>-worker-<job-name>` — one deployment per Kafka consumer / SQS worker

For partnerships specifically: 6 worker deployment types reflecting the 7+ Kafka consumers (some grouped together).

Worker deployments typically have lower min replicas than the API server (they're consumer-bound, not request-bound).

---

## What's NOT directly in kube-manifests

- **Image registry config** — handled in shared CI tooling.
- **Vault / secret injection config** — usually init-container based; specifics in shared templates.
- **CronJobs** — sometimes manifested here, sometimes in a separate `cron` overlay per service.
- **Network policies** — present but not deeply scanned in this pass.

---

## Failure Modes

| Failure | Behavior | Recovery |
|---|---|---|
| Deploy fails (image pull error, syntax error) | `cleanupOnFail: false` keeps the failed release; manual `helm rollback` or `helm uninstall` | Operator decides |
| Pod CrashLoopBackOff after deploy | Standard K8s back-off; HPA may scale down | Investigate via Coralogix logs; rollback by editing image SHA back |
| Image pull rate-limit on registry | Multiple pods stuck `ContainerCreating` | Wait + cluster has cached layers; retry |
| Ingress controller (Traefik) hits a bad rule | Some routes 502/503; specific service unreachable | Roll back the ingress portion of the values; concierge routing fails open in some configs |
| HPA mis-tuned (panic-scaling on noisy metric) | Cluster cost spikes, but services stay up | Tune metric source / thresholds in values |
| Helm release stuck in `pending-upgrade` | Manual intervention; previous bad release jam | `helm rollback <release> <revision>` |

---

## Where to look for things

| Want to know... | Look at |
|---|---|
| What image is in prod for service X? | `prod/<service>/values.yaml` (or regional equivalent) |
| How many replicas? | Same file; `replicas` block |
| Resource limits? | Same file; `resources` block |
| What workers exist? | Same file; `workers` block |
| Canary status? | Same file; `canary` block (and the actual deploy state in the cluster) |
| What's in dev / stage? | `dev/<service>/values.yaml`, `stage/<service>/values.yaml` |
| What region is this deployment? | The top-level dir name |

---

## Confidence

- ✅ Verified: layout, helmfile defaults, partnerships values structure, canary pattern, ingress controller, multi-region pattern.
- ⚠️ Inferred: precise number of services manifested (60+ observable from Phase 1 scan; full enumeration not done here); exact HPA metric sources.
- ❗ Out of scope: Helm chart internals (which sub-templates are rendered for each service); per-environment secret management.
