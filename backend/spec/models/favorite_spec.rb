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
end
