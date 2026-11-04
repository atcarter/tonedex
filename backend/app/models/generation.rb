# PokeAPI names generations "generation-i" through "generation-ix"; the app
# stores and compares the number. One lookup serves both the adapter (a game's
# generation at seed time) and Pokemon#types_for_generation (past-type cutoffs).
module Generation
  NUMBER_BY_NAME = {
    "generation-i" => 1, "generation-ii" => 2, "generation-iii" => 3,
    "generation-iv" => 4, "generation-v" => 5, "generation-vi" => 6,
    "generation-vii" => 7, "generation-viii" => 8, "generation-ix" => 9
  }.freeze

  # Unknown or missing names return +default+.
  def self.number_for(name, default: 0)
    NUMBER_BY_NAME.fetch(name, default)
  end
end
