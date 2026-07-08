class Api::V1::MovesController < ApplicationController
  def show
    move = adapter.find_or_create_move(params[:id])

    render json: {
      name: move.name,
      type: move.move_type,
      power: move.power,
      accuracy: move.accuracy,
      pp: move.pp,
      damage_class: move.damage_class
    }
  rescue PokeapiClient::ApiError => e
    render json: {error: e.message}, status: :not_found
  end

  private

  def adapter
    @adapter ||= PokeapiAdapter.new
  end
end
