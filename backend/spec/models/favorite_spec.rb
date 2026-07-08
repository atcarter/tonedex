require "rails_helper"

RSpec.describe Favorite, type: :model do
  describe "associations" do
    it { is_expected.to belong_to(:user) }
    it { is_expected.to belong_to(:pokemon) }
  end

  describe "validations" do
    subject { build(:favorite) }

    it { is_expected.to validate_uniqueness_of(:user_id).scoped_to(:pokemon_id) }
  end

  describe "default scope" do
    it "orders by position ascending" do
      user = create(:user)
      pokemon_a = create(:pokemon)
      pokemon_b = create(:pokemon)
      fav_b = create(:favorite, user: user, pokemon: pokemon_b, position: 2)
      fav_a = create(:favorite, user: user, pokemon: pokemon_a, position: 1)

      expect(user.favorites.map(&:id)).to eq([fav_a.id, fav_b.id])
    end
  end
end
