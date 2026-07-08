class AddUniqueIndexToGamePokemons < ActiveRecord::Migration[8.1]
  def up
    # Remove duplicate rows, keeping the lowest id for each (game_id, pokemon_id) pair
    execute <<~SQL
      DELETE FROM game_pokemons
      WHERE id NOT IN (
        SELECT MIN(id)
        FROM game_pokemons
        GROUP BY game_id, pokemon_id
      )
    SQL

    add_index :game_pokemons, [:game_id, :pokemon_id], unique: true,
      name: "index_game_pokemons_on_game_and_pokemon_unique"
  end

  def down
    remove_index :game_pokemons, name: "index_game_pokemons_on_game_and_pokemon_unique"
  end
end
