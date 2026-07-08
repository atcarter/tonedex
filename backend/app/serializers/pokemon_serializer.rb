# Single source of truth for the Pokemon JSON shapes the API exposes.
# Controllers were each hand-rolling near-identical `pokemon_summary` hashes,
# which let the shapes drift apart silently.
module PokemonSerializer
  module_function

  # Card/grid shape. Pass game: to translate types to that game's generation.
  def summary(pokemon, game: nil)
    {
      id: pokemon.id,
      name: pokemon.name,
      types: game ? pokemon.types_for_generation(game.generation) : pokemon.types,
      sprite_url: pokemon.sprite_url
    }
  end

  # A row in a game's dex listing.
  def game_entry(pokemon, game, game_pokemon)
    summary(pokemon, game: game).merge(pokedex_number: game_pokemon&.pokedex_number)
  end

  # A row in the favorites listing.
  def favorite_entry(pokemon, favorite_id)
    summary(pokemon).merge(favorite_id: favorite_id)
  end

  # The detail page header shape. Includes the game-local dex number when a
  # game is given and the pokemon belongs to its dex.
  def details(pokemon, game: nil)
    base = summary(pokemon, game: game).merge(
      base_stats: pokemon.base_stats,
      shiny_sprite_url: pokemon.shiny_sprite_url
    )

    if game
      game_pokemon = pokemon.game_pokemons.find { |gp| gp.game_id == game.id }
      base[:pokedex_number] = game_pokemon&.pokedex_number
    end

    base
  end
end
