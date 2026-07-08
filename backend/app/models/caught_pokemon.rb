class CaughtPokemon < ApplicationRecord
  belongs_to :user
  belongs_to :pokemon
  belongs_to :game

  validates :user_id, uniqueness: {scope: [:pokemon_id, :game_id]}
end
