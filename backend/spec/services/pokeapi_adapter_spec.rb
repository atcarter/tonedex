require "rails_helper"

# All pokeapi_ids are set to high fake values (100_000+) so they can never
# collide with real Pokémon records that may exist in the test database from
# prior seeding. `find_or_create_by!(pokeapi_id: ...)` would silently return
# an existing record if we used real IDs like 25 (Pikachu) or 1 (Bulbasaur).
FAKE_PIKACHU_ID = 100_025
FAKE_CLEFAIRY_ID = 100_035
FAKE_BULBASAUR_ID = 100_001

RSpec.describe PokeapiAdapter do
  # Inject a test double instead of making real HTTP calls.
  # This is what the constructor's `client:` keyword argument is designed for.
  let(:client) { instance_double("PokeapiClient") }
  let(:adapter) { described_class.new(client: client) }

  def pikachu_data
    {
      "id" => FAKE_PIKACHU_ID,
      "name" => "pikachu",
      "types" => [
        {"slot" => 1, "type" => {"name" => "electric"}}
      ],
      "past_types" => [],
      "stats" => [
        {"stat" => {"name" => "hp"}, "base_stat" => 35},
        {"stat" => {"name" => "attack"}, "base_stat" => 55},
        {"stat" => {"name" => "defense"}, "base_stat" => 40},
        {"stat" => {"name" => "special-attack"}, "base_stat" => 50},
        {"stat" => {"name" => "special-defense"}, "base_stat" => 50},
        {"stat" => {"name" => "speed"}, "base_stat" => 90}
      ],
      "sprites" => {
        "front_default" => "https://example.com/pikachu.png",
        "front_shiny" => "https://example.com/pikachu-shiny.png"
      },
      "moves" => []
    }
  end

  def clefairy_data
    {
      "id" => FAKE_CLEFAIRY_ID,
      "name" => "clefairy",
      "types" => [
        {"slot" => 1, "type" => {"name" => "normal"}},
        {"slot" => 2, "type" => {"name" => "fairy"}}
      ],
      "past_types" => [
        {
          "generation" => {"name" => "generation-v"},
          "types" => [{"slot" => 1, "type" => {"name" => "normal"}}]
        }
      ],
      "stats" => [
        {"stat" => {"name" => "hp"}, "base_stat" => 70},
        {"stat" => {"name" => "attack"}, "base_stat" => 45},
        {"stat" => {"name" => "defense"}, "base_stat" => 48},
        {"stat" => {"name" => "special-attack"}, "base_stat" => 60},
        {"stat" => {"name" => "special-defense"}, "base_stat" => 65},
        {"stat" => {"name" => "speed"}, "base_stat" => 35}
      ],
      "sprites" => {
        "front_default" => "https://example.com/clefairy.png",
        "front_shiny" => nil
      },
      "moves" => []
    }
  end

  def tackle_move_data
    {
      "id" => 100_033,
      "name" => "tackle",
      "type" => {"name" => "normal"},
      "power" => 40,
      "accuracy" => 100,
      "pp" => 35,
      "damage_class" => {"name" => "physical"}
    }
  end

  # Linear chain: bulbasaur → ivysaur → venusaur
  def bulbasaur_chain
    {
      "chain" => {
        "species" => {"name" => "bulbasaur"},
        "evolution_details" => [],
        "evolves_to" => [
          {
            "species" => {"name" => "ivysaur"},
            "evolution_details" => [
              {"trigger" => {"name" => "level-up"}, "min_level" => 16,
               "item" => nil, "held_item" => nil, "time_of_day" => "",
               "location" => nil, "min_happiness" => nil,
               "min_affection" => nil, "known_move" => nil,
               "known_move_type" => nil, "gender" => nil, "trade_species" => nil}
            ],
            "evolves_to" => [
              {
                "species" => {"name" => "venusaur"},
                "evolution_details" => [
                  {"trigger" => {"name" => "level-up"}, "min_level" => 32,
                   "item" => nil, "held_item" => nil, "time_of_day" => "",
                   "location" => nil, "min_happiness" => nil,
                   "min_affection" => nil, "known_move" => nil,
                   "known_move_type" => nil, "gender" => nil, "trade_species" => nil}
                ],
                "evolves_to" => []
              }
            ]
          }
        ]
      }
    }
  end

  # Branching chain: eevee → [vaporeon, flareon]
  def eevee_chain
    {
      "chain" => {
        "species" => {"name" => "eevee"},
        "evolution_details" => [],
        "evolves_to" => [
          {
            "species" => {"name" => "vaporeon"},
            "evolution_details" => [
              {"trigger" => {"name" => "use-item"}, "item" => {"name" => "water-stone"},
               "min_level" => nil, "held_item" => nil, "time_of_day" => "",
               "location" => nil, "min_happiness" => nil, "min_affection" => nil,
               "known_move" => nil, "known_move_type" => nil, "gender" => nil,
               "trade_species" => nil}
            ],
            "evolves_to" => []
          },
          {
            "species" => {"name" => "flareon"},
            "evolution_details" => [
              {"trigger" => {"name" => "use-item"}, "item" => {"name" => "fire-stone"},
               "min_level" => nil, "held_item" => nil, "time_of_day" => "",
               "location" => nil, "min_happiness" => nil, "min_affection" => nil,
               "known_move" => nil, "known_move_type" => nil, "gender" => nil,
               "trade_species" => nil}
            ],
            "evolves_to" => []
          }
        ]
      }
    }
  end

  # ---------------------------------------------------------------------------
  # find_or_create_pokemon
  # ---------------------------------------------------------------------------

  describe "#find_or_create_pokemon" do
    before { allow(client).to receive(:pokemon).with(FAKE_PIKACHU_ID).and_return(pikachu_data) }

    it "creates a new Pokemon record with mapped attributes" do
      expect { adapter.find_or_create_pokemon(FAKE_PIKACHU_ID) }.to change(Pokemon, :count).by(1)

      pokemon = Pokemon.find_by!(pokeapi_id: FAKE_PIKACHU_ID)
      expect(pokemon.name).to eq("pikachu")
      expect(pokemon.types).to eq(["electric"])
      expect(pokemon.base_stats["hp"]).to eq(35)
      expect(pokemon.sprite_url).to eq("https://example.com/pikachu.png")
      expect(pokemon.shiny_sprite_url).to eq("https://example.com/pikachu-shiny.png")
    end

    it "is idempotent — returns the existing record on a second call without creating a duplicate" do
      adapter.find_or_create_pokemon(FAKE_PIKACHU_ID)
      expect { adapter.find_or_create_pokemon(FAKE_PIKACHU_ID) }.not_to change(Pokemon, :count)
    end

    it "maps multi-slot types ordered by slot number" do
      allow(client).to receive(:pokemon).with(FAKE_CLEFAIRY_ID).and_return(clefairy_data)
      pokemon = adapter.find_or_create_pokemon(FAKE_CLEFAIRY_ID)
      expect(pokemon.types).to eq(["normal", "fairy"])
    end

    it "persists past_types when present" do
      allow(client).to receive(:pokemon).with(FAKE_CLEFAIRY_ID).and_return(clefairy_data)
      pokemon = adapter.find_or_create_pokemon(FAKE_CLEFAIRY_ID)
      expect(pokemon.past_types).to eq([
        {"generation" => "generation-v", "types" => ["normal"]}
      ])
    end

    it "backfills shiny_sprite_url for existing records that have nil" do
      existing = create(:pokemon, pokeapi_id: FAKE_PIKACHU_ID, shiny_sprite_url: nil)
      adapter.find_or_create_pokemon(FAKE_PIKACHU_ID)
      expect(existing.reload.shiny_sprite_url).to eq("https://example.com/pikachu-shiny.png")
    end
  end

  # ---------------------------------------------------------------------------
  # find_or_create_move
  # ---------------------------------------------------------------------------

  describe "#find_or_create_move" do
    before { allow(client).to receive(:move).with("tackle").and_return(tackle_move_data) }

    it "creates a Move record with correct fields" do
      expect { adapter.find_or_create_move("tackle") }.to change(Move, :count).by(1)

      move = Move.last
      expect(move.name).to eq("tackle")
      expect(move.move_type).to eq("normal")
      expect(move.power).to eq(40)
      expect(move.accuracy).to eq(100)
      expect(move.pp).to eq(35)
      expect(move.damage_class).to eq("physical")
    end

    it "is idempotent — does not duplicate on second call" do
      adapter.find_or_create_move("tackle")
      expect { adapter.find_or_create_move("tackle") }.not_to change(Move, :count)
    end
  end

  # ---------------------------------------------------------------------------
  # basic_moves_for_game
  # ---------------------------------------------------------------------------

  describe "#basic_moves_for_game" do
    let(:game) { create(:game, name: "scarlet") }
    # Use the factory's sequence so the pokeapi_id is always unique and
    # won't collide with any other record in the test run.
    let(:pokemon) { create(:pokemon) }

    let(:scarlet_violet_vg) { {"versions" => [{"name" => "scarlet"}, {"name" => "violet"}]} }
    let(:red_blue_vg) { {"versions" => [{"name" => "red"}, {"name" => "blue"}]} }

    let(:pokemon_data_with_moves) do
      {
        "id" => pokemon.pokeapi_id,
        "name" => "test-pokemon",
        "types" => [{"slot" => 1, "type" => {"name" => "fire"}}],
        "past_types" => [],
        "stats" => [],
        "sprites" => {"front_default" => nil, "front_shiny" => nil},
        "moves" => [
          {
            "move" => {"name" => "thunderbolt"},
            "version_group_details" => [
              {
                "version_group" => {"name" => "scarlet-violet"},
                "level_learned_at" => 0,
                "move_learn_method" => {"name" => "machine"}
              },
              {
                "version_group" => {"name" => "red-blue"},
                "level_learned_at" => 0,
                "move_learn_method" => {"name" => "machine"}
              }
            ]
          },
          {
            "move" => {"name" => "scratch"},
            "version_group_details" => [
              {
                "version_group" => {"name" => "red-blue"},
                "level_learned_at" => 1,
                "move_learn_method" => {"name" => "level-up"}
              }
            ]
          }
        ]
      }
    end

    before do
      allow(client).to receive(:pokemon).with(pokemon.pokeapi_id).and_return(pokemon_data_with_moves)
      allow(client).to receive(:version_group).with("scarlet-violet").and_return(scarlet_violet_vg)
      allow(client).to receive(:version_group).with("red-blue").and_return(red_blue_vg)
    end

    it "returns only moves that exist in the game's version group" do
      moves = adapter.basic_moves_for_game(pokemon, game)
      expect(moves.map { |m| m[:name] }).to contain_exactly("thunderbolt")
    end

    it "includes level_learned and learn_method in each result" do
      moves = adapter.basic_moves_for_game(pokemon, game)
      expect(moves.first).to include(
        name: "thunderbolt",
        level_learned: 0,
        learn_method: "machine"
      )
    end

    it "returns an empty array when no moves match the game" do
      game_no_moves = create(:game, name: "legends-arceus")
      allow(client).to receive(:version_group).with("scarlet-violet").and_return(scarlet_violet_vg)
      allow(client).to receive(:version_group).with("red-blue").and_return(red_blue_vg)
      moves = adapter.basic_moves_for_game(pokemon, game_no_moves)
      expect(moves).to be_empty
    end
  end

  # ---------------------------------------------------------------------------
  # load_pokedex_for_game
  # ---------------------------------------------------------------------------

  describe "#load_pokedex_for_game" do
    # Use fake species IDs (100_906, 100_907) in the pokedex response URLs so
    # we control the client stubs precisely without colliding with real IDs.
    let(:paldea_pokedex) do
      {
        "pokemon_entries" => [
          {
            "entry_number" => 1,
            "pokemon_species" => {
              "name" => "sprigatito",
              "url" => "https://pokeapi.co/api/v2/pokemon-species/100906/"
            }
          },
          {
            "entry_number" => 2,
            "pokemon_species" => {
              "name" => "floragato",
              "url" => "https://pokeapi.co/api/v2/pokemon-species/100907/"
            }
          }
        ]
      }
    end

    let(:sprigatito_data) do
      pikachu_data.merge("id" => 100_906, "name" => "sprigatito")
    end

    let(:floragato_data) do
      pikachu_data.merge("id" => 100_907, "name" => "floragato")
    end

    before do
      allow(client).to receive(:pokedex).with("paldea").and_return(paldea_pokedex)
      allow(client).to receive(:pokemon).with(100_906).and_return(sprigatito_data)
      allow(client).to receive(:pokemon).with(100_907).and_return(floragato_data)
    end

    it "uses GAME_TO_POKEDEX to resolve the pokedex name for known games" do
      game = create(:game, name: "scarlet", region: "paldea")
      adapter.load_pokedex_for_game(game)
      expect(client).to have_received(:pokedex).with("paldea")
    end

    it "falls back to game.region when the game name is not in GAME_TO_POKEDEX" do
      game = create(:game, name: "some-unknown-game", region: "paldea")
      adapter.load_pokedex_for_game(game)
      expect(client).to have_received(:pokedex).with("paldea")
    end

    it "returns an empty array when neither mapping nor region resolves" do
      game = create(:game, name: "unknown", region: nil)
      result = adapter.load_pokedex_for_game(game)
      expect(result).to eq([])
    end

    it "creates Pokemon records for each entry and returns them" do
      game = create(:game, name: "scarlet", region: "paldea")
      pokemons = adapter.load_pokedex_for_game(game)
      expect(pokemons.map(&:name)).to contain_exactly("sprigatito", "floragato")
    end

    it "respects the limit option" do
      game = create(:game, name: "scarlet", region: "paldea")
      pokemons = adapter.load_pokedex_for_game(game, limit: 1)
      expect(pokemons.length).to eq(1)
    end

    it "respects the offset option" do
      game = create(:game, name: "scarlet", region: "paldea")
      pokemons = adapter.load_pokedex_for_game(game, offset: 1)
      expect(pokemons.map(&:name)).to eq(["floragato"])
    end

    it "creates GamePokemon associations linking each Pokemon to the game" do
      game = create(:game, name: "scarlet", region: "paldea")
      adapter.load_pokedex_for_game(game)
      expect(game.game_pokemons.count).to eq(2)
    end

    it "skips an entry that raises PokeapiClient::ApiError and continues with the rest" do
      game = create(:game, name: "scarlet", region: "paldea")
      allow(client).to receive(:pokemon).with(100_906).and_raise(PokeapiClient::ApiError, "not found")
      pokemons = adapter.load_pokedex_for_game(game)
      expect(pokemons.map(&:name)).to eq(["floragato"])
    end
  end

  # ---------------------------------------------------------------------------
  # evolution_chain_for
  # ---------------------------------------------------------------------------

  describe "#evolution_chain_for" do
    # Use the factory sequence — no hardcoded pokeapi_id that could collide with
    # real Bulbasaur (1) or Eevee (133) if those are in the test DB.
    let(:pokemon) { create(:pokemon) }

    let(:species_data) do
      {"evolution_chain" => {"url" => "https://pokeapi.co/api/v2/evolution-chain/1/"}}
    end

    before do
      allow(client).to receive(:pokemon_species).with(pokemon.pokeapi_id).and_return(species_data)
    end

    context "with a linear 3-stage chain (bulbasaur)" do
      before { allow(client).to receive(:evolution_chain).with("1").and_return(bulbasaur_chain) }

      it "returns a flat array with all three stages in order" do
        result = adapter.evolution_chain_for(pokemon)
        expect(result.map { |e| e[:name] }).to eq(["bulbasaur", "ivysaur", "venusaur"])
      end

      it "includes evolution_details with trigger and level for non-base entries" do
        result = adapter.evolution_chain_for(pokemon)
        expect(result[1][:evolution_details].first).to include(trigger: "level-up", min_level: 16)
      end

      it "base species has an empty evolution_details array" do
        result = adapter.evolution_chain_for(pokemon)
        expect(result[0][:evolution_details]).to be_empty
      end
    end

    context "with a branching chain (eevee)" do
      before { allow(client).to receive(:evolution_chain).with("1").and_return(eevee_chain) }

      it "includes all branches as separate entries in the flat result" do
        result = adapter.evolution_chain_for(pokemon)
        expect(result.map { |e| e[:name] }).to contain_exactly("eevee", "vaporeon", "flareon")
      end

      it "attaches item-based evolution details to branch entries" do
        result = adapter.evolution_chain_for(pokemon)
        vaporeon = result.find { |e| e[:name] == "vaporeon" }
        expect(vaporeon[:evolution_details].first).to include(trigger: "use-item", item: "water-stone")
      end
    end
  end

  # ---------------------------------------------------------------------------
  # roman_numeral_to_int (private — tested via send; non-trivial enough to
  # warrant direct coverage since it drives generation number extraction)
  # ---------------------------------------------------------------------------

  describe "#roman_numeral_to_int (private)" do
    subject { adapter.send(:roman_numeral_to_int, input) }

    context "with nil" do
      let(:input) { nil }
      it { is_expected.to eq(0) }
    end

    {
      "i" => 1,
      "ii" => 2,
      "iii" => 3,
      "iv" => 4,
      "v" => 5,
      "vi" => 6,
      "vii" => 7,
      "viii" => 8,
      "ix" => 9,
      "x" => 10
    }.each do |numeral, expected|
      context "with \"#{numeral}\"" do
        let(:input) { numeral }
        it { is_expected.to eq(expected) }
      end
    end

    context "with uppercase input" do
      let(:input) { "VIII" }
      it "is case-insensitive" do
        is_expected.to eq(8)
      end
    end
  end
end
