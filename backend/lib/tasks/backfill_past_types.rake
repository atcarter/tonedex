namespace :backfill do
  desc "Backfill past_types for existing Pokemon from cached PokeAPI responses (no network calls)"
  task past_types: :environment do
    scope = Pokemon.where("past_types = '[]' OR past_types IS NULL")
    total = scope.count
    puts "#{total} Pokemon missing past_types"

    updated = 0
    skipped = 0

    scope.find_each do |pokemon|
      cached = CacheService.fetch("/pokemon/#{pokemon.pokeapi_id}")

      unless cached
        skipped += 1
        next
      end

      past = (cached["past_types"] || []).map do |pt|
        {
          "generation" => pt.dig("generation", "name"),
          "types" => pt["types"].sort_by { |t| t["slot"] }.map { |t| t.dig("type", "name") }
        }
      end

      pokemon.update_column(:past_types, past)
      updated += 1
    end

    puts "Done — updated: #{updated}, skipped (not in cache): #{skipped}"
  end
end
