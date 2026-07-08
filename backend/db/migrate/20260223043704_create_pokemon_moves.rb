class CreatePokemonMoves < ActiveRecord::Migration[8.1]
  def change
    create_table :pokemon_moves do |t|
      t.references :pokemon, null: false, foreign_key: true
      t.references :move, null: false, foreign_key: true
      t.references :game, null: false, foreign_key: true
      t.integer :level_learned
      t.string :learn_method

      t.timestamps
    end
  end
end
