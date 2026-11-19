class AddEncountersAvailableToGames < ActiveRecord::Migration[8.1]
  def change
    # Whether PokeAPI has any encounters for the game's versions; null until WarmEncountersJob checks
    add_column :games, :encounters_available, :boolean
  end
end
