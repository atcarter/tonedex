class Game < ApplicationRecord
  has_many :game_pokemons, dependent: :destroy
  has_many :pokemons, through: :game_pokemons

  has_many :caught_pokemons, dependent: :destroy
end
