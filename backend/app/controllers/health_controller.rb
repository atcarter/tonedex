class HealthController < ActionController::API
  def show
    checks = {database: check_database}
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
end
