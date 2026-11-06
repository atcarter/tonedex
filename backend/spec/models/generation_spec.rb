require "rails_helper"

RSpec.describe Generation do
  describe ".number_for" do
    it "maps every PokeAPI generation name to its number" do
      expect(described_class.number_for("generation-i")).to eq(1)
      expect(described_class.number_for("generation-iv")).to eq(4)
      expect(described_class.number_for("generation-ix")).to eq(9)
    end

    it "returns 0 for a missing name" do
      expect(described_class.number_for(nil)).to eq(0)
    end

    it "returns the given default for an unknown name" do
      expect(described_class.number_for("generation-xx", default: 999)).to eq(999)
    end
  end

  describe ".introducing" do
    it "maps a species id to the generation that introduced it" do
      expect(described_class.introducing(1)).to eq(1)
      expect(described_class.introducing(151)).to eq(1)
      expect(described_class.introducing(152)).to eq(2)
      expect(described_class.introducing(172)).to eq(2)
      expect(described_class.introducing(700)).to eq(6)
      expect(described_class.introducing(1025)).to eq(9)
    end

    it "places an id past the table in a newer generation" do
      expect(described_class.introducing(1026)).to eq(10)
    end

    it "returns nil for a missing id" do
      expect(described_class.introducing(nil)).to be_nil
    end
  end
end
