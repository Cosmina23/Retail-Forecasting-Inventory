# 🔗 Cum să conectezi toate componentele

Am configurat toate sistemele să comunice între ele! Iată cum funcționează:

## 📊 Arhitectura sistemului

```
┌─────────────┐      HTTP/REST      ┌─────────────┐      MongoDB      ┌─────────────┐
│  Frontend   │ ←─────────────────→ │   Backend   │ ←───────────────→ │  Database   │
│  (React +   │  API Calls (JSON)   │  (FastAPI)  │  pymongo          │  (MongoDB)  │
│   Vite)     │                     │             │                   │   Docker    │
└─────────────┘                     └─────────────┘                   └─────────────┘
  Port: 5173                          Port: 8000                        Port: 27017
```

## 🚀 Pași pentru a rula totul

### 1️⃣ Pornește MongoDB
```powershell
cd "C:\Users\cosmi\OneDrive\IMAGE\DOCS\Savnet Atos\New folder\Retail-Forecasting-Inventory"
docker compose up -d
```

### 2️⃣ Pornește Backend-ul (FastAPI)
```powershell
cd backend
.\venv\Scripts\Activate.ps1
python main.py
```
Backend va rula pe: **http://localhost:8000**

### 3️⃣ Pornește Frontend-ul (React)
Într-un terminal nou:
```powershell
cd frontend
npm run dev
# sau: bun dev
```
Frontend va rula pe: **http://localhost:5173**

## 🔌 Cum comunică componentele

### Frontend → Backend
- **Service Layer**: [api.ts](frontend/src/services/api.ts) gestionează toate request-urile HTTP
- **Authentication**: Token JWT salvat în localStorage
- **Headers**: Fiecare request include `Authorization: Bearer <token>`

### Backend → Database
- **Connection**: [database.py](backend/database.py) folosește pymongo
- **Collections**: users, products, sales, inventory, forecasts
- **Connection String**: definită în [.env](backend/.env)

### Flow-ul de autentificare
```
1. User se înregistrează/loginează pe frontend
2. Frontend trimite email + password către /api/auth/login
3. Backend verifică în MongoDB
4. Backend returnează JWT token
5. Frontend salvează token-ul în localStorage
6. Toate request-urile ulterioare includ token-ul
```

## 📝 API Endpoints disponibile

### Authentication
- `POST /api/auth/register` - Înregistrare utilizator nou
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Informații utilizator curent

### Products (necesită autentificare)
- `GET /api/products/` - Lista de produse
- `GET /api/products/{id}` - Un produs specific
- `POST /api/products/` - Creare produs nou
- `PUT /api/products/{id}` - Update produs
- `DELETE /api/products/{id}` - Ștergere produs

## 🧪 Testare

### 1. Testează backend-ul direct
Accesează **http://localhost:8000/docs** pentru Swagger UI interactiv

### 2. Testează flow-ul complet
1. Deschide **http://localhost:5173**
2. Înregistrează un cont nou
3. Login cu credențialele create
4. Navighează prin aplicație

## 🔍 Verificare conexiuni

### Verifică MongoDB
```powershell
docker compose ps
# Ar trebui să vezi containerul "mongo" running
```

### Verifică Backend
```powershell
# Accesează:
curl http://localhost:8000/health
# Sau deschide în browser: http://localhost:8000
```

### Verifică Frontend
```powershell
# Ar trebui să se deschidă automat browserul
# Sau accesează manual: http://localhost:5173
```

## 🛠️ Debugging

### Problemă: CORS errors
✅ **Soluție**: Backend-ul este configurat cu CORS pentru `http://localhost:5173`

### Problemă: 401 Unauthorized
✅ **Verifică**: Token-ul este salvat în localStorage
✅ **Acțiune**: Logout și login din nou

### Problemă: MongoDB connection failed
✅ **Verifică**: Docker container pornit: `docker compose ps`
✅ **Verifică**: Connection string în [backend/.env](backend/.env)

## 📦 Ce fișiere au fost create/modificate

### Backend:
- [main.py](backend/main.py) - Aplicația FastAPI cu CORS
- [routers/auth.py](backend/routers/auth.py) - Endpoints autentificare
- [routers/products.py](backend/routers/products.py) - Endpoints produse
- [utils/auth.py](backend/utils/auth.py) - JWT și password hashing
- [database.py](backend/database.py) - Conexiune MongoDB
- [models.py](backend/models.py) - Modele Pydantic

### Frontend:
- [services/api.ts](frontend/src/services/api.ts) - Service pentru API calls
- [pages/Login.tsx](frontend/src/pages/Login.tsx) - Login conectat la API
- [pages/Register.tsx](frontend/src/pages/Register.tsx) - Register conectat la API
- [.env](frontend/.env) - URL backend API

## 🎯 Next Steps

1. ✅ Sistemele sunt conectate
2. 📝 Poți adăuga mai multe endpoints (inventory, forecasting)
3. 🎨 Poți îmbunătăți UI/UX
4. 🔒 Poți adăuga validări suplimentare
5. 📊 Poți implementa algoritmii de forecasting
