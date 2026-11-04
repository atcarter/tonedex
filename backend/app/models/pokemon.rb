class Pokemon < ApplicationRecord
  has_many :game_pokemons, dependent: :destroy
  has_many :games, through: :game_pokemons

  has_many :favorites, dependent: :destroy
  has_many :users, through: :favorites

  # Returns the correct types for a given game generation, accounting for
  # type changes over time (e.g. Clefairy was Normal before Gen VI made it Fairy).
  # Each past_types entry has { "generation" => "generation-v", "types" => [...] }
  # meaning those types applied up to and including that generation.
  def types_for_generation(generation)
    return types if past_types.blank?

    applicable = past_types
      .select { |pt| Generation.number_for(pt["generation"], default: 999) >= generation }
      .min_by { |pt| Generation.number_for(pt["generation"], default: 999) }

    applicable ? applicable["types"] : types
  end
end
