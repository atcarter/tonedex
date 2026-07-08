class PokeapiClient
  BASE_URL = "https://pokeapi.co/api/v2".freeze

  # Aggressive timeouts: these calls run on Puma request threads (pokemon show/
  # search, move detail), so a hung upstream must fail fast rather than pin a
  # thread for Net::HTTP's 60s default.
  OPEN_TIMEOUT = 2
  READ_TIMEOUT = 5

  # Transient failures (timeouts, resets, 5xx) are retried with linear backoff.
  MAX_RETRIES = 2
  BACKOFF_BASE = 0.5

  TRANSIENT_ERRORS = [
    Net::OpenTimeout, Net::ReadTimeout,
    Errno::ECONNRESET, Errno::ECONNREFUSED, SocketError
  ].freeze

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

    response = request_with_retries(endpoint)

    unless response.success?
      error_class = (response.code == 404) ? NotFoundError : ApiError
      raise error_class, "PokeAPI returned #{response.code} for #{endpoint}"
    end

    data = response.parsed_response
    @cache.store(endpoint, data)
    data
  end

  def request_with_retries(endpoint)
    attempts = 0
    loop do
      attempts += 1
      begin
        response = HTTParty.get(
          "#{BASE_URL}#{endpoint}",
          open_timeout: OPEN_TIMEOUT,
          read_timeout: READ_TIMEOUT
        )
      rescue *TRANSIENT_ERRORS => e
        raise ApiError, "PokeAPI request failed for #{endpoint}: #{e.message}" if attempts > MAX_RETRIES
        sleep(BACKOFF_BASE * attempts)
        next
      end

      return response unless response.code >= 500 && attempts <= MAX_RETRIES
      sleep(BACKOFF_BASE * attempts)
    end
  end
end
