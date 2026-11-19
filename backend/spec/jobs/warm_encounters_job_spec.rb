require "rails_helper"

RSpec.describe WarmEncountersJob do
  let(:game) { create(:game) }
  let(:pokemon) { create(:pokemon) }

  def clear_lock
    Sidekiq.redis { |r| r.del(described_class.lock_key(game.id)) }
  end

  before { clear_lock }
  after { clear_lock }

  it "enqueues one warm-up per game while the lock is held" do
    other = create(:pokemon)

    expect {
      described_class.enqueue_once(game.id, pokemon.id)
      described_class.enqueue_once(game.id, other.id)
    }.to have_enqueued_job(described_class).exactly(:once)
  end

  describe "#perform" do
    let(:adapter) { instance_double(PokeapiAdapter, warm_encounters: nil) }

    before { allow(PokeapiAdapter).to receive(:new).and_return(adapter) }

    it "warms the requested Pokémon and the game, then releases the lock" do
      GamePokemon.create!(game: game, pokemon: pokemon, pokedex_number: 1)
      described_class.enqueue_once(game.id, pokemon.id)
      described_class.perform_now(game.id, pokemon.id)

      expect(adapter).to have_received(:warm_encounters).with(game, pokemon, seeded: true)
      expect { described_class.enqueue_once(game.id) }.to have_enqueued_job(described_class)
    end

    it "won't settle a game whose dex is unseeded or still seeding" do
      described_class.perform_now(game.id)
      expect(adapter).to have_received(:warm_encounters).with(game, nil, seeded: false)

      GamePokemon.create!(game: game, pokemon: pokemon, pokedex_number: 1)
      Sidekiq.redis { |r| r.set(SeedGamePokemonJob.lock_key(game.id), "1") }
      described_class.perform_now(game.id)
      expect(adapter).to have_received(:warm_encounters).with(game, nil, seeded: false).twice
    ensure
      SeedGamePokemonJob.release_lock(game.id)
    end

    it "keeps the lock when the warm-up fails, so retries don't stack" do
      allow(adapter).to receive(:warm_encounters).and_raise("boom")
      described_class.enqueue_once(game.id)

      expect { described_class.perform_now(game.id) }.to raise_error("boom")
      expect { described_class.enqueue_once(game.id) }.not_to have_enqueued_job(described_class)
    end
  end
end
