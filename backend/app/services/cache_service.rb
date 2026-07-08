class CacheService
  class << self
    def fetch(key)
      ApiCache.fetch(key)
    end

    def store(key, data)
      ApiCache.store(key, data)
    end
  end
end
