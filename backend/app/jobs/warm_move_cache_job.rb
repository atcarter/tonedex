class WarmMoveCacheJob < ApplicationJob
  queue_as :low

  def perform(move_name)
    PokeapiAdapter.new.find_or_create_move(move_name)
  end
end
