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

      it "serves mirrored sprite URLs rooted at the request origin" do
        allow(SpriteStore).to receive(:mirrored?).and_return(true)

        get "/api/v1/games/#{game.id}"

        expect(response.parsed_body["pokemons"].first["sprite_url"])
          .to match(%r{\Ahttp://localhost/sprites/\d+\.png\z})
      end

      it "falls back to the original sprite URL when not mirrored" do
        get "/api/v1/games/#{game.id}"

        expect(response.parsed_body["pokemons"].first["sprite_url"])
          .to eq("https://example.com/sprite.png")
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

    context "with ?dex=national" do
      def lock_keys
        [SeedGamePokemonJob.lock_key(game.id), SeedNationalDexJob.lock_key]
      end

      before { Sidekiq.redis { |r| r.del(*lock_keys) } }
      after { Sidekiq.redis { |r| r.del(*lock_keys) } }

      let!(:regional) do
        [2, 1].map do |number|
          create(:pokemon, types: ["fire"]).tap do |pokemon|
            GamePokemon.create!(game: game, pokemon: pokemon, pokedex_number: number)
          end
        end
      end
      let!(:national_only) do
        create(:pokemon, types: ["ghost"], mythical: true).tap do |pokemon|
          GamePokemon.create!(game: game, pokemon: pokemon, regional: false)
        end
      end

      context "before the national pass has run" do
        it "enqueues the pass once and reports seeding with no rows" do
          expect {
            get "/api/v1/games/#{game.id}", params: {dex: "national"}
            get "/api/v1/games/#{game.id}", params: {dex: "national"}
          }.to have_enqueued_job(SeedNationalDexJob).exactly(:once)

          json = response.parsed_body
          expect(json["pokemons"]).to eq([])
          expect(json["pagination"]["seeding"]).to be(true)
        end

        it "leaves the regional view alone" do
          expect {
            get "/api/v1/games/#{game.id}"
          }.not_to have_enqueued_job(SeedNationalDexJob)
        end
      end

      context "after the national pass" do
        before { game.update!(national_seeded_at: Time.current) }

        it "lists every row by national number" do
          get "/api/v1/games/#{game.id}", params: {dex: "national"}

          json = response.parsed_body
          expected = [*regional, national_only].sort_by(&:pokeapi_id)
          expect(json["pokemons"].map { |p| p["id"] }).to eq(expected.map(&:id))
          expect(json["pokemons"].map { |p| p["pokedex_number"] }).to eq(expected.map(&:pokeapi_id))
          expect(json["pokemons"].find { |p| p["id"] == national_only.id }["mythical"]).to be(true)
          expect(json["pokemon_ids"]).to eq(expected.map(&:id))
          expect(json["dex_numbers"]).to eq(expected.map(&:pokeapi_id))
          expect(json["available_types"]).to eq(%w[fire ghost])
          expect(json["pagination"]).to include("total" => 3, "seeding" => false)
        end

        it "does not enqueue another pass" do
          expect {
            get "/api/v1/games/#{game.id}", params: {dex: "national"}
          }.not_to have_enqueued_job(SeedNationalDexJob)
        end
      end

      it "keeps national-only rows out of the regional view" do
        get "/api/v1/games/#{game.id}"

        json = response.parsed_body
        expect(json["pokemons"].map { |p| p["pokedex_number"] }).to eq([1, 2])
        expect(json["pokemon_ids"]).to eq(regional.reverse.map(&:id))
        expect(json["dex_numbers"]).to eq([1, 2])
        expect(json["available_types"]).to eq(["fire"])
        expect(json["pagination"]).to include("total" => 2, "seeding" => false)
      end

      it "seeds the regional dex of a game that only has national rows" do
        GamePokemon.where(game: game, regional: true).delete_all

        expect {
          get "/api/v1/games/#{game.id}"
        }.to have_enqueued_job(SeedGamePokemonJob).with(game.id)
      end
    end

    it "returns 404 for an unknown game" do
      get "/api/v1/games/999999"

      expect(response).to have_http_status(:not_found)
    end
  end
end
