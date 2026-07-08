require "rails_helper"

# Rack::Attack is disabled globally in the test env (see the initializer);
# these specs re-enable it with an isolated in-memory store to pin down the
# throttle policy itself.
RSpec.describe "Rack::Attack throttles", type: :request do
  include ActiveSupport::Testing::TimeHelpers

  around do |example|
    original_store = Rack::Attack.cache.store
    Rack::Attack.enabled = true
    Rack::Attack.cache.store = ActiveSupport::Cache::MemoryStore.new
    # Counters are bucketed by epoch-minute; freeze so a burst never straddles
    # a bucket boundary mid-example.
    freeze_time { example.run }
  ensure
    Rack::Attack.enabled = false
    Rack::Attack.cache.store = original_store
  end

  it "does not throttle dex pagination bursts" do
    game = create(:game)
    pokemon = create(:pokemon)
    GamePokemon.create!(game: game, pokemon: pokemon, pokedex_number: 1)

    # An infinite-scroll pass over a large dex plus the seeding poll is well
    # over the old 5/min games limit — all of it must go through.
    15.times do |i|
      get "/api/v1/games/#{game.id}", params: {offset: i * 40}
      expect(response).to have_http_status(:ok)
    end
  end

  it "throttles pokemon search abuse with a Retry-After hint" do
    adapter = instance_double(PokeapiAdapter)
    allow(adapter).to receive(:find_or_create_pokemon).and_raise(PokeapiClient::NotFoundError)
    allow(PokeapiAdapter).to receive(:new).and_return(adapter)

    15.times do
      get "/api/v1/pokemon/search", params: {q: "zzz"}
      expect(response).to have_http_status(:ok)
    end

    get "/api/v1/pokemon/search", params: {q: "zzz"}

    expect(response).to have_http_status(:too_many_requests)
    expect(response.headers["Retry-After"]).to be_present
    expect(response.parsed_body["retry_after"]).to be_a(Integer)
  end
end
