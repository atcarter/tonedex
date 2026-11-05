class Api::V1::GamesController < ApplicationController
  def index
    games = Game.all.order(:generation, :name)
    render json: games
  end

  # ?dex=national lists every species in the game's data (ADR-009); the default is the regional dex.
  def show
    game = Game.find(params[:id])
    national = params[:dex] == "national"

    # enqueue_once's Redis lock keeps concurrent requests from stacking duplicate jobs
    SeedGamePokemonJob.enqueue_once(game.id) unless game.game_pokemons.regional.exists?
    SeedNationalDexJob.enqueue_once if national && game.national_seeded_at.nil?

    pokemons = national ? national_pokemons(game) : game.pokemons.merge(GamePokemon.regional)
    number = national ? "pokemons.pokeapi_id" : "game_pokemons.pokedex_number"

    limit = (params[:limit] || 40).to_i
    offset = (params[:offset] || 0).to_i
    total = pokemons.count
    page = pokemons.select("pokemons.*", "#{number} AS dex_number").order(number).offset(offset).limit(limit)
    # Whole-view data is only worth computing for the first page —
    # the frontend reads it from page one exclusively.
    whole = offset.zero? ? whole_view(pokemons, number, game) : {available_types: [], pokemon_ids: [], dex_numbers: []}

    render json: {
      game: game,
      pokemons: page.map { |p| PokemonSerializer.game_entry(p, game, p.dex_number, sprite_base: request.base_url) },
      **whole,
      pagination: {
        total: total,
        limit: limit,
        offset: offset,
        has_more: offset + limit < total,
        seeding: total.zero? || (national && game.national_seeded_at.nil?)
      }
    }
  end

  private

  # Empty until the national pass finishes, so the list never grows under the reader
  def national_pokemons(game)
    game.national_seeded_at ? game.pokemons : Pokemon.none
  end

  # pokemon_ids and dex_numbers span the whole view in list order: the caught
  # counter and the dex-section jumps need them before every page has loaded.
  def whole_view(pokemons, number, game)
    rows = pokemons.order(number).pluck("pokemons.id", number)
    {
      available_types: available_types(pokemons, game),
      pokemon_ids: rows.map(&:first),
      dex_numbers: rows.map(&:last)
    }
  end

  def available_types(pokemons, game)
    pokemons.select(:types, :past_types)
      .map { |p| p.types_for_generation(game.generation) }
      .flatten.uniq.sort
  end
end
