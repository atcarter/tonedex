locals {
  api_url      = trimsuffix(render_web_service.api.url, "/")
  frontend_url = trimsuffix(render_static_site.web.url, "/")

  # https://<key>@o123.ingest.us.sentry.io/456 -> https://o123.ingest.us.sentry.io
  sentry_ingest_origin = (
    var.vite_sentry_dsn == ""
    ? ""
    : "https://${regex("^https://[^@/]+@([^/]+)/", var.vite_sentry_dsn)[0]}"
  )

  # Report-only for now; infra/render/README.md explains each source and how
  # to switch to an enforcing Content-Security-Policy.
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

# --- Data stores -------------------------------------------------------------

resource "render_postgres" "db" {
  name          = "tonedex-db"
  plan          = "basic_256mb"
  region        = var.region
  version       = "15"
  database_name = "pokedex_production"
  database_user = "pokedex"

  # Private network only by default: an empty allow list blocks every external
  # connection. Set explicitly so this doesn't depend on provider or API defaults.
  ip_allow_list = var.postgres_ip_allow_list
}

resource "render_keyvalue" "redis" {
  name   = "tonedex-redis"
  plan   = var.keyvalue_plan
  region = var.region
  # Sidekiq needs noeviction: an evicted key is a silently lost job.
  max_memory_policy = "noeviction"

  # Private network only: an empty allow list blocks every external connection.
  ip_allow_list = []
}

# --- Backend -----------------------------------------------------------------

# Shared configuration lives in render_env_group.backend, attached by
# render_env_group_link.backend. Neither service references the static site,
# which is what keeps the api <-> web URL dependency from forming a cycle.
resource "render_web_service" "api" {
  name   = "tonedex-api"
  plan   = "starter"
  region = var.region

  runtime_source = {
    docker = local.backend_docker_source
  }

  health_check_path  = "/up"
  pre_deploy_command = "./bin/rails db:migrate"

  env_vars = {
    HTTP_PORT         = { value = "10000" }
    RAILS_MAX_THREADS = { value = "3" }
    DB_POOL           = { value = "3" }
  }
}

resource "render_background_worker" "worker" {
  name   = "tonedex-worker"
  plan   = "starter"
  region = var.region

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
  name = "tonedex-backend"

  env_vars = merge(
    {
      DATABASE_URL          = { value = render_postgres.db.connection_info.internal_connection_string }
      REDIS_URL             = { value = render_keyvalue.redis.connection_info.internal_connection_string }
      SECRET_KEY_BASE       = { value = var.secret_key_base }
      JWT_SECRET            = { value = var.jwt_secret }
      GOOGLE_CLIENT_ID      = { value = var.google_client_id }
      GOOGLE_CLIENT_SECRET  = { value = var.google_client_secret }
      SIDEKIQ_ALLOWED_EMAIL = { value = var.sidekiq_allowed_email }
      CORS_ORIGINS          = { value = local.frontend_url }
      ALLOWED_HOSTS         = { value = trimprefix(local.api_url, "https://") }
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
  repo_url       = var.github_repo_url
  branch         = var.github_branch
  root_directory = "frontend"
  build_command  = "npm ci && npm run build"
  publish_path   = "dist"
  # Deploy a commit only after its GitHub checks pass (README: "Deploys wait for CI").
  auto_deploy_trigger = "checksPass"

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
    { path = "/*", name = "Content-Security-Policy-Report-Only", value = local.content_security_policy },
  ]
}
