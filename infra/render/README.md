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

`terraform output` then prints `api_url` and `frontend_url`. On a stack built from nothing, those custom domains also need the DNS records and the Google OAuth entries from the [cutover runbook](#cutover-runbook) (steps 1, 3 and 5).

On a stack built from nothing, this apply creates the ToneDex project and its Production environment too, so there's nothing to import.

The env group is linked to the api and worker after both services exist, so their very first deploy can start before `DATABASE_URL`, `CORS_ORIGINS` and the secrets are present, and fail. If either service shows a failed first deploy, trigger **Manual Deploy → Deploy latest commit** on it once the apply finishes.

### Why the env group

The api and worker share their secrets, connection strings, `CORS_ORIGINS` and `ALLOWED_HOSTS`, so they live once in `render_env_group.backend`, attached to both with `render_env_group_link`. The env group also keeps the api resource from referencing the static site. That used to break a dependency cycle, when each service's URL came from the other's Render-assigned hostname. Now both URLs are fixed custom domains in `locals`, so there's no cycle either way.

## Custom domains

The SPA is served at `https://tonedex.app` and the API at `https://api.tonedex.app`. `main.tf` attaches each domain with the service's `custom_domains` attribute, which is how provider 1.9.1 manages them (it has no separate custom-domain resource). The same two names set `VITE_API_URL`, `CORS_ORIGINS`, `ALLOWED_HOSTS` and the CSP, so one apply moves all of them.

The `onrender.com` hostnames still exist, because the DNS records point at them. `tonedex-web.onrender.com` keeps serving the SPA, and the first lines of `frontend/src/main.tsx` send every visit there to the same path, query and fragment on `https://tonedex.app` without initializing Sentry or rendering the app, so links already shared keep working and the old page never calls the API. `CORS_ORIGINS` still lists `https://tonedex-web.onrender.com` (`local.legacy_frontend_url`) next to `https://tonedex.app`, `ALLOWED_HOSTS` likewise lists `tonedex-api.onrender.com` (`local.legacy_api_domain`) next to `api.tonedex.app`, so the build that's live at the apply, which calls the old API host, keeps working until its rebuild finishes. The CSP also allows `https://tonedex-api.onrender.com` (`local.legacy_api_url`) in `connect-src` and `img-src` for the same reason. None of these needs a later cleanup. `tonedex-api.onrender.com` gets no redirect.

When the apex is added, Render also adds `www.tonedex.app` as a redirect to `tonedex.app`. The provider records it only in the read-only `active_custom_domains` and leaves it out of `custom_domains`, so no plan drift is expected.

### Cutover runbook

Run this after hours, in this order. `tonedex.app` is unreachable until its certificate is issued. With both API hosts allowed, the site on the old hostname keeps working through the apply. The only remaining window is the rebuild itself: if it goes live, calling `https://api.tonedex.app`, before that certificate is issued, the old-hostname site can't reach the API until it is. The rebuild normally finishes after the certificate issues. That's accepted for this cutover. `.app` is on browsers' HSTS preload list, so `tonedex.app` loads only over HTTPS and stays down until its certificate is issued.

1. **Create the DNS records in Cloudflare**, before applying. Set all three to **DNS only** (grey cloud, not proxied). A proxied record makes Render's certificate validation fail.

   | Name | Type | Target | Proxy status |
   |---|---|---|---|
   | `tonedex.app` (`@`) | `CNAME` | `tonedex-web.onrender.com` (Cloudflare flattens it at the apex) | DNS only |
   | `www` | `CNAME` | `tonedex-web.onrender.com` | DNS only |
   | `api` | `CNAME` | `tonedex-api.onrender.com` | DNS only |

   For the apex, the `A` record the Render dashboard shows for the static site's custom domain also works instead of the `CNAME`. Delete any `AAAA` records for `tonedex.app`, `www.tonedex.app` and `api.tonedex.app`. If the zone has `CAA` records, add ones allowing `letsencrypt.org` and `pki.goog`, or Render can't issue certificates. Check that all three names resolve (`dig +short tonedex.app`, `dig +short www.tonedex.app`, `dig +short api.tonedex.app`) before moving on.
2. **Apply from a checkout of the PR branch, before merging.** `terraform apply` reads the local `main.tf`, so run it from the PR branch:

   ```bash
   git fetch origin fm/tonedex-custom-domain
   git checkout fm/tonedex-custom-domain
   cd infra/render
   terraform plan
   terraform apply
   ```

   Expect in-place updates only: `custom_domains` added to `render_web_service.api` and `render_static_site.web`, the new `VITE_API_URL` and `Content-Security-Policy` on the static site, and the new `CORS_ORIGINS` and `ALLOWED_HOSTS` (each with the new and the old hostname) in `render_env_group.backend`. Nothing should be replaced or destroyed. The env change rebuilds the current site from `main` against the new domain: `tonedex-web` needs a build that started after the apply (`VITE_API_URL` is baked in at build time), and `tonedex-api` and `tonedex-worker` need a deploy that picked up the env group change. If any of the three shows no new deploy, use **Manual Deploy → Deploy latest commit** on it.
3. **Wait for both certificates to show issued.** In the dashboard, open **Settings → Custom Domains** on `tonedex-web` and on `tonedex-api`. Each domain should show **Verified** with its certificate issued, not "DNS update needed". If one is still waiting a few minutes after DNS resolves, click **Verify** next to it. Then check from a terminal: `curl -sI https://tonedex.app` and `curl -s https://api.tonedex.app/up` should succeed without certificate errors.
4. **Merge the PR.** Render deploys the merge once its checks pass. From then on, old links on `tonedex-web.onrender.com` redirect to `tonedex.app`. The apply already matches the merged `main.tf`, so a later `terraform plan` from `main` shows no changes.
5. **Update the Google OAuth client** (Google Cloud console → APIs & Services → Credentials → the OAuth 2.0 client whose ID is `google_client_id`):
   - **Authorized JavaScript origins:** add `https://tonedex.app`, for the SPA's sign-in.
   - **Authorized redirect URIs:** add `https://api.tonedex.app/auth/google_oauth2/callback`, for the Sidekiq dashboard's OmniAuth sign-in.

   Google can take a few minutes to apply changes. Then test both sign-ins. At `https://tonedex.app`, sign in with Google, check that the avatar loads and the signed-in pages work, then sign out, all with the browser console open and free of CSP and CORS errors. Open an old link such as `https://tonedex-web.onrender.com/game/scarlet` and check that it lands on `https://tonedex.app/game/scarlet`. At `https://api.tonedex.app/sidekiq`, sign in as `SIDEKIQ_ALLOWED_EMAIL` and check that the dashboard loads.

   Only once both sign-ins pass, remove the old entries, `https://tonedex-web.onrender.com` and `https://tonedex-api.onrender.com/auth/google_oauth2/callback`, so they remain a fallback until the new domain is proven.
6. **Point the smoke suite at the new domain and run it once.** Set the repository variables `SMOKE_BASE_URL` to `https://tonedex.app` and `SMOKE_API_URL` to `https://api.tonedex.app` (GitHub → Settings → Secrets and variables → Actions → Variables), then trigger the Production smoke workflow (`.github/workflows/smoke.yml`, **Run workflow**) as the final check.

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

The static site sends an enforcing `Content-Security-Policy`: the browser blocks anything the policy doesn't allow and logs each block as a console error. Terraform builds the value in `main.tf` (`local.content_security_policy`) from the api URL, the legacy api URL and the Sentry ingest origin, which comes from `vite_sentry_dsn` (an empty DSN adds no source):

```
default-src 'self'; script-src 'self' https://accounts.google.com; frame-src https://accounts.google.com; connect-src 'self' <api url> <legacy api url> https://accounts.google.com <sentry ingest origin>; img-src 'self' data: <api url> <legacy api url> https://raw.githubusercontent.com https://*.googleusercontent.com; style-src 'self' 'unsafe-inline' https://accounts.google.com; font-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'
```

Why each non-`'self'` source is there:

- **`https://accounts.google.com`** in `script-src`, `frame-src`, `connect-src` and `style-src`: Google Identity Services loads its script, sign-in iframe, token requests and stylesheet from there.
- **`'unsafe-inline'` in `style-src`**: styled-components and MUI inject `<style>` tags at runtime.
- **`https://raw.githubusercontent.com`** in `img-src`: the sprite fallback for anything not mirrored under `backend/public/sprites/`.
- **`https://*.googleusercontent.com`** in `img-src`: serves the signed-in user's avatar.
- **The api URL** in `img-src`: the API serves the mirrored sprites from `backend/public/sprites`.
- **The api URL and the Sentry ingest origin** in `connect-src`: the SPA's API calls and Sentry's error reports.
- **The legacy api URL** (`https://tonedex-api.onrender.com`) in `connect-src` and `img-src`: the build live at the cutover apply calls the API and loads sprites there until its rebuild ([Custom domains](#custom-domains)).

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
