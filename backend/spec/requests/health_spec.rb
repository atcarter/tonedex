require "rails_helper"

RSpec.describe "GET /up", type: :request do
  it "reports up with database and redis checks" do
    get "/up"

    expect(response).to have_http_status(:ok)
    json = response.parsed_body
    expect(json["status"]).to eq("up")
    expect(json.dig("checks", "database", "ok")).to be(true)
    expect(json.dig("checks", "redis", "ok")).to be(true)
  end

  it "reports down with the error class, not the message, when a check fails" do
    allow(Sidekiq).to receive(:redis).and_raise(RedisClient::CannotConnectError, "redis:6379 refused")

    get "/up"

    expect(response).to have_http_status(:service_unavailable)
    json = response.parsed_body
    expect(json["status"]).to eq("down")
    expect(json.dig("checks", "redis")).to eq("ok" => false, "error" => "RedisClient::CannotConnectError")
  end
end
