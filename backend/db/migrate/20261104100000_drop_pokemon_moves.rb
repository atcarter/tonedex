class DropPokemonMoves < ActiveRecord::Migration[8.1]
  # Nothing ever wrote this table: the detail page reads move lists straight
  # from the cached PokeAPI payload (PokeapiAdapter#basic_moves_for_game).
  def change
    drop_table :pokemon_moves do |t|
      t.references :pokemon, null: false, foreign_key: true
      t.references :move, null: false, foreign_key: true
      t.references :game, null: false, foreign_key: true
      t.integer :level_learned
      t.string :learn_method
      t.timestamps
      t.index [:pokemon_id, :game_id]
    end
  end
end
