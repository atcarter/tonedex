class CreateGamePokemons < ActiveRecord::Migration[8.1]
  def change
    create_table :game_pokemons do |t|
      t.references :game, null: false, foreign_key: true
      t.references :pokemon, null: false, foreign_key: true
      t.integer :pokedex_number

      t.timestamps
    end
  end
end
