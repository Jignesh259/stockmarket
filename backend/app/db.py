from __future__ import annotations

import json
import os
from typing import Any, Dict, List, Optional

import redis


# ---------------------------------------------------------------------------
# Redis connection
# ---------------------------------------------------------------------------
# Render.com provides REDIS_URL (or REDIS_TLS_URL) automatically when you
# attach a Redis instance to your service.  We prefer that URL if present,
# falling back to individual host/port/password env-vars for local dev.
# ---------------------------------------------------------------------------

_REDIS_URL = os.getenv("REDIS_TLS_URL") or os.getenv("REDIS_URL")

# Local fallback
_REDIS_HOST = os.getenv("REDIS_HOST", "127.0.0.1")
_REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
_REDIS_DB = int(os.getenv("REDIS_DB", "0"))
_REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", None)

_pool: Optional[redis.ConnectionPool] = None


def _get_pool() -> redis.ConnectionPool:
    global _pool
    if _pool is None:
        if _REDIS_URL:
            # Render / cloud URL (supports redis:// and rediss:// TLS URLs)
            _pool = redis.ConnectionPool.from_url(
                _REDIS_URL, decode_responses=True
            )
        else:
            # Local development
            _pool = redis.ConnectionPool(
                host=_REDIS_HOST,
                port=_REDIS_PORT,
                db=_REDIS_DB,
                password=_REDIS_PASSWORD,
                decode_responses=True,
            )
    return _pool


def get_conn() -> redis.Redis:
    """Return a Redis client backed by a shared connection pool."""
    return redis.Redis(connection_pool=_get_pool())


# ---------------------------------------------------------------------------
# Initialisation
# ---------------------------------------------------------------------------

def init_db() -> None:
    """Verify Redis is reachable. No schema creation needed."""
    r = get_conn()
    try:
        r.ping()
        print("[OK] Redis connected successfully")
    except redis.ConnectionError as exc:
        print(f"[ERROR] Redis connection failed: {exc}")
        raise


# ---------------------------------------------------------------------------
# Key helpers
# ---------------------------------------------------------------------------

def _pred_key(pred_id: str) -> str:
    """Hash key for a single prediction."""
    return f"prediction:{pred_id}"


def _symbol_preds_key(symbol: str) -> str:
    """Sorted-set key: prediction ids for a symbol, scored by timestamp."""
    return f"symbol:{symbol.upper()}:predictions"


def _training_key(symbol: str) -> str:
    """List key for training samples of a symbol."""
    return f"symbol:{symbol.upper()}:training_samples"


# ---------------------------------------------------------------------------
# CRUD operations — same signatures as the old SQLite module
# ---------------------------------------------------------------------------

def insert_prediction(
    *,
    pred_id: str,
    symbol: str,
    prediction_time_epoch: int,
    horizon_minutes: int,
    base_price: float,
    predicted_price: float,
    direction: str,
    confidence: float,
    features: Dict[str, Any],
) -> None:
    r = get_conn()
    mapping = {
        "id": pred_id,
        "symbol": symbol.upper(),
        "prediction_time_epoch": str(int(prediction_time_epoch)),
        "horizon_minutes": str(int(horizon_minutes)),
        "base_price": str(float(base_price)),
        "predicted_price": str(float(predicted_price)),
        "direction": direction,
        "confidence": str(float(confidence)),
        "actual_price": "",
        "correct": "",
        "features_json": json.dumps(features, separators=(",", ":")),
    }
    pipe = r.pipeline()
    pipe.hset(_pred_key(pred_id), mapping=mapping)
    pipe.zadd(
        _symbol_preds_key(symbol),
        {pred_id: int(prediction_time_epoch)},
    )
    pipe.execute()


def close_prediction(*, pred_id: str, actual_price: float, correct: bool) -> None:
    r = get_conn()
    r.hset(
        _pred_key(pred_id),
        mapping={
            "actual_price": str(float(actual_price)),
            "correct": "1" if correct else "0",
        },
    )


def insert_training_sample(
    *, symbol: str, created_time_epoch: int, target: int, features: Dict[str, Any]
) -> None:
    r = get_conn()
    sample = json.dumps(
        {
            "symbol": symbol.upper(),
            "created_time_epoch": int(created_time_epoch),
            "target": int(target),
            "features": features,
        },
        separators=(",", ":"),
    )
    r.lpush(_training_key(symbol), sample)


def get_prediction_history(symbol: str, limit: int = 50) -> List[Dict[str, Any]]:
    r = get_conn()
    # Retrieve most recent prediction IDs (highest score = most recent)
    pred_ids = r.zrevrange(_symbol_preds_key(symbol), 0, limit - 1)

    result: List[Dict[str, Any]] = []
    for pred_id in pred_ids:
        data = r.hgetall(_pred_key(pred_id))
        if not data:
            continue

        actual = data.get("actual_price", "")
        correct_raw = data.get("correct", "")
        result.append(
            {
                "id": data["id"],
                "symbol": data["symbol"],
                "prediction_time_epoch": int(data["prediction_time_epoch"]),
                "predicted_price": float(data["predicted_price"]),
                "actual_price": float(actual) if actual else None,
                "direction": data["direction"],
                "confidence": float(data["confidence"]),
                "correct": None if correct_raw == "" else bool(int(correct_raw)),
            }
        )
    return result
