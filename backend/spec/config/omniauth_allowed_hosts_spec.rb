require "rails_helper"

RSpec.describe OmniauthAllowedHosts do
  def env(name) = ActiveSupport::EnvironmentInquirer.new(name)

  it "restricts production to the ALLOWED_HOSTS list" do
    expect(described_class.from(env("production"), ["api.x"])).to eq(["api.x"])
  end

  it "allows any host in production when ALLOWED_HOSTS is unset" do
    expect(described_class.from(env("production"), [])).to be_nil
  end

  it "allows any host in development, whose config.hosts holds IP ranges OmniAuth can't match" do
    dev_hosts = ActionDispatch::HostAuthorization::ALLOWED_HOSTS_IN_DEVELOPMENT

    expect(described_class.from(env("development"), dev_hosts)).to be_nil
  end

  it "allows any host in test" do
    expect(described_class.from(env("test"), [])).to be_nil
  end
end
