FactoryBot.define do
  factory :user do
    sequence(:google_uid) { |n| "google_uid_abc#{n}" }
    sequence(:email) { |n| "user#{n}@example.com" }
    name { "Test User" }
    avatar_url { "https://example.com/avatar.jpg" }
  end
end
