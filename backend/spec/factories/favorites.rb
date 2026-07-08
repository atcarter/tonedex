FactoryBot.define do
  factory :favorite do
    association :user
    association :pokemon
    sequence(:position) { |n| n }
  end
end
