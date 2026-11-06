locals {
  # Every resource that can belong to an environment goes in ToneDex/Production.
  environment_id = render_project.tonedex.environments["Production"].id

  # Custom domains, attached below; infra/render/README.md has the cutover runbook.
  api_domain      = "api.tonedex.app"
  frontend_domain = "tonedex.app"
  api_url         = "https://${local.api_domain}"
  frontend_url    = "https://${local.frontend_domain}"
  # Still allowed by CORS, so the current site keeps working between certificate issuance and the merge.
  legacy_frontend_url = "https://tonedex-web.onrender.com"

  # https://<key>@o123.ingest.us.sentry.io/456 -> https://o123.ingest.us.sentry.io
  sentry_ingest_origin = (
    var.vite_sentry_dsn == ""
    ? ""
    : "https://${regex("^https://[^@/]+@([^/]+)/", var.vite_sentry_dsn)[0]}"
  )

  # Sent as an enforcing Content-Security-Policy. infra/render/README.md
  # explains each source; run frontend/e2e-smoke/csp.spec.ts before changing it.
  content_security_policy = join("; ", [
    "default-src 'self'",
    "script-src 'self' https://accounts.google.com",
    "frame-src https://accounts.google.com",
    join(" ", compact([
      "connect-src 'self'",
      local.api_url,
      "https://accounts.google.com",
      local.sentry_ingest_origin,
    ])),
    join(" ", ["img-src 'self' data:", local.api_url, "https://raw.githubusercontent.com https://*.googleusercontent.com"]),
    "style-src 'self' 'unsafe-inline' https://accounts.google.com",
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
  ])

  # Optional values are left out entirely when empty rather than set to "".
  optional_backend_env = {
    for name, value in { SENTRY_DSN = var.sentry_dsn } : name => { value = value } if value != ""
  }
  optional_frontend_env = {
    for name, value in { VITE_SENTRY_DSN = var.vite_sentry_dsn } : name => { value = value } if value != ""
  }

  backend_docker_source = {
    repo_url        = var.github_repo_url
    branch          = var.github_branch
    dockerfile_path = "./backend/Dockerfile"
    context         = "./backend"
    # Deploy a commit only after its GitHub checks pass (README: "Deploys wait for CI").
    auto_deploy_trigger = "checksPass"
  }
}

# --- Project -----------------------------------------------------------------

# Created in the dashboard and imported (README: "Importing the ToneDex
# project"). The map key must equal the environment's name: that is the key
# an import gives it, and a different key would make Terraform replace the
# environment instead of keeping it.
resource "render_project" "tonedex" {
  name = "ToneDex"

  environments = {
    "Production" = {
      name             = "Production"
      protected_status = "unprotected"
    }
  }
}

# --- Data stores -------------------------------------------------------------

resource "render_postgres" "db" {
  name           = "tonedex-db"
  environment_id = local.environment_id
  plan           = "basic_256mb"
  region         = var.region
  version        = "15"
  database_name  = "pokedex_production"
  database_user  = "pokedex"

  # Private network only by default: an empty allow list blocks every external
  # connection. Set explicitly so this doesn't depend on provider or API defaults.
  ip_allow_list = var.postgres_ip_allow_list
}

resource "render_keyvalue" "redis" {
  name           = "tonedex-redis"
  environment_id = local.environment_id
  plan           = var.keyvalue_plan
  region         = var.region
  # Sidekiq needs noeviction: an evicted key is a silently lost job.
  max_memory_policy = "noeviction"

  # Private network only: an empty allow list blocks every external connection.
  ip_allow_list = []
}

# --- Backend -----------------------------------------------------------------

# Shared configuration lives in render_env_group.backend, attached by
# render_env_group_link.backend.
resource "render_web_service" "api" {
  name           = "tonedex-api"
  environment_id = local.environment_id
  plan           = "starter"
  region         = var.region

  runtime_source = {
    docker = local.backend_docker_source
  }

  health_check_path  = "/up"
  pre_deploy_command = "./bin/rails db:migrate"

  custom_domains = [{ name = local.api_domain }]

  env_vars = {
    HTTP_PORT         = { value = "10000" }
    RAILS_MAX_THREADS = { value = "3" }
    DB_POOL           = { value = "3" }
  }
}

resource "render_background_worker" "worker" {
  name           = "tonedex-worker"
  environment_id = local.environment_id
  plan           = "starter"
  region         = var.region

  runtime_source = {
    docker = local.backend_docker_source
  }

  start_command = "bundle exec sidekiq"

  env_vars = {
    SIDEKIQ_CONCURRENCY = { value = "5" }
    DB_POOL             = { value = "5" }
  }
}

resource "render_env_group" "backend" {
  name           = "tonedex-backend"
  environment_id = local.environment_id

  env_vars = merge(
    {
      DATABASE_URL          = { value = render_postgres.db.connection_info.internal_connection_string }
      REDIS_URL             = { value = render_keyvalue.redis.connection_info.internal_connection_string }
      SECRET_KEY_BASE       = { value = var.secret_key_base }
      JWT_SECRET            = { value = var.jwt_secret }
      GOOGLE_CLIENT_ID      = { value = var.google_client_id }
      GOOGLE_CLIENT_SECRET  = { value = var.google_client_secret }
      SIDEKIQ_ALLOWED_EMAIL = { value = var.sidekiq_allowed_email }
      CORS_ORIGINS          = { value = join(",", [local.frontend_url, local.legacy_frontend_url]) }
      ALLOWED_HOSTS         = { value = local.api_domain }
    },
    local.optional_backend_env,
  )
}

resource "render_env_group_link" "backend" {
  env_group_id = render_env_group.backend.id
  service_ids = [
    render_web_service.api.id,
    render_background_worker.worker.id,
  ]
}

# --- Frontend ----------------------------------------------------------------

resource "render_static_site" "web" {
  name           = "tonedex-web"
  environment_id = local.environment_id
  repo_url       = var.github_repo_url
  branch         = var.github_branch
  root_directory = "frontend"
  build_command  = "npm ci && npm run build"
  publish_path   = "dist"
  # Deploy a commit only after its GitHub checks pass (README: "Deploys wait for CI").
  auto_deploy_trigger = "checksPass"

  # Render also adds www.tonedex.app as a redirect to the apex; the provider leaves it out of state.
  custom_domains = [{ name = local.frontend_domain }]

  env_vars = merge(
    {
      VITE_API_URL          = { value = local.api_url }
      VITE_GOOGLE_CLIENT_ID = { value = var.google_client_id }
      # Render reads NODE_VERSION; matches CI, and Vite 7 needs Node 20.19+ or 22.12+.
      NODE_VERSION = { value = "22" }
    },
    local.optional_frontend_env,
  )

  # Render serves a file that exists before applying rewrites, so this only
  # catches client-side routes (deep links into the SPA).
  routes = [
    {
      source      = "/*"
      destination = "/index.html"
      type        = "rewrite"
    },
  ]

  headers = [
    { path = "/*", name = "X-Frame-Options", value = "DENY" },
    { path = "/*", name = "X-Content-Type-Options", value = "nosniff" },
    { path = "/*", name = "Referrer-Policy", value = "strict-origin-when-cross-origin" },
    { path = "/*", name = "Content-Security-Policy", value = local.content_security_policy },
  ]
}
