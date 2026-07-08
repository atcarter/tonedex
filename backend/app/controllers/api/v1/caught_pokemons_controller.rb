class Api::V1::CaughtPokemonsController < ApplicationController
  before_action :authenticate_user!

  def index
    entries = current_user.caught_pokemons.where(game_id: params[:game_id])
    render json: entries.map { |c| {id: c.id, pokemon_id: c.pokemon_id, game_id: c.game_id} }
  end

  def create
    game = Game.find(params[:game_id])
    pokemon = Pokemon.find(params[:pokemon_id])
    entry = current_user.caught_pokemons.find_or_create_by!(pokemon: pokemon, game: game)
    render json: {id: entry.id, pokemon_id: pokemon.id, game_id: game.id}, status: :created
  rescue ActiveRecord::RecordNotFound
    render json: {error: "Not found"}, status: :not_found
  end

  def destroy
    entry = current_user.caught_pokemons.find(params[:id])
    entry.destroy
    head :no_content
  rescue ActiveRecord::RecordNotFound
    render json: {error: "Not found"}, status: :not_found
  end
end
