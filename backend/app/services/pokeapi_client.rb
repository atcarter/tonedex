class PokeapiClient
  BASE_URL = "https://pokeapi.co/api/v2".freeze

  class ApiError < StandardError; end
  class NotFoundError < ApiError; end

  def initialize(cache: CacheService)
    @cache = cache
  end

  def pokemon(name_or_id)
    fetch("/pokemon/#{name_or_id}")
  end

  def pokemon_species(name_or_id)
    fetch("/pokemon-species/#{name_or_id}")
  end

  def move(name_or_id)
    fetch("/move/#{name_or_id}")
  end

  def version(name_or_id)
    fetch("/version/#{name_or_id}")
  end

  def version_group(name_or_id)
    fetch("/version-group/#{name_or_id}")
  end

  def pokedex(name_or_id)
    fetch("/pokedex/#{name_or_id}")
  end

  def evolution_chain(id)
    fetch("/evolution-chain/#{id}")
  end

  def evolution_trigger(name_or_id)
    fetch("/evolution-trigger/#{name_or_id}")
  end

  def item(name_or_id)
    fetch("/item/#{name_or_id}")
  end

  def location(name_or_id)
    fetch("/location/#{name_or_id}")
  end

  private

  def fetch(endpoint)
    cached = @cache.fetch(endpoint)
    return cached if cached

    response = HTTParty.get("#{BASE_URL}#{endpoint}")

    unless response.success?
      error_class = (response.code == 404) ? NotFoundError : ApiError
      raise error_class, "PokeAPI returned #{response.code} for #{endpoint}"
    end

    data = response.parsed_response
    @cache.store(endpoint, data)
    data
  end
end
