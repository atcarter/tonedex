# syntax=docker/dockerfile:1

FROM node:22-slim AS base
WORKDIR /app

# ==============================================================================
# Development stage
# ==============================================================================
FROM base AS development

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host"]
