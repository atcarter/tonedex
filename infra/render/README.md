# ToneDex on Render (Terraform)

This directory declares the whole production stack on [Render](https://render.com). One `terraform apply` builds it from nothing:

| Resource | Render name | What it is |
|---|---|---|
| `render_postgres.db` | `tonedex-db` | PostgreSQL 15 (matches dev and CI), `basic_256mb` plan |
| `render_keyvalue.redis` | `tonedex-redis` | Redis-compatible Key Value for Sidekiq and Rack::Attack, plan from `keyvalue_plan` (default `free`) |
| `render_web_service.api` | `tonedex-api` | Rails API, built from `backend/Dockerfile`; runs `./bin/rails db:migrate` before each deploy and uses `/up` as its health check |
| `render_background_worker.worker` | `tonedex-worker` | Sidekiq (`bundle exec sidekiq`) from the same Dockerfile |
| `render_env_group.backend` | `tonedex-backend` | Secrets and connection strings shared by the api and worker |
| `render_static_site.web` | `tonedex-web` | The Vite SPA from `frontend/` |

Service names become public `onrender.com` hostnames, which is why every resource has the `tonedex-` prefix. One `region` variable (default `oregon`) applies to every regional resource. The static site is served from Render's global CDN, so it has no region.

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

`terraform output` then prints `api_url` and `frontend_url`.

The env group is linked to the api and worker after both services exist, so their very first deploy can start before `DATABASE_URL`, `CORS_ORIGINS` and the secrets are present, and fail. If either service shows a failed first deploy, trigger **Manual Deploy → Deploy latest commit** on it once the apply finishes.

### Why the env group

The api needs the static site's URL (`CORS_ORIGINS`) and the static site needs the api's URL (`VITE_API_URL` and the CSP). If both URLs sat on the services themselves, that would be a dependency cycle. `CORS_ORIGINS` (and everything else the backend shares) lives in `render_env_group.backend` instead, attached with `render_env_group_link`, so the api resource never references the static site.

## The state file holds secrets

`terraform.tfstate` stores every variable and every generated value **in plain text**, including `secret_key_base`, `jwt_secret`, `google_client_secret` and both database connection strings with passwords. Marking a variable `sensitive` only hides it from CLI output. It doesn't encrypt the state.

**Never commit `terraform.tfstate`, `terraform.tfstate.backup` or `terraform.tfvars`.** The repository's `.gitignore` excludes them. Keep the state somewhere private and backed up. Losing it means Terraform no longer knows it owns these resources.

## Tear down

```bash
cd infra/render
terraform destroy
```

This deletes every resource above, including the database and all its data. Export a backup from the database's page in the Render dashboard first if you want to keep anything. With `postgres_ip_allow_list` empty, the database accepts no external connections, so add your IP for that export if it needs one.

## Content Security Policy

The static site sends `Content-Security-Policy-Report-Only`, which logs violations in the browser console but blocks nothing. Terraform builds the value in `main.tf` (`local.content_security_policy`) from the api URL and the Sentry ingest origin, which comes from `vite_sentry_dsn` (an empty DSN adds no source):

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

### Switching to enforcing

1. After a deploy, open the site with the browser console open and click through everything: sign in and out, pick a game, browse the dex, search (including an unknown name), open Pokémon and move details, and make sure an avatar and a fallback sprite both load.
2. Fix any `[Report Only]` violation by adding the missing source to `local.content_security_policy` in `main.tf`. Apply and repeat until a full click-through is clean.
3. In the `headers` list of `render_static_site.web`, rename `Content-Security-Policy-Report-Only` to `Content-Security-Policy`, then `terraform apply`.
4. Click through once more. Anything the policy now blocks shows as a console error rather than a warning.

The CSP belongs on the static host because Rails, as an API-only app, sends none.

## Deploys wait for CI

`tonedex-api`, `tonedex-worker` and `tonedex-web` set `auto_deploy_trigger = "checksPass"`: Render deploys a new commit on `github_branch` only after every GitHub check on that commit has passed (`ci.yml`'s backend, frontend, e2e and backend-image jobs, and `terraform.yml`). A failed check means that commit never deploys, and production stays on the last good one. The production smoke suite isn't part of this gate. It tests whatever is already live.

If CI stops running on pushes to `main` (a workflow is deleted or disabled, or its `push` trigger is removed), nothing deploys automatically. Use **Manual Deploy** in the Render dashboard until CI runs again.

## CI

`.github/workflows/terraform.yml` runs `terraform fmt -check -recursive infra`, `init -backend=false` and `validate` on every pull request and push to `main`. It has no credentials and never plans or applies.
