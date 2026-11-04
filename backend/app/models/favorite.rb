class Favorite < ApplicationRecord
  belongs_to :user
  belongs_to :pokemon

  validates :user_id, uniqueness: {scope: :pokemon_id}
end
