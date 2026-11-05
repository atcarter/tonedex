# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_11_05_110000) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"

  create_table "api_caches", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "endpoint"
    t.datetime "fetched_at"
    t.jsonb "response_data"
    t.datetime "updated_at", null: false
    t.index ["endpoint"], name: "index_api_caches_on_endpoint"
  end

  create_table "caught_pokemons", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.bigint "pokemon_id", null: false
    t.bigint "game_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["game_id"], name: "index_caught_pokemons_on_game_id"
    t.index ["pokemon_id"], name: "index_caught_pokemons_on_pokemon_id"
    t.index ["user_id", "pokemon_id", "game_id"], name: "index_caught_pokemons_on_user_pokemon_game", unique: true
    t.index ["user_id"], name: "index_caught_pokemons_on_user_id"
  end

  create_table "favorites", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "pokemon_id", null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.integer "position"
    t.index ["pokemon_id"], name: "index_favorites_on_pokemon_id"
    t.index ["user_id", "pokemon_id"], name: "index_favorites_on_user_id_and_pokemon_id", unique: true
    t.index ["user_id", "position"], name: "index_favorites_on_user_id_and_position"
    t.index ["user_id"], name: "index_favorites_on_user_id"
  end

  create_table "game_pokemons", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "game_id", null: false
    t.integer "pokedex_number"
    t.bigint "pokemon_id", null: false
    t.datetime "updated_at", null: false
    t.boolean "regional", default: true, null: false
    t.index ["game_id", "pokemon_id"], name: "index_game_pokemons_on_game_and_pokemon_unique", unique: true
    t.index ["game_id"], name: "index_game_pokemons_on_game_id"
    t.index ["pokemon_id"], name: "index_game_pokemons_on_pokemon_id"
  end

  create_table "games", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.integer "generation"
    t.string "name"
    t.integer "pokeapi_id"
    t.string "region"
    t.datetime "updated_at", null: false
    t.string "pokedex_name"
    t.datetime "national_seeded_at"
    t.index ["pokeapi_id"], name: "index_games_on_pokeapi_id"
  end

  create_table "moves", force: :cascade do |t|
    t.integer "accuracy"
    t.datetime "created_at", null: false
    t.string "damage_class"
    t.string "move_type"
    t.string "name"
    t.integer "pokeapi_id"
    t.integer "power"
    t.integer "pp"
    t.datetime "updated_at", null: false
    t.index ["pokeapi_id"], name: "index_moves_on_pokeapi_id", unique: true
  end

  create_table "pokemons", force: :cascade do |t|
    t.jsonb "base_stats"
    t.datetime "created_at", null: false
    t.string "name"
    t.integer "pokeapi_id"
    t.string "shiny_sprite_url"
    t.string "sprite_url"
    t.jsonb "types"
    t.datetime "updated_at", null: false
    t.jsonb "past_types", default: []
    t.boolean "mythical", default: false, null: false
    t.index ["pokeapi_id"], name: "index_pokemons_on_pokeapi_id", unique: true
  end

  create_table "users", force: :cascade do |t|
    t.string "avatar_url"
    t.datetime "created_at", null: false
    t.string "email", null: false
    t.string "google_uid", null: false
    t.string "name"
    t.datetime "updated_at", null: false
    t.index ["email"], name: "index_users_on_email", unique: true
    t.index ["google_uid"], name: "index_users_on_google_uid", unique: true
  end

  add_foreign_key "caught_pokemons", "games"
  add_foreign_key "caught_pokemons", "pokemons"
  add_foreign_key "caught_pokemons", "users"
  add_foreign_key "favorites", "pokemons"
  add_foreign_key "favorites", "users"
  add_foreign_key "game_pokemons", "games"
  add_foreign_key "game_pokemons", "pokemons"
end
