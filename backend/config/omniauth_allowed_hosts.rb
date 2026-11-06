# OmniAuth's allowed_hosts for a Rails env and its config.hosts: production's list, or nil (allow any) when empty or not production.
module OmniauthAllowedHosts
  def self.from(env, hosts)
    hosts.presence if env.production?
  end
end
