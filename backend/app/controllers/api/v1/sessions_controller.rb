class Api::V1::SessionsController < ApplicationController
  def create
    payload = Google::Auth::IDTokens.verify_oidc(
      params[:id_token],
      aud: ENV.fetch("GOOGLE_CLIENT_ID")
    )

    user = User.find_or_create_by!(google_uid: payload["sub"]) do |u|
      u.email = payload["email"]
      u.name = payload["name"]
      u.avatar_url = payload["picture"]
    end

    token = JWT.encode(
      {user_id: user.id, email: user.email, exp: 30.days.from_now.to_i},
      ENV.fetch("JWT_SECRET"),
      "HS256"
    )

    render json: {
      token: token,
      user: {id: user.id, email: user.email, name: user.name, avatar_url: user.avatar_url}
    }
  rescue Google::Auth::IDTokens::VerificationError => e
    render json: {error: "Invalid Google token: #{e.message}"}, status: :unauthorized
  end
end
