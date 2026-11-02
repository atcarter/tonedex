# ADR-001 — Sidekiq over solid_queue

**Date:** 2026-02-28
**Status:** Accepted

## Context

Background jobs are needed for Pokémon data seeding. Rails 8 ships with `solid_queue`, which uses the existing Postgres database as its queue backend and requires no additional infrastructure. The project already runs Redis for caching.

Two options were considered:

| | solid_queue | Sidekiq |
|---|---|---|
| Queue backend | Postgres | Redis |
| Extra infrastructure | None | Redis (already present) |
| Web UI | None built-in | Built-in at `/sidekiq` |
| Dead-job handling | Basic | Retry queues, dead set, configurable back-off |
| Queue priorities | Limited | Named queues with per-queue concurrency |
| Community / ecosystem | Growing | Mature (10+ years) |

## Decision

Use **Sidekiq 8** with Redis. Remove `solid_queue` from the `Gemfile` and all related configuration.

## Consequences

**Accepted trade-offs:**
- Redis is now a hard runtime dependency. If Redis goes down, job processing stops (though Rails request serving is unaffected).
- Redis persistence must be configured separately to avoid losing queued jobs on container restart. (Since done for Docker Compose, which runs Redis with AOF; production depends on the Key Value plan, see ADR-008.)
- The Sidekiq Web UI at `/sidekiq` must be secured before any public deploy (since done: see ADR-006).

**Benefits gained:**
- Proven reliability at scale with a large community.
- Built-in retry logic with exponential back-off and a dead-job set.
- Named queues (`:default`, `:low`) with independent concurrency settings.
- Web UI for monitoring and manually retrying jobs without Rails console access.
