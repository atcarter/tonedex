FactoryBot.define do
  factory :caught_pokemon do
    association :user
    association :pokemon
    association :game
  end
end
