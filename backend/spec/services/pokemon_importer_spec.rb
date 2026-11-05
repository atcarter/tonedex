require "rails_helper"

RSpec.describe PokemonImporter do
  let(:importer) { described_class.new }
  let(:game) { create(:game) }
  let(:pokemon) { create(:pokemon) }

  describe "#link_pokemon_to_game" do
    it "creates a regional row with its number" do
      importer.link_pokemon_to_game(pokemon, game, 12)

      expect(GamePokemon.find_by!(game: game, pokemon: pokemon)).to have_attributes(regional: true, pokedex_number: 12)
    end

    it "promotes a row the national pass created first" do
      importer.link_national_pokemon(pokemon, [game])
      importer.link_pokemon_to_game(pokemon, game, 12)

      expect(GamePokemon.where(game: game, pokemon: pokemon).pluck(:regional, :pokedex_number)).to eq([[true, 12]])
    end
  end

  describe "#link_national_pokemon" do
    it "adds a national-only row for each game" do
      other_game = create(:game)

      importer.link_national_pokemon(pokemon, [game, other_game])

      expect(GamePokemon.where(pokemon: pokemon).pluck(:game_id, :regional, :pokedex_number))
        .to contain_exactly([game.id, false, nil], [other_game.id, false, nil])
    end

    it "never overwrites a regional row" do
      importer.link_pokemon_to_game(pokemon, game, 12)
      importer.link_national_pokemon(pokemon, [game])

      expect(GamePokemon.where(game: game, pokemon: pokemon).pluck(:regional, :pokedex_number)).to eq([[true, 12]])
    end
  end
end
