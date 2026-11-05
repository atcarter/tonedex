class AddNationalDexColumns < ActiveRecord::Migration[8.1]
  def change
    # Existing rows are the regional dex; national-only rows are false with a nil pokedex_number
    add_column :game_pokemons, :regional, :boolean, null: false, default: true
    add_column :games, :national_seeded_at, :datetime
    add_column :pokemons, :mythical, :boolean, null: false, default: false
  end
end
