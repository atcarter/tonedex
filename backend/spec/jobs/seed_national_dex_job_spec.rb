require "rails_helper"

RSpec.describe SeedNationalDexJob do
  def clear_lock
    Sidekiq.redis { |r| r.del(described_class.lock_key) }
  end

  before { clear_lock }
  after { clear_lock }

  describe ".enqueue_once" do
    it "enqueues one pass while the lock is held" do
      expect {
        described_class.enqueue_once
        described_class.enqueue_once
      }.to have_enqueued_job(described_class).exactly(:once)
    end
  end

  describe "#perform" do
    let(:adapter) { instance_double(PokeapiAdapter) }
    let!(:unseeded) { create(:game, name: "national-job-spec-unseeded") }
    let!(:seeded) { create(:game, name: "national-job-spec-seeded", national_seeded_at: 1.day.ago) }

    before do
      allow(PokeapiAdapter).to receive(:new).and_return(adapter)
      allow(adapter).to receive(:load_national_dexes) { |games| games }
    end

    it "seeds only games without a national view and marks them seeded" do
      described_class.perform_now

      expect(adapter).to have_received(:load_national_dexes) do |games|
        expect(games).to include(unseeded)
        expect(games).not_to include(seeded)
      end
      expect(unseeded.reload.national_seeded_at).to be_present
    end

    it "reseeds every game with force: true" do
      described_class.perform_now(force: true)

      expect(adapter).to have_received(:load_national_dexes) do |games|
        expect(games).to include(unseeded, seeded)
      end
    end

    it "does not mark a game the pass skipped" do
      allow(adapter).to receive(:load_national_dexes).and_return([])

      described_class.perform_now

      expect(unseeded.reload.national_seeded_at).to be_nil
    end

    it "releases the lock when done" do
      described_class.enqueue_once
      described_class.perform_now

      expect { described_class.enqueue_once }.to have_enqueued_job(described_class)
    end
  end
end
