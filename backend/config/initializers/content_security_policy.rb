# Content Security Policy
#
# Restricts which sources browsers will load for each resource type.
# This is a defence-in-depth control: even if an XSS payload lands on the
# page, CSP prevents it from loading or exfiltrating data to unknown origins.
#
# References:
#   https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP
#   https://guides.rubyonrails.org/security.html#content-security-policy

Rails.application.config.content_security_policy do |policy|
  # Only allow scripts from the same origin.
  # 'strict-dynamic' is omitted — this app has no inline scripts that need it.
  policy.default_src :self
  policy.font_src :self, :data
  policy.img_src :self, :data, "https://raw.githubusercontent.com", "https://assets.pokemon.com"
  policy.object_src :none
  policy.script_src :self
  policy.style_src :self, :unsafe_inline # styled-components injects <style> tags at runtime

  # Allow XHR / fetch to the Rails API origin in production.
  # In development the React dev server calls localhost:3000 which is :self relative to the API.
  if Rails.env.production?
    api_origin = ENV.fetch("API_ORIGIN", "https://api.pokemaniac.com")
    policy.connect_src :self, api_origin,
      "https://accounts.google.com", # Google OAuth token endpoint
      "https://o*.ingest.sentry.io"  # Sentry error reporting
  else
    policy.connect_src :self, :unsafe_eval,
      "http://localhost:3000",
      "ws://localhost:5173",         # Vite HMR websocket
      "https://accounts.google.com",
      "https://o*.ingest.sentry.io"
  end

  # Frame ancestors — prevents clickjacking
  policy.frame_ancestors :none

  # Block all mixed content (HTTP resources on an HTTPS page)
  policy.block_all_mixed_content if Rails.env.production?
end

# Send a Report-Only header in development so violations are logged without
# breaking the app — flip to enforcement by removing this block.
if Rails.env.development?
  Rails.application.config.content_security_policy_report_only = true
end
