class Pokemon < ApplicationRecord
  has_many :game_pokemons, dependent: :destroy
  has_many :games, through: :game_pokemons

  has_many :pokemon_moves, dependent: :destroy
  has_many :moves, through: :pokemon_moves

  has_many :favorites, dependent: :destroy
  has_many :users, through: :favorites

  GEN_NAME_TO_NUMBER = {
    "generation-i" => 1, "generation-ii" => 2, "generation-iii" => 3,
    "generation-iv" => 4, "generation-v" => 5, "generation-vi" => 6,
    "generation-vii" => 7, "generation-viii" => 8, "generation-ix" => 9
  }.freeze

  # Returns the correct types for a given game generation, accounting for
  # type changes over time (e.g. Clefairy was Normal before Gen VI made it Fairy).
  # Each past_types entry has { "generation" => "generation-v", "types" => [...] }
  # meaning those types applied up to and including that generation.
  def types_for_generation(generation)
    return types if past_types.blank?

    applicable = past_types
      .select { |pt| GEN_NAME_TO_NUMBER.fetch(pt["generation"], 999) >= generation }
      .min_by { |pt| GEN_NAME_TO_NUMBER.fetch(pt["generation"], 999) }

    applicable ? applicable["types"] : types
  end
end
