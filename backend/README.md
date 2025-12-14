# Backend - FastAPI Retail Forecasting & Inventory

## Setup

### 1. Creează un virtual environment

```powershell
cd backend
python -m venv venv
```

### 2. Activează virtual environment

```powershell
.\venv\Scripts\Activate.ps1
```

### 3. Instalează dependencies

```powershell
pip install -r requirements.txt
```

### 4. Configurează `.env`

Fișierul `.env` este deja creat cu setările default. Modifică-l dacă e necesar.

### 5. Pornește MongoDB (Docker)

Din rădăcina proiectului:
```powershell
docker compose up -d
```

### 6. Rulează serverul

```powershell
python main.py
```

sau

```powershell
uvicorn main:app --reload
```

Serverul va porni pe `http://localhost:8000`

## API Documentation

După ce serverul pornește, accesează:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Structura proiectului

```
backend/
├── main.py              # Aplicația FastAPI principală
├── database.py          # Configurare MongoDB
├── models.py            # Modele Pydantic
├── requirements.txt     # Dependencies Python
├── .env                 # Environment variables
├── routers/             # API endpoints (de creat)
│   ├── auth.py
│   ├── products.py
│   ├── inventory.py
│   └── forecasting.py
└── utils/               # Utilități (de creat)
    ├── auth.py
    └── forecasting.py
```

## Next Steps

1. Creează folderul `routers/` cu endpoint-urile
2. Creează folderul `utils/` cu funcții helper
3. Implementează autentificarea
4. Implementează CRUD pentru products și inventory
5. Implementează algoritmii de forecasting
