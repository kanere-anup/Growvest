# dashboard

> Merchant-facing web app. React 17 + TypeScript + Nx monorepo with 15 federated micro-apps. Each business unit gets a sub-app (partnership, payments, pos, recon, etc.).

Repo: `~/Desktop/git/dashboard`. Light Tier-2 doc — backend services are the deeper concern.

---

## Stack

- React 17.0.2, TypeScript 5.5.2
- **Nx 20.0.0** for monorepo orchestration
- React Router 6.14.2
- State: Redux + Zustand
- styled-components 5.3.11
- **Blade 12.63.0** (Razorpay's design system) — `@razorpay/blade`
- Build: Rspack / Webpack
- Test: Jest, Playwright (E2E)

---

## Layout (✅ verified)

```
apps/                   ← 15 federated micro-apps
  datasync/
  digital-bills/
  engage/
  gcms/
  money-saver/
  onboarding-experience/
  one-home/
  partnership/          ← partnerships UI
  payroll-app/
  pos/
  recon-saas/
  shell/                ← host app, federated routing, common store
  usl-auth/
  ...
libs/
  shared-core/
  shared-qsuite/
  shared-types/
  shared-ui/
  shared-utils/
.github/workflows/      ← 21 workflows (deploy, fe-e2e, fe-uts, build-php, deploy-devstack)
Tests/                  ← E2E infrastructure
```

The `shell` app is the host — it loads other apps as federated remotes, manages workspace navigation, common Splitz integration.

---

## API integration

Base path: `/merchant/api/{mode}` (REST + GraphQL mixed).

Custom request headers used across all apps:
- `X-app-mode`
- `X-org-id`
- `X-XSRF-TOKEN`
- `apollographql-client-name: dashboard`

API client is constructed dynamically per `(orgId, countryCode, appMode)`. There's no centralized OpenAPI spec checked in — endpoints are discovered by reading individual app code.

---

## Partnership app — what's there

Path: `apps/partnership/` (✅ verified). Key files:

| File | Purpose |
|---|---|
| `apps/partnership/src/services/api/index.ts` | API client setup |
| `apps/partnership/src/providers/APIProvider/index.tsx` | Provider wrapping API context |
| `apps/partnership/src/views/AffiliateAccounts/` | Sub-merchant management UI |
| `apps/partnership/src/views/Home/` | Dashboard home for partner ops |
| `apps/partnership/src/...useRouteConfig.tsx` | Route definitions |
| `apps/partnership/src/...PartnerStateProvider` | App-level state container |

Key API calls visible in code:
- `getSubMList` — list sub-merchants
- `getTransactedSubM` — list sub-merchants who transacted

This UI calls `partnerships` Twirp service via the api monolith → Twirp gateway pattern. (Browsers don't speak Twirp natively; the api monolith proxies.)

---

## Other notable sub-apps (1-line each)

| App | What it does |
|---|---|
| `payments-card` UI / `pos/` | Point-of-sale (27 sub-dirs, full E2E suite) |
| `onboarding-experience/` | Merchant + partner account creation flows |
| `money-saver/` | Discount / savings products |
| `engage/` | Customer engagement campaigns |
| `recon-saas/` | Reconciliation interface |
| `digital-bills/` | Billing documents / invoicing |
| `payroll-app/` | Payroll management (15 sub-dirs) |
| `gcms/` | Gating / campaign management system |
| `datasync/` | Real-time data sync layer |
| `usl-auth/` | Unified login auth |
| `one-home/` | Unified home dashboard |

---

## CI/CD

✅ Verified `.github/workflows/` — 21 files. Notable:

| Workflow | Purpose |
|---|---|
| `deploy.yaml` | Production deploy (likely Spinnaker-driven) |
| `fe-e2e.yml` | Frontend E2E tests (Playwright) |
| `fe-uts.yml` | Frontend unit tests (Jest) |
| `core.yml`, `core-enhanced-guard.yml` | PHP core tests + enhanced validation |
| `build-php.yml`, `build.yml` | Docker image build |
| `deploy-devstack.yml` | Devstack ephemeral env deploy |

The PHP workflows are present because dashboard has a small PHP backend layer (the merchant-mode session bootstrap). Most of the app is the React frontend.

---

## Failure Modes & Recovery

Frontend-specific failure modes are mostly user-facing; the doc focus is intentionally light.

| Failure | Behavior |
|---|---|
| `/merchant/api/{mode}` returns 5xx | App shows error toast; React Query retries (`@tanstack/react-query` configured with retry) |
| Federated remote fails to load | Shell shows fallback UI for that app section; other apps continue working |
| Splitz unreachable | Default variants; no app crash |
| WebSocket / live data sync drops (datasync app) | Reconnects with backoff |

---

## Confidence

- ✅ Verified: stack, monorepo layout, sub-app list, partnership-app key files + API calls, workflow file count.
- ⚠️ Inferred: how the Twirp-over-HTTP proxy in api monolith is implemented (must exist for browser → partnerships RPC to work).
- ❗ Out of scope: full route enumeration per sub-app — would require per-app code reading.
