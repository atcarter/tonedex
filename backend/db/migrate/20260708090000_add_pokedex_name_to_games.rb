class AddPokedexNameToGames < ActiveRecord::Migration[8.1]
  # Copy of PokeapiAdapter::GAME_TO_POKEDEX at the time of this migration —
  # inlined so the migration stays valid if the constant moves or is removed.
  BACKFILL = {
    "red" => "kanto", "blue" => "kanto", "yellow" => "kanto",
    "gold" => "original-johto", "silver" => "original-johto", "crystal" => "original-johto",
    "ruby" => "hoenn", "sapphire" => "hoenn", "emerald" => "hoenn",
    "firered" => "kanto", "leafgreen" => "kanto",
    "diamond" => "original-sinnoh", "pearl" => "original-sinnoh", "platinum" => "extended-sinnoh",
    "heartgold" => "updated-johto", "soulsilver" => "updated-johto",
    "black" => "original-unova", "white" => "original-unova",
    "black-2" => "updated-unova", "white-2" => "updated-unova",
    "x" => "kalos-central", "y" => "kalos-central",
    "omega-ruby" => "updated-hoenn", "alpha-sapphire" => "updated-hoenn",
    "sun" => "original-alola", "moon" => "original-alola",
    "ultra-sun" => "updated-alola", "ultra-moon" => "updated-alola",
    "sword" => "galar", "shield" => "galar",
    "brilliant-diamond" => "original-sinnoh", "shining-pearl" => "original-sinnoh",
    "legends-arceus" => "hisui",
    "scarlet" => "paldea", "violet" => "paldea",
    "legends-za" => "paldea"
  }.freeze

  def up
    add_column :games, :pokedex_name, :string

    BACKFILL.each do |game_name, pokedex_name|
      execute <<~SQL.squish
        UPDATE games
        SET pokedex_name = #{connection.quote(pokedex_name)}
        WHERE name = #{connection.quote(game_name)}
      SQL
    end
  end

  def down
    remove_column :games, :pokedex_name
  end
end
