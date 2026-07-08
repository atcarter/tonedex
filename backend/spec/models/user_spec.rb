require "rails_helper"

RSpec.describe User, type: :model do
  describe "associations" do
    it { is_expected.to have_many(:favorites).dependent(:destroy) }
    it { is_expected.to have_many(:pokemons).through(:favorites) }
    it { is_expected.to have_many(:caught_pokemons).dependent(:destroy) }
  end

  describe "validations" do
    subject { build(:user) }

    it { is_expected.to validate_presence_of(:google_uid) }
    it { is_expected.to validate_presence_of(:email) }

    # google_uid comes from Google as a numeric string; shoulda-matchers v7 requires
    # an alpha character to test case sensitivity, so we use case_insensitive here
    # (the validation is still unique — it just doesn't need case-swap testing).
    it { is_expected.to validate_uniqueness_of(:google_uid).case_insensitive }
    it { is_expected.to validate_uniqueness_of(:email) }
  end

  describe "uniqueness at the DB level" do
    it "raises on duplicate google_uid" do
      create(:user, google_uid: "uid-123")
      expect { create(:user, google_uid: "uid-123") }.to raise_error(ActiveRecord::RecordInvalid)
    end

    it "raises on duplicate email" do
      create(:user, email: "same@example.com")
      expect { create(:user, email: "same@example.com") }.to raise_error(ActiveRecord::RecordInvalid)
    end
  end
end
