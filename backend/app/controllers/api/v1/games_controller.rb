class Api::V1::GamesController < ApplicationController
  def index
    games = Game.all.order(:generation, :name)
    render json: games
  end

  def show
    game = Game.find(params[:id])

    # If no game_pokemons rows exist yet, enqueue a one-time seed job.
    # Checking the join table (not pokemons) means we only enqueue once —
    # as soon as the first row is inserted the check is false for all subsequent requests.
    if game.game_pokemons.empty?
      SeedGamePokemonJob.perform_later(game.id)
    end

    pokemons = game.pokemons
      .includes(:game_pokemons)
      .order("game_pokemons.pokedex_number")

    limit = (params[:limit] || 40).to_i
    offset = (params[:offset] || 0).to_i
    total = pokemons.count

    render json: {
      game: game,
      pokemons: pokemons.offset(offset).limit(limit).map { |p| pokemon_summary(p, game) },
      available_types: pokemons.select(:types, :past_types).map { |p| p.types_for_generation(game.generation) }.flatten.uniq.sort,
      pagination: {
        total: total,
        limit: limit,
        offset: offset,
        has_more: offset + limit < total,
        seeding: total.zero?
      }
    }
  end

  private

  def pokemon_summary(pokemon, game)
    game_pokemon = pokemon.game_pokemons.find { |gp| gp.game_id == game.id }
    {
      id: pokemon.id,
      name: pokemon.name,
      types: pokemon.types_for_generation(game.generation),
      sprite_url: pokemon.sprite_url,
      pokedex_number: game_pokemon&.pokedex_number
    }
  end
end
