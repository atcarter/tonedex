class AddPastTypesToPokemons < ActiveRecord::Migration[8.1]
  def change
    add_column :pokemons, :past_types, :jsonb, default: []
  end
end
