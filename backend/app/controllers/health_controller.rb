class HealthController < ActionController::API
  def show
    checks = {database: check_database, redis: check_redis}
    healthy = checks.values.all? { |v| v[:ok] }

    render json: {status: healthy ? "up" : "down", checks: checks},
      status: healthy ? :ok : :service_unavailable
  end

  private

  def check_database
    ActiveRecord::Base.connection.execute("SELECT 1")
    {ok: true}
  rescue => e
    {ok: false, error: e.message}
  end

  # Redis backs Sidekiq queues and the Rack::Attack store — an outage there
  # should surface here, not only as silently stalled background jobs.
  def check_redis
    Sidekiq.redis(&:ping)
    {ok: true}
  rescue => e
    {ok: false, error: e.message}
  end
end
