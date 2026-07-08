require "sidekiq/web"
require_relative "../app/middleware/sidekiq_auth"

# Session middleware is now in config/initializers/omniauth.rb (main Rails stack),
# so both AuthController and SidekiqAuth share the same session cookie.
Sidekiq::Web.use SidekiqAuth

Rails.application.routes.draw do
  # ── Sidekiq admin auth (server-side OAuth, session-based) ─────────────────
  get "/auth/login", to: "auth#login"
  get "/auth/google_oauth2/callback", to: "auth#callback"
  get "/auth/failure", to: "auth#failure"
  get "/auth/logout", to: "auth#logout"

  mount Sidekiq::Web => "/sidekiq"

  # ── API ───────────────────────────────────────────────────────────────────
  namespace :api do
    namespace :v1 do
      post "/auth/google", to: "sessions#create"  # SPA login: receives Google ID token, returns JWT

      resources :favorites, only: [:index, :create, :destroy] do
        collection { patch :reorder }
      end
      resources :caught_pokemons, only: [:index, :create, :destroy]

      resources :games, only: [:index, :show]
      resources :pokemon, only: [:index, :show] do
        collection do
          get :search
        end
      end
      resources :moves, only: [:show]
    end
  end

  get "up" => "health#show", :as => :rails_health_check
end
