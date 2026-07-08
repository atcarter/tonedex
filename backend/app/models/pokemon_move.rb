class PokemonMove < ApplicationRecord
  belongs_to :pokemon
  belongs_to :move
  belongs_to :game
end
