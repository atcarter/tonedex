class SeedGamePokemonJob < ApplicationJob
  queue_as :default

  def perform(game_id)
    game = Game.find(game_id)
    adapter = PokeapiAdapter.new

    Rails.logger.info("[SeedGamePokemonJob] Seeding #{game.name}...")
    adapter.load_pokedex_for_game(game) # limit: nil loads the full dex
    Rails.logger.info("[SeedGamePokemonJob] Done — #{game.name}: #{game.pokemons.count} Pokémon")
  rescue => e
    Rails.logger.error("[SeedGamePokemonJob] Failed for game #{game_id}: #{e.message}")
    raise
  end
end
