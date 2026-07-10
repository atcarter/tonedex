# Mirrors a newly created pokemon's sprites into public/sprites.
#
# Fully effective in development (the compose volume is shared, so the web
# container serves what the worker wrote). On Heroku the worker dyno's disk is
# ephemeral and separate from the web dyno, so this is best-effort there — the
# serializer's PokeAPI-URL fallback keeps new pokemon rendering until the next
# `rails pokedex:mirror_sprites` run is committed and deployed.
class MirrorSpriteJob < ApplicationJob
  queue_as :low

  def perform(pokemon_id)
    SpriteStore.mirror!(Pokemon.find(pokemon_id))
  end
end
