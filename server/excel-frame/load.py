import duckdb
import csv
from tqdm import tqdm
import os
import re

def normalize_column_name(col_name):
    """Normalize column names to lowercase and replace spaces with underscores."""
    col_name = str(col_name).strip().lower()
    col_name = re.sub(r'[^a-z0-9_]', '_', col_name)
    col_name = re.sub(r'_+', '_', col_name)
    return col_name.strip('_')

def load_data():
    db_path = "my_data.db"
    csv_path = "data/dummy_data.csv"
    table_name = "transaksi_impor"
    
    if not os.path.exists(csv_path):
        print(f"Error: {csv_path} not found.")
        return
        
    conn = duckdb.connect(db_path)
    print(f"Loading data from {csv_path} into table '{table_name}'...")
    
    # Read headers
    with open(csv_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.reader(f, delimiter=';')
        try:
            original_headers = next(reader)
        except StopIteration:
            print("CSV file is empty.")
            return
            
    normalized_headers = [normalize_column_name(h) for h in original_headers]
    
    # Delete table if it exists
    conn.execute(f"DROP TABLE IF EXISTS {table_name}")
    
    # Create table structure based on read_csv_auto but with 0 rows
    conn.execute(f"CREATE TABLE {table_name} AS SELECT * FROM read_csv_auto('{csv_path}', sep=';') LIMIT 0")
    
    # Rename columns to normalized headers
    for old_col, new_col in zip(original_headers, normalized_headers):
        conn.execute(f'ALTER TABLE {table_name} RENAME COLUMN "{old_col}" TO "{new_col}"')
        
    # Menambahkan metadata dengan COMMENT pada tabel
    conn.execute(f"COMMENT ON TABLE {table_name} IS 'Data transaksi impor (dummy)'")
    
    # Menambahkan metadata dengan COMMENT pada masing-masing kolom
    column_comments = {
        "nomor_aju": "Nomor pengajuan dokumen pabean",
        "tanggal_aju": "Tanggal pengajuan dokumen",
        "importir": "Nama perusahaan importir",
        "negara_asal": "Kode negara asal barang",
        "pelabuhan_muat": "Kode pelabuhan tempat memuat barang",
        "pelabuhan_bongkar": "Kode pelabuhan tempat membongkar barang",
        "hs_code": "Kode klasifikasi barang (HS Code)",
        "uraian_barang": "Deskripsi atau nama barang yang diimpor",
        "nilai_fob_usd": "Nilai barang dalam kondisi Free on Board (FOB) dalam satuan USD",
        "freight_usd": "Biaya pengangkutan / ongkos kirim dalam satuan USD",
        "insurance_usd": "Biaya asuransi dalam satuan USD",
        "nilai_cif_usd": "Nilai Cost, Insurance, and Freight (CIF) dalam satuan USD",
        "tarif_bm": "Persentase tarif Bea Masuk yang dikenakan",
        "nilai_bm_idr": "Total nilai Bea Masuk yang harus dibayar dalam satuan Rupiah (IDR)",
        "status_jalur": "Status penjaluran penyelesaian kepabeanan (misal: Hijau, Kuning, Merah)"
    }
    
    for col, comment in column_comments.items():
        try:
            conn.execute(f"COMMENT ON COLUMN {table_name}.{col} IS '{comment}'")
        except Exception as e:
            print(f"Warning: Could not add comment for {col}: {e}")
        
    # Get total lines
    with open(csv_path, 'r', encoding='utf-8-sig') as f:
        total_rows = sum(1 for _ in f) - 1
        
    # Insert data in chunks to show tqdm
    chunk_size = 1000
    with open(csv_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.reader(f, delimiter=';')
        next(reader) # skip header
        
        with tqdm(total=total_rows, desc="Loading data") as pbar:
            chunk = []
            for row in reader:
                if not row: continue
                chunk.append(row)
                if len(chunk) >= chunk_size:
                    placeholders = ','.join(['?'] * len(normalized_headers))
                    conn.executemany(f"INSERT INTO {table_name} VALUES ({placeholders})", chunk)
                    pbar.update(len(chunk))
                    chunk = []
            if chunk:
                placeholders = ','.join(['?'] * len(normalized_headers))
                conn.executemany(f"INSERT INTO {table_name} VALUES ({placeholders})", chunk)
                pbar.update(len(chunk))

    conn.close()
    print("Data loaded successfully!")

if __name__ == "__main__":
    load_data()
