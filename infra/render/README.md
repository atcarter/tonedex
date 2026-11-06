# ToneDex on Render (Terraform)

This directory declares the whole production stack on [Render](https://render.com). One `terraform apply` builds it from nothing:

| Resource | Render name | What it is |
|---|---|---|
| `render_project.tonedex` | `ToneDex` | The Render project holding everything below, with one environment, `Production` |
| `render_postgres.db` | `tonedex-db` | PostgreSQL 15 (matches dev and CI), `basic_256mb` plan |
| `render_keyvalue.redis` | `tonedex-redis` | Redis-compatible Key Value for Sidekiq and Rack::Attack, plan from `keyvalue_plan` (default `free`) |
| `render_web_service.api` | `tonedex-api` | Rails API, built from `backend/Dockerfile`; runs `./bin/rails db:migrate` before each deploy and uses `/up` as its health check |
| `render_background_worker.worker` | `tonedex-worker` | Sidekiq (`bundle exec sidekiq`) from the same Dockerfile |
| `render_env_group.backend` | `tonedex-backend` | Secrets and connection strings shared by the api and worker |
| `render_static_site.web` | `tonedex-web` | The Vite SPA from `frontend/` |

Every other resource in the table sets `environment_id` to the `Production` environment, so all six live in **ToneDex → Production** in the dashboard. `render_env_group_link.backend` has no environment of its own. It only attaches the env group to the api and worker. `Production` is `unprotected`, Render's default for a new environment. The configuration leaves the environment's IP allow list and network isolation unset, so Terraform doesn't manage them. If you turn on network isolation in the dashboard, add `network_isolated = true` to the environment in `main.tf` as well, because the provider sends `false` whenever it updates the environment without it. The project was created in the dashboard, so an existing stack has to [import it](#importing-the-tonedex-project) before its next apply.

Service names become public `onrender.com` hostnames, which is why every resource has the `tonedex-` prefix. Production is served from custom domains on top of them: `tonedex.app` for the static site and `api.tonedex.app` for the api ([Custom domains](#custom-domains)). One `region` variable (default `oregon`) applies to every regional resource. The static site is served from Render's global CDN, so it has no region.

By default the database and Key Value have empty IP allow lists, so only services on Render's private network in the same region can reach them. The Key Value is always private. The database's list comes from the `postgres_ip_allow_list` variable (default `[]`).

The first seed copies a table into the database over its external connection string. That needs your IP in `postgres_ip_allow_list` (for example `[{ cidr_block = "x.x.x.x/32", description = "first seed" }]`) for that apply. A follow-up apply with the list empty again closes the door.

State is local (`terraform.tfstate` in this directory) for now.

## Prerequisites

- Terraform 1.6 or later.
- A Render API key and the owner (workspace) ID it acts for, **exported as environment variables**. The provider reads them from the environment. They never go in `.tf` files or tfvars:

  ```bash
  export RENDER_API_KEY=rnd_...
  export RENDER_OWNER_ID=tea-...   # or usr-... for a personal workspace
  ```

## First apply, in this order

1. **The GitHub repository exists** and holds the branch you'll deploy (`github_branch`, default `main`).
2. **The Render GitHub app is installed** with access to that repository: connect GitHub in the Render dashboard and grant the app this repo. Without it, Render can't clone the repo and service creation fails.
3. **`terraform apply`**:

   ```bash
   cd infra/render
   cp terraform.tfvars.example terraform.tfvars   # gitignored; replace every CHANGEME
   terraform init
   terraform apply
   ```

`terraform output` then prints `api_url` and `frontend_url`. On a stack built from nothing, those custom domains also need the DNS records and the Google OAuth entries from the [cutover runbook](#cutover-runbook) (steps 1, 4 and 5).

On a stack built from nothing, this apply creates the ToneDex project and its Production environment too, so there's nothing to import.

The env group is linked to the api and worker after both services exist, so their very first deploy can start before `DATABASE_URL`, `CORS_ORIGINS` and the secrets are present, and fail. If either service shows a failed first deploy, trigger **Manual Deploy → Deploy latest commit** on it once the apply finishes.

### Why the env group

The api and worker share their secrets, connection strings, `CORS_ORIGINS` and `ALLOWED_HOSTS`, so they live once in `render_env_group.backend`, attached to both with `render_env_group_link`. The env group also keeps the api resource from referencing the static site. That used to break a dependency cycle, when each service's URL came from the other's Render-assigned hostname. Now both URLs are fixed custom domains in `locals`, so there's no cycle either way.

## Custom domains

The SPA is served at `https://tonedex.app` and the API at `https://api.tonedex.app`. `main.tf` attaches each domain with the service's `custom_domains` attribute, which is how provider 1.9.1 manages them (it has no separate custom-domain resource). The same two names set `VITE_API_URL`, `CORS_ORIGINS`, `ALLOWED_HOSTS` and the CSP, so one apply moves all of them. The `onrender.com` hostnames still exist, because the DNS records point at them, but the app no longer works there: CORS and `ALLOWED_HOSTS` accept only the new names.

When the apex is added, Render also adds `www.tonedex.app` and redirects it to `tonedex.app`. The provider leaves that redirect out of state, so it causes no plan diff. It only answers if a `www` DNS record exists, and this setup creates none.

### Cutover runbook

Run this after hours. Between the apply and certificate issuance, the site may be unreachable at both the old and the new hostnames. That's accepted for this cutover. `.app` is on browsers' HSTS preload list, so `tonedex.app` loads only over HTTPS and stays down until its certificate is issued.

1. **Create the DNS records at the registrar**, before applying:

   | Name | Type | Value |
   |---|---|---|
   | `tonedex.app` (apex, `@`) | `ALIAS` or `ANAME` if the provider supports it, else `A` | `tonedex-web.onrender.com` (ALIAS/ANAME) or `216.24.57.1` (A) |
   | `api` | `CNAME` | `tonedex-api.onrender.com` |

   On Cloudflare, use a `CNAME` to `tonedex-web.onrender.com` for the apex instead (it flattens it), with the proxy off. Delete any `AAAA` records for `tonedex.app` and `api.tonedex.app`, because Render serves IPv4 only. If the domain has `CAA` records, add ones allowing `letsencrypt.org` and `pki.goog`, or Render can't issue certificates. Check that both names resolve (`dig +short tonedex.app`, `dig +short api.tonedex.app`) before moving on.
2. **Merge the PR, then `terraform plan` and `terraform apply`.** Expect in-place updates only: `custom_domains` added to `render_web_service.api` and `render_static_site.web`, the new `VITE_API_URL` and `Content-Security-Policy` on the static site, and the new `CORS_ORIGINS` and `ALLOWED_HOSTS` in `render_env_group.backend`. Nothing should be replaced or destroyed.
3. **Check that the new values deployed.** `VITE_API_URL` is baked in at build time, so `tonedex-web` needs a build that started after the apply, and `tonedex-api` and `tonedex-worker` need a deploy that picked up the env group change. If any of the three shows no new deploy, use **Manual Deploy → Deploy latest commit** on it.
4. **Confirm both certificates were issued.** In the dashboard, open **Settings → Custom Domains** on `tonedex-web` and on `tonedex-api`. Each domain should show **Verified** with its certificate issued, not "DNS update needed". If one is still waiting a few minutes after DNS resolves, click **Verify** next to it. Then check from a terminal: `curl -sI https://tonedex.app` and `curl -s https://api.tonedex.app/up` should succeed without certificate errors.
5. **Update the Google OAuth client** (Google Cloud console → APIs & Services → Credentials → the OAuth 2.0 client whose ID is `google_client_id`):
   - **Authorized JavaScript origins:** add `https://tonedex.app`, for the SPA's sign-in.
   - **Authorized redirect URIs:** add `https://api.tonedex.app/auth/google_oauth2/callback`, for the Sidekiq dashboard's OmniAuth sign-in.
   - Remove `https://tonedex-web.onrender.com` and `https://tonedex-api.onrender.com/auth/google_oauth2/callback`. Google can take a few minutes to apply changes.
6. **Test both sign-ins.** At `https://tonedex.app`, sign in with Google, check that the avatar loads and the signed-in pages work, then sign out, all with the browser console open and free of CSP and CORS errors. At `https://api.tonedex.app/sidekiq`, sign in as `SIDEKIQ_ALLOWED_EMAIL` and check that the dashboard loads.
7. **Point the smoke suite at the new domain.** Set the repository variables `SMOKE_BASE_URL` to `https://tonedex.app` and `SMOKE_API_URL` to `https://api.tonedex.app` (GitHub → Settings → Secrets and variables → Actions → Variables), then run `.github/workflows/smoke.yml` on demand.

## Importing the ToneDex project

The ToneDex project and its Production environment were created in the Render dashboard, and every resource above was moved into them there. Until the project is in Terraform state, `terraform apply` plans to create a second ToneDex project and move every resource into it, and fails. **Import the existing project once, before the next `terraform apply`.**

1. **Find the project ID.** In the Render dashboard, open the ToneDex project. Its ID starts with `prj-` and appears in the page's URL.
2. **Import it**, with `RENDER_API_KEY` and `RENDER_OWNER_ID` exported and `terraform.tfvars` in place (import reads the whole configuration, so the required variables must be set):

   ```bash
   cd infra/render
   terraform init
   terraform import render_project.tonedex prj-...   # the ID from step 1
   ```

   This one command imports the environments as well. In 1.9.1 of the provider an environment is part of `render_project`, not a resource of its own. The import keys each environment by its name, which is why `main.tf` uses `"Production"` as the map key. Leave the key as it is. With a different key, Terraform would create a new environment and delete the existing one.
3. **`terraform plan`** before applying. Expect no change to `render_project.tonedex`, and no `environment_id` change on any service, the database, the Key Value or the env group. If the plan changes `protected_status`, the environment was made protected in the dashboard. Set `protected_status = "protected"` in `main.tf` to keep it that way, or let the apply turn protection off.
4. **`terraform apply`.**

The import is needed only once. If `terraform import` reports that the resource is already managed, the project is already in state, so go on to step 3.

## The state file holds secrets

`terraform.tfstate` stores every variable and every generated value **in plain text**, including `secret_key_base`, `jwt_secret`, `google_client_secret` and both database connection strings with passwords. Marking a variable `sensitive` only hides it from CLI output. It doesn't encrypt the state.

**Never commit `terraform.tfstate`, `terraform.tfstate.backup` or `terraform.tfvars`.** The repository's `.gitignore` excludes them. Keep the state somewhere private and backed up. Losing it means Terraform no longer knows it owns these resources.

## Tear down

```bash
cd infra/render
terraform destroy
```

This deletes every resource above, including the database and all its data, and then the ToneDex project and its Production environment. Export a backup from the database's page in the Render dashboard first if you want to keep anything. With `postgres_ip_allow_list` empty, the database accepts no external connections, so add your IP for that export if it needs one.

## Content Security Policy

The static site sends an enforcing `Content-Security-Policy`: the browser blocks anything the policy doesn't allow and logs each block as a console error. Terraform builds the value in `main.tf` (`local.content_security_policy`) from the api URL and the Sentry ingest origin, which comes from `vite_sentry_dsn` (an empty DSN adds no source):

```
default-src 'self'; script-src 'self' https://accounts.google.com; frame-src https://accounts.google.com; connect-src 'self' <api url> https://accounts.google.com <sentry ingest origin>; img-src 'self' data: <api url> https://raw.githubusercontent.com https://*.googleusercontent.com; style-src 'self' 'unsafe-inline' https://accounts.google.com; font-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'
```

Why each non-`'self'` source is there:

- **`https://accounts.google.com`** in `script-src`, `frame-src`, `connect-src` and `style-src`: Google Identity Services loads its script, sign-in iframe, token requests and stylesheet from there.
- **`'unsafe-inline'` in `style-src`**: styled-components and MUI inject `<style>` tags at runtime.
- **`https://raw.githubusercontent.com`** in `img-src`: the sprite fallback for anything not mirrored under `backend/public/sprites/`.
- **`https://*.googleusercontent.com`** in `img-src`: serves the signed-in user's avatar.
- **The api URL** in `img-src`: the API serves the mirrored sprites from `backend/public/sprites`.
- **The api URL and the Sentry ingest origin** in `connect-src`: the SPA's API calls and Sentry's error reports.

### Enforcing

The policy is enforced, so a missing source breaks the feature that needs it rather than only logging a warning. `frontend/e2e-smoke/csp.spec.ts`, part of the production smoke suite, checks it: signed out, at desktop and phone (375×812) widths, it loads each route (`/`, a game's dex, a Pokémon's detail page, `/compare`, a game's team, `/favorites` and an unknown path), loads Google sign-in, and fails on any console message that mentions "Content Security Policy".

Before changing `local.content_security_policy`:

1. Run the spec against production from `frontend/`:

   ```bash
   SMOKE_BASE_URL=https://tonedex.app SMOKE_API_URL=https://api.tonedex.app npm run test:smoke
   ```

2. Add a source as the exact origin a violation names, not a wildcard, then `terraform apply` and run the spec again.
3. The spec runs signed out, so after an apply also click through the signed-in flows with the browser console open: sign in and out, check that the avatar loads, and use the pages that need an account.

The CSP belongs on the static host because Rails, as an API-only app, sends none.

## Deploys wait for CI

`tonedex-api`, `tonedex-worker` and `tonedex-web` set `auto_deploy_trigger = "checksPass"`: Render deploys a new commit on `github_branch` only after every GitHub check on that commit has passed (`ci.yml`'s backend, frontend, e2e and backend-image jobs, and `terraform.yml`). A failed check means that commit never deploys, and production stays on the last good one. The production smoke suite isn't part of this gate. It tests whatever is already live.

If CI stops running on pushes to `main` (a workflow is deleted or disabled, or its `push` trigger is removed), nothing deploys automatically. Use **Manual Deploy** in the Render dashboard until CI runs again.

## CI

`.github/workflows/terraform.yml` runs `terraform fmt -check -recursive infra`, `init -backend=false` and `validate` on every pull request and push to `main`. It has no credentials and never plans or applies.
