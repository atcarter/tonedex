# Pokedex

A game-specific Pokedex application for looking up Pokemon information while playing.

## Tech Stack

- **Backend:** Ruby on Rails 8 (API mode)
- **Frontend:** React + TypeScript + Vite
- **Database:** PostgreSQL
- **Data Source:** [PokeAPI REST v2](https://pokeapi.co/api/v2/)

## Features

- Select a Pokemon game to view its regional Pokedex
- Look up Pokemon details: types, stats, moves (with learn levels), evolution chains
- Game-specific data (e.g., which moves are available in which games)

## Getting Started

### Prerequisites

- Docker and Docker Compose

### Running Locally

```bash
docker-compose up --build
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3000

## Project Structure

```
pokedex/
├── backend/          # Rails 8 API
├── frontend/         # React + TypeScript + Vite
└── docker-compose.yml
```

## Development Principles

This project follows:
- **SOLID** - Single responsibility, clean interfaces
- **DRY** - Don't repeat yourself
- **YAGNI** - You ain't gonna need it (no premature optimization)
- **Monolith first** - Start simple, extract services only when needed
