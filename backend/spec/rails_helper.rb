require "spec_helper"
# Hard-set (not ||=): the Docker containers export RAILS_ENV=development via
# .env.local, which made `||=` silently run the suite against the development
# database. Specs must only ever run in the test environment.
ENV["RAILS_ENV"] = "test"
require_relative "../config/environment"
abort("The Rails environment is running in production mode!") if Rails.env.production?
require "rspec/rails"
require "shoulda/matchers"

Rails.root.glob("spec/support/**/*.rb").sort_by(&:to_s).each { |f| require f }

begin
  ActiveRecord::Migration.maintain_test_schema!
rescue ActiveRecord::PendingMigrationError => e
  abort e.to_s.strip
end

RSpec.configure do |config|
  config.fixture_paths = [Rails.root.join("spec/fixtures")]
  config.use_transactional_fixtures = true
  config.infer_spec_type_from_file_location!
  config.filter_rails_from_backtrace!

  config.include FactoryBot::Syntax::Methods

  # RSpec request specs default to www.example.com, which is blocked by
  # ActionDispatch::HostAuthorization. Override to localhost which is always allowed.
  config.before(:each, type: :request) do
    host! "localhost"
  end
end

Shoulda::Matchers.configure do |config|
  config.integrate do |with|
    with.test_framework :rspec
    with.library :rails
  end
end
