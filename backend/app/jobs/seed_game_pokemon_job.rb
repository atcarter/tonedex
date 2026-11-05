class SeedGamePokemonJob < ApplicationJob
  include EnqueueOnce

  queue_as :default

  # A full-dex seed can take minutes; the lock TTL just has to outlive the
  # window between enqueue and the first regional row being inserted
  # (after which GamesController stops trying to enqueue at all).
  LOCK_TTL = 15.minutes

  def self.lock_key(game_id)
    "seed_game_pokemon:lock:#{game_id}"
  end

  def perform(game_id)
    game = Game.find(game_id)
    importer = PokemonImporter.new
    adapter = PokeapiAdapter.new(importer: importer)

    # A game with no rows at all has lost its national rows too
    importer.mark_national_seeded(game, nil) unless game.game_pokemons.exists?

    Rails.logger.info("[SeedGamePokemonJob] Seeding #{game.name}...")
    adapter.load_pokedex_for_game(game) # limit: nil loads the full dex
    Rails.logger.info("[SeedGamePokemonJob] Done — #{game.name}: #{game.game_pokemons.regional.count} Pokémon")
    self.class.release_lock(game_id)
  rescue => e
    Rails.logger.error("[SeedGamePokemonJob] Failed for game #{game_id}: #{e.message}")
    raise
  end
end
