class AddIndexToPokemonMoves < ActiveRecord::Migration[8.1]
  def change
    add_index :pokemon_moves, [:pokemon_id, :game_id], name: "index_pokemon_moves_on_pokemon_id_and_game_id"
  end
end
