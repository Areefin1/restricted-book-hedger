import yfinance as yf
import pandas as pd

# 1. Download HYG and SJB historical prices
prices = yf.download(
    ["HYG", "SJB"],
    start="2011-03-01",
    auto_adjust=False,
    progress=False
)

# 2. Select Close and Adj Close for both ETFs
prices = prices.loc[:, [
    ("Close", "HYG"),
    ("Adj Close", "HYG"),
    ("Close", "SJB"),
    ("Adj Close", "SJB")
]]

# 3. Rename the columns
prices.columns = [
    "hyg_close",
    "hyg_adj_close",
    "sjb_close",
    "sjb_adj_close"
]

# 4. Remove dates where either ETF has missing prices
prices = prices.dropna()

# 5. Find the earliest and latest shared dates
start_date = prices.index.min()
end_date = prices.index.max()

print("Earliest common date:", start_date)
print("Latest common date:", end_date)

# 6. Name the date column
prices.index.name = "date"

# 7. Save everything to CSV
prices.to_csv("prices.csv")

print("Successfully saved prices.csv!")