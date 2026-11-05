# Redis NX lock so concurrent requests can't stack duplicate seed jobs.
# The including job defines LOCK_TTL and lock_key, and calls release_lock when done.
module EnqueueOnce
  extend ActiveSupport::Concern

  class_methods do
    # The jobs are idempotent, so a lost lock only wastes work.
    def enqueue_once(*args, **kwargs)
      acquired = Sidekiq.redis do |redis|
        redis.set(lock_key(*args, **kwargs), "1", nx: true, ex: self::LOCK_TTL.to_i)
      end
      perform_later(*args, **kwargs) if acquired
    end

    def release_lock(*args, **kwargs)
      Sidekiq.redis { |redis| redis.del(lock_key(*args, **kwargs)) }
    end
  end
end
