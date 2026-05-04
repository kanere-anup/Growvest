# CI/CD

> How code goes from PR to production. GitHub Actions for build/test, Atlantis for IaC, Spinnaker for deployment, Argo for tests.

---

## High-level shape

```
PR opened
   │
   ▼
GitHub Actions (.github/workflows/)
  ├─ Test                     (unit + lint + security scans)
  ├─ Build Docker image       (tagged with commit SHA)
  ├─ SLIT integration tests   (Docker-Compose-based)
  └─ Push image to registry
   │
   ▼
PR merged to main
   │
   ▼
Spinnaker pipeline triggered
  ├─ Deploy to dev/stage cluster
  ├─ Run e2e tests (end-to-end-tests repo)
  ├─ Promote to canary in prod
  ├─ Health check + manual gate
  └─ Promote to baseline (full traffic)
   │
   ▼
kube-manifests PR auto-generated to update image SHA   (or per-service tooling)
   │
   ▼
Argo CD applies the K8s manifest change
```

For Terraform / Kong changes, the path is different (Atlantis-driven; see `deployment/terraform_kong.md`).

---

## GitHub Actions per repo

✅ Verified by directory listing.

### partnerships (`.github/workflows/`, 13 files)

| Workflow | Size | Purpose |
|---|---|---|
| `ci_multi_arch.yml` | 27 KB | Multi-architecture build (arm64, amd64) |
| `ci_devspace.yaml` | 4.6 KB | Devspace ephemeral environment CI |
| `e2e-verified-build.yml` | 14 KB | E2E test + verified build |
| `slit-in-process.yml` | 7.3 KB | SLIT (Service Logic Integration Test) — in-process |
| `central_security_checks.yml`, `danger.yml`, `openai_pr_review.yml` | — | Security scans + PR review automation |
| `generate-docs.yml` | 1.7 KB | Auto-generate documentation |

### pg-router (`.github/workflows/`, 8 files)

| Workflow | Size | Purpose |
|---|---|---|
| `ci.yml` | 128 KB | Main CI pipeline (unusually large — bundles many concerns) |
| `devstack.yml` | 33 KB | Devstack build + deploy |
| `e2e-verified-build.yml` | 38 KB | E2E + verified build |
| `slit.yml` | 3.9 KB | SLIT integration tests |
| `akto_ci_run.yaml` | — | API security scanning (Akto) |

### dashboard (`.github/workflows/`, 21 files)

| Workflow | Size | Purpose |
|---|---|---|
| `deploy.yaml` | 10 KB | Production deploy |
| `fe-e2e.yml` | 15 KB | Frontend E2E (Playwright) |
| `fe-uts.yml` | 9.7 KB | Frontend unit tests (Jest) |
| `core.yml` | 5.9 KB | PHP core tests |
| `core-enhanced-guard.yml` | 5.2 KB | Enhanced validation gates |
| `build-php.yml`, `build.yml` | — | Docker build |
| `deploy-devstack.yml` | 7.2 KB | Devstack deploy |

### Common patterns observed

- **No central composite action visible.** Each repo's CI is largely self-contained. There's likely a shared internal action library (Razorpay org may host `razorpay/actions/*`), but it's not bundled in any of the scanned repos.
- **Multi-arch image builds** (arm64 + amd64) — visible in partnerships' `ci_multi_arch.yml`. Reflects increasing M-series Mac developer fleets + ARM cluster nodes.
- **AI / OpenAI PR review** — partnerships has `openai_pr_review.yml`. Other repos likely have similar; may be Claude-driven now in some.
- **Akto security scanning** in pg-router — API contract validation.

---

## Image build conventions

- Each repo has a `Dockerfile` (some have multiple: `Dockerfile`, `Dockerfile.debug`).
- Multi-stage builds: build stage compiles Go binary, final stage is minimal (alpine or distroless).
- Image tag = commit SHA. The K8s manifest in `kube-manifests/<env>/<service>/values.yaml` references this tag.
- Push target: `c.rzp.io/<service>:<sha>` (per references seen in dashboard config).

---

## SLIT — Service Logic Integration Tests

The `slit/` directory pattern is consistent across Go services (✅ verified in partnerships, pg-router). It runs:
- A Docker Compose stack with the service + dependencies (MySQL, Redis, Kafka, etc.)
- Integration tests that hit the running service over RPC/HTTP
- Coverage instrumentation (Go coverage for end-to-end runs)

Two SLIT modes seen: `slit-in-process.yml` (faster, in-process) and `slit.yml` (full Docker-isolated).

---

## E2E — `end-to-end-tests` repo

✅ Verified Tier 3 evidence. Single repo `end-to-end-tests/` (Go-based).

- Test suites for ~30 services
- Runs on Argo Workflows in K8s
- Trigger: Spinnaker pipeline OR direct API trigger via the E2E Test Orchestrator (Twirp RPC)
- Hooks: `BeforeTest`, `AfterTest`, `HandleStats`
- Results dispatched to a ReportPortal database

---

## Spinnaker

Deployments are Spinnaker-driven. Evidence:
- `mcp/spinnaker/` directory (Python service for Spinnaker pipeline management)
- Multiple repos reference Spinnaker in their workflows
- `spinnaker-ops-assistant` skill in the platform (claude-plugins)

The typical Spinnaker pipeline shape:
1. Image bake from PR-built artifact
2. Deploy to dev → run e2e
3. Manual gate
4. Deploy to stage → run e2e
5. Manual gate
6. Canary deploy in prod (the 96/2/2 split from `kube-manifests` config)
7. Auto-rollback on failure

---

## Atlantis (Terraform IaC)

✅ Verified at `terraform-kong/atlantis.yaml:1-100`. See `deployment/terraform_kong.md` for full detail.

Key facts:
- 672 projects (per env × service combinations)
- `automerge: true`
- `apply_requirements: [approved]`
- Triggers on `*.tf`, `templates/**`, `regex.yaml` changes

---

## Devstack

Most Razorpay repos have a "devstack" deploy path — ephemeral environments per PR / per dev. Evidence:
- partnerships' `ci_devspace.yaml`
- pg-router's `devstack.yml` (33 KB)
- dashboard's `deploy-devstack.yml`

The TTL for devstack environments is 8 hours by default (per `kube-manifests/helmfile/helmfile.yaml`).

---

## Security scans

Multiple layers:
- **Semgrep** — SAST scanning (`security-tools/semgrep-automation/`)
- **Trivy** — container vuln scanning (`security-tools/trivy-scanner/`)
- **ClamAV** — malware detection
- **Akto** — API contract scans (per-repo, e.g., pg-router)
- **Dependabot** — dependency tracking (visible in repo configs)

These run as workflows in each repo's CI plus continuously by the security-tools deployments.

---

## Failure Modes

| Failure | Behavior | Recovery |
|---|---|---|
| CI fails on PR | PR can't be merged (branch protection) | Fix the failing test / lint / build |
| Image build OOM | Workflow runner OOMs | Restart the build; increase runner size if recurring |
| SLIT flaky test | Test fails intermittently | Re-run; investigate flaky test; `pr-autopilot` skill exists for this |
| E2E test breaks in stage | Spinnaker pipeline halts at gate | Manual investigation via ReportPortal logs |
| Spinnaker canary alert fires | Pipeline auto-rollback | Investigate via Coralogix; promote-back-to-baseline manually |
| Atlantis plan diverges from state | Manual `terraform plan` to inspect; `terraform import` if drift | Rare; usually means someone made a manual Kong change |
| Argo CD sync fails | Some K8s resources stuck out-of-sync | Investigate via Argo UI; force sync if config-only issue |

---

## What's transitional / messy

- **Workflow file size disparity**: pg-router's `ci.yml` is 128 KB — that's typically a sign of accumulated complexity that should be broken up. Other repos have smaller, more focused workflows.
- **No discoverable central composite-action library** in scanned repos. If one exists, it would simplify the larger workflows. Worth confirming with platform team.
- **Multi-arch only on some repos** — partnerships has it; not all do. ARM rollout is in progress.

---

## Confidence

- ✅ Verified: workflow file counts and sizes (per repo `.github/workflows/` listing), Atlantis config, SLIT directory presence, security tooling list.
- ⚠️ Inferred: exact Spinnaker pipeline shape (mcp/spinnaker is the closest evidence; no actual pipeline YAML in scanned repos).
- ❗ Needs verification: existence and location of a shared GitHub Actions composite library; precise Argo CD vs Spinnaker boundaries (who applies what).
