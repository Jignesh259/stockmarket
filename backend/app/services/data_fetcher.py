from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Dict, Iterable, List

import pandas as pd
import yfinance as yf


@dataclass
class Snapshot:
  symbol: str
  last_price: float
  change_percent: float


def _to_nse_symbol(symbol: str) -> str:
  # yfinance uses .NS suffix for NSE
  return f"{symbol}.NS"


def get_nifty_sensex_watchlist() -> List[Dict[str, str]]:
  # Minimal curated subset; extend as needed.
  nifty = [
      ("RELIANCE", "Reliance Industries Ltd"),
      ("TCS", "Tata Consultancy Services Ltd"),
      ("INFY", "Infosys Ltd"),
      ("HDFCBANK", "HDFC Bank Ltd"),
      ("ICICIBANK", "ICICI Bank Ltd"),
      ("SBIN", "State Bank of India"),
      ("AXISBANK", "Axis Bank Ltd"),
      ("KOTAKBANK", "Kotak Mahindra Bank Ltd"),
      ("ITC", "ITC Ltd"),
      ("LT", "Larsen & Toubro Ltd"),
  ]

  sensex = [
      ("RELIANCE", "Reliance Industries Ltd"),
      ("TCS", "Tata Consultancy Services Ltd"),
      ("INFY", "Infosys Ltd"),
      ("HDFCBANK", "HDFC Bank Ltd"),
      ("ICICIBANK", "ICICI Bank Ltd"),
      ("SBIN", "State Bank of India"),
      ("BHARTIARTL", "Bharti Airtel Ltd"),
      ("ASIANPAINT", "Asian Paints Ltd"),
      ("HINDUNILVR", "Hindustan Unilever Ltd"),
      ("MARUTI", "Maruti Suzuki India Ltd"),
  ]

  items: List[Dict[str, str]] = []
  for sym, name in nifty:
      items.append({"symbol": sym, "name": name, "index": "NIFTY50"})
  for sym, name in sensex:
      items.append({"symbol": sym, "name": name, "index": "SENSEX"})
  # De-duplicate same symbol across indices, preferring first
  seen = set()
  unique: List[Dict[str, str]] = []
  for item in items:
      if item["symbol"] in seen:
          continue
      seen.add(item["symbol"])
      unique.append(item)
  return unique


async def get_live_snapshot_for_symbols(symbols: Iterable[str]) -> List[Snapshot]:
  yf_symbols = [_to_nse_symbol(s) for s in symbols]
  data = yf.download(
      tickers=" ".join(yf_symbols),
      period="2d",
      interval="1d",
      auto_adjust=False,
      threads=True,
      progress=False,
  )

  result: List[Snapshot] = []

  if data.empty:
      return result

  # When multiple tickers are used, columns are multi-index (field, symbol)
  try:
      # Ensure we have a way to access the data even if columns are MultiIndex
      if isinstance(data.columns, pd.MultiIndex):
          close = data.xs("Close", axis=1, level=0).iloc[-1]
          prev_close = data.xs("Close", axis=1, level=0).iloc[-2] if len(data) > 1 else None
      else:
          close = data["Close"].iloc[-1]
          prev_close = data["Close"].iloc[-2] if len(data) > 1 else None
      
      for base_symbol in symbols:
          yf_symbol = _to_nse_symbol(base_symbol)
          if yf_symbol not in close:
              continue
          last = float(close[yf_symbol])
          if prev_close is not None and yf_symbol in prev_close:
              pc = float(prev_close[yf_symbol])
              change_pct = (last - pc) / pc * 100 if pc else 0.0
          else:
              change_pct = 0.0
          result.append(Snapshot(symbol=base_symbol, last_price=last, change_percent=change_pct))
  except Exception:
      # Fallback: try single download per symbol
      for base_symbol in symbols:
          yf_symbol = _to_nse_symbol(base_symbol)
          try:
              hist = yf.Ticker(yf_symbol).history(period="2d", interval="1d")
              if hist.empty:
                  continue
              last = float(hist["Close"].iloc[-1])
              if len(hist) > 1:
                  pc = float(hist["Close"].iloc[-2])
                  change_pct = (last - pc) / pc * 100 if pc else 0.0
              else:
                  change_pct = 0.0
              result.append(Snapshot(symbol=base_symbol, last_price=last, change_percent=change_pct))
          except Exception:
              continue

  return result


async def get_live_candles(symbol: str, interval: str = "1m", lookback_minutes: int = 60) -> List[Dict]:
  """
  Fetch recent intraday candles. If market is closed (no recent data),
  fall back to last full trading day's intraday candles.
  """
  yf_symbol = _to_nse_symbol(symbol)
  end = datetime.now(timezone.utc)
  start = end - timedelta(minutes=lookback_minutes + 5)
  hist = yf.download(
      tickers=yf_symbol,
      interval=interval,
      start=start,
      end=end,
      auto_adjust=False,
      progress=False,
  )

  # Fallback: last full day intraday (e.g. 5m bars)
  if hist.empty:
      try:
          hist = yf.download(
              tickers=yf_symbol,
              period="1d",
              interval="5m",
              auto_adjust=False,
              progress=False,
          )
      except Exception:
          hist = None

  if hist is None or hist.empty:
      return []

  # Ensure columns are flat (yfinance sometime returns MultiIndex even for single ticker)
  if isinstance(hist.columns, pd.MultiIndex):
      hist.columns = hist.columns.get_level_values(0)

  candles: List[Dict] = []
  for ts, row in hist.iterrows():
      try:
          epoch = int(ts.timestamp())
          candles.append(
              {
                  "time": epoch,
                  "open": float(row["Open"]),
                  "high": float(row["High"]),
                  "low": float(row["Low"]),
                  "close": float(row["Close"]),
                  "volume": float(row["Volume"]),
              }
          )
      except (KeyError, ValueError, TypeError):
          continue
  
  # Ensure strictly ascending order by time (required by chart library)
  # Reverse then sort to guarantee proper ascending order
  candles.reverse()
  candles.sort(key=lambda x: x["time"])
  return candles

