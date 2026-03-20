from __future__ import annotations

import json
import os
import sqlite3
from pathlib import Path
from typing import Any, Dict, List, Optional


def _repo_root() -> Path:
    # backend/app/db.py -> backend/app -> backend -> repo root
    return Path(__file__).resolve().parents[2]


def _db_path() -> Path:
    return _repo_root() / "database" / "stock_prediction.sqlite3"


def get_conn() -> sqlite3.Connection:
    db_file = _db_path()
    db_file.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_file), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    conn = get_conn()
    try:
        schema_path = _repo_root() / "database" / "schema.sql"
        schema_sql = schema_path.read_text(encoding="utf-8")
        conn.executescript(schema_sql)
        conn.commit()
    finally:
        conn.close()


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
    conn = get_conn()
    try:
        conn.execute(
            """
            INSERT OR REPLACE INTO predictions (
              id, symbol, prediction_time_epoch, horizon_minutes,
              base_price, predicted_price, direction, confidence,
              actual_price, correct, features_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?)
            """,
            (
                pred_id,
                symbol.upper(),
                int(prediction_time_epoch),
                int(horizon_minutes),
                float(base_price),
                float(predicted_price),
                direction,
                float(confidence),
                json.dumps(features, separators=(",", ":")),
            ),
        )
        conn.commit()
    finally:
        conn.close()


def close_prediction(*, pred_id: str, actual_price: float, correct: bool) -> None:
    conn = get_conn()
    try:
        conn.execute(
            """
            UPDATE predictions
            SET actual_price = ?, correct = ?
            WHERE id = ?
            """,
            (float(actual_price), 1 if correct else 0, pred_id),
        )
        conn.commit()
    finally:
        conn.close()


def insert_training_sample(*, symbol: str, created_time_epoch: int, target: int, features: Dict[str, Any]) -> None:
    conn = get_conn()
    try:
        conn.execute(
            """
            INSERT INTO training_samples (symbol, created_time_epoch, target, features_json)
            VALUES (?, ?, ?, ?)
            """,
            (
                symbol.upper(),
                int(created_time_epoch),
                int(target),
                json.dumps(features, separators=(",", ":")),
            ),
        )
        conn.commit()
    finally:
        conn.close()


def get_prediction_history(symbol: str, limit: int = 50) -> List[Dict[str, Any]]:
    conn = get_conn()
    try:
        rows = conn.execute(
            """
            SELECT id, symbol, prediction_time_epoch, predicted_price,
                   actual_price, direction, confidence, correct
            FROM predictions
            WHERE symbol = ?
            ORDER BY prediction_time_epoch DESC
            LIMIT ?
            """,
            (symbol.upper(), int(limit)),
        ).fetchall()
        result: List[Dict[str, Any]] = []
        for r in rows:
            result.append(
                {
                    "id": r["id"],
                    "symbol": r["symbol"],
                    "prediction_time_epoch": int(r["prediction_time_epoch"]),
                    "predicted_price": float(r["predicted_price"]),
                    "actual_price": float(r["actual_price"]) if r["actual_price"] is not None else None,
                    "direction": r["direction"],
                    "confidence": float(r["confidence"]),
                    "correct": (None if r["correct"] is None else bool(int(r["correct"]))),
                }
            )
        return result
    finally:
        conn.close()

