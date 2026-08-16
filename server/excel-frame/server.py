import os
from mcp.server import MCPServer
from mcp.server.transport_security import TransportSecuritySettings
import argparse
import duckdb

server = MCPServer(name='excel-frame', version='0.0.1', description='MCP Server untuk eksplorasi data excel menggunakan duckdb')

# Inisialisasi koneksi DuckDB secara global agar bisa diakses oleh fungsi tools
conn = duckdb.connect("my_data.db")

@server.tool(name='list_data_sources', description='List datasource yang terhubung dengan DuckDB')
def list_data_sources() -> list[str]:
    """
    Menampilkan daftar semua tabel (data source) yang tersedia di database DuckDB.
    
    Returns:
        List string berisi nama-nama tabel/view.
    """
    try:
        # Menjalankan query SHOW TABLES untuk mendapatkan daftar tabel
        result = conn.execute("SHOW TABLES").fetchall()
        #fetchall() mengembalikan list of tuples, kita ambil elemen pertama
        return [row[0] for row in result]
    except Exception as e:
        return [f"Error saat mengambil list data sources: {str(e)}"]

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="MCP Server Eksplorasi Data Excel Duckdb")
    parser.add_argument("--host", default=os.getenv("MCP_HOST", "127.0.0.1"), help="Host untuk binding (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=int(os.getenv("MCP_PORT", "8002")), help="Port untuk server (default: 8002)")
    parser.add_argument("--path", default=os.getenv("MCP_PATH", "/mcp"), help="Endpoint path (default: /mcp)")
    
    args = parser.parse_args()
    
    try:
        print(f"Memulai Eksplorasi Excel MCP Server dengan Streamable HTTP Transport...")
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
    finally:
        conn.close()
        print("Koneksi DuckDB ditutup.")