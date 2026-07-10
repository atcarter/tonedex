# Single source of truth for the Pokemon JSON shapes the API exposes.
# Controllers were each hand-rolling near-identical `pokemon_summary` hashes,
# which let the shapes drift apart silently.
#
# sprite_base is the request's base URL; when given, sprite URLs point at the
# self-hosted mirror in public/sprites (falling back to the original PokeAPI
# URL for anything not mirrored yet — see SpriteStore).
module PokemonSerializer
  module_function

  # Card/grid shape. Pass game: to translate types to that game's generation.
  def summary(pokemon, game: nil, sprite_base: nil)
    {
      id: pokemon.id,
      name: pokemon.name,
      types: game ? pokemon.types_for_generation(game.generation) : pokemon.types,
      sprite_url: SpriteStore.url_for(pokemon, sprite_base)
    }
  end

  # A row in a game's dex listing.
  def game_entry(pokemon, game, game_pokemon, sprite_base: nil)
    summary(pokemon, game: game, sprite_base: sprite_base)
      .merge(pokedex_number: game_pokemon&.pokedex_number)
  end

  # A row in the favorites listing.
  def favorite_entry(pokemon, favorite_id, sprite_base: nil)
    summary(pokemon, sprite_base: sprite_base).merge(favorite_id: favorite_id)
  end

  # The detail page header shape. Includes the game-local dex number when a
  # game is given and the pokemon belongs to its dex.
  def details(pokemon, game: nil, sprite_base: nil)
    base = summary(pokemon, game: game, sprite_base: sprite_base).merge(
      base_stats: pokemon.base_stats,
      shiny_sprite_url: SpriteStore.url_for(pokemon, sprite_base, shiny: true)
    )

    if game
      game_pokemon = pokemon.game_pokemons.find { |gp| gp.game_id == game.id }
      base[:pokedex_number] = game_pokemon&.pokedex_number
    end

    base
  end
end
