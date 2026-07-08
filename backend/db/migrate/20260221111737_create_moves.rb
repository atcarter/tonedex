class CreateMoves < ActiveRecord::Migration[8.1]
  def change
    create_table :moves do |t|
      t.string :name
      t.integer :pokeapi_id
      t.string :move_type
      t.integer :power
      t.integer :accuracy
      t.integer :pp
      t.string :damage_class

      t.timestamps
    end
    add_index :moves, :pokeapi_id
  end
end
