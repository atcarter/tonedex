class CreatePokemons < ActiveRecord::Migration[8.1]
  def change
    create_table :pokemons do |t|
      t.string :name
      t.integer :pokeapi_id
      t.jsonb :types
      t.jsonb :base_stats
      t.string :sprite_url

      t.timestamps
    end
    add_index :pokemons, :pokeapi_id
  end
end
