# MongoDB (Docker) — Setup & quick start

This file explains how to run MongoDB locally using Docker Compose for development. The compose file and an example env file are included in the repository.

Files added:
- `docker-compose.yml` — starts a MongoDB 6.0 container with a persistent volume.
- `.env.example` — sample environment variables. Copy to `.env` and edit if needed.

Default credentials (from `.env.example`):
- username: `admin`
- password: `password`
- database: `retail_db`

Important: If you provide `MONGO_URI` in your environment (or a `.env` file), use that for apps/scripts. Otherwise, apps can use the local default:
`mongodb://admin:password@localhost:27017/?authSource=admin`

PowerShell quick start (from the project root):
```powershell
# (1) Copy .env.example to .env and edit if you want
Copy-Item .env.example .env -Force

# (2) Start MongoDB with Docker Compose
docker compose up -d

# (3) Check container status
docker compose ps

# (4) View logs (follow)
docker compose logs -f mongo

# (5) To stop and remove containers
docker compose down
```

Notes for developers
- Use the `MONGO_URI` env var in your local environment or in your app config. Example (PowerShell session):
```powershell
$env:MONGO_URI = "mongodb://admin:password@localhost:27017/?authSource=admin"
```
- If you later decide to use MongoDB Atlas, replace `MONGO_URI` with your Atlas connection string.

Persistence and data
- The `docker-compose.yml` declares a Docker volume named `retail_mongo_data` so data persists across container restarts.

Security and production
- The included setup is for local development only. For production, use secure credentials, network rules, and backups. Consider a managed provider (Atlas) or self-hosted Mongo behind proper firewalling.

Next steps (optional)
- Add a data-seeding script to populate `products` and `sales` collections