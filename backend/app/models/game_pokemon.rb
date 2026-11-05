class GamePokemon < ApplicationRecord
  belongs_to :game
  belongs_to :pokemon

  # The game's main in-game dex; national-only rows have no pokedex_number
  scope :regional, -> { where(regional: true) }
end
