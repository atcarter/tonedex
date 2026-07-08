FactoryBot.define do
  factory :game do
    sequence(:pokeapi_id) { |n| 1_000_000 + n }
    sequence(:name) { |n| "game-#{n}" }
    generation { 9 }
    region { "paldea" }
  end
end
