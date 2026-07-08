class Api::V1::PokemonController < ApplicationController
  def search
    query = params[:q].to_s.downcase.strip
    return render json: {error: "Query required"}, status: :bad_request if query.empty?

    # First try exact match from PokeAPI
    pokemon = adapter.find_or_create_pokemon(query)
    render json: pokemon_summary(pokemon)
  rescue PokeapiClient::ApiError
    # If not found in PokeAPI, search local database.
    # sanitize_sql_like escapes user-supplied % and _ so they match literally.
    escaped = ActiveRecord::Base.sanitize_sql_like(query)
    local_results = Pokemon.where("LOWER(name) LIKE ?", "%#{escaped}%").limit(10)
    render json: local_results.map { |p| pokemon_summary(p) }
  end

  def show
    pokemon = find_or_fetch_pokemon
    game = params[:game_id] ? Game.find(params[:game_id]) : nil

    render json: {
      pokemon: pokemon_details(pokemon, game),
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

  def pokemon_summary(pokemon)
    {
      id: pokemon.id,
      name: pokemon.name,
      types: pokemon.types,
      sprite_url: pokemon.sprite_url
    }
  end

  def pokemon_details(pokemon, game)
    {
      id: pokemon.id,
      name: pokemon.name,
      types: game ? pokemon.types_for_generation(game.generation) : pokemon.types,
      base_stats: pokemon.base_stats,
      sprite_url: pokemon.sprite_url,
      shiny_sprite_url: pokemon.shiny_sprite_url
    }
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

  def adapter
    @adapter ||= PokeapiAdapter.new
  end
end
