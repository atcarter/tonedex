require "rails_helper"

RSpec.describe WarmAbilitiesJob do
  let(:adapter) { instance_double(PokeapiAdapter, warm_abilities_for: nil) }
  let!(:pokemon) { create_list(:pokemon, 2) }

  before { allow(PokeapiAdapter).to receive(:new).and_return(adapter) }

  it "warms every Pokémon and skips one whose payload fails" do
    allow(adapter).to receive(:warm_abilities_for).with(pokemon.first).and_raise(PokeapiClient::ApiError, "503")

    described_class.perform_now

    expect(adapter).to have_received(:warm_abilities_for).with(pokemon.last)
  end
end
