require "rails_helper"

# Configures OmniAuth as production does with ALLOWED_HOSTS set. The test env has no Rails host check.
RSpec.describe "OmniAuth callback hosts", type: :request do
  let(:allowed_host) { "api.tonedex.test" }
  let(:forged_host) { "evil.example" }

  around do |example|
    original_hosts, original_logger = OmniAuth.config.allowed_hosts, OmniAuth.config.logger
    OmniAuth.config.allowed_hosts = OmniauthAllowedHosts.from(ActiveSupport::EnvironmentInquirer.new("production"), [allowed_host])
    OmniAuth.config.logger = Logger.new(IO::NULL)
    example.run
  ensure
    OmniAuth.config.allowed_hosts = original_hosts
    OmniAuth.config.logger = original_logger
  end

  def expect_invalid_host
    expect(response).to redirect_to(%r{\A[^?]*/auth/failure\?message=invalid_host})
  end

  describe "POST /auth/google_oauth2" do
    it "redirects to Google with a callback on the allowed host" do
      post "/auth/google_oauth2", headers: {"Host" => allowed_host}

      expect(response.location).to start_with("https://accounts.google.com/")
      redirect_uri = Rack::Utils.parse_query(URI(response.location).query)["redirect_uri"]
      expect(redirect_uri).to eq("http://#{allowed_host}/auth/google_oauth2/callback")
    end

    it "rejects a forged Host header" do
      post "/auth/google_oauth2", headers: {"Host" => forged_host}

      expect_invalid_host
    end

    it "rejects a forged X-Forwarded-Host header" do
      post "/auth/google_oauth2", headers: {"Host" => allowed_host, "X-Forwarded-Host" => forged_host}

      expect_invalid_host
    end

    it "does not log the forgeable-host warning" do
      allow(OmniAuth.logger).to receive(:warn)

      post "/auth/google_oauth2", headers: {"Host" => allowed_host}

      expect(OmniAuth.logger).not_to have_received(:warn).with(/building callback URLs/)
    end
  end

  describe "GET /auth/google_oauth2/callback" do
    it "rejects a forged X-Forwarded-Host header" do
      get "/auth/google_oauth2/callback", headers: {"Host" => allowed_host, "X-Forwarded-Host" => forged_host}

      expect_invalid_host
    end
  end
end
