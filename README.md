# 🏋️ GymTracker

A clean, minimal gym progress tracking app — **React Native (Expo)** mobile frontend + **Node.js/Express** REST API backend running on **Azure App Service** with an **Azure SQL Database**.

---

## Project Structure

```
Gym App/
├── backend/          ← Node.js Express API
│   ├── sql/
│   │   └── schema.sql       ← Run this first in Azure
│   ├── src/
│   │   ├── app.js
│   │   ├── config/database.js
│   │   └── routes/workouts.js
│   ├── .env.example
│   └── package.json
│
├── mobile/           ← React Native (Expo) app
│   ├── App.tsx
│   ├── src/
│   │   ├── screens/
│   │   │   ├── HomeScreen.tsx       ← Weekly view
│   │   │   ├── DayDetailScreen.tsx  ← Day's exercises
│   │   │   └── AddExerciseScreen.tsx
│   │   ├── components/
│   │   ├── services/api.ts          ← API calls
│   │   ├── config/index.ts          ← API URL config
│   │   ├── constants/colors.ts
│   │   ├── types/index.ts
│   │   └── utils/dateUtils.ts
│   └── package.json
│
└── README.md
```

---

## ☁️ Azure Setup (step by step)

### 1 — Create an Azure SQL Database

1. Open the [Azure Portal](https://portal.azure.com)
2. **Create a resource → SQL Database**
3. Fill in:
   - **Database name**: `GymAppDB`
   - **Server**: Create new → give it a name (e.g. `gymtracker-server`)
   - **Authentication**: SQL authentication — set a username and password
   - **Compute + storage**: "Basic" or "Serverless" is fine for personal use
4. After creation, go to **Networking** → **Firewall rules** → add your IP address
5. Open **Query editor** in the portal, sign in, and paste + run the contents of `backend/sql/schema.sql`

### 2 — Create an Azure App Service (for the API)

1. **Create a resource → Web App**
2. Settings:
   - **Runtime stack**: Node 20 LTS
   - **OS**: Linux
   - **SKU**: Free F1 (fine for personal use)
3. After creation, go to **Configuration → Application settings** and add:

   | Name                  | Value                                      |
   |-----------------------|--------------------------------------------|
   | `AZURE_SQL_SERVER`    | `your-server.database.windows.net`         |
   | `AZURE_SQL_DATABASE`  | `GymAppDB`                                 |
   | `AZURE_SQL_USER`      | *(your SQL admin username)*                |
   | `AZURE_SQL_PASSWORD`  | *(your SQL admin password)*                |
   | `NODE_ENV`            | `production`                               |
   | `ALLOWED_ORIGINS`     | `*`                                        |

4. Deploy the `backend/` folder to App Service (see Deployment section below)

### 3 — Point the mobile app at Azure

Edit `mobile/src/config/index.ts`:
```typescript
const PROD_API_URL = 'https://YOUR_APP_NAME.azurewebsites.net/api';
```

---

## 🚀 Running Locally

### Backend

```bash
cd backend
npm install
cp .env.example .env        # fill in your Azure SQL credentials
npm run dev                 # runs on http://localhost:3000
```

Test it: `http://localhost:3000/health`

### Mobile app

```bash
cd mobile
npm install
npx expo start
```

Then:
- Press **`a`** to open Android emulator
- Press **`i`** to open iOS simulator  
- Scan the QR code with the **Expo Go** app on your phone

> **Local dev note**: The default API URL in `mobile/src/config/index.ts` points to `10.0.2.2:3000`
> (Android emulator's alias for your machine's localhost).
> - **iOS simulator**: change to `127.0.0.1:3000`
> - **Physical device**: change to your machine's LAN IP (find it with `ipconfig`)

---

## 📦 Deploying the Backend to Azure

### Option A — Azure CLI (recommended)

```bash
cd backend
az webapp up \
  --name YOUR_APP_NAME \
  --resource-group YOUR_RG \
  --runtime "NODE:20-lts" \
  --sku F1
```

### Option B — ZIP deploy via portal

1. Zip the `backend/` folder (exclude `node_modules/` and `.env`)
2. Portal → App Service → **Advanced Tools (Kudu)** → Zip push deploy

---

## ✨ Features

| Feature | Details |
|---------|---------|
| **Weekly view** | Mon–Sun grid showing exercise count per day |
| **Week navigation** | ← → arrows to browse any past or future week |
| **Week number** | ISO week number shown prominently |
| **Log exercise** | Name, sets, reps (optional), weight, KG/LBS toggle |
| **Edit exercise** | Tap any exercise to edit it in-place |
| **Delete exercise** | Swipe-style delete with confirmation |
| **Unit memory** | Remembers your last used unit (KG or LBS) |
| **Notes field** | Optional per-exercise notes |

---

## 🗄️ API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/api/workouts?startDate=&endDate=` | Weekly exercises |
| `GET` | `/api/workouts/day?date=` | Single day |
| `POST` | `/api/workouts` | Create exercise |
| `PUT` | `/api/workouts/:id` | Update exercise |
| `DELETE` | `/api/workouts/:id` | Delete exercise |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile | React Native + Expo SDK 51 |
| Navigation | React Navigation v6 |
| Backend | Node.js + Express |
| Database | Azure SQL (SQL Server) |
| Hosting | Azure App Service |
| HTTP client | Axios |
