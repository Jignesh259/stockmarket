"""Quick smoke test for the Redis-backed db module."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.db import init_db, insert_prediction, close_prediction, insert_training_sample, get_prediction_history
import time

print("=== Redis DB Smoke Test ===\n")

# 1. Init
print("[1] init_db ...")
init_db()
print("    PASS\n")

# 2. Insert a prediction
symbol = "TEST_SMOKE"
ts = int(time.time())
pred_id = f"{symbol}-{ts}"
print(f"[2] insert_prediction  id={pred_id} ...")
insert_prediction(
    pred_id=pred_id,
    symbol=symbol,
    prediction_time_epoch=ts,
    horizon_minutes=15,
    base_price=100.0,
    predicted_price=101.5,
    direction="UP",
    confidence=0.72,
    features={"rsi": 55.3, "macd": 0.12},
)
print("    PASS\n")

# 3. Retrieve history
print("[3] get_prediction_history ...")
history = get_prediction_history(symbol, limit=10)
assert len(history) >= 1, f"Expected >=1 rows, got {len(history)}"
row = history[0]
assert row["id"] == pred_id
assert row["predicted_price"] == 101.5
assert row["actual_price"] is None
assert row["correct"] is None
print(f"    PASS  (got {len(history)} rows, latest id={row['id']})\n")

# 4. Close prediction
print("[4] close_prediction ...")
close_prediction(pred_id=pred_id, actual_price=102.0, correct=True)
history2 = get_prediction_history(symbol, limit=10)
row2 = history2[0]
assert row2["actual_price"] == 102.0
assert row2["correct"] is True
print("    PASS\n")

# 5. Training sample
print("[5] insert_training_sample ...")
insert_training_sample(symbol=symbol, created_time_epoch=ts, target=1, features={"rsi": 55.3})
print("    PASS\n")

# Cleanup: remove test keys
from app.db import get_conn
r = get_conn()
r.delete(f"prediction:{pred_id}")
r.delete(f"symbol:{symbol}:predictions")
r.delete(f"symbol:{symbol}:training_samples")
print("=== ALL TESTS PASSED ===")
