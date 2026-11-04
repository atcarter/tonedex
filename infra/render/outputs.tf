output "api_url" {
  description = "Public URL of the Rails API (tonedex-api)."
  value       = local.api_url
}

output "frontend_url" {
  description = "Public URL of the SPA (tonedex-web)."
  value       = local.frontend_url
}
