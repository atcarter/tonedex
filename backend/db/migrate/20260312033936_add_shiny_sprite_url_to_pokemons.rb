class AddShinySpriteUrlToPokemons < ActiveRecord::Migration[8.1]
  def change
    add_column :pokemons, :shiny_sprite_url, :string
  end
end
