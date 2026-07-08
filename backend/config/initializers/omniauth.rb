# Promote session + cookie middleware to the main Rails middleware stack so that:
#   - AuthController (ActionController::Base) can write session[:sidekiq_authed]
#   - SidekiqAuth Rack middleware can read the same session
#   - OmniAuth can store OAuth state in the session during the redirect flow
#
# Order matters: Cookies must come before Session, and both must come before OmniAuth.
Rails.application.config.middleware.use ActionDispatch::Cookies
Rails.application.config.middleware.use ActionDispatch::Session::CookieStore,
  key: "_sidekiq_session",
  secure: Rails.env.production?,
  same_site: :lax,
  expire_after: 30.minutes

Rails.application.config.middleware.use OmniAuth::Builder do
  provider :google_oauth2,
    ENV.fetch("GOOGLE_CLIENT_ID"),
    ENV.fetch("GOOGLE_CLIENT_SECRET"),
    scope: "email profile",
    prompt: "select_account"
end
