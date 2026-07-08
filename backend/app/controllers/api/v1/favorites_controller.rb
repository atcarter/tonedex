class Api::V1::FavoritesController < ApplicationController
  before_action :authenticate_user!

  def index
    favorites = current_user.favorites.includes(:pokemon)
    render json: favorites.map { |f| PokemonSerializer.favorite_entry(f.pokemon, f.id) }
  end

  def create
    pokemon = Pokemon.find(params[:pokemon_id])
    favorite = current_user.favorites.find_or_create_by!(pokemon: pokemon) do |f|
      # 1-based: first favorite gets position 1, each new one appends at max+1
      f.position = (current_user.favorites.maximum(:position) || 0) + 1
    end
    render json: {id: favorite.id, pokemon_id: pokemon.id}, status: :created
  rescue ActiveRecord::RecordNotFound
    render json: {error: "Pokemon not found"}, status: :not_found
  end

  def reorder
    ids = params[:ids]
    return render json: {error: "ids required"}, status: :unprocessable_entity unless ids.is_a?(Array)

    # Reassign 1-based positions in the order the client submitted
    ActiveRecord::Base.transaction do
      ids.each_with_index do |id, index|
        current_user.favorites.where(id: id).update_all(position: index + 1)
      end
    end
    head :no_content
  end

  def destroy
    favorite = current_user.favorites.find(params[:id])
    favorite.destroy
    head :no_content
  rescue ActiveRecord::RecordNotFound
    render json: {error: "Favorite not found"}, status: :not_found
  end
end
