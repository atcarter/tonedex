class SidekiqAuth
  def initialize(app) = @app = app

  def call(env)
    if (env["rack.session"] || {})[:sidekiq_authed]
      @app.call(env)
    else
      [302, {"Location" => "/auth/login", "Content-Type" => "text/html"}, []]
    end
  end
end
