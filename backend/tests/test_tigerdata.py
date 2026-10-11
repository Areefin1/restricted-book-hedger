import os
from pathlib import Path

import pandas as pd
import psycopg
from dotenv import load_dotenv


def main():
    env_path = Path(__file__).resolve().parent.parent / ".env"
    load_dotenv(env_path)

    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise SystemExit("DATABASE_URL not found in backend/.env!")

    try:
        with psycopg.connect(database_url, connect_timeout=10) as conn:
            print("Successfully connected to TigerData!")

            with conn.cursor() as cursor:
                cursor.execute("SELECT COUNT(*) FROM prices;")
                count = cursor.fetchone()[0]
                print(f"\nTotal rows in prices: {count}")

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

    except psycopg.Error as error:
        raise SystemExit(f"Database connection/query failed: {error}") from error


if __name__ == "__main__":
    main()