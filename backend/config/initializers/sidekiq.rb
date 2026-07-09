Sidekiq.configure_server do |config|
  config.redis = {url: ENV.fetch("REDIS_URL", "redis://localhost:6379/0")}

  # Bound dead-set growth explicitly (defaults are 10k jobs / 6 months).
  # Anything nobody has retried within a month is effectively abandoned.
  config[:dead_max_jobs] = 5_000
  config[:dead_timeout_in_seconds] = 1.month.to_i
end

Sidekiq.configure_client do |config|
  config.redis = {url: ENV.fetch("REDIS_URL", "redis://localhost:6379/0")}
end
