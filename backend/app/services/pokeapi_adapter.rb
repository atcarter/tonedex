class PokeapiAdapter
  GAME_TO_POKEDEX = {
    "red" => "kanto", "blue" => "kanto", "yellow" => "kanto",
    "gold" => "original-johto", "silver" => "original-johto", "crystal" => "original-johto",
    "ruby" => "hoenn", "sapphire" => "hoenn", "emerald" => "hoenn",
    "firered" => "kanto", "leafgreen" => "kanto",
    "diamond" => "original-sinnoh", "pearl" => "original-sinnoh", "platinum" => "extended-sinnoh",
    "heartgold" => "updated-johto", "soulsilver" => "updated-johto",
    "black" => "original-unova", "white" => "original-unova",
    "black-2" => "updated-unova", "white-2" => "updated-unova",
    "x" => "kalos-central", "y" => "kalos-central",
    "omega-ruby" => "updated-hoenn", "alpha-sapphire" => "updated-hoenn",
    "sun" => "original-alola", "moon" => "original-alola",
    "ultra-sun" => "updated-alola", "ultra-moon" => "updated-alola",
    "sword" => "galar", "shield" => "galar",
    "brilliant-diamond" => "original-sinnoh", "shining-pearl" => "original-sinnoh",
    "legends-arceus" => "hisui",
    "scarlet" => "paldea", "violet" => "paldea",
    "legends-za" => "paldea"
  }.freeze

  def initialize(client: PokeapiClient.new)
    @client = client
  end

  def load_pokedex_for_game(game, limit: nil, offset: 0)
    pokedex_name = GAME_TO_POKEDEX[game.name] || game.region
    return [] unless pokedex_name

    pokedex_data = @client.pokedex(pokedex_name)
    entries = pokedex_data["pokemon_entries"] || []

    entries = entries.drop(offset)
    entries = entries.take(limit) if limit

    entries.filter_map do |entry|
      species_url = entry.dig("pokemon_species", "url")
      species_id = species_url&.split("/")&.compact&.last&.to_i
      pokedex_number = entry["entry_number"]

      next unless species_id

      pokemon = find_or_create_pokemon(species_id)
      associate_pokemon_with_game(pokemon, game, pokedex_number)
      pokemon
    rescue PokeapiClient::ApiError => e
      Rails.logger.warn("[PokeapiAdapter] Skipping entry ##{pokedex_number}: #{e.message}")
      nil
    end
  end

  def pokedex_count_for_game(game)
    pokedex_name = GAME_TO_POKEDEX[game.name] || game.region
    return 0 unless pokedex_name

    pokedex_data = @client.pokedex(pokedex_name)
    (pokedex_data["pokemon_entries"] || []).length
  end

  def find_or_create_pokemon(name_or_id)
    data = @client.pokemon(name_or_id)

    pokemon = Pokemon.find_or_create_by!(pokeapi_id: data["id"]) do |p|
      p.name = data["name"]
      p.types = extract_types(data)
      p.past_types = extract_past_types(data)
      p.base_stats = extract_stats(data)
      p.sprite_url = data.dig("sprites", "front_default")
      p.shiny_sprite_url = data.dig("sprites", "front_shiny")
    end

    # Backfill columns added after initial seeding
    updates = {}
    updates[:shiny_sprite_url] = data.dig("sprites", "front_shiny") if pokemon.shiny_sprite_url.nil?
    updates[:past_types] = extract_past_types(data) if pokemon.past_types.blank?
    pokemon.update_columns(updates) if updates.any?

    pokemon
  rescue ActiveRecord::RecordNotUnique
    Pokemon.find_by!(pokeapi_id: data["id"])
  end

  def find_or_create_move(name_or_id)
    data = @client.move(name_or_id)

    Move.find_or_create_by!(pokeapi_id: data["id"]) do |move|
      move.name = data["name"]
      move.move_type = data.dig("type", "name")
      move.power = data["power"]
      move.accuracy = data["accuracy"]
      move.pp = data["pp"]
      move.damage_class = data.dig("damage_class", "name")
    end
  rescue ActiveRecord::RecordNotUnique
    Move.find_by!(pokeapi_id: data["id"])
  end

  def find_or_create_game(name_or_id)
    data = @client.version(name_or_id)
    version_group = @client.version_group(data.dig("version_group", "name"))

    Game.find_or_create_by!(pokeapi_id: data["id"]) do |game|
      game.name = data["name"]
      game.generation = extract_generation_number(version_group)
      game.region = extract_region(version_group)
    end
  end

  def pokemon_moves_for_game(pokemon, game)
    data = @client.pokemon(pokemon.pokeapi_id)

    data["moves"].filter_map do |move_data|
      version_details = move_data["version_group_details"].find do |vd|
        game_matches_version_group?(game, vd.dig("version_group", "name"))
      end

      next unless version_details

      move = find_or_create_move(move_data.dig("move", "name"))

      PokemonMove.find_or_create_by!(
        pokemon: pokemon,
        move: move,
        game: game
      ) do |pm|
        pm.level_learned = version_details["level_learned_at"]
        pm.learn_method = version_details.dig("move_learn_method", "name")
      end
    end
  end

  # Returns basic move info without fetching move details from API
  # This is much faster as it only uses data from the Pokemon endpoint
  def basic_moves_for_game(pokemon, game)
    data = @client.pokemon(pokemon.pokeapi_id)

    data["moves"].filter_map do |move_data|
      version_details = move_data["version_group_details"].find do |vd|
        game_matches_version_group?(game, vd.dig("version_group", "name"))
      end

      next unless version_details

      {
        name: move_data.dig("move", "name"),
        level_learned: version_details["level_learned_at"],
        learn_method: version_details.dig("move_learn_method", "name")
      }
    end
  end

  def evolution_chain_for(pokemon)
    species_data = @client.pokemon_species(pokemon.pokeapi_id)
    chain_url = species_data.dig("evolution_chain", "url")
    chain_id = chain_url.split("/").last

    chain_data = @client.evolution_chain(chain_id)
    parse_evolution_chain(chain_data["chain"])
  end

  private

  def associate_pokemon_with_game(pokemon, game, pokedex_number)
    GamePokemon.find_or_create_by!(pokemon: pokemon, game: game) do |gp|
      gp.pokedex_number = pokedex_number
    end
  rescue ActiveRecord::RecordNotUnique
    # Another concurrent seed job beat us to it — that's fine, find the existing row
    GamePokemon.find_by!(pokemon: pokemon, game: game)
  end

  def extract_types(data)
    data["types"]
      .sort_by { |t| t["slot"] }
      .map { |t| t.dig("type", "name") }
  end

  # Returns a simplified array of past-type entries, e.g.:
  # [{ "generation" => "generation-v", "types" => ["normal"] }]
  # Each entry means: these types applied up to and including that generation.
  def extract_past_types(data)
    (data["past_types"] || []).map do |pt|
      {
        "generation" => pt.dig("generation", "name"),
        "types" => pt["types"].sort_by { |t| t["slot"] }.map { |t| t.dig("type", "name") }
      }
    end
  end

  def extract_stats(data)
    data["stats"].each_with_object({}) do |stat, hash|
      stat_name = stat.dig("stat", "name")
      hash[stat_name] = stat["base_stat"]
    end
  end

  def extract_generation_number(version_group_data)
    gen_name = version_group_data.dig("generation", "name")
    roman_numeral = gen_name&.split("-")&.last
    roman_numeral_to_int(roman_numeral)
  end

  def roman_numeral_to_int(roman_numeral)
    return 0 if roman_numeral.nil?

    roman_values = {"i" => 1, "v" => 5, "x" => 10}
    chars = roman_numeral.downcase.chars
    total = 0

    chars.each_with_index do |char, i|
      value = roman_values[char] || 0
      next_value = roman_values[chars[i + 1]] || 0

      if value < next_value
        total -= value
      else
        total += value
      end
    end

    total
  end

  def extract_region(version_group_data)
    version_group_data.dig("regions", 0, "name")
  end

  def game_matches_version_group?(game, version_group_name)
    vg_data = @client.version_group(version_group_name)
    vg_data["versions"].any? { |v| v["name"] == game.name }
  end

  def parse_evolution_chain(chain, evolutions = [])
    current = {
      name: chain.dig("species", "name"),
      evolution_details: chain["evolution_details"].map { |ed| parse_evolution_details(ed) }
    }

    evolutions << current

    chain["evolves_to"].each do |evolution|
      parse_evolution_chain(evolution, evolutions)
    end

    evolutions
  end

  def parse_evolution_details(details)
    {
      trigger: details.dig("trigger", "name"),
      min_level: details["min_level"],
      item: details.dig("item", "name"),
      held_item: details.dig("held_item", "name"),
      time_of_day: details["time_of_day"].presence,
      location: details.dig("location", "name"),
      min_happiness: details["min_happiness"],
      min_affection: details["min_affection"],
      known_move: details.dig("known_move", "name"),
      known_move_type: details.dig("known_move_type", "name"),
      gender: details["gender"],
      trade_species: details.dig("trade_species", "name")
    }.compact
  end
end
