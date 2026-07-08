# Permanent cache of raw PokeAPI responses, keyed by endpoint path.
#
# Policy: entries are immutable — PokeAPI data for released games is static,
# so each endpoint is fetched at most once, forever (404s included, via
# PokeapiClient::NOT_FOUND_SENTINEL). If upstream data must be re-pulled
# (e.g. sprite fixes), delete the affected rows and let them re-fetch:
#   ApiCache.where("endpoint LIKE '/pokemon/%'").delete_all
class ApiCache < ApplicationRecord
  validates :endpoint, presence: true, uniqueness: true
  validates :response_data, presence: true

  def self.fetch(endpoint)
    find_by(endpoint: endpoint)&.response_data
  end

  def self.store(endpoint, data)
    record = find_or_initialize_by(endpoint: endpoint)
    record.update!(response_data: data, fetched_at: Time.current)
    record
  end
end
