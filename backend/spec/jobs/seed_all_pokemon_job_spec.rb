require "rails_helper"

RSpec.describe SeedAllPokemonJob do
  let(:seed_job) { SeedGamePokemonJob }

  def clear_seed_locks(game_ids)
    Sidekiq.redis { |r| game_ids.each { |id| r.del(seed_job.lock_key(id)) } }
  end

  # The fan-out locks every game in the test DB, including rows left by earlier runs.
  after { clear_seed_locks(Game.ids) }

  context "with games that have no Pokémon" do
    let!(:game_a) { create(:game, name: "seed-all-spec-unseeded-a") }
    let!(:game_b) { create(:game, name: "seed-all-spec-unseeded-b") }

    before { clear_seed_locks([game_a.id, game_b.id]) }

    it "enqueues exactly one seed per game" do
      expect {
        described_class.perform_now
      }.to have_enqueued_job(seed_job).with(game_a.id).exactly(:once)
        .and have_enqueued_job(seed_job).with(game_b.id).exactly(:once)
    end

    it "holds the lock, so a later enqueue_once for the same game is a no-op" do
      expect {
        described_class.perform_now
        seed_job.enqueue_once(game_a.id) # what GamesController#show does
      }.to have_enqueued_job(seed_job).with(game_a.id).exactly(:once)
    end

    it "skips a game whose seed is already enqueued" do
      seed_job.enqueue_once(game_a.id)

      expect {
        described_class.perform_now
      }.not_to have_enqueued_job(seed_job).with(game_a.id)
    end
  end

  context "with a game that already has Pokémon" do
    let!(:game) { create(:game, name: "seed-all-spec-seeded") }

    before do
      GamePokemon.create!(game: game, pokemon: create(:pokemon), pokedex_number: 1)
      clear_seed_locks([game.id])
    end

    it "does not enqueue it by default" do
      expect {
        described_class.perform_now
      }.not_to have_enqueued_job(seed_job).with(game.id)
    end

    it "enqueues it once with force: true" do
      expect {
        described_class.perform_now(force: true)
      }.to have_enqueued_job(seed_job).with(game.id).exactly(:once)
    end
  end
end
