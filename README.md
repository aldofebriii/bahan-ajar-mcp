# Bahan Ajar MCP (Model Context Protocol)

Repositori ini adalah bahan ajar (teaching material) yang mendemonstrasikan cara kerja dan implementasi **Model Context Protocol (MCP)**. Proyek ini berisi contoh implementasi lengkap mulai dari sisi antarmuka pengguna (Frontend), sisi klien (LLM Agent), hingga beberapa server MCP baik dalam bahasa TypeScript maupun Python.

## 📁 Struktur Proyek & Penjelasan File

Secara garis besar, proyek ini terbagi menjadi antarmuka klien (Frontend), sistem agen penghubung (Agent/Chat API), dan beberapa implementasi MCP Server.

```text
bahan-ajar-mcp/
├── frontend/                   # 🖥️ Antarmuka Pengguna (Vite + React)
│   ├── package.json            # Dependencies frontend.
│   └── src/                    # Source code UI untuk chat dan interaksi.
├── src/                        # 💻 TypeScript Implementation (Client & Server)
│   ├── agent.ts                # Entry point API Express untuk Chat Agent. Berjalan di port 8000.
│   ├── chat.ts                 # Logika MCP Client dan integrasi ke OpenAI/OpenRouter LLM. Mengatur kapan AI harus memanggil tool dari MCP.
│   └── server.ts               # Implementasi contoh MCP Server (graph-viz) dalam TypeScript menggunakan @modelcontextprotocol/node.
├── server/                     # 🐍 Python Implementation (MCP Servers)
│   ├── excel-frame/            # Contoh MCP Server Python (pakai DuckDB) untuk berinteraksi dan membaca file Excel.
│   └── weather-dummy/          # Contoh MCP Server Python yang menyediakan data cuaca dummy untuk LLM.
├── .env                        # Konfigurasi environment (harus dibuat manual).
├── package.json                # Dependencies utama untuk proyek Node.js/TypeScript (Agent & TS Server).
└── requirements.txt            # Dependencies utama untuk menjalankan semua proyek Python MCP Server.
```

## 🛠️ Prasyarat (Requirements)

Untuk menjalankan keseluruhan proyek ini, pastikan sistem Anda telah terinstal perangkat lunak berikut:

### 1. Node.js (v18 atau lebih baru)
- Diperlukan untuk menjalankan Frontend, Chat API (`agent.ts`), dan TS MCP Server (`server.ts`).
- Digunakan melalui perintah `npm`.

### 2. Python (v3.10 atau lebih baru)
- Diperlukan untuk menjalankan implementasi MCP Server yang ada di dalam direktori `server/`.
- Membutuhkan module seperti `mcp`, `uvicorn`, `starlette`, dll. (Tercatat dalam `requirements.txt`).

## 🔐 Konfigurasi Environment (`.env`)

Buat sebuah file bernama `.env` pada *root* direktori proyek. File ini diperlukan agar AI Agent (`src/agent.ts` & `src/chat.ts`) dapat memanggil model LLM via API OpenAI / OpenRouter.

Berikut adalah contoh konfigurasi yang dibutuhkan:

```env
# Mode Environment
ENV=DEV

# Port untuk menjalankan Chat API Express Server (agent.ts)
PORT=8000

# Base URL API (Contoh ini menggunakan OpenRouter. Untuk OpenAI resmi, abaikan atau sesuaikan)
OPENAI_BASE_URL=https://openrouter.ai/api/v1

# API Key untuk Provider LLM (Wajib diisi sesuai platform yang Anda gunakan)
OPENAI_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxxx
```

## 🚀 Cara Instalasi & Menjalankan

Proyek ini memiliki 3 komponen utama yang dapat dijalankan. Anda perlu membuka **terminal/Command Prompt baru** untuk masing-masing proses di bawah ini:

### 1. Menjalankan Agent API Server (Node.js)
Server ini menghubungkan Frontend ke OpenAI dan mengatur komunikasi dengan MCP Server.
```bash
# Install dependencies Node.js di root
npm install

# Jalankan Agent API (berjalan di localhost:8000)
npm run dev
```

### 2. Menjalankan Frontend (Vite + React)
Aplikasi antarmuka web bagi pengguna untuk berinteraksi dengan AI.
```bash
# Masuk ke direktori frontend
cd frontend

# Install dependencies frontend
npm install

# Jalankan development server untuk frontend
npm run dev
```

### 3. Menjalankan Python MCP Servers
Server ini berfungsi sebagai penyedia *tools* tambahan bagi LLM. Anda bisa menjalankan server mana saja yang ingin dicoba.
```bash
# Kembali ke root folder (jika masih di frontend)
cd ..

# Buat dan aktifkan Virtual Environment Python
python -m venv .venv

# Aktifkan untuk Windows:
.venv\Scripts\activate
# ATAU untuk MacOS/Linux:
source .venv/bin/activate

# Install semua dependencies Python MCP
pip install -r requirements.txt

# Jalankan salah satu Server Python (Contoh: weather-dummy)
cd server/weather-dummy
python server.py
```

*(Opsional)* Jika Anda ingin menjalankan **TypeScript MCP Server (graph-viz)**:
```bash
# Dari root folder proyek, jalankan:
npx tsx ./src/server.ts
```
