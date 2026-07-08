require "rails_helper"

RSpec.describe "Moves API", type: :request do
  let(:adapter) { instance_double(PokeapiAdapter) }

  before { allow(PokeapiAdapter).to receive(:new).and_return(adapter) }

  describe "GET /api/v1/moves/:id" do
    it "returns the move details" do
      move = Move.create!(
        pokeapi_id: 1_000_052, name: "ember", move_type: "fire",
        power: 40, accuracy: 100, pp: 25, damage_class: "special"
      )
      allow(adapter).to receive(:find_or_create_move).with("ember").and_return(move)

      get "/api/v1/moves/ember"

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body).to include(
        "name" => "ember", "type" => "fire", "power" => 40,
        "accuracy" => 100, "pp" => 25, "damage_class" => "special"
      )
    end

    it "returns 404 when the move does not exist upstream" do
      allow(adapter).to receive(:find_or_create_move)
        .and_raise(PokeapiClient::NotFoundError.new("PokeAPI returned 404 for /move/garbage"))

      get "/api/v1/moves/garbage"

      expect(response).to have_http_status(:not_found)
      expect(response.parsed_body["error"]).to match(/404/)
    end
  end
end
