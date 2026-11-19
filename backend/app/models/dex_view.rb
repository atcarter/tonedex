# A game's regional or national list (ADR-009): who is in it and in what order.
class DexView
  def initialize(game, dex)
    @game = game
    @national = dex.to_s == "national"
  end

  # National is empty until the pass finishes, so the list never grows under the reader
  def pokemons
    return @game.pokemons.merge(GamePokemon.regional) unless @national

    @game.national_seeded_at ? @game.pokemons : Pokemon.none
  end

  # The column the view is numbered and ordered by
  def number
    @national ? Pokemon.arel_table[:pokeapi_id] : GamePokemon.arel_table[:pokedex_number]
  end
end
