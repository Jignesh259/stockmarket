from __future__ import annotations

from typing import Dict

import numpy as np
import pandas as pd


def compute_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """
    Compute SMA, EMA, RSI, MACD, and volume trend.
    Expects df with columns: Open, High, Low, Close, Volume
    """
    df = df.copy()

    close = df["Close"]
    volume = df["Volume"]

    df["sma_10"] = close.rolling(window=10).mean()
    df["sma_20"] = close.rolling(window=20).mean()
    df["ema_10"] = close.ewm(span=10, adjust=False).mean()
    df["ema_20"] = close.ewm(span=20, adjust=False).mean()

    # RSI
    delta = close.diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
    rs = gain / loss.replace(0, np.nan)
    df["rsi_14"] = 100 - (100 / (1 + rs))

    # MACD
    ema_12 = close.ewm(span=12, adjust=False).mean()
    ema_26 = close.ewm(span=26, adjust=False).mean()
    macd = ema_12 - ema_26
    signal = macd.ewm(span=9, adjust=False).mean()
    df["macd"] = macd
    df["macd_signal"] = signal

    # Volume trend: simple ratio vs 20-period average
    vol_ma = volume.rolling(window=20).mean()
    df["vol_trend"] = volume / vol_ma.replace(0, np.nan)

    return df


FEATURE_COLUMNS = [
    "sma_10",
    "sma_20",
    "ema_10",
    "ema_20",
    "rsi_14",
    "macd",
    "macd_signal",
    "vol_trend",
]


def last_row_features(df: pd.DataFrame) -> Dict:
    f = df.iloc[-1]
    return {col: float(f[col]) for col in FEATURE_COLUMNS if col in df.columns}


