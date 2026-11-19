require "rails_helper"

RSpec.describe ApiCache do
  it "stores an empty array, PokeAPI's answer for a Pokémon with no encounters" do
    described_class.store("/pokemon/100999/encounters", [])

    expect(described_class.fetch("/pokemon/100999/encounters")).to eq([])
  end

  it "rejects a missing payload" do
    expect(described_class.new(endpoint: "/pokemon/100999", response_data: nil)).not_to be_valid
  end
end
