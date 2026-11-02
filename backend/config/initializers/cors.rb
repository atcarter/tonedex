# Be sure to restart your server when you modify this file.
#
# CORS_ORIGINS must be set in production to the exact frontend domain(s).
# Multiple origins are supported as a comma-separated list:
#   CORS_ORIGINS=https://example.com,https://www.example.com
#
# Never use a wildcard (*) in production — it defeats same-origin protection.

origins_raw = if Rails.env.production?
  ENV.fetch("CORS_ORIGINS") # raises KeyError if not set — intentional
else
  ENV.fetch("CORS_ORIGINS", "http://localhost:5173")
end

# Split so a single env var can cover multiple domains (e.g. www + apex)
allowed_origins = origins_raw.split(",").map(&:strip)

Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins(*allowed_origins)

    resource "*",
      headers: :any,
      methods: [:get, :post, :put, :patch, :delete, :options, :head]
  end
end
