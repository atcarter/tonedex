require "rails_helper"

RSpec.describe SpriteStore do
  let(:tmp_root) { Pathname.new(Dir.mktmpdir) }

  before { allow(SpriteStore).to receive(:public_root).and_return(tmp_root) }
  after { FileUtils.remove_entry(tmp_root) }

  let(:pokemon) do
    build(:pokemon,
      pokeapi_id: 1_000_025,
      sprite_url: "https://sprites.example.com/25.png",
      shiny_sprite_url: "https://sprites.example.com/shiny/25.png")
  end

  def response_double(code: 200, body: "PNG")
    double("HTTParty::Response", code: code, success?: code < 400, body: body)
  end

  describe ".mirror!" do
    it "downloads both sprites to disk and is idempotent" do
      allow(HTTParty).to receive(:get).and_return(response_double)

      expect(described_class.mirror!(pokemon)).to eq(2)
      expect(tmp_root.join("sprites/1000025.png")).to be_file
      expect(tmp_root.join("sprites/shiny/1000025.png")).to be_file

      # Second run finds the files and downloads nothing
      expect(described_class.mirror!(pokemon)).to eq(0)
      expect(HTTParty).to have_received(:get).twice
    end

    it "skips blank URLs" do
      pokemon.shiny_sprite_url = nil
      allow(HTTParty).to receive(:get).and_return(response_double)

      expect(described_class.mirror!(pokemon)).to eq(1)
      expect(tmp_root.join("sprites/shiny/1000025.png")).not_to be_file
    end

    it "leaves no file behind on a failed download" do
      allow(HTTParty).to receive(:get).and_return(response_double(code: 429))

      expect(described_class.mirror!(pokemon)).to eq(0)
      expect(tmp_root.join("sprites/1000025.png")).not_to be_file
    end

    it "survives network errors" do
      allow(HTTParty).to receive(:get).and_raise(Net::ReadTimeout)

      expect(described_class.mirror!(pokemon)).to eq(0)
    end
  end

  describe ".url_for" do
    it "returns the original URL when nothing is mirrored" do
      expect(described_class.url_for(pokemon, "http://localhost:3000"))
        .to eq("https://sprites.example.com/25.png")
    end

    it "returns the mirrored URL rooted at base_url once the file exists" do
      allow(HTTParty).to receive(:get).and_return(response_double)
      described_class.mirror!(pokemon)

      expect(described_class.url_for(pokemon, "http://localhost:3000"))
        .to eq("http://localhost:3000/sprites/1000025.png")
      expect(described_class.url_for(pokemon, "http://localhost:3000/", shiny: true))
        .to eq("http://localhost:3000/sprites/shiny/1000025.png")
    end

    it "returns the original URL when no base_url is given" do
      allow(HTTParty).to receive(:get).and_return(response_double)
      described_class.mirror!(pokemon)

      expect(described_class.url_for(pokemon, nil))
        .to eq("https://sprites.example.com/25.png")
    end

    it "passes nil through for pokemon without a sprite" do
      pokemon.sprite_url = nil
      expect(described_class.url_for(pokemon, "http://localhost:3000")).to be_nil
    end
  end
end
