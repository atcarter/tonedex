class SeedGamePokemonJob < ApplicationJob
  queue_as :default

  # A full-dex seed can take minutes; the lock TTL just has to outlive the
  # window between enqueue and the first game_pokemons row being inserted
  # (after which GamesController stops trying to enqueue at all).
  LOCK_TTL = 15.minutes

  # The jobs are idempotent, so a lost lock only wastes work.
  def self.enqueue_once(game_id)
    acquired = Sidekiq.redis do |redis|
      redis.set(lock_key(game_id), "1", nx: true, ex: LOCK_TTL.to_i)
    end
    perform_later(game_id) if acquired
  end

  def self.lock_key(game_id)
    "seed_game_pokemon:lock:#{game_id}"
  end

  def perform(game_id)
    game = Game.find(game_id)
    adapter = PokeapiAdapter.new

    Rails.logger.info("[SeedGamePokemonJob] Seeding #{game.name}...")
    adapter.load_pokedex_for_game(game) # limit: nil loads the full dex
    Rails.logger.info("[SeedGamePokemonJob] Done — #{game.name}: #{game.pokemons.count} Pokémon")
    Sidekiq.redis { |redis| redis.del(self.class.lock_key(game_id)) }
  rescue => e
    Rails.logger.error("[SeedGamePokemonJob] Failed for game #{game_id}: #{e.message}")
    raise
  end
end
