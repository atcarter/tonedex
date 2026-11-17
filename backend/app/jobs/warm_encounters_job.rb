# Caches a Pokémon's /encounters payload, then settles whether PokeAPI has any
# encounters for the game by warming each of its Pokémon (ADR-010).
class WarmEncountersJob < ApplicationJob
  include EnqueueOnce

  queue_as :default

  # Outlives a first check that fetches every Pokémon the game has
  LOCK_TTL = 1.hour

  def self.lock_key(game_id, *)
    "warm_encounters:lock:#{game_id}"
  end

  def perform(game_id, pokemon_id = nil)
    game = Game.find(game_id)
    pokemon = pokemon_id && Pokemon.find_by(id: pokemon_id)
    # A dex still seeding can't prove the game has no encounters
    seeded = game.game_pokemons.regional.exists? && !SeedGamePokemonJob.locked?(game.id)
    PokeapiAdapter.new.warm_encounters(game, pokemon, seeded: seeded)
    self.class.release_lock(game_id)
  rescue => e
    Rails.logger.error("[WarmEncountersJob] Failed for game #{game_id}: #{e.message}")
    raise
  end
end
