# React + FastAPI Setup & Run Instructions

This project is split into two parts:
- **Backend**: FastAPI application (Python) running on port 8000
- **Frontend**: React + Vite application (Node.js) running on port 5173
- **Database**: MongoDB running in Docker on port 27017

All three services can run together locally on your development machine.

---

## Prerequisites

1. **Docker & Docker Compose** — for MongoDB
2. **Python 3.9+** — for the FastAPI backend
3. **Node.js 16+** — for the React frontend

Verify installations:
```powershell
docker --version
docker compose --version
python --version
node --version
```

---

## Step 1: Start MongoDB (Docker)

From the project root:

```powershell
# Start MongoDB container in background
docker compose up -d

# Verify it's running
docker compose ps

# Check logs (optional)
docker compose logs -f mongo
```

MongoDB will be accessible at:
- **Local**: `mongodb://admin:password@localhost:27017/?authSource=admin`
- **Database name**: `retail_db`

To stop MongoDB:
```powershell
docker compose down
```

---

## Step 2: Set Up and Run the FastAPI Backend

```powershell
# Navigate to backend folder
cd backend

# Create a virtual environment (optional but recommended)
python -m venv venv
.\venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Copy .env.example to .env and edit if needed (optional)
Copy-Item .env.example .env -Force

# Run the FastAPI server
uvicorn main:app --reload --port 8000
```

The API will be available at:
- **Base URL**: `http://localhost:8000`
- **API docs (Swagger UI)**: `http://localhost:8000/docs`
- **OpenAPI schema**: `http://localhost:8000/openapi.json`
- **Health check**: `http://localhost:8000/health`

Endpoints:
- `GET /api/products/` — list all products
- `GET /api/products/{sku}` — get product by SKU
- `GET /api/products/category/{category}` — products in a category
- `GET /api/sales/` — list recent sales
- `GET /api/sales/sku/{sku}` — sales for a specific SKU
- `GET /api/sales/summary` — sales summary with aggregation
- `GET /health` — API and database health check

---

## Step 3: Set Up and Run the React Frontend

In a **new PowerShell terminal**:

```powershell
# Navigate to frontend folder
cd frontend

# Copy .env.example to .env (optional, default already works)
Copy-Item .env.example .env -Force

# Install dependencies
npm install

# Start the development server
npm run dev
```

The frontend will be available at:
- **URL**: `http://localhost:5173`

The Vite dev server is configured to proxy API calls from `/api` to `http://localhost:8000/api`.

---

## Step 4: Verify Everything is Connected

1. Open `http://localhost:5173` in your browser.
2. Navigate to the **Dashboard** page.
3. You should see:
   - API Status: `ok`
   - Database: `connected`
   - Sales summary table (if you have data in the database)

If you see errors, check:
- MongoDB container is running: `docker compose ps`
- Backend is running on port 8000: visit `http://localhost:8000/health`
- Frontend console logs (F12 in browser)

---

## Populating Sample Data

Right now, the database is empty. You have two options:

### Option A: Use a Seeding Script (Coming Soon)
I can provide a Python script to generate realistic synthetic sales data.

### Option B: Load from Excel
I can create a script to load data from your Excel file into MongoDB. Provide:
1. The Excel file path
2. The sheet names and column mappings
3. Which collection(s) to insert into

---

## Quick Reference: Terminal Setup

**Terminal 1 — MongoDB** (stays running):
```powershell
cd C:\Users\flavia\Desktop\Academy\Retail-Forecasting-Inventory
docker compose up -d
docker compose logs -f mongo
```

**Terminal 2 — FastAPI Backend** (stays running):
```powershell
cd C:\Users\flavia\Desktop\Academy\Retail-Forecasting-Inventory\backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Terminal 3 — React Frontend** (stays running):
```powershell
cd C:\Users\flavia\Desktop\Academy\Retail-Forecasting-Inventory\frontend
npm install
npm run dev
```

Then open `http://localhost:5173` in your browser.

---

## Build for Production

### Backend
```powershell
cd backend
# Dockerfile or deploy with: gunicorn -w 4 -b 0.0.0.0:8000 main:app
```

### Frontend
```powershell
cd frontend
npm run build
# Outputs to frontend/dist/
# Serve with: npx serve -s dist
```

---

## Troubleshooting

**Issue**: Backend fails to connect to MongoDB
- Ensure Docker container is running: `docker compose ps`
- Verify MongoDB is listening: `docker compose logs mongo`
- Check `MONGO_URI` in `backend/.env`

**Issue**: Frontend can't reach the API
- Check backend is running on port 8000
- Verify CORS is enabled in `backend/main.py`
- Check browser console (F12) for network errors

**Issue**: Port already in use
- MongoDB (27017): `netstat -ano | findstr :27017`
- FastAPI (8000): `netstat -ano | findstr :8000`
- React (5173): `netstat -ano | findstr :5173`
- Kill process: `taskkill /PID <PID> /F`

**Issue**: npm packages won't install
- Delete `node_modules/` and `package-lock.json`, then try again
- Ensure Node.js is properly installed

---

## Environment Variables

### Backend (`backend/.env`)
```dotenv
MONGO_URI=mongodb://admin:password@localhost:27017/?authSource=admin
MONGO_INITDB_DATABASE=retail_db
API_HOST=0.0.0.0
API_PORT=8000
DEBUG=True
```

### Frontend (`frontend/.env`)
```dotenv
VITE_API_BASE_URL=http://localhost:8000/api
```

---

## Next Steps

1. Populate the database with sample or real data
2. Add more features (forecasting, inventory optimization, chat interface)
3. Deploy to the cloud (Azure App Service, AWS, etc.)
