from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

import pandas as pd

from .data_fetcher import get_live_candles
from .indicators import compute_indicators, last_row_features
from ..ml.xgboost_model import GLOBAL_MODEL
from ..db import close_prediction, insert_prediction, insert_training_sample, get_prediction_history


@dataclass
class PendingPrediction:
    id: str
    symbol: str
    prediction_time: datetime
    horizon_minutes: int
    predicted_price: float
    direction: str
    confidence: float
    base_price: float
    features: Dict


PENDING: Dict[str, PendingPrediction] = {}
HISTORY: List[Dict] = []


async def get_prediction_for_symbol(symbol: str) -> Optional[Dict]:
    candles = await get_live_candles(symbol, interval="1m", lookback_minutes=60)
    if not candles:
        return None

    df = pd.DataFrame(candles)
    df.rename(columns={"open": "Open", "high": "High", "low": "Low", "close": "Close", "volume": "Volume"}, inplace=True)

    df = compute_indicators(df)
    feats = last_row_features(df)
    if not feats:
        return None

    # Base current / predicted price assumption: next 15m candle closes relative to last close
    last_close = float(df["Close"].iloc[-1])
    p_down, p_up = GLOBAL_MODEL.predict_proba(feats)

    direction = "UP" if p_up >= 0.5 else "DOWN"
    confidence = max(p_up, p_down)

    # Simplistic predicted price shift: +/- 0.3% scaled by confidence
    shift = last_close * 0.003 * confidence
    predicted_price = last_close + shift if direction == "UP" else last_close - shift

    now = datetime.now(timezone.utc)
    pred_id = f"{symbol}-{int(now.timestamp())}"

    pending = PendingPrediction(
        id=pred_id,
        symbol=symbol,
        prediction_time=now,
        horizon_minutes=15,
        predicted_price=predicted_price,
        direction=direction,
        confidence=confidence,
        base_price=last_close,
        features=feats,
    )
    PENDING[pred_id] = pending

    insert_prediction(
        pred_id=pred_id,
        symbol=symbol,
        prediction_time_epoch=int(now.timestamp()),
        horizon_minutes=15,
        base_price=last_close,
        predicted_price=predicted_price,
        direction=direction,
        confidence=confidence,
        features=feats,
    )

    # Generate trading recommendation based on confidence and direction
    if confidence > 0.70:
        if direction == "UP":
            recommendation = "BUY"
            reason = f"Strong uptrend signal (Confidence: {confidence:.1%})"
        else:
            recommendation = "SELL"
            reason = f"Strong downtrend signal (Confidence: {confidence:.1%})"
    elif confidence > 0.55:
        recommendation = "HOLD"
        reason = f"Moderate signal - {direction} with {confidence:.1%} confidence"
    else:
        recommendation = "WAIT"
        reason = f"Weak signal - insufficient confidence ({confidence:.1%})"

    return {
        "symbol": symbol,
        "current_price": last_close,
        "predicted_price": predicted_price,
        "direction": direction,
        "confidence": confidence,
        "prediction_time": now.isoformat(),
        "last_updated": now.isoformat(),
        "recommendation": recommendation,
        "recommendation_reason": reason,
    }


async def process_pending_predictions_once() -> None:
    """
    Compare each pending prediction with actual price after its horizon.
    Add mistakes to training data and retrain model.
    """
    if not PENDING:
        return

    now = datetime.now(timezone.utc)
    to_delete = []

    for pred_id, pending in list(PENDING.items()):
        due_at = pending.prediction_time + timedelta(minutes=pending.horizon_minutes)
        if now < due_at:
            continue

        # Fetch candles from prediction time onwards
        candles = await get_live_candles(pending.symbol, interval="1m", lookback_minutes=pending.horizon_minutes + 10)
        if not candles:
            continue

        df = pd.DataFrame(candles)
        df.rename(
            columns={"open": "Open", "high": "High", "low": "Low", "close": "Close", "volume": "Volume"},
            inplace=True,
        )

        # Approximate actual price at horizon as last close in window
        actual_price = float(df["Close"].iloc[-1])
        actual_direction = "UP" if actual_price >= pending.base_price else "DOWN"
        correct = actual_direction == pending.direction

        # Persist outcome to Redis for dataset/demo
        close_prediction(pred_id=pred_id, actual_price=actual_price, correct=correct)

        # Keep in-memory history too (used by UI during the same run)
        HISTORY.append(
            {
                "id": pred_id,
                "symbol": pending.symbol,
                "prediction_time": pending.prediction_time.isoformat(),
                "prediction_time_epoch": int(pending.prediction_time.timestamp()),
                "predicted_price": pending.predicted_price,
                "actual_price": actual_price,
                "direction": pending.direction,
                "confidence": pending.confidence,
                "correct": correct,
            }
        )

        # If wrong, add to training data and retrain
        if not correct:
            target = 1 if actual_direction == "UP" else 0
            GLOBAL_MODEL.add_training_sample(pending.features, target)
            GLOBAL_MODEL.retrain()
            insert_training_sample(
                symbol=pending.symbol,
                created_time_epoch=int(now.timestamp()),
                target=target,
                features=pending.features,
            )

        to_delete.append(pred_id)

    for pred_id in to_delete:
        PENDING.pop(pred_id, None)


def get_history_for_symbol(symbol: str) -> List[Dict]:
    # Prefer persisted dataset (works across restarts).
    rows = get_prediction_history(symbol, limit=50)
    result: List[Dict] = []
    for r in rows:
        result.append(
            {
                "id": r["id"],
                "symbol": r["symbol"],
                "prediction_time": datetime.fromtimestamp(r["prediction_time_epoch"], tz=timezone.utc).isoformat(),
                "prediction_time_epoch": r["prediction_time_epoch"],
                "predicted_price": r["predicted_price"],
                "actual_price": r["actual_price"],
                "direction": r["direction"],
                "confidence": r["confidence"],
                "correct": r["correct"],
            }
        )
    return result


