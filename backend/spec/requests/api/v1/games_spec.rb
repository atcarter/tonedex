require "rails_helper"

RSpec.describe "Games API", type: :request do
  describe "GET /api/v1/games" do
    # The shared test database may hold previously seeded games, so assert
    # relative ordering of sentinel records rather than the exact list.
    it "returns games ordered by generation then name" do
      create(:game, name: "spec-gen9-game", generation: 9)
      create(:game, name: "spec-gen1-aa", generation: 1)
      create(:game, name: "spec-gen1-zz", generation: 1)

      get "/api/v1/games"

      expect(response).to have_http_status(:ok)
      names = response.parsed_body.map { |g| g["name"] }
      expect(names.index("spec-gen1-aa")).to be < names.index("spec-gen1-zz")
      expect(names.index("spec-gen1-zz")).to be < names.index("spec-gen9-game")
    end
  end

  describe "GET /api/v1/games/:id" do
    let(:game) { create(:game, generation: 9) }

    def seed_pokemons(count)
      count.times.map do |i|
        pokemon = create(:pokemon, types: ["fire"])
        GamePokemon.create!(game: game, pokemon: pokemon, pokedex_number: i + 1)
        pokemon
      end
    end

    context "when the game is already seeded" do
      before { seed_pokemons(3) }

      it "returns pokemon ordered by pokedex number with pagination metadata" do
        get "/api/v1/games/#{game.id}", params: {limit: 2}

        expect(response).to have_http_status(:ok)
        json = response.parsed_body
        expect(json["pokemons"].map { |p| p["pokedex_number"] }).to eq([1, 2])
        expect(json["pagination"]).to include(
          "total" => 3, "limit" => 2, "offset" => 0, "has_more" => true, "seeding" => false
        )
      end

      it "returns the final page with has_more false" do
        get "/api/v1/games/#{game.id}", params: {limit: 2, offset: 2}

        json = response.parsed_body
        expect(json["pokemons"].length).to eq(1)
        expect(json["pagination"]["has_more"]).to be(false)
      end

      it "includes available_types on the first page only" do
        get "/api/v1/games/#{game.id}"
        expect(response.parsed_body["available_types"]).to eq(["fire"])

        get "/api/v1/games/#{game.id}", params: {offset: 2}
        expect(response.parsed_body["available_types"]).to eq([])
      end

      it "does not enqueue a seed job" do
        expect {
          get "/api/v1/games/#{game.id}"
        }.not_to have_enqueued_job(SeedGamePokemonJob)
      end
    end

    context "when the game has no pokemon yet" do
      before { Sidekiq.redis { |r| r.del(SeedGamePokemonJob.lock_key(game.id)) } }
      after { Sidekiq.redis { |r| r.del(SeedGamePokemonJob.lock_key(game.id)) } }

      it "enqueues a seed job and reports seeding" do
        expect {
          get "/api/v1/games/#{game.id}"
        }.to have_enqueued_job(SeedGamePokemonJob).with(game.id)

        expect(response.parsed_body["pagination"]["seeding"]).to be(true)
        expect(response.parsed_body["pokemons"]).to eq([])
      end

      it "does not stack duplicate seed jobs while the lock is held" do
        expect {
          get "/api/v1/games/#{game.id}"
          get "/api/v1/games/#{game.id}"
        }.to have_enqueued_job(SeedGamePokemonJob).exactly(:once)
      end
    end

    it "returns 404 for an unknown game" do
      get "/api/v1/games/999999"

      expect(response).to have_http_status(:not_found)
    end
  end
end
