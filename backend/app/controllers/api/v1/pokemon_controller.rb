class Api::V1::PokemonController < ApplicationController
  # As-you-type autocomplete for the search bar. DB-only — never touches
  # PokeAPI (the full search behind Enter handles unseeded names), so it's
  # cheap enough to hit per keystroke. Prefix matches sort first.
  def suggestions
    query = params[:q].to_s.downcase.strip
    return render json: {results: []} if query.length < 2

    escaped = ActiveRecord::Base.sanitize_sql_like(query)
    prefix = ActiveRecord::Base.connection.quote("#{escaped}%")
    results = Pokemon.where("LOWER(name) LIKE ?", "%#{escaped}%")
      .order(Arel.sql("CASE WHEN name LIKE #{prefix} THEN 0 ELSE 1 END"), :name)
      .limit(8)

    render json: {
      results: results.map { |p| PokemonSerializer.summary(p, sprite_base: request.base_url) }
    }
  end

  # Always renders {results: [...], exact: bool} — one response shape for both
  # the exact PokeAPI hit and the local substring fallback.
  def search
    query = params[:q].to_s.downcase.strip
    return render json: {error: "Query required"}, status: :bad_request if query.empty?

    # First try exact match from PokeAPI
    pokemon = adapter.find_or_create_pokemon(query)
    render json: {
      results: [PokemonSerializer.summary(pokemon, sprite_base: request.base_url)],
      exact: true
    }
  rescue PokeapiClient::ApiError
    # If not found in PokeAPI, search local database.
    # sanitize_sql_like escapes user-supplied % and _ so they match literally.
    escaped = ActiveRecord::Base.sanitize_sql_like(query)
    local_results = Pokemon.where("LOWER(name) LIKE ?", "%#{escaped}%").limit(10)
    render json: {
      results: local_results.map { |p| PokemonSerializer.summary(p, sprite_base: request.base_url) },
      exact: false
    }
  end

  def show
    pokemon = find_or_fetch_pokemon
    game = params[:game_id] ? Game.find(params[:game_id]) : nil

    render json: {
      pokemon: PokemonSerializer.details(pokemon, game: game, dex: params[:dex], sprite_base: request.base_url),
      species: species_info(pokemon, game),
      moves: moves_for_game(pokemon, game),
      evolution_chain: evolution_chain(pokemon)
    }
  end

  private

  def find_or_fetch_pokemon
    if params[:id].match?(/^\d+$/)
      Pokemon.find(params[:id])
    else
      adapter.find_or_create_pokemon(params[:id])
    end
  end

  def moves_for_game(pokemon, game)
    return [] unless game

    moves = adapter.basic_moves_for_game(pokemon, game)

    # Sort by level (level-up moves first), then by name
    moves.sort_by { |m| [(m[:learn_method] == "level-up") ? 0 : 1, m[:level_learned] || 999, m[:name]] }
  end

  def evolution_chain(pokemon)
    adapter.evolution_chain_for(pokemon)
  rescue PokeapiClient::ApiError
    []
  end

  def species_info(pokemon, game)
    adapter.species_info_for(pokemon, game)
  rescue PokeapiClient::ApiError
    nil
  end

  def adapter
    @adapter ||= PokeapiAdapter.new
  end
end
