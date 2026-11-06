# ADR-008 — Render via Terraform for Production Hosting

**Date:** 2026-10-30
**Status:** Accepted. Updated 2026-11-06: production moved to the custom domains `tonedex.app` (static site) and `api.tonedex.app` (API), attached in Terraform. The Render URLs no longer depend on each other, so the env group no longer breaks a cycle.

## Context

ToneDex needs a public production deployment. It has never been deployed: the repo carried Heroku config (`heroku.yml`, `app.json`, `Procfile`) that never ran, and that Heroku account has since been cancelled. `config/database.yml` still declares Rails 8's four default databases, the frontend has no production build or host, and nothing proves the production image boots.

Production needs four pieces plus a static SPA:
- **web**: Puma behind Thruster, from `backend/Dockerfile`'s `production` stage
- **worker**: `bundle exec sidekiq`
- **Postgres**
- **Redis**: Sidekiq, the seed-job lock, Rack::Attack counters, and the `/up` check
- **frontend**: static Vite build

Constraints:
- **Low running cost.** This is a personal project with a handful of visitors.
- **Infrastructure as code.** Terraform is more than this project strictly needs. The practice is the point, and the stack should be reproducible from one `apply`.
- **Deploys and credentials stay human.** Agents may write and validate infrastructure code. `apply`, cloud keys and the Google OAuth console stay with the owner.

Heroku has been in sustaining engineering since February 2026: maintained, but getting no new features.

## Decision

Host on **Render**, with every resource declared in Terraform under `infra/render` using the official `render-oss/render` provider:
- **Web service:** Docker runtime from the existing Dockerfile, health check `/up`, pre-deploy `db:migrate`. `HTTP_PORT=10000` for Thruster, which sets Puma's own port itself.
- **Background worker:** Sidekiq on the same image.
- **Postgres 15**, matching dev and CI.
- **Key Value** for Redis.
- **Static site** for the SPA, with a deep-link rewrite to `index.html` and security headers.
- **A shared env group** carrying `DATABASE_URL`, `REDIS_URL`, the secrets, `CORS_ORIGINS` and `ALLOWED_HOSTS`. Attaching it through `render_env_group_link` breaks the cycle where the API needs the frontend's URL and the frontend needs the API's.

Supporting decisions:
- **Production config is env-only.** It runs on `DATABASE_URL` and `REDIS_URL`. `solid_cache` goes, and the cache store becomes `:memory_store`.
- **State is local and gitignored.** Terraform state holds secrets in plain text (`sensitive = true` only hides CLI output), so it must never be committed.
- **GitHub repository settings are managed by hand in the UI.** That covers rulesets, required checks and secret scanning: a handful of one-time settings that aren't worth a second provider and token. Terraform covers the cloud, not the forge.
- **Agents run only `terraform fmt` and `terraform validate`** (with `init -backend=false`). CI does the same without credentials. `plan` and `apply` are run by the owner.
- **Heroku config is deleted now**, not after go-live. It was never deployed, so there is nothing to migrate away from.

## Consequences

**Positive:**
- One `terraform apply` builds production from nothing, and infrastructure changes are reviewable diffs.
- Roughly $20–30/month: web $7, worker $7, Postgres ~$6, Key Value free or $10, static site free.
- Managed TLS, now on the custom domains `tonedex.app` and `api.tonedex.app`. The domain is cosmetic, because the JWT travels in a header, not a cookie.
- The app stays portable: Docker plus environment variables. Leaving Render would mean rewriting `infra/`, not the app.

**Negative:**
- **The Terraform is Render-specific.** Another host would need a new `infra/`, not just a different provider.
- **Local state is a single point of loss** on one laptop. Revisit with a remote backend if a second machine ever needs to apply.
- **Free Key Value isn't persistent.** Acceptable for now: the only queued jobs are re-runnable seed crawls, and resetting Rack::Attack counters is harmless.
- **Render instances have ephemeral disks.** Mirrored sprites stay committed to git so they ship in the image.
- **The free `onrender.com` URLs weren't memorable.** Resolved on 2026-11-06 by `tonedex.app` and `api.tonedex.app`.

## Alternatives Considered

**Heroku (~$22/month):** unused config for it already sat in the repo. Rejected because the platform is in sustaining engineering and offers the least Terraform practice of the options.

**AWS ECS on Fargate (~$55–75/month at list price, ~$0 on new-account credits for six months):** the most Terraform practice (VPC, IAM, load balancer, RDS, ElastiCache), but also the most moving parts, too many for the first deployment of a small app. App Runner, AWS's simpler option, closed to new customers on 2026-04-30. Rejected for now.

**AWS Lightsail (~$13/month):** cheapest. Rejected because operations are largely manual and the Terraform story is thin.
