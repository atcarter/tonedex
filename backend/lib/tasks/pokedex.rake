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

  desc "Seed every game's national view in one background pass (FORCE=1 reseeds all games)"
  task seed_national: :environment do
    if SeedNationalDexJob.enqueue_once(force: ENV["FORCE"].present?)
      puts "Enqueued SeedNationalDexJob — monitor progress at /sidekiq"
    else
      puts "A national seed is already enqueued or running"
    end
  end

  desc "Cache the /ability payloads of every Pokémon already seeded (async, idempotent)"
  task warm_abilities: :environment do
    WarmAbilitiesJob.perform_later
    puts "Enqueued WarmAbilitiesJob — monitor progress at /sidekiq"
  end

  desc "Seed everything: game metadata + Pokemon (run this on first deploy)"
  task seed: [:seed_games, :seed_pokemon]

  desc "Mirror PokeAPI sprites into public/sprites (idempotent; LIMIT=n to cap). " \
    "Commit the results — production disks can't keep runtime downloads."
  task mirror_sprites: :environment do
    scope = Pokemon.order(:pokeapi_id)
    scope = scope.limit(ENV["LIMIT"].to_i) if ENV["LIMIT"].present?

    total = scope.count
    processed = 0
    downloaded = 0

    scope.find_each do |pokemon|
      downloaded += SpriteStore.mirror!(pokemon)
      processed += 1
      puts "  #{processed}/#{total} (#{downloaded} files downloaded)" if processed % 100 == 0
      # Be polite to the upstream CDN — we're the burst we're defending against
      sleep 0.05
    end

    puts "Done — #{processed} pokemon scanned, #{downloaded} new files in public/sprites"
  end
end
