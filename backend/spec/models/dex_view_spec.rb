require "rails_helper"

RSpec.describe DexView do
  let(:game) { create(:game) }

  def add(number, regional: true)
    create(:pokemon).tap do |pokemon|
      GamePokemon.create!(game: game, pokemon: pokemon, pokedex_number: number, regional: regional)
    end
  end

  def neighbor_ids(pokemon, dex = nil)
    DexView.new(game, dex).neighbors(pokemon).transform_values { |p| p&.id }
  end

  describe "#neighbors in the regional view" do
    # Created out of order, so ids and pokeapi_ids don't follow the numbers
    let!(:seventh) { add(7) }
    let!(:third) { add(3) }
    let!(:twelfth) { add(12) }

    it "returns the entries either side by number, not by number ± 1" do
      expect(neighbor_ids(seventh)).to eq(previous: third.id, next: twelfth.id)
    end

    it "carries each entry's number as dex_number" do
      neighbors = DexView.new(game, nil).neighbors(seventh)

      expect(neighbors.transform_values(&:dex_number)).to eq(previous: 3, next: 12)
    end

    it "has no previous for the first entry and no next for the last" do
      expect(neighbor_ids(third)).to eq(previous: nil, next: seventh.id)
      expect(neighbor_ids(twelfth)).to eq(previous: seventh.id, next: nil)
    end

    it "treats number 0 as a valid first entry" do
      victini = add(0)

      expect(neighbor_ids(victini)).to eq(previous: nil, next: third.id)
      expect(DexView.new(game, nil).neighbors(third)[:previous].dex_number).to eq(0)
    end

    it "skips national-only rows, as neighbors and as the current Pokémon" do
      national_only = add(nil, regional: false)

      expect(neighbor_ids(seventh)).to eq(previous: third.id, next: twelfth.id)
      expect(neighbor_ids(national_only)).to eq(previous: nil, next: nil)
    end

    it "breaks a tied number on pokeapi_id" do
      tied = add(7)

      expect(neighbor_ids(seventh)).to eq(previous: third.id, next: tied.id)
      expect(neighbor_ids(tied)).to eq(previous: seventh.id, next: twelfth.id)
    end

    it "has none for a Pokémon the game lacks" do
      expect(neighbor_ids(create(:pokemon))).to eq(previous: nil, next: nil)
    end
  end

  describe "#neighbors in the national view" do
    # The factory's pokeapi_id sequence follows creation order
    let!(:first) { add(30) }
    let!(:national_only) { add(nil, regional: false) }
    let!(:last) { add(10) }

    it "orders regional and national-only rows by national number" do
      game.update!(national_seeded_at: Time.current)

      expect(neighbor_ids(national_only, "national")).to eq(previous: first.id, next: last.id)
      expect(DexView.new(game, "national").neighbors(first)[:next].dex_number)
        .to eq(national_only.pokeapi_id)
    end

    it "has none until the national pass has stamped the game" do
      expect(neighbor_ids(national_only, "national")).to eq(previous: nil, next: nil)
    end
  end
end
