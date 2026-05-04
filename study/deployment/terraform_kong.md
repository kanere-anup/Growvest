# terraform-kong

> Terraform-managed Kong API Gateway configuration. Routes, services, upstreams, plugins. PR-driven via Atlantis.

Repo: `~/Desktop/git/terraform-kong`. HCL.

---

## Mental model

```
edge (Lua plugins, in `~/Desktop/git/edge`)
   ▲
   │ define plugins
   │
terraform-kong (this repo)
   │ wires {service, route, upstream, plugins}
   ▼
Kong control plane
   │ deploys
   ▼
Kong data plane (handles requests)
```

Plugins are defined in `edge`; Kong's *configuration* — which plugins to apply to which route, service definitions, upstream targets — is in this repo.

PRs to this repo generate Atlantis plans that ops engineers review and apply.

---

## Top-level layout (✅ verified)

```
prod/         ← 37+ .tf files (one per service variant)
stage/        ← staging Kong configuration
module/       ← reusable Terraform modules for Kong resources
templates/    ← shared Kong configuration snippets
base/         ← base Kong infrastructure
atlantis.yaml ← Atlantis CI config
```

---

## The reusable module (`module/`)

✅ Verified files:

| File | What it defines |
|---|---|
| `service.tf` | A `kong_service` resource. Upstream config merged from inputs. Timeouts: connect/write/read all 60s. (`module/service.tf:1-15`) |
| `route.tf` | `kong_route` resources. Merged from 6 path types: `paths`, `identified`, `authenticated`, `oauth`, `login_as_mx_internal`, `login_as_mx_external`. Routes with `dark_enabled` go to `edge-dark.razorpay.com`. (`module/route.tf:1-30`) |
| `upstream.tf` | Target balancing + health checks for the upstream service |
| `plugins.tf` | Plugin chain (auth, JWT, rate-limit, etc.) |
| `errors.tf` | Validates that service plugins are not specified inside referenced modules. Uses a `null_resource` error handler to fail-fast. (`module/errors.tf:1-43`) |
| `variables.tf` | Input schema |
| `output.tf` | Outputs |

This module is invoked **once per service variant** in `prod/*.tf` files.

---

## Per-service Terraform files (`prod/*.tf`)

37+ .tf files, each typically representing one service or a variant of a service:

- `api*.tf` (multiple variants: api-2, api-graphql, api-internal, api-wallet)
- `payment-create.tf`, `payment-handle.tf`
- `partnerships.tf`
- `pgos.tf`
- `recon-saas.tf`
- `optimizer.tf`
- `cron.tf`, `batch.tf`
- `capital-api-proxy.tf`
- `hallmark-standard-checkout.tf` (API + CDN variants)
- `scrooge.tf`

Each file declares variables:
- `name` (service name)
- `paths` (route paths to expose)
- `auth` (plugin chain)
- `upstream` config

Plus variants like canary, baseline, dark — Razorpay rolls out gateway changes through these traffic shapes (same idea as kube-manifests canary).

---

## Atlantis (CI for Terraform)

✅ Verified at `terraform-kong/atlantis.yaml:1-100`:

```yaml
version: 3
automerge: true

projects:
  # 672 projects (one per module)
  - name: <env>-<service>
    dir: <path>
    terraform_version: v1.1.0
    apply_requirements: [approved]
    autoplan:
      when_modified:
        - "*.tf"
        - "templates/**"
        - "regex.yaml"
```

What this means:
- Every PR triggers `atlantis plan` on the affected projects.
- A reviewer must `approve` before `atlantis apply` is allowed.
- Auto-merge happens after successful apply.
- 672 projects = the granularity at which terraform plans run. Each service+env combo is its own project.

---

## Plugin patterns

Common plugin chains observed (✅ verified by name in module + edge plugin list):

| Plugin | Purpose |
|---|---|
| `kong-plugin-authz-enforcer` | gRPC-based authorization policy check |
| `kong-plugin-consumer-identification` | Idempotency-key handling |
| `kong-plugin-geo-router` | Country-based routing using GeoLite2 |
| JWT validation | OAuth bearer tokens |
| Rate limiting | Per-merchant or per-API throttle |
| CSRF, request termination, restriction | Security layer |

The exact plugin configuration per route lives in the per-service `.tf` files. These reference plugin names defined in `edge/kong-plugins/`.

---

## Routing variants

✅ Verified at `module/route.tf:1-30` — six path types are merged:

```
paths                     ← public, no special auth
identified                ← needs consumer identification (idempotency)
authenticated             ← needs valid token
oauth                     ← OAuth flow
login_as_mx_internal      ← Razorpay-internal user logging in as a merchant
login_as_mx_external      ← External / partner equivalent
```

This separation is what lets the same service expose different paths with different auth requirements.

`dark_enabled = true` routes get duplicated onto `edge-dark.razorpay.com` for shadow traffic.

---

## Failure Modes

| Failure | Behavior | Recovery |
|---|---|---|
| `terraform plan` fails on a PR | PR check fails; Atlantis comments the error | Fix the .tf and push |
| `terraform apply` fails (Kong API rejection) | Apply step shows the Kong error; partial application possible | Manual `terraform state rm` + reapply, or rollback PR |
| Plugin reference broken (plugin name doesn't exist in Kong) | Apply fails | Coordinate with edge plugin deployment first |
| Upstream target unreachable post-apply | Kong logs 502s; affected service routes broken | Rollback the .tf change and reapply; fast because Atlantis is automated |
| Atlantis itself down | PRs can't plan/apply | Manual `terraform plan/apply` from operator workstation as fallback |

---

## Coordination with kube-manifests

A new service deployment usually requires changes in **both** repos:
1. `kube-manifests` — pod, replicas, internal service.
2. `terraform-kong` — public-facing routes, plugins, upstream config pointing at the K8s service.

Order matters: deploy the workload first, then expose it via Kong. Otherwise Kong serves 502s.

---

## Confidence

- ✅ Verified: layout, module structure, route.tf 6-path-type merge, atlantis.yaml structure (672 projects, version 3, approval requirement), Kong plugin names.
- ⚠️ Inferred: precise per-service plugin chains (would require reading every prod/*.tf).
- ❗ Out of scope: Kong control plane deployment itself (lives elsewhere); how plugin Lua code reaches the Kong data plane (that's edge repo + Kong release pipeline).
