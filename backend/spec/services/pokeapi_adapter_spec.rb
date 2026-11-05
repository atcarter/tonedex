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

    it "enqueues a sprite mirror only for newly created pokemon" do
      expect {
        adapter.find_or_create_pokemon(FAKE_PIKACHU_ID)
      }.to have_enqueued_job(MirrorSpriteJob)

      expect {
        adapter.find_or_create_pokemon(FAKE_PIKACHU_ID)
      }.not_to have_enqueued_job(MirrorSpriteJob)
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
  # find_or_create_game
  # ---------------------------------------------------------------------------

  describe "#find_or_create_game" do
    def stub_version(name, pokeapi_id:, regions:)
      allow(client).to receive(:version).with(name).and_return(
        "id" => pokeapi_id, "name" => name, "version_group" => {"name" => "#{name}-vg"}
      )
      allow(client).to receive(:version_group).with("#{name}-vg").and_return(
        "generation" => {"name" => "generation-ix"},
        "regions" => regions.map { |r| {"name" => r} }
      )
    end

    it "maps Legends: Z-A to the Lumiose City dex and takes its region from that dex" do
      stub_version("legends-za", pokeapi_id: 100_047, regions: [])
      allow(client).to receive(:pokedex).with("lumiose-city").and_return("region" => {"name" => "kalos"})

      game = adapter.find_or_create_game("legends-za")

      expect(game).to have_attributes(pokedex_name: "lumiose-city", region: "kalos", generation: 9)
    end

    it "uses the version group's region without fetching the dex" do
      stub_version("scarlet", pokeapi_id: 100_040, regions: ["paldea"])
      expect(client).not_to receive(:pokedex)

      game = adapter.find_or_create_game("scarlet")

      expect(game).to have_attributes(pokedex_name: "paldea", region: "paldea")
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

    it "prefers the games.pokedex_name column over any fallback" do
      game = create(:game, name: "some-unknown-game", region: "hoenn", pokedex_name: "paldea")
      adapter.load_pokedex_for_game(game)
      expect(client).to have_received(:pokedex).with("paldea")
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

    it "warms each Pokémon's ability payloads" do
      game = create(:game, name: "scarlet", region: "paldea")
      allow(client).to receive(:pokemon).with(100_906)
        .and_return(sprigatito_data.merge("abilities" => [{"slot" => 1, "ability" => {"name" => "overgrow"}}]))
      allow(client).to receive(:ability).with("overgrow").and_return({})

      adapter.load_pokedex_for_game(game)

      expect(client).to have_received(:ability).with("overgrow")
    end

    it "skips an entry that raises PokeapiClient::ApiError and continues with the rest" do
      game = create(:game, name: "scarlet", region: "paldea")
      allow(client).to receive(:pokemon).with(100_906).and_raise(PokeapiClient::ApiError, "not found")
      pokemons = adapter.load_pokedex_for_game(game)
      expect(pokemons.map(&:name)).to eq(["floragato"])
    end
  end

  # ---------------------------------------------------------------------------
  # load_national_dexes
  # ---------------------------------------------------------------------------

  describe "#load_national_dexes" do
    # Fake species: 100_801 is in the main dex, 100_802 only in a DLC dex,
    # 100_803 only in the learnsets, 100_804 in neither.
    def species_entry(id)
      {"entry_number" => id, "pokemon_species" => {"url" => "https://pokeapi.co/api/v2/pokemon-species/#{id}/"}}
    end

    def payload(id, version_groups)
      pikachu_data.merge(
        "id" => id,
        "name" => "national-spec-#{id}",
        "moves" => [{"version_group_details" => version_groups.map { |vg| {"version_group" => {"name" => vg}} }}]
      )
    end

    let(:game) { create(:game, name: "national-spec-sword") }
    let(:other_game) { create(:game, name: "national-spec-red") }

    before do
      allow(client).to receive(:version).with(game.name).and_return({"version_group" => {"name" => "spec-swsh"}})
      allow(client).to receive(:version).with(other_game.name).and_return({"version_group" => {"name" => "spec-rb"}})
      allow(client).to receive(:version_group).with("spec-swsh").and_return(
        {"pokedexes" => [{"name" => "spec-galar"}, {"name" => "spec-crown-tundra"}]}
      )
      allow(client).to receive(:version_group).with("spec-rb").and_return({"pokedexes" => [{"name" => "spec-kanto"}]})
      allow(client).to receive(:pokedex).with("spec-galar").and_return({"pokemon_entries" => [species_entry(100_801)]})
      allow(client).to receive(:pokedex).with("spec-crown-tundra").and_return({"pokemon_entries" => [species_entry(100_802)]})
      allow(client).to receive(:pokedex).with("spec-kanto").and_return({"pokemon_entries" => []})
      allow(client).to receive(:pokedex).with("national").and_return(
        {"pokemon_entries" => [100_801, 100_802, 100_803, 100_804].map { |id| species_entry(id) }}
      )
      allow(client).to receive(:pokemon).with(100_801).and_return(payload(100_801, ["spec-swsh"]))
      allow(client).to receive(:pokemon).with(100_802).and_return(payload(100_802, []))
      allow(client).to receive(:pokemon).with(100_803).and_return(payload(100_803, ["spec-swsh", "spec-rb"]))
      allow(client).to receive(:pokemon).with(100_804).and_return(payload(100_804, ["spec-other"]))
      allow(client).to receive(:pokemon_species).and_return({"is_mythical" => false})
      allow(client).to receive(:pokemon_species).with(100_803).and_return({"is_mythical" => true})
    end

    def national_ids(for_game)
      for_game.pokemons.pluck(:pokeapi_id)
    end

    it "unions the learnset species with every dex in the version group" do
      adapter.load_national_dexes([game, other_game])

      expect(national_ids(game)).to contain_exactly(100_801, 100_802, 100_803)
      expect(national_ids(other_game)).to contain_exactly(100_803)
      expect(Pokemon.where(pokeapi_id: 100_804)).to be_empty
    end

    it "stores national-only rows as non-regional with no number" do
      adapter.load_national_dexes([game])

      expect(game.game_pokemons.pluck(:regional, :pokedex_number).uniq).to eq([[false, nil]])
    end

    it "keeps an existing regional row and its number" do
      regional = create(:pokemon, pokeapi_id: 100_801)
      GamePokemon.create!(game: game, pokemon: regional, pokedex_number: 7)

      adapter.load_national_dexes([game])

      expect(game.game_pokemons.find_by(pokemon: regional)).to have_attributes(regional: true, pokedex_number: 7)
    end

    it "labels mythical species" do
      adapter.load_national_dexes([game])

      expect(Pokemon.find_by!(pokeapi_id: 100_803).mythical).to be(true)
      expect(Pokemon.find_by!(pokeapi_id: 100_801).mythical).to be(false)
    end

    it "falls back to the version group's dexes when no learnset names the game" do
      allow(client).to receive(:pokemon).with(100_801).and_return(payload(100_801, []))
      allow(client).to receive(:pokemon).with(100_803).and_return(payload(100_803, ["spec-rb"]))

      adapter.load_national_dexes([game])

      expect(national_ids(game)).to contain_exactly(100_801, 100_802)
    end

    it "warms the ability payloads of species it links" do
      allow(client).to receive(:pokemon).with(100_801)
        .and_return(payload(100_801, ["spec-swsh"]).merge("abilities" => [{"slot" => 1, "ability" => {"name" => "overgrow"}}]))
      allow(client).to receive(:ability).with("overgrow").and_return({})

      adapter.load_national_dexes([game])

      expect(client).to have_received(:ability).with("overgrow")
    end

    it "is idempotent" do
      adapter.load_national_dexes([game])
      expect { adapter.load_national_dexes([game]) }.not_to change(GamePokemon, :count)
    end

    it "covers a game whose version group is a 404, keeping only its existing rows" do
      allow(client).to receive(:version).with(other_game.name).and_raise(PokeapiClient::NotFoundError, "404")

      expect(adapter.load_national_dexes([game, other_game])).to eq([game, other_game])
      expect(other_game.game_pokemons).to be_empty
    end

    it "raises on a transient version lookup failure so the job retries" do
      allow(client).to receive(:version).with(other_game.name).and_raise(PokeapiClient::ApiError, "503")

      expect { adapter.load_national_dexes([game, other_game]) }.to raise_error(PokeapiClient::ApiError)
    end

    it "raises on a transient species failure instead of skipping it" do
      allow(client).to receive(:pokemon).with(100_802).and_raise(PokeapiClient::ApiError, "timeout")

      expect { adapter.load_national_dexes([game]) }.to raise_error(PokeapiClient::ApiError)
    end

    it "raises on a transient species-payload failure instead of leaving mythical unset" do
      allow(client).to receive(:pokemon_species).with(100_803).and_raise(PokeapiClient::ApiError, "503")

      expect { adapter.load_national_dexes([game]) }.to raise_error(PokeapiClient::ApiError)
    end
  end

  # ---------------------------------------------------------------------------
  # evolution_chain_for
  # ---------------------------------------------------------------------------

  describe "#species_info_for" do
    let(:pokemon) { create(:pokemon) }

    before do
      allow(client).to receive(:pokemon).with(pokemon.pokeapi_id).and_return(
        pikachu_data.merge(
          "height" => 4,
          "weight" => 60,
          "abilities" => [
            {"slot" => 2, "is_hidden" => true, "ability" => {"name" => "lightning-rod"}},
            {"slot" => 1, "is_hidden" => false, "ability" => {"name" => "static"}}
          ]
        )
      )
      allow(client).to receive(:pokemon_species).with(pokemon.pokeapi_id).and_return(
        {
          "genera" => [
            {"genus" => "ねずみポケモン", "language" => {"name" => "ja"}},
            {"genus" => "Mouse Pokémon", "language" => {"name" => "en"}}
          ],
          "flavor_text_entries" => [
            {"flavor_text" => "When several of\nthese POKéMON\fgather", "language" => {"name" => "en"}}
          ]
        }
      )
      allow(client).to receive(:ability).and_return(nil)
    end

    it "extracts English genus and whitespace-normalised flavor text" do
      info = adapter.species_info_for(pokemon)
      expect(info[:genus]).to eq("Mouse Pokémon")
      expect(info[:flavor_text]).to eq("When several of these POKéMON gather")
    end

    it "returns abilities sorted by slot with the hidden flag" do
      info = adapter.species_info_for(pokemon)
      expect(info[:abilities].map { |a| a.slice(:name, :hidden) }).to eq([
        {name: "static", hidden: false},
        {name: "lightning-rod", hidden: true}
      ])
    end

    it "leaves the text null on an ability cache miss, reading the cache only" do
      info = adapter.species_info_for(pokemon)

      expect(info[:abilities].first).to include(description: nil, short_effect: nil)
      expect(client).to have_received(:ability).with("static", cache_only: true)
    end

    it "passes height and weight through unconverted" do
      info = adapter.species_info_for(pokemon)
      expect(info).to include(height: 4, weight: 60)
    end
  end

  describe "#species_info_for abilities in a game" do
    let(:pokemon) { create(:pokemon) }

    def ability_entry(name, slot, hidden: false)
      {"slot" => slot, "is_hidden" => hidden, "ability" => name && {"name" => name}}
    end

    def flavor(version_group, text, language: "en")
      {"flavor_text" => text, "language" => {"name" => language}, "version_group" => {"name" => version_group}}
    end

    def ability_payload(flavors, short_effect: "Evades Ground moves.")
      {
        "effect_entries" => [{"short_effect" => short_effect, "language" => {"name" => "en"}}],
        "flavor_text_entries" => flavors
      }
    end

    def game_in(version_group, generation)
      game = create(:game, name: "ability-spec-#{version_group}", generation: generation)
      allow(client).to receive(:version).with(game.name, cache_only: true)
        .and_return({"version_group" => {"name" => version_group}})
      game
    end

    def abilities(game)
      adapter.species_info_for(pokemon, game)[:abilities]
    end

    let(:pokemon_data) do
      {
        "abilities" => [ability_entry("cursed-body", 1), ability_entry("lightning-rod", 3, hidden: true)],
        "past_abilities" => [
          {"generation" => {"name" => "generation-vi"}, "abilities" => [ability_entry("levitate", 1)]},
          {"generation" => {"name" => "generation-iv"}, "abilities" => [ability_entry(nil, 3, hidden: true)]}
        ]
      }
    end

    before do
      allow(client).to receive(:pokemon).with(pokemon.pokeapi_id).and_return(pokemon_data)
      allow(client).to receive(:pokemon_species).with(pokemon.pokeapi_id).and_return({})
      allow(client).to receive(:ability).and_return(nil)
    end

    describe "past_abilities resolution" do
      it "shows no abilities before Gen 3" do
        expect(abilities(game_in("gold-silver", 2))).to eq([])
      end

      it "uses the past ability up to its generation and drops slots that were empty" do
        expect(abilities(game_in("diamond-pearl", 4)).map { |a| a[:name] }).to eq(["levitate"])
      end

      it "keeps the past ability through its last generation" do
        expect(abilities(game_in("x-y", 6)).map { |a| a[:name] }).to eq(["levitate", "lightning-rod"])
      end

      it "uses the current abilities in later games and with no game" do
        expect(abilities(game_in("sun-moon", 7)).map { |a| a[:name] }).to eq(["cursed-body", "lightning-rod"])
        expect(adapter.species_info_for(pokemon)[:abilities].map { |a| a[:name] }).to eq(["cursed-body", "lightning-rod"])
      end
    end

    describe "description" do
      let(:pokemon_data) { {"abilities" => [ability_entry("levitate", 1)]} }

      def description(version_group, generation, flavors, **payload)
        allow(client).to receive(:ability).with("levitate", cache_only: true)
          .and_return(ability_payload(flavors, **payload))
        abilities(game_in(version_group, generation)).first
      end

      it "uses the game's own flavor text and the cleaned short effect" do
        result = description("platinum", 4, [flavor("ruby-sapphire", "Gives full immunity to all\nGROUND-type moves."), flavor("platinum", "Gives full immunity to\nall Ground-type moves.")],
          short_effect: "  Evades  Ground moves. ")

        expect(result).to include(description: "Gives full immunity to all Ground-type moves.", short_effect: "Evades Ground moves.")
      end

      it "drops soft hyphens and zero-width spaces and joins hyphenated wraps, keeping a space before and/or" do
        flavors = [
          flavor("diamond-pearl", "Powers down super\u00AD\neffective moves."),
          flavor("platinum", "Ups resistance to Fire-\u200B\nand Ice-type and critical-\nhit moves.")
        ]

        expect(description("diamond-pearl", 4, flavors)[:description]).to eq("Powers down supereffective moves.")
        expect(description("platinum", 4, flavors)[:description]).to eq("Ups resistance to Fire- and Ice-type and critical-hit moves.")
      end

      it "falls back along the chain for a game without its own text" do
        flavors = [flavor("sword-shield", "SwSh text."), flavor("scarlet-violet", "SV text.", language: "fr"), flavor("the-teal-mask", "Teal Mask text.")]

        expect(description("brilliant-diamond-shining-pearl", 8, flavors)[:description]).to eq("SwSh text.")
        expect(description("scarlet-violet", 9, flavors)[:description]).to eq("Teal Mask text.")
        expect(description("legends-za", 9, [flavor("champions", "Champions text.")])[:description]).to eq("Champions text.")
      end

      it "uses the short effect when the game's chain has no English text" do
        expect(description("ultra-sun-ultra-moon", 7, [flavor("ruby-sapphire", "Old."), flavor("x-y", "Newer.")])[:description]).to eq("Evades Ground moves.")
        expect(description("x-y", 6, [])[:description]).to eq("Evades Ground moves.")
      end

      it "leaves the text null for an ability PokeAPI 404s on" do
        allow(client).to receive(:ability).and_raise(PokeapiClient::NotFoundError)

        expect(abilities(game_in("x-y", 6)).first).to include(name: "levitate", description: nil)
      end

      it "uses the newest game's text outside a game, ahead of later DLC entries" do
        allow(client).to receive(:ability).with("levitate", cache_only: true)
          .and_return(ability_payload([flavor("scarlet-violet", "SV text."), flavor("the-teal-mask", "Mislabelled DLC text.")]))

        expect(adapter.species_info_for(pokemon)[:abilities].first[:description]).to eq("SV text.")
      end

      it "still describes abilities when the game's version is not cached" do
        game = create(:game, name: "ability-spec-uncached", generation: 9)
        allow(client).to receive(:version).with(game.name, cache_only: true).and_return(nil)
        allow(client).to receive(:ability).with("levitate", cache_only: true)
          .and_return(ability_payload([flavor("x-y", "X/Y text."), flavor("scarlet-violet", "SV text.")]))

        expect(abilities(game).first[:description]).to eq("SV text.")
      end
    end
  end

  describe "#warm_abilities" do
    let(:pokemon_data) do
      {
        "abilities" => [{"slot" => 1, "ability" => {"name" => "cursed-body"}}],
        "past_abilities" => [
          {"abilities" => [{"slot" => 1, "ability" => {"name" => "levitate"}}, {"slot" => 3, "ability" => nil}]}
        ]
      }
    end

    it "fetches current and past abilities and skips ones that fail" do
      allow(client).to receive(:ability).with("cursed-body").and_raise(PokeapiClient::ApiError, "503")
      allow(client).to receive(:ability).with("levitate").and_return({})

      adapter.warm_abilities(pokemon_data)

      expect(client).to have_received(:ability).with("levitate")
    end
  end

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
end
