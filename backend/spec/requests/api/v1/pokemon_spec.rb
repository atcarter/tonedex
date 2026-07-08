require "rails_helper"

RSpec.describe "Pokemon API", type: :request do
  # PokemonController builds its own adapter; swap it for a double so no spec
  # ever reaches PokeAPI.
  let(:adapter) { instance_double(PokeapiAdapter) }

  before do
    allow(PokeapiAdapter).to receive(:new).and_return(adapter)
    allow(adapter).to receive(:evolution_chain_for).and_return(
      [{name: "charmander", evolution_details: []}]
    )
    allow(adapter).to receive(:species_info_for).and_return(
      {genus: "Lizard Pokémon", flavor_text: "Prefers hot places.",
       height: 6, weight: 85,
       abilities: [{name: "blaze", hidden: false}]}
    )
  end

  describe "GET /api/v1/pokemon/:id" do
    let!(:pokemon) do
      create(:pokemon, name: "charmander", types: ["fire"])
    end

    it "returns details and evolution chain, with no moves outside a game" do
      get "/api/v1/pokemon/#{pokemon.id}"

      expect(response).to have_http_status(:ok)
      json = response.parsed_body
      expect(json["pokemon"]).to include("name" => "charmander", "types" => ["fire"])
      expect(json["pokemon"]["base_stats"]).to be_present
      expect(json["moves"]).to eq([])
      expect(json["evolution_chain"].first["name"]).to eq("charmander")
    end

    it "returns an empty evolution chain when the adapter fails" do
      allow(adapter).to receive(:evolution_chain_for).and_raise(PokeapiClient::ApiError)

      get "/api/v1/pokemon/#{pokemon.id}"

      expect(response.parsed_body["evolution_chain"]).to eq([])
    end

    it "includes species info and degrades to null when unavailable" do
      get "/api/v1/pokemon/#{pokemon.id}"
      expect(response.parsed_body["species"]).to include(
        "genus" => "Lizard Pokémon",
        "abilities" => [{"name" => "blaze", "hidden" => false}]
      )

      allow(adapter).to receive(:species_info_for).and_raise(PokeapiClient::ApiError)
      get "/api/v1/pokemon/#{pokemon.id}"
      expect(response.parsed_body["species"]).to be_nil
    end

    it "returns 404 for an unknown numeric id" do
      get "/api/v1/pokemon/999999"

      expect(response).to have_http_status(:not_found)
    end

    context "with a game_id" do
      let(:game) { create(:game, generation: 1) }

      before do
        allow(adapter).to receive(:basic_moves_for_game).and_return([
          {name: "wing-attack", level_learned: 17, learn_method: "level-up"},
          {name: "fly", level_learned: 0, learn_method: "machine"},
          {name: "scratch", level_learned: 1, learn_method: "level-up"}
        ])
      end

      it "sorts moves level-up first, then by level" do
        get "/api/v1/pokemon/#{pokemon.id}", params: {game_id: game.id}

        names = response.parsed_body["moves"].map { |m| m["name"] }
        expect(names).to eq(%w[scratch wing-attack fly])
      end

      it "applies generation-specific types" do
        pokemon.update!(
          types: %w[normal fairy],
          past_types: [{"generation" => "generation-v", "types" => ["normal"]}]
        )

        get "/api/v1/pokemon/#{pokemon.id}", params: {game_id: game.id}

        expect(response.parsed_body["pokemon"]["types"]).to eq(["normal"])
      end

      it "includes the game-local pokedex number" do
        GamePokemon.create!(game: game, pokemon: pokemon, pokedex_number: 4)

        get "/api/v1/pokemon/#{pokemon.id}", params: {game_id: game.id}

        expect(response.parsed_body["pokemon"]["pokedex_number"]).to eq(4)
      end
    end
  end

  describe "GET /api/v1/pokemon/search" do
    it "returns 400 when the query is blank" do
      get "/api/v1/pokemon/search", params: {q: "  "}

      expect(response).to have_http_status(:bad_request)
    end

    it "returns an exact PokeAPI match as {results:, exact: true}" do
      pokemon = create(:pokemon, name: "pikachu")
      allow(adapter).to receive(:find_or_create_pokemon).with("pikachu").and_return(pokemon)

      get "/api/v1/pokemon/search", params: {q: "Pikachu"}

      json = response.parsed_body
      expect(json["exact"]).to be(true)
      expect(json["results"].map { |p| p["name"] }).to eq(["pikachu"])
    end

    it "falls back to a database substring search as {results:, exact: false}" do
      # Sentinel names: the shared test database may hold leftover real Pokémon
      create(:pokemon, name: "spectest-pika")
      create(:pokemon, name: "spectest-rai")
      allow(adapter).to receive(:find_or_create_pokemon).and_raise(PokeapiClient::NotFoundError)

      get "/api/v1/pokemon/search", params: {q: "spectest"}

      json = response.parsed_body
      expect(json["exact"]).to be(false)
      expect(json["results"].map { |p| p["name"] }).to contain_exactly("spectest-pika", "spectest-rai")
    end

    it "treats SQL LIKE wildcards in the query literally" do
      create(:pokemon, name: "pikachu")
      allow(adapter).to receive(:find_or_create_pokemon).and_raise(PokeapiClient::NotFoundError)

      get "/api/v1/pokemon/search", params: {q: "%"}

      expect(response.parsed_body["results"]).to eq([])
    end
  end
end
