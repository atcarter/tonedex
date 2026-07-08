class AddUniqueIndexToPokeapiIds < ActiveRecord::Migration[8.1]
  def up
    # ── Pokemons ────────────────────────────────────────────────────────────────
    # Step 1: Repoint game_pokemons from duplicate pokemon rows → canonical row
    execute <<~SQL
      UPDATE game_pokemons
      SET pokemon_id = canonical.id
      FROM (
        SELECT MIN(id) AS id, pokeapi_id FROM pokemons GROUP BY pokeapi_id
      ) canonical
      JOIN pokemons dup ON dup.pokeapi_id = canonical.pokeapi_id AND dup.id != canonical.id
      WHERE game_pokemons.pokemon_id = dup.id
    SQL

    # Step 2: After repointing, some game_pokemons may now be duplicate (same game+pokemon).
    #         Keep only the lowest id for each pair.
    execute <<~SQL
      DELETE FROM game_pokemons
      WHERE id NOT IN (
        SELECT MIN(id) FROM game_pokemons GROUP BY game_id, pokemon_id
      )
    SQL

    # Step 3: Delete duplicate pokemon rows, keeping lowest id per pokeapi_id
    execute <<~SQL
      DELETE FROM pokemons
      WHERE id NOT IN (
        SELECT MIN(id) FROM pokemons GROUP BY pokeapi_id
      )
    SQL

    # Step 4: Replace the non-unique index with a unique one
    remove_index :pokemons, name: "index_pokemons_on_pokeapi_id"
    add_index :pokemons, :pokeapi_id, unique: true

    # ── Moves ────────────────────────────────────────────────────────────────────
    # Step 5: Repoint pokemon_moves from duplicate move rows → canonical row
    execute <<~SQL
      UPDATE pokemon_moves
      SET move_id = canonical.id
      FROM (
        SELECT MIN(id) AS id, pokeapi_id FROM moves GROUP BY pokeapi_id
      ) canonical
      JOIN moves dup ON dup.pokeapi_id = canonical.pokeapi_id AND dup.id != canonical.id
      WHERE pokemon_moves.move_id = dup.id
    SQL

    # Step 6: Clean up duplicate pokemon_moves
    execute <<~SQL
      DELETE FROM pokemon_moves
      WHERE id NOT IN (
        SELECT MIN(id) FROM pokemon_moves GROUP BY pokemon_id, move_id, game_id
      )
    SQL

    # Step 7: Delete duplicate move rows
    execute <<~SQL
      DELETE FROM moves
      WHERE id NOT IN (
        SELECT MIN(id) FROM moves GROUP BY pokeapi_id
      )
    SQL

    # Step 8: Replace the non-unique index with a unique one
    remove_index :moves, name: "index_moves_on_pokeapi_id"
    add_index :moves, :pokeapi_id, unique: true
  end

  def down
    remove_index :pokemons, :pokeapi_id
    add_index :pokemons, :pokeapi_id

    remove_index :moves, :pokeapi_id
    add_index :moves, :pokeapi_id
  end
end
