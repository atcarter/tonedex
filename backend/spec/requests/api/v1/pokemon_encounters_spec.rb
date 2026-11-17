require "rails_helper"

# Uses the real adapter on cached payloads: the endpoint is cache-only, so nothing reaches PokeAPI.
RSpec.describe "Pokemon encounters API", type: :request do
  let(:pokemon) { create(:pokemon) }
  let(:game) { create(:game, name: "sword", region: "galar", encounters_available: true) }

  def cache_encounters(payload)
    ApiCache.store("/pokemon/#{pokemon.pokeapi_id}/encounters", payload)
  end

  def get_encounters(game_id: game.id)
    get "/api/v1/pokemon/#{pokemon.id}/encounters", params: {game_id: game_id}
  end

  def route_four(version)
    {"location_area" => {"name" => "galar-route-4-area"},
     "version_details" => [{"version" => {"name" => version}, "max_chance" => 5, "encounter_details" => [
       {"chance" => 5, "min_level" => 14, "max_level" => 16, "method" => {"name" => "overworld"}, "condition_values" => []}
     ]}]}
  end

  before do
    Sidekiq.redis { |r| r.del(WarmEncountersJob.lock_key(game.id)) }
    allow(HTTParty).to receive(:get).and_raise("PokeAPI must not be called")
  end

  it "lists the game's locations" do
    cache_encounters([route_four("sword"), route_four("shield")])

    get_encounters

    expect(response).to have_http_status(:ok)
    expect(response.parsed_body).to eq(
      "status" => "found",
      "locations" => [{"area" => "galar-route-4-area", "method" => "overworld", "dlc" => nil,
                       "min_level" => 14, "max_level" => 16, "chance" => 5, "chance_varies" => false,
                       "conditions" => [], "varies_with" => []}]
    )
  end

  it "says none when the game has encounter data but not for this Pokémon" do
    cache_encounters([route_four("shield")])

    get_encounters

    expect(response.parsed_body).to eq("status" => "none", "locations" => [])
  end

  it "says unavailable, not none, for a game PokeAPI has no encounters for" do
    game.update!(encounters_available: false)
    cache_encounters([])

    get_encounters

    expect(response.parsed_body).to eq("status" => "unavailable", "locations" => [])
  end

  it "reports pending and enqueues one warm-up when the payload is not cached" do
    expect {
      get_encounters
      get_encounters
    }.to have_enqueued_job(WarmEncountersJob).with(game.id, pokemon.id).exactly(:once)
    expect(response.parsed_body["status"]).to eq("pending")
  end

  it "reports pending until the game is settled, rather than none" do
    game.update!(encounters_available: nil)
    cache_encounters([])

    expect { get_encounters }.to have_enqueued_job(WarmEncountersJob)
    expect(response.parsed_body["status"]).to eq("pending")
  end

  it "requires a game" do
    get "/api/v1/pokemon/#{pokemon.id}/encounters"

    expect(response).to have_http_status(:bad_request)
  end

  it "returns 404 for an unknown Pokémon" do
    get "/api/v1/pokemon/999999999/encounters", params: {game_id: game.id}

    expect(response).to have_http_status(:not_found)
  end
end
