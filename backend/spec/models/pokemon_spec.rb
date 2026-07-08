require "rails_helper"

RSpec.describe Pokemon, type: :model do
  describe "#types_for_generation" do
    it "returns current types when there are no past types" do
      pokemon = build(:pokemon, types: ["fire"], past_types: [])

      expect(pokemon.types_for_generation(1)).to eq(["fire"])
    end

    context "with a single past-types entry (Clefairy: Normal until Gen V, Fairy from Gen VI)" do
      let(:pokemon) do
        build(:pokemon,
          types: ["fairy"],
          past_types: [{"generation" => "generation-v", "types" => ["normal"]}])
      end

      it "returns the past types for generations up to and including the entry's" do
        expect(pokemon.types_for_generation(1)).to eq(["normal"])
        expect(pokemon.types_for_generation(5)).to eq(["normal"])
      end

      it "returns the current types after the entry's generation" do
        expect(pokemon.types_for_generation(6)).to eq(["fairy"])
        expect(pokemon.types_for_generation(9)).to eq(["fairy"])
      end
    end

    context "with multiple past-types entries" do
      let(:pokemon) do
        build(:pokemon,
          types: ["ghost"],
          past_types: [
            {"generation" => "generation-ii", "types" => ["bug"]},
            {"generation" => "generation-v", "types" => ["bug", "poison"]}
          ])
      end

      it "picks the earliest entry that still applies" do
        expect(pokemon.types_for_generation(1)).to eq(["bug"])
        expect(pokemon.types_for_generation(2)).to eq(["bug"])
      end

      it "moves to the next entry once the earlier one no longer applies" do
        expect(pokemon.types_for_generation(3)).to eq(["bug", "poison"])
        expect(pokemon.types_for_generation(5)).to eq(["bug", "poison"])
      end

      it "falls through to current types past all entries" do
        expect(pokemon.types_for_generation(6)).to eq(["ghost"])
      end
    end
  end
end
