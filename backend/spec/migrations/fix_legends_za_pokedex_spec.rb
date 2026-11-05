require "rails_helper"
require Rails.root.join("db/migrate/20261105100000_fix_legends_za_pokedex")

RSpec.describe FixLegendsZaPokedex do
  let!(:za) { create(:game, name: "legends-za", pokeapi_id: 100_047, region: nil, pokedex_name: "paldea") }
  let!(:scarlet) { create(:game, name: "scarlet", pokeapi_id: 100_040, region: "paldea", pokedex_name: "paldea") }
  let(:pokemon) { create(:pokemon) }

  before do
    GamePokemon.create!(game: za, pokemon: pokemon, pokedex_number: 1)
    GamePokemon.create!(game: scarlet, pokemon: pokemon, pokedex_number: 1)
  end

  def migrate_up
    ActiveRecord::Migration.suppress_messages { described_class.new.migrate(:up) }
  end

  it "points Legends: Z-A at the Lumiose City dex and clears its stale rows" do
    migrate_up

    expect(za.reload).to have_attributes(pokedex_name: "lumiose-city", region: "kalos")
    expect(za.game_pokemons).to be_empty
  end

  it "leaves other games alone" do
    expect { migrate_up }.not_to change { scarlet.reload.attributes }
    expect(scarlet.game_pokemons.count).to eq(1)
  end

  it "is harmless to run twice, keeping a reseeded dex" do
    migrate_up
    GamePokemon.create!(game: za, pokemon: pokemon, pokedex_number: 1)

    expect { migrate_up }.not_to change { za.reload.attributes }
    expect(za.game_pokemons.count).to eq(1)
  end
end
