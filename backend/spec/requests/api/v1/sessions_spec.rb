require "rails_helper"

RSpec.describe "POST /api/v1/auth/google", type: :request do
  let(:google_payload) do
    {
      "sub" => "google-uid-abc",
      "email" => "trainer@example.com",
      "name" => "Ash Ketchum",
      "picture" => "https://example.com/ash.jpg"
    }
  end

  context "with a valid Google ID token" do
    before do
      allow(Google::Auth::IDTokens).to receive(:verify_oidc).and_return(google_payload)
    end

    it "returns 200 with a JWT and user info" do
      post "/api/v1/auth/google", params: {id_token: "valid-token"}

      expect(response).to have_http_status(:ok)
      json = response.parsed_body
      expect(json["token"]).to be_present
      expect(json["user"]["email"]).to eq("trainer@example.com")
      expect(json["user"]["name"]).to eq("Ash Ketchum")
    end

    it "creates a new user on first sign-in" do
      expect {
        post "/api/v1/auth/google", params: {id_token: "valid-token"}
      }.to change(User, :count).by(1)
    end

    it "does not create a duplicate user on subsequent sign-ins" do
      create(:user, google_uid: "google-uid-abc", email: "trainer@example.com")

      expect {
        post "/api/v1/auth/google", params: {id_token: "valid-token"}
      }.not_to change(User, :count)
    end

    it "syncs profile fields that changed at Google" do
      user = create(:user, google_uid: "google-uid-abc", email: "old@example.com",
        name: "Old Name", avatar_url: "https://example.com/old.jpg")

      post "/api/v1/auth/google", params: {id_token: "valid-token"}

      expect(user.reload).to have_attributes(
        email: "trainer@example.com",
        name: "Ash Ketchum",
        avatar_url: "https://example.com/ash.jpg"
      )
    end

    it "returns a JWT that decodes to the correct user_id" do
      post "/api/v1/auth/google", params: {id_token: "valid-token"}

      token = response.parsed_body["token"]
      payload, = JWT.decode(token, ENV.fetch("JWT_SECRET", "test_secret"), true, algorithms: ["HS256"])
      user = User.find_by!(email: "trainer@example.com")
      expect(payload["user_id"]).to eq(user.id)
    end
  end

  context "with an invalid Google ID token" do
    before do
      allow(Google::Auth::IDTokens).to receive(:verify_oidc)
        .and_raise(Google::Auth::IDTokens::VerificationError.new("bad token"))
    end

    it "returns 401" do
      post "/api/v1/auth/google", params: {id_token: "bad-token"}

      expect(response).to have_http_status(:unauthorized)
      expect(response.parsed_body["error"]).to match(/Invalid Google token/)
    end
  end
end
