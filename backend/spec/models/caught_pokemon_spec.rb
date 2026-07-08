require "rails_helper"

RSpec.describe CaughtPokemon, type: :model do
  describe "associations" do
    it { is_expected.to belong_to(:user) }
    it { is_expected.to belong_to(:pokemon) }
    it { is_expected.to belong_to(:game) }
  end

  describe "validations" do
    subject { build(:caught_pokemon) }

    it { is_expected.to validate_uniqueness_of(:user_id).scoped_to(:pokemon_id, :game_id) }
  end

  it "prevents the same pokemon from being caught twice in the same game" do
    user = create(:user)
    pokemon = create(:pokemon)
    game = create(:game)
    create(:caught_pokemon, user: user, pokemon: pokemon, game: game)

    duplicate = build(:caught_pokemon, user: user, pokemon: pokemon, game: game)
    expect(duplicate).not_to be_valid
  end

  it "allows the same pokemon to be caught in different games" do
    user = create(:user)
    pokemon = create(:pokemon)
    game_a = create(:game)
    game_b = create(:game)
    create(:caught_pokemon, user: user, pokemon: pokemon, game: game_a)

    second = build(:caught_pokemon, user: user, pokemon: pokemon, game: game_b)
    expect(second).to be_valid
  end
end
