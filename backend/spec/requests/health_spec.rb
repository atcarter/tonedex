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
end
