"""
MCP Weather & Running Advisor Server (Dummy) using Streamable HTTP Transport
Dibuat dengan Python MCP SDK resmi (mcp>=2.0.0).
Menyediakan Tools Cuaca, Prompts Rencana Lari Pagi, dan Resources Panduan Lari Pagi.
"""

import os
import sys
import random
from typing import Literal

# Pastikan UTF-8 di Windows Console
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import mcp.types as types
from mcp.server import MCPServer
from mcp.server.streamable_http import TransportSecuritySettings

# Inisialisasi Server MCP
server = MCPServer(
    name="weather-running-server",
    version="1.1.0",
    description="MCP Server Cuaca & Asisten Lari Pagi (Weather & Running Advisor) dengan Streamable HTTP Transport"
)

# Dataset dummy cuaca kota-kota di Indonesia & Internasional
CITY_WEATHER_DATA = {
    "jakarta": {
        "condition": "Berawan Sebagian",
        "temp_c": 28,  # Suhu pagi hari
        "humidity": 78,
        "wind_speed_kmh": 12,
        "air_quality": {"aqi": 110, "status": "Tidak Sehat bagi Kelompok Sensitif"},
        "alerts": ["Waspada potensi hujan ringan menjelang siang hari."]
    },
    "bandung": {
        "condition": "Cerah Sejuk",
        "temp_c": 20,
        "humidity": 85,
        "wind_speed_kmh": 8,
        "air_quality": {"aqi": 42, "status": "Baik"},
        "alerts": []
    },
    "surabaya": {
        "condition": "Cerah",
        "temp_c": 29,
        "humidity": 70,
        "wind_speed_kmh": 15,
        "air_quality": {"aqi": 82, "status": "Sedang"},
        "alerts": ["Suhu meningkat cepat setelah pukul 07:30. Disarankan lari lebih awal."]
    },
    "bali": {
        "condition": "Cerah Berawan",
        "temp_c": 26,
        "humidity": 75,
        "wind_speed_kmh": 14,
        "air_quality": {"aqi": 30, "status": "Baik (Sangat Segar)"},
        "alerts": []
    },
    "yogyakarta": {
        "condition": "Cerah Berawan",
        "temp_c": 24,
        "humidity": 76,
        "wind_speed_kmh": 10,
        "air_quality": {"aqi": 55, "status": "Sedang"},
        "alerts": []
    },
    "medan": {
        "condition": "Berawan",
        "temp_c": 25,
        "humidity": 82,
        "wind_speed_kmh": 9,
        "air_quality": {"aqi": 48, "status": "Baik"},
        "alerts": []
    },
    "tokyo": {
        "condition": "Cerah Sejuk",
        "temp_c": 16,
        "humidity": 55,
        "wind_speed_kmh": 15,
        "air_quality": {"aqi": 25, "status": "Sangat Baik"},
        "alerts": []
    },
    "london": {
        "condition": "Gerimis Ringan",
        "temp_c": 13,
        "humidity": 88,
        "wind_speed_kmh": 14,
        "air_quality": {"aqi": 28, "status": "Baik"},
        "alerts": ["Jalanan licin di beberapa taman kota karena embun dan gerimis."]
    }
}

CONDITIONS_LIST = [
    "Cerah", "Cerah Sejuk", "Cerah Berawan", "Berawan Tebal", 
    "Hujan Ringan", "Hujan Sedang", "Hujan Lebat", "Badai Petir"
]


def _get_or_generate_city_data(city: str) -> dict:
    key = city.strip().lower()
    if key in CITY_WEATHER_DATA:
        return CITY_WEATHER_DATA[key]
    
    random.seed(key)
    temp_c = random.randint(21, 30)
    condition = random.choice(CONDITIONS_LIST)
    humidity = random.randint(65, 90)
    wind = random.randint(5, 25)
    aqi = random.randint(25, 140)
    
    if aqi <= 50:
        aqi_status = "Baik"
    elif aqi <= 100:
        aqi_status = "Sedang"
    elif aqi <= 150:
        aqi_status = "Tidak Sehat bagi Kelompok Sensitif"
    else:
        aqi_status = "Tidak Sehat"

    return {
        "condition": condition,
        "temp_c": temp_c,
        "humidity": humidity,
        "wind_speed_kmh": wind,
        "air_quality": {"aqi": aqi, "status": aqi_status},
        "alerts": ["Peringatan cuaca lokal."] if "Badai" in condition or "Lebat" in condition else []
    }


# ============================================================================
# 1. MCP TOOLS (Alat Pengecekan Cuaca & Kelayakan Lari)
# ============================================================================

@server.tool(
    name="get_current_weather",
    description="Mendapatkan informasi kondisi cuaca saat ini untuk kota tertentu seperti suhu, kelembaban, dan kecepatan angin."
)
def get_current_weather(
    city: str,
    unit: Literal["celsius", "fahrenheit"] = "celsius"
) -> types.TextContent:
    """Mengambil kondisi cuaca terkini untuk suatu kota."""
    data = _get_or_generate_city_data(city)
    temp = data["temp_c"]
    unit_symbol = "°C"
    
    if unit == "fahrenheit":
        temp = round((temp * 9/5) + 32, 1)
        unit_symbol = "°F"

    text = (
        f"🌤️ Cuaca di {city.title()}:\n"
        f"- Kondisi: {data['condition']}\n"
        f"- Suhu: {temp}{unit_symbol}\n"
        f"- Kelembaban: {data['humidity']}%\n"
        f"- Kecepatan Angin: {data['wind_speed_kmh']} km/jam"
    )
    return types.TextContent(type="text", text=text)


@server.tool(
    name="get_weather_forecast",
    description="Mendapatkan perkiraan cuaca selama beberapa hari ke depan (1-7 hari) untuk suatu kota."
)
def get_weather_forecast(
    city: str,
    days: int = 3
) -> types.TextContent:
    """Mengambil ramalan cuaca multi-hari untuk kota tertentu."""
    days = max(1, min(days, 7))
    base_data = _get_or_generate_city_data(city)
    
    forecast_lines = [f"📅 Ramalan Cuaca {days} Hari ke Depan untuk {city.title()}:"]
    
    for i in range(1, days + 1):
        random.seed(f"{city.lower()}-day-{i}")
        temp_min = base_data["temp_c"] - random.randint(2, 4)
        temp_max = base_data["temp_c"] + random.randint(2, 6)
        condition = random.choice(CONDITIONS_LIST)
        rain_prob = random.randint(10, 90)
        
        forecast_lines.append(
            f"• Hari +{i}: {condition} | Suhu: {temp_min}°C - {temp_max}°C | Peluang Hujan: {rain_prob}%"
        )

    return types.TextContent(type="text", text="\n".join(forecast_lines))


@server.tool(
    name="get_air_quality",
    description="Mendapatkan data kualitas udara (Air Quality Index / AQI) untuk kota tertentu."
)
def get_air_quality(city: str) -> types.TextContent:
    """Mengambil data indeks kualitas udara (AQI)."""
    data = _get_or_generate_city_data(city)
    aqi_info = data["air_quality"]
    
    text = (
        f"🍃 Kualitas Udara di {city.title()}:\n"
        f"- AQI: {aqi_info['aqi']}\n"
        f"- Kategori: {aqi_info['status']}"
    )
    return types.TextContent(type="text", text=text)


@server.tool(
    name="get_weather_alerts",
    description="Mengecek apakah ada peringatan dini cuaca ekstrem aktif untuk kota tertentu."
)
def get_weather_alerts(city: str) -> types.TextContent:
    """Mengambil peringatan cuaca dini untuk kota tertentu."""
    data = _get_or_generate_city_data(city)
    alerts = data.get("alerts", [])
    
    if not alerts:
        text = f"✅ Tidak ada peringatan cuaca aktif untuk wilayah {city.title()} saat ini. Kondisi relatif aman."
    else:
        alerts_str = "\n".join([f"⚠️ {alert}" for alert in alerts])
        text = f"🚨 PERINGATAN CUACA untuk {city.title()}:\n{alerts_str}"
    
    return types.TextContent(type="text", text=text)


@server.tool(
    name="check_morning_run_feasibility",
    description="Mengevaluasi kelayakan kondisi cuaca untuk lari pagi di suatu kota (skor kelayakan, outfit, waktu ideal, dan tips)."
)
def check_morning_run_feasibility(
    city: str,
    target_time: str = "06:00"
) -> types.TextContent:
    """Mengevaluasi kelayakan lari pagi berdasarkan cuaca, suhu, dan kualitas udara."""
    data = _get_or_generate_city_data(city)
    temp = data["temp_c"]
    aqi = data["air_quality"]["aqi"]
    condition = data["condition"]
    
    # Kalkulasi skor kelayakan (1-10)
    score = 10
    reasons = []
    
    if "Hujan Lebat" in condition or "Badai" in condition:
        score -= 7
        reasons.append("Hujan lebat / badai membahayakan keselamatan luar ruangan.")
    elif "Hujan Sedang" in condition:
        score -= 4
        reasons.append("Hujan sedang membuat jalanan licin dan visibilitas berkurang.")
    elif "Hujan Ringan" in condition or "Gerimis" in condition:
        score -= 2
        reasons.append("Gerimis/hujan ringan, disarankan memakai jaket windbreaker anti-air.")
        
    if aqi > 150:
        score -= 4
        reasons.append("Kualitas udara Tidak Sehat (AQI > 150), disarankan lari indoor / treadmill.")
    elif aqi > 100:
        score -= 2
        reasons.append("AQI agak tinggi (101-150), kurangi lari intensitas tinggi.")
        
    if temp > 30:
        score -= 2
        reasons.append("Suhu cukup tinggi, percepat jadwal lari ke pukul 05:30.")
    elif temp < 15:
        reasons.append("Suhu dingin, gunakan pakaian hangat / thermal running gear.")

    status_badge = "🟢 SANGAT DIREKOMENDASIKAN" if score >= 8 else ("🟡 COCOK DENGAN CATATAN" if score >= 5 else "🔴 TIDAK DIREKOMENDASIKAN (INDOOR SAJA)")

    tips = "\n".join([f"  • {r}" for r in reasons]) if reasons else "  • Kondisi cuaca dan udara sangat mendukung!"

    result_text = (
        f"🏃 Laporan Kelayakan Lari Pagi di {city.title()} (Pukul {target_time}):\n"
        f"Status: {status_badge} (Skor: {max(1, score)}/10)\n\n"
        f"📊 Parameter Lapangan:\n"
        f"- Suhu: {temp}°C | Kondisi: {condition}\n"
        f"- Kualitas Udara (AQI): {aqi} ({data['air_quality']['status']})\n"
        f"- Kecepatan Angin: {data['wind_speed_kmh']} km/jam | Kelembaban: {data['humidity']}%\n\n"
        f"💡 Catatan & Rekomendasi:\n{tips}"
    )
    return types.TextContent(type="text", text=result_text)


RESOURCES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "resources")


def _read_markdown_file(relative_path: str, fallback_content: str = "") -> str:
    """Helper untuk membaca file markdown resource dari disk."""
    file_path = os.path.join(RESOURCES_DIR, relative_path)
    if os.path.exists(file_path):
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                return f.read()
        except Exception as e:
            return f"Error membaca resource file {relative_path}: {e}"
    return fallback_content


# ============================================================================
# 2. MCP RESOURCES (Panduan Keselamatan & Spot Lari Pagi dari file .md)
# ============================================================================

@server.resource(
    uri="running://guidelines/safety",
    name="Panduan Keselamatan Lari Pagi Berdasarkan Cuaca",
    mime_type="text/markdown",
    description="Aturan keselamatan, batas suhu, ambang batas AQI, dan protokol hidrasi bagi pelari pagi."
)
def get_running_safety_guidelines() -> str:
    """Resource panduan keselamatan lari pagi (dibaca dari server/resources/safety_guidelines.md)."""
    return _read_markdown_file("safety_guidelines.md", fallback_content="# Panduan Lari Pagi")


@server.resource(
    uri="running://spots/{city}",
    name="Daftar Spot Lari Pagi Populer",
    mime_type="text/markdown",
    description="Daftar lokasi spot jogging dan lari pagi populer di kota pilihan."
)
def get_running_spots_by_city(city: str) -> str:
    """Resource spot lari per kota (dibaca dari server/resources/spots/{city}.md)."""
    key = city.strip().lower()
    city_file = f"spots/{key}.md"
    default_file = "spots/default.md"
    
    content = _read_markdown_file(city_file)
    if not content:
        content = _read_markdown_file(default_file, fallback_content=f"# Spot Lari Pagi di {city.title()}\n\nSilakan cari rute di taman kota atau stadion terdekat.")
    return content


# ============================================================================
# 3. MCP PROMPTS (Template Prompt untuk AI Agent)
# ============================================================================

@server.prompt(
    name="morning_run_advisor_prompt",
    description="Template prompt bagi agent untuk menganalisis cuaca dan menyusun rencana lari pagi yang dipersonalisasi."
)
def morning_run_advisor_prompt(
    city: str,
    target_distance_km: str = "5km",
    preferred_time: str = "06:00"
) -> str:
    """Prompt template untuk asisten rencana lari pagi."""
    return f"""Kamu adalah Asisten Ahli Lari Pagi & Kebugaran Berbasis Cuaca (Morning Run Coach).
Pengguna berencana melakukan lari pagi di kota **{city}** pada pukul **{preferred_time}** dengan target jarak **{target_distance_km}**.

Lakukan langkah-langkah berikut:
1. Gunakan tool `get_current_weather` dan `get_air_quality` untuk memeriksa suhu, kondisi langit, kelembaban, dan indeks kualitas udara di {city}.
2. Gunakan tool `check_morning_run_feasibility` untuk memperoleh skor kelayakan lari.
3. Baca resource `running://spots/{city.lower()}` untuk menyarankan lokasi lari terbaik.
4. Susun rencana lari yang meliputi:
   - Evaluasi kelayakan (Apakah aman lari di luar ruangan hari ini?)
   - Rekomendasi waktu mulai (start time) terbaik
   - Rekomendasi outfit & gear (sepatu, topi, sunscreen, hidrasi)
   - Strategi pacing dan rute lari yang disarankan."""


@server.prompt(
    name="quick_weather_run_brief",
    description="Prompt singkat untuk briefing kondisi lari pagi kilat sebelum pengguna keluar rumah."
)
def quick_weather_run_brief(city: str) -> str:
    """Prompt template briefing lari kilat."""
    return f"""Berikan briefing singkat (maksimal 3 poin) untuk pelari yang akan segera keluar rumah di {city}:
1. Cuaca & Suhu saat ini
2. Kualitas udara (AQI) & Keamanan bernapas
3. Satu tips krusial (misal: pakaian atau hidrasi)."""


# ============================================================================
# Server Runner
# ============================================================================

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Dummy Weather & Running MCP Server (Streamable HTTP)")
    parser.add_argument("--host", default=os.getenv("MCP_HOST", "127.0.0.1"), help="Host untuk binding (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=int(os.getenv("MCP_PORT", "8001")), help="Port untuk server (default: 8001)")
    parser.add_argument("--path", default=os.getenv("MCP_PATH", "/mcp"), help="Endpoint path (default: /mcp)")
    args = parser.parse_args()

    print(f"Memulai Weather & Running MCP Server dengan Streamable HTTP Transport...")
    print(f"URL Endpoint: http://{args.host}:{args.port}{args.path}")
    print(f"Transport: streamable-http")

    security_settings = TransportSecuritySettings(
        enable_dns_rebinding_protection=False
    )

    server.run(
        transport="streamable-http",
        host=args.host,
        port=args.port,
        streamable_http_path=args.path,
        transport_security=security_settings
    )
