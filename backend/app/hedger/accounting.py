"""Shared return-series overlay accounting; arrays may contain many windows."""
import numpy as np


def overlay_values(hyg, sjb, rebate, funding, days, book_size, ratio, borrow,
                   round_trip_cost_bps=0.0, book_beta=1.0, annual_basis_return=0.0):
    book = book_size * (1 + book_beta * (hyg - 1) + annual_basis_return * days / 365)
    notional = book_size * ratio
    cost = notional * round_trip_cost_bps / 10_000 * (days > 0)
    return np.stack([
        book,
        book - notional * (hyg - 1) + notional * (rebate - 1) - notional * borrow * days / 365 - cost,
        book + notional * (sjb - 1) - notional * (funding - 1) - cost,
    ], axis=-1)


def terminate_paths(values, floor):
    """Freeze each stress path at its first floor breach, preserving overshoot.

    This terminates the research calculation; it does not assume the restricted
    book can be sold or that broker margin equals this equity-floor assumption.
    Time is the penultimate axis; the last axis enumerates strategies.
    """
    breached = values <= floor
    first = np.argmax(breached, axis=-2)
    ever = np.any(breached, axis=-2)
    stop = np.where(ever, first, values.shape[-2] - 1)
    times = np.arange(values.shape[-2])
    indices = np.minimum(times.reshape((1,) * (values.ndim - 2) + (-1, 1)), np.expand_dims(stop, -2))
    return np.take_along_axis(values, indices, axis=-2), stop, ever
