class PokeapiAdapter
  # Seed-time defaults only: games.pokedex_name (set at creation and editable
  # in the DB) is the authoritative mapping — see resolve_pokedex_name. Adding
  # a game no longer requires touching this hash; it exists so seeds can
  # populate the column for the curated game list.
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
    "legends-za" => "lumiose-city"
  }.freeze

  # Abilities arrived in Gen 3; earlier games show none.
  FIRST_ABILITY_GENERATION = 3

  # Version groups with no or partial English ability flavor text borrow it, in order.
  ABILITY_TEXT_FALLBACKS = {
    "x-y" => %w[omega-ruby-alpha-sapphire],
    "sun-moon" => %w[ultra-sun-ultra-moon],
    "brilliant-diamond-shining-pearl" => %w[sword-shield],
    "legends-arceus" => %w[sword-shield],
    "scarlet-violet" => %w[the-teal-mask the-indigo-disk sword-shield],
    "legends-za" => %w[scarlet-violet the-teal-mask the-indigo-disk champions]
  }.freeze

  # Outside a game (or with its version uncached), abilities use the newest game's text.
  CURRENT_ABILITY_TEXT_GROUP = "legends-za"

  # Transforms PokeAPI payloads; persistence is delegated to PokemonImporter
  # so this class never touches ActiveRecord directly (SRP).
  def initialize(client: PokeapiClient.new, importer: PokemonImporter.new)
    @client = client
    @importer = importer
  end

  def load_pokedex_for_game(game, limit: nil, offset: 0)
    pokedex_name = resolve_pokedex_name(game)
    return [] unless pokedex_name

    pokedex_data = @client.pokedex(pokedex_name)
    entries = pokedex_data["pokemon_entries"] || []

    entries = entries.drop(offset)
    entries = entries.take(limit) if limit

    entries.filter_map do |entry|
      species_id = species_id_from(entry.dig("pokemon_species", "url"))
      pokedex_number = entry["entry_number"]

      next unless species_id

      data = @client.pokemon(species_id)
      pokemon = import_pokemon(data)
      @importer.link_pokemon_to_game(pokemon, game, pokedex_number)
      warm_abilities(data)
      pokemon
    rescue PokeapiClient::ApiError => e
      Rails.logger.warn("[PokeapiAdapter] Skipping entry ##{pokedex_number}: #{e.message}")
      nil
    end
  end

  # National view (ADR-009): a game's set is every species whose learnset names
  # its version group, plus every species in all of the version group's dexes.
  # One pass over species, one cached payload at a time. Returns the games covered.
  def load_national_dexes(games)
    version_groups = games.to_h { |game| [game.id, version_group_name(game)] }.compact
    targetable = games.select { |game| version_groups.key?(game.id) }
    dex_species = version_groups.values.uniq.to_h { |vg| [vg, version_group_dex_species(vg)] }

    national_species_ids.each do |species_id|
      data = @client.pokemon(species_id)
      learnset = learnset_version_groups(data)
      targets = targetable.select do |game|
        vg = version_groups[game.id]
        learnset.include?(vg) || dex_species[vg].include?(species_id)
      end
      next if targets.empty?

      pokemon = import_pokemon(data)
      mythical = species_mythical(species_id)
      @importer.mark_mythical(pokemon, mythical) unless mythical.nil?
      @importer.link_national_pokemon(pokemon, targets)
      warm_abilities(data)
    rescue PokeapiClient::NotFoundError => e
      Rails.logger.warn("[PokeapiAdapter] Skipping species ##{species_id}: #{e.message}")
    end

    games
  end

  def find_or_create_pokemon(name_or_id)
    import_pokemon(@client.pokemon(name_or_id))
  end

  def import_pokemon(data)
    @importer.upsert_pokemon(
      pokeapi_id: data["id"],
      attributes: {
        name: data["name"],
        types: extract_types(data),
        past_types: extract_past_types(data),
        base_stats: extract_stats(data),
        sprite_url: data.dig("sprites", "front_default"),
        shiny_sprite_url: data.dig("sprites", "front_shiny")
      },
      backfill: {
        shiny_sprite_url: data.dig("sprites", "front_shiny"),
        past_types: extract_past_types(data)
      }
    )
  end

  def find_or_create_move(name_or_id)
    data = @client.move(name_or_id)

    @importer.upsert_move(
      pokeapi_id: data["id"],
      attributes: {
        name: data["name"],
        move_type: data.dig("type", "name"),
        power: data["power"],
        accuracy: data["accuracy"],
        pp: data["pp"],
        damage_class: data.dig("damage_class", "name")
      }
    )
  end

  def find_or_create_game(name_or_id)
    data = @client.version(name_or_id)
    version_group = @client.version_group(data.dig("version_group", "name"))
    pokedex_name = GAME_TO_POKEDEX[data["name"]]

    @importer.upsert_game(
      pokeapi_id: data["id"],
      attributes: {
        name: data["name"],
        generation: extract_generation_number(version_group),
        region: extract_region(version_group) || pokedex_region(pokedex_name),
        pokedex_name: pokedex_name
      }
    )
  end

  # Move list for the detail page, read from the cached pokemon payload: the
  # name, level and learn method are all there, so no move endpoint is fetched
  # until a row is expanded (MovesController).
  def basic_moves_for_game(pokemon, game)
    each_move_for_game(pokemon, game) do |move_data, version_details|
      {
        name: move_data.dig("move", "name"),
        level_learned: version_details["level_learned_at"],
        learn_method: version_details.dig("move_learn_method", "name")
      }
    end
  end

  # sprite_base is the request's base URL, as for PokemonSerializer.details.
  # A game narrows the chain to the species the game has: its game_pokemons
  # rows once the national pass has stamped it (ADR-009), else the species
  # introduced in or before its generation. With no game, an unstamped game
  # with no stored generation, or a species the game lacks, the full chain is
  # returned.
  def evolution_chain_for(pokemon, game = nil, sprite_base: nil)
    species_data = @client.pokemon_species(pokemon.pokeapi_id)
    chain_url = species_data.dig("evolution_chain", "url")
    chain_id = chain_url.split("/").last

    chain_data = @client.evolution_chain(chain_id)
    steps = parse_evolution_chain(chain_data["chain"])
    steps = within_game(steps, game, species_data["name"]) if game
    with_sprite_urls(steps, sprite_base)
  end

  # Caches the /ability payloads the detail page reads, so the request path stays
  # cache-only. Seeds call it per Pokémon; WarmAbilitiesJob backfills seeded ones.
  def warm_abilities(pokemon_data)
    ability_names(pokemon_data).each do |name|
      @client.ability(name)
    rescue PokeapiClient::ApiError => e
      Rails.logger.warn("[PokeapiAdapter] No ability payload for #{name}: #{e.message}")
    end
  end

  def warm_abilities_for(pokemon)
    warm_abilities(@client.pokemon(pokemon.pokeapi_id))
  end

  # Flavor/lore data for the detail page. The seed jobs (load_pokedex_for_game /
  # load_national_dexes) warm the /pokemon and /ability payloads and
  # evolution_chain_for the species, so this normally costs zero network calls.
  # Abilities match the game's generation; their text is read cache-only.
  def species_info_for(pokemon, game = nil)
    pokemon_data = @client.pokemon(pokemon.pokeapi_id)
    species_data = @client.pokemon_species(pokemon.pokeapi_id)
    version_group = game && cached_version_group(game)

    {
      genus: english_entry(species_data["genera"])&.fetch("genus", nil),
      flavor_text: english_entry(species_data["flavor_text_entries"])
        &.fetch("flavor_text", nil)
        &.gsub(/\s+/, " ")
        &.strip,
      height: pokemon_data["height"], # decimetres
      weight: pokemon_data["weight"], # hectograms
      abilities: abilities_for_generation(pokemon_data, game&.generation)
        .map { |a| ability_info(a, version_group) }
    }
  end

  private

  def species_id_from(url)
    url&.split("/")&.compact&.last&.to_i
  end

  def version_group_name(game)
    @client.version(game.name).dig("version_group", "name")
  rescue PokeapiClient::NotFoundError => e
    Rails.logger.warn("[PokeapiAdapter] No version group for #{game.name}: #{e.message}")
    nil
  end

  def cached_version_group(game)
    @client.version(game.name, cache_only: true)&.dig("version_group", "name")
  rescue PokeapiClient::NotFoundError
    nil
  end

  # Species in every dex the version group lists, sub-dexes and DLC dexes included
  def version_group_dex_species(version_group)
    (@client.version_group(version_group)["pokedexes"] || []).each_with_object(Set.new) do |dex, ids|
      entries = @client.pokedex(dex["name"])["pokemon_entries"] || []
      entries.each { |entry| ids << species_id_from(entry.dig("pokemon_species", "url")) }
    end
  end

  def national_species_ids
    (@client.pokedex("national")["pokemon_entries"] || [])
      .filter_map { |entry| species_id_from(entry.dig("pokemon_species", "url")) }
  end

  def learnset_version_groups(pokemon_data)
    (pokemon_data["moves"] || []).each_with_object(Set.new) do |move, groups|
      move["version_group_details"].each { |vd| groups << vd.dig("version_group", "name") }
    end
  end

  # nil when the species payload is unavailable, so a known label is kept
  def species_mythical(species_id)
    @client.pokemon_species(species_id)["is_mythical"] == true
  rescue PokeapiClient::NotFoundError
    nil
  end

  # Current and past ability names, so a game-accurate list is always warm.
  def ability_names(pokemon_data)
    past = (pokemon_data["past_abilities"] || []).flat_map { |entry| entry["abilities"] }
    ((pokemon_data["abilities"] || []) + past).filter_map { |a| a.dig("ability", "name") }.uniq
  end

  # Each past_abilities entry lists the slots that applied up to and including its
  # generation; a null ability means the slot was empty then.
  # No generation (no game) keeps the current abilities.
  def abilities_for_generation(pokemon_data, generation)
    generation = generation.to_i
    return [] if generation.between?(1, FIRST_ABILITY_GENERATION - 1)

    slots = (pokemon_data["abilities"] || []).to_h { |a| [a["slot"], a] }
    (pokemon_data["past_abilities"] || [])
      .map { |past| [Generation.number_for(past.dig("generation", "name")), past] }
      .select { |number, _| generation.positive? && number >= generation }
      .sort_by { |number, _| -number }
      .each { |_, past| past["abilities"].each { |a| slots[a["slot"]] = a } }

    slots.sort.filter_map do |_, a|
      {name: a.dig("ability", "name"), hidden: a["is_hidden"]} if a["ability"]
    end
  end

  # A cache miss leaves the text null; the request path never calls PokeAPI.
  def ability_info(ability, version_group)
    data = @client.ability(ability[:name], cache_only: true)
    return ability.merge(description: nil, short_effect: nil) unless data

    short_effect = clean_ability_text(english_entry(data["effect_entries"])&.dig("short_effect"))
    ability.merge(description: ability_flavor_text(data, version_group) || short_effect, short_effect: short_effect)
  rescue PokeapiClient::NotFoundError
    ability.merge(description: nil, short_effect: nil)
  end

  # The game's own wording, then its fallbacks; nil leaves short_effect as the description.
  def ability_flavor_text(data, version_group)
    version_group ||= CURRENT_ABILITY_TEXT_GROUP
    entries = (data["flavor_text_entries"] || []).select { |e| e.dig("language", "name") == "en" }
    entry = [version_group, *ABILITY_TEXT_FALLBACKS[version_group]].lazy
      .filter_map { |vg| entries.find { |e| e.dig("version_group", "name") == vg } }
      .first
    clean_ability_text(entry&.dig("flavor_text"))
  end

  # Drops soft hyphens, zero-width spaces and textbox line breaks; a wrap before and/or keeps its space.
  def clean_ability_text(text)
    return if text.blank?

    text.gsub("\u00AD\n", "").delete("\u00AD\u200B")
      .gsub(/-\n(?=(?:and|or)\b)/, "- ").gsub("-\n", "-")
      .gsub(/\s+/, " ").strip
  end

  def english_entry(entries)
    (entries || []).find { |e| e.dig("language", "name") == "en" }
  end

  # The DB column is authoritative (editable without a deploy); the hash and
  # region are fallbacks for rows created before the column existed.
  def resolve_pokedex_name(game)
    game.pokedex_name.presence || GAME_TO_POKEDEX[game.name] || game.region
  end

  # Yields each move entry that applies to the given game, with its matching
  # version_group details.
  def each_move_for_game(pokemon, game)
    data = @client.pokemon(pokemon.pokeapi_id)

    data["moves"].filter_map do |move_data|
      version_details = move_data["version_group_details"].find do |vd|
        game_matches_version_group?(game, vd.dig("version_group", "name"))
      end

      next unless version_details

      yield(move_data, version_details)
    end
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
    Generation.number_for(version_group_data.dig("generation", "name"))
  end

  def extract_region(version_group_data)
    version_group_data.dig("regions", 0, "name")
  end

  # Some version groups (legends-za) list no region; their dex still names one.
  def pokedex_region(pokedex_name)
    @client.pokedex(pokedex_name).dig("region", "name") if pokedex_name
  end

  def game_matches_version_group?(game, version_group_name)
    vg_data = @client.version_group(version_group_name)
    vg_data["versions"].any? { |v| v["name"] == game.name }
  end

  def parse_evolution_chain(chain, evolutions = [], evolves_from = nil)
    name = chain.dig("species", "name")
    evolutions << {
      name: name,
      species_id: species_id_from(chain.dig("species", "url")),
      evolves_from: evolves_from,
      evolution_details: chain["evolution_details"].map { |ed| parse_evolution_details(ed) }
    }

    chain["evolves_to"].each do |evolution|
      parse_evolution_chain(evolution, evolutions, name)
    end

    evolutions
  end

  # Keeps the stages whose species the game has, in one query. A stage whose
  # parent the game lacks becomes a root with no evolution details: in Gen 1,
  # Pikachu starts the chain and Pichu's happiness step is gone. When that
  # leaves several roots (Hitmonlee and Hitmonchan without Tyrogue), only the
  # tree holding the requested species is kept. A species the game lacks keeps
  # its full chain.
  def within_game(steps, game, species_name)
    if game.national_seeded_at
      ids = game.pokemons.where(pokeapi_id: steps.pluck(:species_id).compact).pluck(:pokeapi_id).to_set
      kept = steps.select { |step| ids.include?(step[:species_id]) }
    elsif game.generation.to_i.positive?
      kept = steps.select { |step| Generation.introducing(step[:species_id]).to_i <= game.generation }
    else
      return steps
    end

    names = kept.to_set { |step| step[:name] }
    return steps unless names.include?(species_name)

    kept = kept.map do |step|
      next step if step[:evolves_from].nil? || names.include?(step[:evolves_from])

      step.merge(evolves_from: nil, evolution_details: [])
    end

    parents = kept.to_h { |step| [step[:name], step[:evolves_from]] }
    root_of = ->(name) { parents[name] ? root_of.call(parents[name]) : name }
    root = root_of.call(species_name)
    kept.select { |step| root_of.call(step[:name]) == root }
  end

  # Swaps each step's species id for its sprite URL
  def with_sprite_urls(steps, sprite_base)
    steps.map do |step|
      id = step.delete(:species_id)
      step.merge(sprite_url: id && SpriteStore.species_url(id, sprite_base))
    end
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
