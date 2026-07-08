class Api::V1::GamesController < ApplicationController
  def index
    games = Game.all.order(:generation, :name)
    render json: games
  end

  def show
    game = Game.find(params[:id])

    # If no game_pokemons rows exist yet, enqueue a seed job. The Redis lock in
    # enqueue_once prevents concurrent requests from stacking duplicate jobs
    # during the window before the first row is inserted.
    if game.game_pokemons.empty?
      SeedGamePokemonJob.enqueue_once(game.id)
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
      # Scanning every row's types is only worth doing for the first page —
      # the frontend reads available_types from page one exclusively.
      available_types: offset.zero? ? available_types(pokemons, game) : [],
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

  def available_types(pokemons, game)
    pokemons.select(:types, :past_types)
      .map { |p| p.types_for_generation(game.generation) }
      .flatten.uniq.sort
  end

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
