import os
from mcp.server import MCPServer
from mcp.server.transport_security import TransportSecuritySettings
from mcp import types
import argparse
import duckdb
import logging

mcp = MCPServer(name='excel-frame')

# Inisialisasi koneksi DuckDB secara global agar bisa diakses oleh fungsi tools
conn = duckdb.connect("my_data.db")

@mcp.tool(name="get_datasource_metadata", description="Penjelasan kolom dari datasource yang digunakan")
def get_datasource_metadata(table: str) -> types.TextContent:
    query = """
        SELECT 
            column_name,
            data_type,
            is_nullable,
            column_default,
            comment
        FROM duckdb_columns()
        where table_name = ?
    """
    try:
        result = conn.execute(query, [table]).fetchall()
        if not result:
            result = f"Tabel {table} tidak memiliki metadata"
            logging.error(result)
            raise Exception(result) 
            
        
        metadata = [
            f"Metadata untuk tabel {table} : ", 
            "column_name : data_type | is_nullable | column_default | comment"
        ]
        for row in result:
            column_name, data_type, is_nullable, column_default, comment = row
            metadata.append(f"{column_name}: {data_type} | {is_nullable} | {column_default} | {comment}")
        
        result = "\n".join(metadata)
    except Exception as e:
        result = f"Error saat mengambil metadata: {str(e)}"
    return types.TextContent(text=result, type="text")

@mcp.tool(name='list_data_sources', description='List datasource yang terhubung dengan DuckDB')
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

        mcp.run(
            transport="streamable-http",
            port=args.port,
            streamable_http_path=args.path,
            transport_security=security_settings
        )
    finally:
        conn.close()
        print("Koneksi DuckDB ditutup.")