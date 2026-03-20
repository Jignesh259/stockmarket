from datetime import datetime, time
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address

from ..services.data_fetcher import (
    get_nifty_sensex_watchlist,
    get_live_candles,
    get_live_snapshot_for_symbols,
)
from ..services.prediction_service import (
    get_prediction_for_symbol,
    get_history_for_symbol,
    process_pending_predictions_once,
)

router = APIRouter(prefix="/stocks", tags=["stocks"])

limiter = Limiter(key_func=get_remote_address)


class MarketStatus(BaseModel):
    is_open: bool
    now_ist: datetime
    next_open: Optional[datetime] = None


class WatchlistItem(BaseModel):
    symbol: str
    name: str
    index: str
    last_price: Optional[float] = None
    change_percent: Optional[float] = None
    delayed: bool = False


class Candle(BaseModel):
    time: int  # epoch seconds
    open: float
    high: float
    low: float
    close: float
    volume: float


class PredictionResponse(BaseModel):
    symbol: str
    current_price: Optional[float]
    predicted_price: Optional[float]
    direction: Optional[str]
    confidence: Optional[float]
    prediction_time: Optional[str]
    last_updated: Optional[str]
    recommendation: Optional[str] = None
    recommendation_reason: Optional[str] = None


class HistoryItem(BaseModel):
    id: str
    symbol: str
    prediction_time: str
    prediction_time_epoch: int
    predicted_price: float
    actual_price: Optional[float]
    direction: str
    confidence: float
    correct: Optional[bool]


@router.get("/market/status", response_model=MarketStatus)
async def market_status():
    # Use IST without explicit holidays; user can extend later.
    from zoneinfo import ZoneInfo

    ist = ZoneInfo("Asia/Kolkata")
    now = datetime.now(ist)

    # Market is open Monday-Friday
    is_weekday = now.weekday() < 5
    open_time = time(9, 15)
    close_time = time(15, 30)
    
    # Check if time is within trading hours
    current_time = now.time()
    is_trading_hours = open_time <= current_time < close_time

    # True only if it's a weekday AND during trading hours
    is_open = is_weekday and is_trading_hours

    next_open: Optional[datetime] = None
    if not is_open:
        day = now
        while True:
            day = day.replace(hour=open_time.hour, minute=open_time.minute, second=0, microsecond=0)
            if day.weekday() < 5 and day > now:
                next_open = day
                break
            day = day.replace(day=day.day + 1)

    return MarketStatus(is_open=is_open, now_ist=now, next_open=next_open)


@router.get("/list", response_model=List[WatchlistItem])
async def stocks_list():
    base_items = get_nifty_sensex_watchlist()
    symbols = [item["symbol"] for item in base_items]
    snapshots = await get_live_snapshot_for_symbols(symbols)
    snapshot_map = {s.symbol: s for s in snapshots}

    result: List[WatchlistItem] = []
    for item in base_items:
        snap = snapshot_map.get(item["symbol"])
        result.append(
            WatchlistItem(
                symbol=item["symbol"],
                name=item["name"],
                index=item["index"],
                last_price=snap.last_price if snap else None,
                change_percent=snap.change_percent if snap else None,
                delayed=False,
            )
        )
    return result


@router.get("/live", response_model=List[Candle])
@limiter.limit("60/minute")
async def stocks_live(request: Request, symbol: str = Query(..., description="NSE symbol, e.g. RELIANCE")):
    candles = await get_live_candles(symbol)
    return [Candle(**c) for c in candles]


@router.get("/predict", response_model=PredictionResponse)
@limiter.limit("30/minute")
async def stocks_predict(request: Request, symbol: str):
    prediction = await get_prediction_for_symbol(symbol)
    if prediction is None:
        raise HTTPException(status_code=404, detail="Prediction not available")
    return PredictionResponse(**prediction)


@router.get("/history", response_model=List[HistoryItem])
async def stocks_history(symbol: str):
    # Ensure we try to close out any predictions that became due.
    await process_pending_predictions_once()
    history = get_history_for_symbol(symbol)
    return [HistoryItem(**h) for h in history]


