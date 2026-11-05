require "rails_helper"

RSpec.describe SeedGamePokemonJob do
  describe ".enqueue_once" do
    let(:game) { create(:game) }

    before { Sidekiq.redis { |r| r.del(described_class.lock_key(game.id)) } }
    after { Sidekiq.redis { |r| r.del(described_class.lock_key(game.id)) } }

    it "enqueues the job on first call" do
      expect {
        described_class.enqueue_once(game.id)
      }.to have_enqueued_job(described_class).with(game.id)
    end

    it "does not enqueue again while the lock is held" do
      expect {
        described_class.enqueue_once(game.id)
        described_class.enqueue_once(game.id)
      }.to have_enqueued_job(described_class).exactly(:once)
    end
  end

  describe "#perform" do
    let(:game) { create(:game, national_seeded_at: 1.day.ago) }
    let(:adapter) { instance_double(PokeapiAdapter, load_pokedex_for_game: []) }

    before { allow(PokeapiAdapter).to receive(:new).and_return(adapter) }
    after { Sidekiq.redis { |r| r.del(described_class.lock_key(game.id)) } }

    it "clears the national mark of a game with no rows, so the national view reseeds" do
      described_class.perform_now(game.id)

      expect(game.reload.national_seeded_at).to be_nil
    end

    it "keeps the national mark while the game has rows" do
      GamePokemon.create!(game: game, pokemon: create(:pokemon), regional: false)

      described_class.perform_now(game.id)

      expect(game.reload.national_seeded_at).to be_present
    end
  end
end
