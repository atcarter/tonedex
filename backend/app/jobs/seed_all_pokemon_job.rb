class SeedAllPokemonJob < ApplicationJob
  queue_as :default

  # Enqueues a SeedGamePokemonJob for each game.
  # By default skips games that already have Pokemon (idempotent).
  # Pass force: true to re-seed everything (e.g. after a new game release).
  #
  # Enqueues through SeedGamePokemonJob.enqueue_once so the per-game lock is
  # held from fan-out onward: a visitor opening an unseeded game before its
  # first game_pokemons row lands can't enqueue a second full-dex crawl.
  def perform(force: false)
    Game.find_each do |game|
      next if !force && game.pokemons.any?

      if SeedGamePokemonJob.enqueue_once(game.id)
        Rails.logger.info("[SeedAllPokemonJob] Enqueued seed for #{game.name}")
      else
        Rails.logger.info("[SeedAllPokemonJob] Skipped #{game.name}: a seed is already enqueued")
      end
    end
  end
end
