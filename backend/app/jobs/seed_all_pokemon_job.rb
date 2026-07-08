class SeedAllPokemonJob < ApplicationJob
  queue_as :default

  # Enqueues a SeedGamePokemonJob for each game.
  # By default skips games that already have Pokemon (idempotent).
  # Pass force: true to re-seed everything (e.g. after a new game release).
  def perform(force: false)
    Game.find_each do |game|
      next if !force && game.pokemons.any?

      SeedGamePokemonJob.perform_later(game.id)
      Rails.logger.info("[SeedAllPokemonJob] Enqueued seed for #{game.name}")
    end
  end
end
