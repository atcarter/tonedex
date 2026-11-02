# Handles browser-based authentication for the Sidekiq Web UI only.
# Uses ActionController::Base (not API) so session cookies are available.
class AuthController < ActionController::Base
  protect_from_forgery with: :null_session

  def login
    render html: <<~HTML.html_safe, layout: false
      <!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
      <title>ToneDex Admin</title>
      <style>
        body{display:flex;align-items:center;justify-content:center;height:100vh;
             margin:0;font-family:sans-serif;background:#f5f5f5}
        .card{background:#fff;padding:40px;border-radius:12px;
              box-shadow:0 2px 12px rgba(0,0,0,.1);text-align:center}
        h1{color:#cc0000;margin-bottom:8px;letter-spacing:2px}
        p{color:#666;margin-bottom:24px}
        button{background:#cc0000;color:#fff;border:none;padding:12px 28px;
               border-radius:6px;font-size:1rem;cursor:pointer}
        button:hover{background:#aa0000}
      </style></head>
      <body><div class="card">
        <h1>&#9670; POKÉDEX</h1><p>Admin access required</p>
        <form action="/auth/google_oauth2" method="post">
          <input type="hidden" name="authenticity_token"
                 value="#{ERB::Util.html_escape(form_authenticity_token)}">
          <button type="submit">Sign in with Google</button>
        </form>
      </div></body></html>
    HTML
  end

  def callback
    email = request.env["omniauth.auth"]&.dig("info", "email")
    if email == ENV.fetch("SIDEKIQ_ALLOWED_EMAIL")
      session[:sidekiq_authed] = true
      redirect_to "/sidekiq", allow_other_host: false
    else
      render plain: "Access denied: #{email} is not authorized.", status: :forbidden
    end
  end

  def failure
    render plain: "Authentication failed: #{params[:message]}", status: :unauthorized
  end

  def logout
    session.delete(:sidekiq_authed)
    render plain: "Signed out.", status: :ok
  end
end
