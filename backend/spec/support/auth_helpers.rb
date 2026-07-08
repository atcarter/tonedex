# Shared helpers for request specs that need an authenticated user.
#
# Usage:
#   let(:user) { create(:user) }
#   let(:headers) { auth_headers(user) }
#   it { get "/api/v1/favorites", headers: headers }
module AuthHelpers
  def auth_headers(user)
    token = JWT.encode(
      {user_id: user.id, email: user.email, exp: 1.hour.from_now.to_i},
      ENV.fetch("JWT_SECRET", "test_secret"),
      "HS256"
    )
    {"Authorization" => "Bearer #{token}"}
  end
end

RSpec.configure do |config|
  config.include AuthHelpers, type: :request
end
