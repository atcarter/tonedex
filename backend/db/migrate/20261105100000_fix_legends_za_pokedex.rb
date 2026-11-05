class FixLegendsZaPokedex < ActiveRecord::Migration[8.1]
  # Legends: Z-A was seeded with Paldea's dex. Point it at Lumiose City and
  # delete its stale game_pokemons so the next GET /games/:id reseeds it.
  def up
    stale_ids = select_values(<<~SQL.squish)
      SELECT id FROM games WHERE name = 'legends-za' AND pokedex_name = 'paldea'
    SQL

    stale_ids.each do |game_id|
      execute "DELETE FROM game_pokemons WHERE game_id = #{connection.quote(game_id)}"
      execute "UPDATE games SET pokedex_name = 'lumiose-city' WHERE id = #{connection.quote(game_id)}"
    end

    execute "UPDATE games SET region = 'kalos' WHERE name = 'legends-za' AND region IS NULL"
  end

  # Nothing to restore: the Paldea rows were wrong.
  def down
  end
end
