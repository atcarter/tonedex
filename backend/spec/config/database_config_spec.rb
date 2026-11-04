require "rails_helper"

RSpec.describe "config/database.yml" do
  describe "production" do
    around do |example|
      original = ENV["DATABASE_URL"]
      ENV["DATABASE_URL"] = "postgres://u:p@db.example:5432/pokedex_production"
      example.run
    ensure
      ENV["DATABASE_URL"] = original
    end

    let(:configs) do
      yaml = ERB.new(Rails.root.join("config/database.yml").read).result
      ActiveRecord::DatabaseConfigurations
        .new(YAML.safe_load(yaml, aliases: true))
        .configs_for(env_name: "production")
    end

    it "is a single primary connection built from DATABASE_URL" do
      expect(configs.map(&:name)).to eq(["primary"])
      expect(configs.first.host).to eq("db.example")
      expect(configs.first.database).to eq("pokedex_production")
    end
  end
end
