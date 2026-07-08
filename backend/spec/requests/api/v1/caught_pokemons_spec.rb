require "rails_helper"

RSpec.describe "CaughtPokemons API", type: :request do
  let(:user) { create(:user) }
  let(:game) { create(:game) }
  let(:headers) { auth_headers(user) }

  describe "GET /api/v1/caught_pokemons" do
    it "returns 401 without a token" do
      get "/api/v1/caught_pokemons", params: {game_id: game.id}
      expect(response).to have_http_status(:unauthorized)
    end

    it "returns caught pokemon for the given game" do
      pokemon = create(:pokemon)
      create(:caught_pokemon, user: user, pokemon: pokemon, game: game)

      get "/api/v1/caught_pokemons", params: {game_id: game.id}, headers: headers

      expect(response).to have_http_status(:ok)
      json = response.parsed_body
      expect(json.length).to eq(1)
      expect(json.first["pokemon_id"]).to eq(pokemon.id)
      expect(json.first["game_id"]).to eq(game.id)
    end

    it "does not return entries from other games" do
      other_game = create(:game)
      create(:caught_pokemon, user: user, pokemon: create(:pokemon), game: other_game)

      get "/api/v1/caught_pokemons", params: {game_id: game.id}, headers: headers
      expect(response.parsed_body).to eq([])
    end
  end

  describe "POST /api/v1/caught_pokemons" do
    it "returns 401 without a token" do
      post "/api/v1/caught_pokemons", params: {pokemon_id: 1, game_id: game.id}
      expect(response).to have_http_status(:unauthorized)
    end

    it "marks a pokemon as caught and returns 201" do
      pokemon = create(:pokemon)

      expect {
        post "/api/v1/caught_pokemons",
          params: {pokemon_id: pokemon.id, game_id: game.id},
          headers: headers
      }.to change(CaughtPokemon, :count).by(1)

      expect(response).to have_http_status(:created)
      json = response.parsed_body
      expect(json["pokemon_id"]).to eq(pokemon.id)
      expect(json["game_id"]).to eq(game.id)
    end

    it "returns 404 for a non-existent pokemon" do
      post "/api/v1/caught_pokemons",
        params: {pokemon_id: 999_999, game_id: game.id},
        headers: headers
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "DELETE /api/v1/caught_pokemons/:id" do
    it "returns 401 without a token" do
      delete "/api/v1/caught_pokemons/1"
      expect(response).to have_http_status(:unauthorized)
    end

    it "removes the caught entry and returns 204" do
      pokemon = create(:pokemon)
      entry = create(:caught_pokemon, user: user, pokemon: pokemon, game: game)

      expect {
        delete "/api/v1/caught_pokemons/#{entry.id}", headers: headers
      }.to change(CaughtPokemon, :count).by(-1)

      expect(response).to have_http_status(:no_content)
    end

    it "returns 404 when the entry belongs to another user" do
      other_entry = create(:caught_pokemon, user: create(:user), pokemon: create(:pokemon), game: game)

      delete "/api/v1/caught_pokemons/#{other_entry.id}", headers: headers
      expect(response).to have_http_status(:not_found)
    end
  end
end
