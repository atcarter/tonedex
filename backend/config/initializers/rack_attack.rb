class Rack::Attack
  # Request specs fire far more requests per minute than the throttles allow,
  # and the Redis-backed counters would even persist across runs.
  self.enabled = !Rails.env.test?

  # Use Redis for the throttle store so limits are shared across Puma workers.
  # Falls back to the default memory store in test/development if Redis isn't configured.
  if ENV["REDIS_URL"].present?
    Rack::Attack.cache.store = ActiveSupport::Cache::RedisCacheStore.new(url: ENV["REDIS_URL"])
  end

  # ── Throttles ──────────────────────────────────────────────────────────────

  # General API: 300 requests per 5 minutes per IP.
  # Covers browsing the dex, viewing Pokémon, move lookups, etc.
  throttle("api/general", limit: 300, period: 5.minutes) do |req|
    req.ip if req.path.start_with?("/api/")
  end

  # Auth endpoint: 10 sign-in attempts per minute per IP.
  # Prevents credential-stuffing against the Google ID token exchange.
  throttle("api/auth", limit: 10, period: 1.minute) do |req|
    req.ip if req.path == "/api/v1/auth/google" && req.post?
  end

  # NOTE: there is deliberately no games-specific throttle. Dex pagination is
  # legitimate burst traffic (infinite scroll fetches ~10 pages for a large dex,
  # and the seeding banner polls every 5s), and the threat the old 5/min limit
  # guarded against — stacking SeedGamePokemonJobs on an unseeded game — is now
  # prevented structurally by SeedGamePokemonJob.enqueue_once's Redis lock.
  # The general 300/5min throttle above still bounds raw volume.

  # Search: 15 requests per minute per IP.
  # Every query that misses the local DB triggers a synchronous PokeAPI fetch
  # from the request thread, so this is the endpoint where per-request cost is
  # highest and abuse fans out to an external service.
  throttle("api/search", limit: 15, period: 1.minute) do |req|
    req.ip if req.path == "/api/v1/pokemon/search" && req.get?
  end

  # ── Response ───────────────────────────────────────────────────────────────

  # Return a plain 429 with a Retry-After header so clients can back off gracefully.
  self.throttled_responder = lambda do |req|
    match_data = req.env["rack.attack.match_data"]
    retry_after = match_data ? (match_data[:period] - (Time.now.to_i % match_data[:period])).to_s : "60"
    [
      429,
      {"Content-Type" => "application/json", "Retry-After" => retry_after},
      [{error: "Too many requests. Please slow down.", retry_after: retry_after.to_i}.to_json]
    ]
  end
end
