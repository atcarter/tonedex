namespace :pokedex do
  desc "Seed game metadata only (fast — no Pokemon data)"
  task seed_games: :environment do
    load Rails.root.join("db/seeds.rb")
  end

  desc "Seed Pokemon for all games via background jobs (async)"
  task seed_pokemon: :environment do
    SeedAllPokemonJob.perform_later
    puts "Enqueued SeedAllPokemonJob — monitor progress at /sidekiq"
  end

  desc "Force re-seed all Pokemon even if already loaded (use after a new game release)"
  task reseed_pokemon: :environment do
    SeedAllPokemonJob.perform_later(force: true)
    puts "Enqueued full re-seed — monitor progress at /sidekiq"
  end

  desc "Seed everything: game metadata + Pokemon (run this on first deploy)"
  task seed: [:seed_games, :seed_pokemon]
end
