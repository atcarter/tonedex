class CreateGames < ActiveRecord::Migration[8.1]
  def change
    create_table :games do |t|
      t.string :name
      t.integer :pokeapi_id
      t.integer :generation
      t.string :region

      t.timestamps
    end
    add_index :games, :pokeapi_id
  end
end
