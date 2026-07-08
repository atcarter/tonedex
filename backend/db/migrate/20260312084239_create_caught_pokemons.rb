class CreateCaughtPokemons < ActiveRecord::Migration[8.1]
  def change
    create_table :caught_pokemons do |t|
      t.references :user, null: false, foreign_key: true
      t.references :pokemon, null: false, foreign_key: true
      t.references :game, null: false, foreign_key: true
      t.timestamps
    end
    add_index :caught_pokemons, [:user_id, :pokemon_id, :game_id], unique: true,
      name: "index_caught_pokemons_on_user_pokemon_game"
  end
end
