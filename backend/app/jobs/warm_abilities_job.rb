# Backfills /ability payloads for Pokémon seeded before seeds warmed them.
# Cache-first, so a rerun only fetches what is still missing.
class WarmAbilitiesJob < ApplicationJob
  queue_as :default

  def perform
    adapter = PokeapiAdapter.new
    Pokemon.find_each do |pokemon|
      adapter.warm_abilities_for(pokemon)
    rescue PokeapiClient::ApiError => e
      Rails.logger.warn("[WarmAbilitiesJob] Skipping #{pokemon.name}: #{e.message}")
    end
    Rails.logger.info("[WarmAbilitiesJob] Done")
  end
end
