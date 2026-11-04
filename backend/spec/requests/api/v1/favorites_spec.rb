require "rails_helper"

RSpec.describe "Favorites API", type: :request do
  let(:user) { create(:user) }
  let(:headers) { auth_headers(user) }

  describe "GET /api/v1/favorites" do
    it "returns 401 without a token" do
      get "/api/v1/favorites"
      expect(response).to have_http_status(:unauthorized)
    end

    it "returns an empty array when the user has no favorites" do
      get "/api/v1/favorites", headers: headers
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body).to eq([])
    end

    it "returns the user's favorites with pokemon data and favorite_id" do
      pokemon = create(:pokemon, name: "pikachu", types: ["electric"])
      create(:favorite, user: user, pokemon: pokemon, position: 1)

      get "/api/v1/favorites", headers: headers

      expect(response).to have_http_status(:ok)
      json = response.parsed_body
      expect(json.length).to eq(1)
      expect(json.first["name"]).to eq("pikachu")
      expect(json.first["favorite_id"]).to be_present
    end

    it "returns favorites in position order" do
      later = create(:favorite, user: user, pokemon: create(:pokemon), position: 2)
      first = create(:favorite, user: user, pokemon: create(:pokemon), position: 1)

      get "/api/v1/favorites", headers: headers

      expect(response.parsed_body.map { |f| f["favorite_id"] }).to eq([first.id, later.id])
    end

    it "does not return another user's favorites" do
      other = create(:user)
      create(:favorite, user: other, pokemon: create(:pokemon))

      get "/api/v1/favorites", headers: headers
      expect(response.parsed_body).to eq([])
    end
  end

  describe "POST /api/v1/favorites" do
    it "returns 401 without a token" do
      post "/api/v1/favorites", params: {pokemon_id: 1}
      expect(response).to have_http_status(:unauthorized)
    end

    it "creates a favorite and returns 201" do
      pokemon = create(:pokemon)

      expect {
        post "/api/v1/favorites", params: {pokemon_id: pokemon.id}, headers: headers
      }.to change(Favorite, :count).by(1)

      expect(response).to have_http_status(:created)
      expect(response.parsed_body["pokemon_id"]).to eq(pokemon.id)
    end

    it "returns 404 for a non-existent pokemon" do
      post "/api/v1/favorites", params: {pokemon_id: 999_999}, headers: headers
      expect(response).to have_http_status(:not_found)
    end

    it "is idempotent — favoriting the same pokemon twice does not create a duplicate" do
      pokemon = create(:pokemon)
      create(:favorite, user: user, pokemon: pokemon, position: 1)

      expect {
        post "/api/v1/favorites", params: {pokemon_id: pokemon.id}, headers: headers
      }.not_to change(Favorite, :count)
    end
  end

  describe "DELETE /api/v1/favorites/:id" do
    it "returns 401 without a token" do
      delete "/api/v1/favorites/1"
      expect(response).to have_http_status(:unauthorized)
    end

    it "destroys the favorite and returns 204" do
      pokemon = create(:pokemon)
      favorite = create(:favorite, user: user, pokemon: pokemon, position: 1)

      expect {
        delete "/api/v1/favorites/#{favorite.id}", headers: headers
      }.to change(Favorite, :count).by(-1)

      expect(response).to have_http_status(:no_content)
    end

    it "returns 404 when the favorite belongs to another user" do
      other_favorite = create(:favorite, user: create(:user), pokemon: create(:pokemon))

      delete "/api/v1/favorites/#{other_favorite.id}", headers: headers
      expect(response).to have_http_status(:not_found)
    end
  end
end
