# All ActiveRecord persistence for PokeAPI-sourced records. PokeapiAdapter
# transforms API payloads into plain attribute hashes and hands them here —
# the adapter no longer touches the database directly.
#
# Every write is concurrency-safe: parallel seed jobs racing on the same
# record fall back to the existing row via RecordNotUnique.
class PokemonImporter
  def upsert_pokemon(pokeapi_id:, attributes:, backfill: {})
    pokemon = Pokemon.find_or_create_by!(pokeapi_id: pokeapi_id) do |p|
      p.assign_attributes(attributes)
    end

    # Columns added after a record was first seeded get filled on re-touch
    updates = {}
    if pokemon.shiny_sprite_url.nil? && backfill.key?(:shiny_sprite_url)
      updates[:shiny_sprite_url] = backfill[:shiny_sprite_url]
    end
    if pokemon.past_types.blank? && backfill.key?(:past_types)
      updates[:past_types] = backfill[:past_types]
    end
    pokemon.update_columns(updates) if updates.any?

    # Self-host the sprites for newly created pokemon (see SpriteStore)
    MirrorSpriteJob.perform_later(pokemon.id) if pokemon.previously_new_record?

    pokemon
  rescue ActiveRecord::RecordNotUnique
    Pokemon.find_by!(pokeapi_id: pokeapi_id)
  end

  def upsert_move(pokeapi_id:, attributes:)
    Move.find_or_create_by!(pokeapi_id: pokeapi_id) do |move|
      move.assign_attributes(attributes)
    end
  rescue ActiveRecord::RecordNotUnique
    Move.find_by!(pokeapi_id: pokeapi_id)
  end

  def upsert_game(pokeapi_id:, attributes:)
    Game.find_or_create_by!(pokeapi_id: pokeapi_id) do |game|
      game.assign_attributes(attributes)
    end
  end

  def link_pokemon_to_game(pokemon, game, pokedex_number)
    GamePokemon.find_or_create_by!(pokemon: pokemon, game: game) do |gp|
      gp.pokedex_number = pokedex_number
    end
  rescue ActiveRecord::RecordNotUnique
    # Another concurrent seed job beat us to it — find the existing row
    GamePokemon.find_by!(pokemon: pokemon, game: game)
  end
end
