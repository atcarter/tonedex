FactoryBot.define do
  factory :pokemon do
    sequence(:pokeapi_id) { |n| 1_000_000 + n }
    sequence(:name) { |n| "pokemon-#{n}" }
    types { ["fire"] }
    sprite_url { "https://example.com/sprite.png" }
    shiny_sprite_url { nil }
    base_stats { {hp: 45, attack: 49, defense: 49, "special-attack": 65, "special-defense": 65, speed: 45} }
  end
end
