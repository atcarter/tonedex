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

  # The entries either side in list order, each with dex_number; both nil outside the view
  def neighbors(pokemon)
    current = pokemons.where(id: pokemon.id).pick(number)
    return {previous: nil, next: nil} if current.nil?

    rows = pokemons.select("pokemons.*", number.as("dex_number"))
    # pokeapi_id breaks ties: nothing makes a regional number unique
    tiebreak = Pokemon.arel_table[:pokeapi_id]
    before = number.lt(current).or(number.eq(current).and(tiebreak.lt(pokemon.pokeapi_id)))
    after = number.gt(current).or(number.eq(current).and(tiebreak.gt(pokemon.pokeapi_id)))
    {
      previous: rows.where(before).order(number.desc, tiebreak.desc).first,
      next: rows.where(after).order(number.asc, tiebreak.asc).first
    }
  end
end
