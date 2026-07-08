class PreloadGamePokemonJob < ApplicationJob
  queue_as :default

  def perform(game_id)
    PokeapiAdapter.new.load_pokedex_for_game(game_id, limit: 1000, offset: 0)
  end
end
