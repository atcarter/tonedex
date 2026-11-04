variable "region" {
  description = "Render region for every regional resource (the static site is served from Render's global CDN)."
  type        = string
  default     = "oregon"

  validation {
    condition     = contains(["frankfurt", "ohio", "oregon", "singapore", "virginia"], var.region)
    error_message = "region must be one of frankfurt, ohio, oregon, singapore or virginia."
  }
}

variable "github_repo_url" {
  description = "HTTPS URL of the GitHub repository Render builds from, e.g. https://github.com/<owner>/tonedex. The Render GitHub app must have access to it."
  type        = string
}

variable "github_branch" {
  description = "Branch Render builds and auto-deploys."
  type        = string
  default     = "main"
}

variable "keyvalue_plan" {
  description = "Render Key Value plan. The free plan isn't persistent, which is acceptable because the only queued jobs are re-runnable seed crawls."
  type        = string
  default     = "free"

  validation {
    condition     = contains(["free", "starter", "standard", "pro", "pro_plus"], var.keyvalue_plan)
    error_message = "keyvalue_plan must be one of free, starter, standard, pro or pro_plus."
  }
}

variable "postgres_ip_allow_list" {
  description = "External IPs allowed to reach Postgres. Empty means private network only. Set your own IP (x.x.x.x/32) for a one-off external psql session, then clear it and apply again."
  type = set(object({
    cidr_block  = string
    description = string
  }))
  default = []
}

# --- Secrets ---------------------------------------------------------------

variable "secret_key_base" {
  description = "Rails SECRET_KEY_BASE. Generate with `bin/rails secret`."
  type        = string
  sensitive   = true
}

variable "jwt_secret" {
  description = "Secret that signs and verifies the API's JWTs."
  type        = string
  sensitive   = true
}

variable "google_client_secret" {
  description = "Google OAuth client secret (OmniAuth sign-in for the Sidekiq UI)."
  type        = string
  sensitive   = true
}

# --- Non-secret settings -----------------------------------------------------

variable "google_client_id" {
  description = "Google OAuth client ID. Used by the API to verify ID tokens and baked into the SPA build as VITE_GOOGLE_CLIENT_ID."
  type        = string
}

variable "sidekiq_allowed_email" {
  description = "The one Google account allowed into the Sidekiq UI."
  type        = string
}

variable "sentry_dsn" {
  description = "Backend Sentry DSN. Empty leaves SENTRY_DSN unset, which turns backend error tracking off."
  type        = string
  default     = ""
}

variable "vite_sentry_dsn" {
  description = "Frontend Sentry DSN, baked into the SPA build. Its ingest origin is added to the CSP's connect-src. Empty turns frontend error tracking off."
  type        = string
  default     = ""

  validation {
    condition     = var.vite_sentry_dsn == "" || can(regex("^https://[^@/]+@[^/]+/", var.vite_sentry_dsn))
    error_message = "vite_sentry_dsn must be empty or a DSN of the form https://<key>@<host>/<project>."
  }
}
