# ADR-003 — Single Redis instance, multiple logical databases

**Date:** 2026-02-28
**Status:** Superseded in part (2026-07-09)

> **Status note (2026-07-09):** the Redis db/1 PokeAPI cache described below
> was later replaced by the Postgres `api_caches` table (the `ApiCache`
> model), and no `REDIS_CACHE_URL`/`CACHE_BACKEND` switch exists anymore.
> Redis now serves db/0 only: Sidekiq queues and the Rack::Attack throttle
> store. The single-instance/multiple-databases reasoning is kept for
> historical context.

## Context

Two Redis consumers exist in the application:

1. **Sidekiq** — job queues, retry sets, dead-job set.
2. **Rails cache** — PokeAPI response caching to reduce external calls.

Options considered:

| Option | Pros | Cons |
|---|---|---|
| One Redis instance, one database (db/0 for everything) | Simplest config | Sidekiq and cache keys share the same keyspace; a `FLUSHDB` clears both; no isolation |
| One Redis instance, separate logical databases | Key isolation, one container, minimal ops overhead | Both workloads share memory and CPU; eviction policy cannot differ per workload |
| Two Redis instances (separate containers) | Full isolation, independent eviction policies | Two containers to operate and monitor; more docker-compose complexity |

## Decision

Use **one Redis instance with two logical databases**:

- `redis://redis:6379/0` (`REDIS_URL`) — Sidekiq
- `redis://redis:6379/1` (`REDIS_CACHE_URL`) — Rails application cache

## Consequences

**Accepted trade-offs:**
- Both workloads compete for the same Redis memory and CPU. If the cache grows unboundedly it could impact job throughput.
- Redis logical databases do not support per-database `maxmemory-policy` settings; a global eviction policy applies to all databases.
- A single Redis failure takes out both job processing and caching simultaneously.

**Mitigations if load grows:**
- Set `maxmemory-policy noeviction` to protect Sidekiq data, and manage cache size explicitly via TTLs.
- Promote to two Redis instances if resource contention becomes measurable.
