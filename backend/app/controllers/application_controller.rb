class ApplicationController < ActionController::API
  private

  def authenticate_user!
    token = request.headers["Authorization"]&.split(" ", 2)&.last
    payload, = JWT.decode(token.to_s, ENV.fetch("JWT_SECRET"), true, algorithms: ["HS256"])
    @current_user = User.find(payload["user_id"])
  rescue JWT::DecodeError, ActiveRecord::RecordNotFound
    render json: {error: "Unauthorized"}, status: :unauthorized
  end

  attr_reader :current_user
end
