require "rails_helper"

RSpec.describe PokeapiClient do
  let(:cache) { class_double(ApiCache, fetch: nil, store: nil) }
  let(:client) { described_class.new(cache: cache) }

  # Retries back off with real sleeps — stub them out so specs stay fast
  before { allow(client).to receive(:sleep) }

  def response_double(code:, body: {})
    double("HTTParty::Response", code: code, success?: code < 400, parsed_response: body)
  end

  describe "#fetch (via #pokemon)" do
    it "returns cached data without hitting the network" do
      allow(cache).to receive(:fetch).with("/pokemon/25").and_return({"name" => "pikachu"})

      expect(HTTParty).not_to receive(:get)
      expect(client.pokemon(25)).to eq({"name" => "pikachu"})
    end

    it "fetches with explicit timeouts and stores the response on a cache miss" do
      response = response_double(code: 200, body: {"name" => "pikachu"})
      allow(HTTParty).to receive(:get)
        .with("#{described_class::BASE_URL}/pokemon/25",
          open_timeout: described_class::OPEN_TIMEOUT,
          read_timeout: described_class::READ_TIMEOUT)
        .and_return(response)

      expect(client.pokemon(25)).to eq({"name" => "pikachu"})
      expect(cache).to have_received(:store).with("/pokemon/25", {"name" => "pikachu"})
    end

    it "raises NotFoundError on 404 and negative-caches the miss" do
      allow(HTTParty).to receive(:get).and_return(response_double(code: 404))

      expect { client.pokemon("garbage") }.to raise_error(described_class::NotFoundError)
      expect(cache).to have_received(:store)
        .with("/pokemon/garbage", described_class::NOT_FOUND_SENTINEL)
    end

    it "raises NotFoundError from a cached negative entry without hitting the network" do
      allow(cache).to receive(:fetch).with("/pokemon/garbage")
        .and_return(described_class::NOT_FOUND_SENTINEL.dup)

      expect(HTTParty).not_to receive(:get)
      expect { client.pokemon("garbage") }.to raise_error(described_class::NotFoundError, /cached/)
    end

    it "raises ApiError on other client errors" do
      allow(HTTParty).to receive(:get).and_return(response_double(code: 400))

      expect { client.pokemon(25) }.to raise_error(described_class::ApiError)
    end
  end

  describe "retry behaviour" do
    it "retries transient network errors and succeeds" do
      ok = response_double(code: 200, body: {"name" => "pikachu"})
      allow(HTTParty).to receive(:get).and_invoke(
        ->(*) { raise Net::ReadTimeout },
        ->(*) { ok }
      )

      expect(client.pokemon(25)).to eq({"name" => "pikachu"})
      expect(HTTParty).to have_received(:get).twice
    end

    it "raises ApiError after exhausting retries on network errors" do
      allow(HTTParty).to receive(:get).and_raise(Net::OpenTimeout)

      expect { client.pokemon(25) }.to raise_error(described_class::ApiError, /request failed/)
      expect(HTTParty).to have_received(:get).exactly(described_class::MAX_RETRIES + 1).times
    end

    it "retries 5xx responses and succeeds" do
      allow(HTTParty).to receive(:get).and_return(
        response_double(code: 503),
        response_double(code: 200, body: {"name" => "pikachu"})
      )

      expect(client.pokemon(25)).to eq({"name" => "pikachu"})
      expect(HTTParty).to have_received(:get).twice
    end

    it "raises ApiError when 5xx persists past the retry budget" do
      allow(HTTParty).to receive(:get).and_return(response_double(code: 503))

      expect { client.pokemon(25) }.to raise_error(described_class::ApiError, /returned 503/)
      expect(HTTParty).to have_received(:get).exactly(described_class::MAX_RETRIES + 1).times
    end
  end
end
