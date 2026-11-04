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
end
