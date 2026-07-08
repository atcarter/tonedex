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

  def stale?(max_age: 24.hours)
    fetched_at < max_age.ago
  end
end
