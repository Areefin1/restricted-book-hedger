
import os
import time
import statistics
from pathlib import Path

import pandas as pd
import psycopg
from dotenv import load_dotenv

BACKEND = Path(__file__).resolve().parent.parent

# Change this to your actual CSV location
CSV_PATH = BACKEND / "data" / "prices.csv"

# Keep credentials in a Git-ignored .env
load_dotenv(BACKEND / ".env.example")
DATABASE_URL = os.environ["DATABASE_URL"]

START_DATE = "2020-01-01"
END_DATE = "2020-12-31"
RUNS = 50

def csv_query():
    df = pd.read_csv(CSV_PATH, parse_dates=["date"])

    return df[
        (df["date"] >= START_DATE)
        & (df["date"] <= END_DATE)
    ].sort_values("date").reset_index(drop=True)

def tiger_query(conn):
    with conn.cursor() as cursor:
        cursor.execute("""
            SELECT date, hyg_close, hyg_adj_close,
                   sjb_close, sjb_adj_close, rf_annual_pct
            FROM prices
            WHERE date BETWEEN %s AND %s
            ORDER BY date
        """, (START_DATE, END_DATE))

        rows = cursor.fetchall()
        columns = [col.name for col in cursor.description]

    df = pd.DataFrame(rows, columns=columns)
    df["date"] = pd.to_datetime(df["date"])
    return df

def measure(func):
    timings = []

    for _ in range(RUNS):
        start = time.perf_counter()
        result = func()
        timings.append(
            (time.perf_counter() - start) * 1000
        )

    return statistics.median(timings), result

# Establish connection BEFORE the benchmark
with psycopg.connect(DATABASE_URL) as conn:

    # Warm up both approaches
    csv_query()
    tiger_query(conn)

    csv_ms, csv_result = measure(csv_query)
    tiger_ms, tiger_result = measure(
        lambda: tiger_query(conn)
    )

# Verify matching rows and numerical values
pd.testing.assert_frame_equal(
    csv_result,
    tiger_result,
    check_dtype=False,
    check_exact=False,
    rtol=1e-6
)

print(f"Rows retrieved: {len(csv_result)}")
print(f"CSV median:       {csv_ms:.2f} ms")
print(f"TigerData median: {tiger_ms:.2f} ms")

reduction = (csv_ms - tiger_ms) / csv_ms * 100
print(f"Time reduction: {reduction:+.2f}%")
