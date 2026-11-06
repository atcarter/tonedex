# PokeAPI names generations "generation-i" through "generation-ix"; the app
# stores and compares the number. One lookup serves both the adapter (a game's
# generation at seed time) and Pokemon#types_for_generation (past-type cutoffs).
module Generation
  NUMBER_BY_NAME = {
    "generation-i" => 1, "generation-ii" => 2, "generation-iii" => 3,
    "generation-iv" => 4, "generation-v" => 5, "generation-vi" => 6,
    "generation-vii" => 7, "generation-viii" => 8, "generation-ix" => 9
  }.freeze

  # The last species each generation introduced. PokeAPI species ids are
  # national-dex numbers, so a species' generation needs no network call.
  LAST_SPECIES_ID = {
    1 => 151, 2 => 251, 3 => 386, 4 => 493, 5 => 649,
    6 => 721, 7 => 809, 8 => 905, 9 => 1025
  }.freeze

  # Unknown or missing names return +default+.
  def self.number_for(name, default: 0)
    NUMBER_BY_NAME.fetch(name, default)
  end

  # The generation that introduced a species. An id past the table belongs to
  # a generation newer than any listed; a missing id returns nil.
  def self.introducing(species_id)
    return nil unless species_id

    LAST_SPECIES_ID.find { |_, last| species_id <= last }&.first || LAST_SPECIES_ID.size + 1
  end
end
