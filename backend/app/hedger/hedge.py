import pandas as pd

def simulate_hedge(prices, book_size, hedge_ratio):

    # Starting adjusted prices
    hyg_0 = prices["hyg_adj_close"].iloc[0]
    sjb_0 = prices["sjb_adj_close"].iloc[0]

    # HYG and SJB returns for every date
    hyg_return = prices["hyg_adj_close"] / hyg_0 - 1
    sjb_return = prices["sjb_adj_close"] / sjb_0 - 1

    # Formula 1: Bond portfolio profit/loss
    book_pnl = book_size * hyg_return

    # Formula 2: Static short profit/loss
    static_pnl = -hedge_ratio * book_size * hyg_return

    # Formula 3: SJB profit/loss
    sjb_pnl = hedge_ratio * book_size * sjb_return

    # Combine original bond position with each hedge
    results = pd.DataFrame({
        "date": prices["date"],
        "unhedged": book_pnl,
        "static_short": book_pnl + static_pnl,
        "sjb": book_pnl + sjb_pnl
    })

    return results