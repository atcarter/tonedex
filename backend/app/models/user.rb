class User < ApplicationRecord
  has_many :favorites, dependent: :destroy
  has_many :pokemons, through: :favorites

  has_many :caught_pokemons, dependent: :destroy

  validates :google_uid, :email, presence: true, uniqueness: true
end
