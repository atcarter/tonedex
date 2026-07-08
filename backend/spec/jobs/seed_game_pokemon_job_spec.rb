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
end
