
import os
from pathlib import Path

import pandas as pd
import psycopg
from dotenv import load_dotenv

# 1. Load backend/.env
env_path = Path(__file__).resolve().parent.parent / ".env.example"
load_dotenv(env_path)

database_url = os.getenv("DATABASE_URL")

if not database_url:
    raise ValueError("DATABASE_URL not found in .env!")

# 2. Connect to TigerData
try:
    with psycopg.connect(database_url) as conn:
        print("Successfully connected to TigerData!")

        with conn.cursor() as cursor:

            # 3. Count all records
            cursor.execute("SELECT COUNT(*) FROM prices;")
            count = cursor.fetchone()[0]

            print(f"\nTotal rows in prices: {count}")

            # 4. Retrieve first 10 rows
            cursor.execute("""
                SELECT *
                FROM prices
                ORDER BY date ASC
                LIMIT 10;
            """)

            rows = cursor.fetchall()
            columns = [col.name for col in cursor.description]

            df = pd.DataFrame(rows, columns=columns)

            print("\nFirst 10 rows:")
            print(df.to_string(index=False))

except Exception as error:
    print(f"Database connection/query failed: {error}")
