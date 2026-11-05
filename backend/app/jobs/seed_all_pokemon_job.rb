class SeedAllPokemonJob < ApplicationJob
  queue_as :default

  # Enqueues a SeedGamePokemonJob for each game.
  # By default skips games that already have their regional dex (idempotent).
  # Pass force: true to re-seed everything (e.g. after a new game release).
  # enqueue_once holds the per-game lock from fan-out on, so a visitor can't start a duplicate crawl.
  def perform(force: false)
    Game.find_each do |game|
      next if !force && game.game_pokemons.regional.exists?

      if SeedGamePokemonJob.enqueue_once(game.id)
        Rails.logger.info("[SeedAllPokemonJob] Enqueued seed for #{game.name}")
      else
        Rails.logger.info("[SeedAllPokemonJob] Skipped #{game.name}: a seed is already enqueued")
      end
    end
  end
end
