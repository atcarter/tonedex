# Fills every game's national view in one pass over species (ADR-009).
# One lock for the whole pass: it seeds every game whose national_seeded_at is null.
class SeedNationalDexJob < ApplicationJob
  include EnqueueOnce

  queue_as :default

  # Outlives a first pass that has to fetch the species payloads
  LOCK_TTL = 1.hour

  def self.lock_key(*, **)
    "seed_national_dex:lock"
  end

  # force: true reseeds every game, e.g. after deleting stale /pokemon/ cache rows
  def perform(force: false)
    games = force ? Game.all.to_a : Game.where(national_seeded_at: nil).to_a
    return self.class.release_lock if games.empty?

    importer = PokemonImporter.new
    Rails.logger.info("[SeedNationalDexJob] Seeding #{games.map(&:name).join(", ")}...")
    seeded = PokeapiAdapter.new(importer: importer).load_national_dexes(games)
    seeded.each { |game| importer.mark_national_seeded(game, Time.current) }
    Rails.logger.info("[SeedNationalDexJob] Done — #{seeded.size} games")
    self.class.release_lock
  rescue => e
    Rails.logger.error("[SeedNationalDexJob] Failed: #{e.message}")
    raise
  end
end
