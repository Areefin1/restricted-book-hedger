"""Inspect the standalone funded-inverse prototype against the local price cache."""

import argparse
from pathlib import Path
import sys

import pandas as pd

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from research.convexity import rolling_windows, summary


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--no-plots", action="store_true", help="Print diagnostics without opening charts")
    args = parser.parse_args()
    prices = pd.read_csv(BACKEND / "data/prices.csv", index_col="date", parse_dates=True)
    print("Price data:", prices.index.min().date(), "to", prices.index.max().date(),
          f"({len(prices)} days)")

    df = rolling_windows(prices)
    print("\n1. Number of windows:", len(df))
    print("\n2. Correlation (should be close to -1):")
    print(df[["hyg_ret", "sjb_ret"]].corr().round(3))
    worst = df.loc[df["hyg_ret"].idxmin()]
    print("\n3. Worst HYG window (should start around Feb 2020):")
    print(f"   start {worst['start'].date()}  HYG {worst['hyg_ret']:+.1%}  "
          f"SJB {worst['sjb_ret']:+.1%}  static short {worst['static_ret']:+.1%}")
    print("\n4. Summary:")
    for key, value in summary(df).items():
        print(f"   {key}: {value:.3f}" if isinstance(value, float) else f"   {key}: {value}")
    print("\n5. Windows per vol bucket (should be roughly equal):")
    print(df["vol_bucket"].value_counts().sort_index())

    bins = [-1, -0.10, -0.05, -0.02, 0.02, 0.05, 0.10, 1]
    print(df.groupby(pd.cut(df["hyg_ret"], bins), observed=True)["sjb_minus_static"]
          .agg(["count", "mean"]))
    df["year"] = df["start"].dt.year.astype(str)
    adj = prices[["hyg_adj_close", "sjb_adj_close"]].pct_change().dropna()
    adj["miss"] = adj["sjb_adj_close"] + adj["hyg_adj_close"]
    print(adj["miss"].abs().sort_values(ascending=False).head(15))

    if not args.no_plots:
        import plotly.express as px

        fig = px.scatter(df, x="hyg_ret", y="sjb_minus_static", color="vol_bucket", opacity=0.4,
                         labels={"hyg_ret": "HYG 63-day return", "sjb_minus_static": "SJB minus static short"})
        fig.add_hline(y=0, line_dash="dash")
        fig.update_yaxes(tickformat=".1%")
        fig.update_xaxes(tickformat=".0%")
        fig.show()
        px.scatter(df, x="hyg_ret", y="sjb_minus_static", color="year", opacity=0.5).show()


if __name__ == "__main__":
    main()
