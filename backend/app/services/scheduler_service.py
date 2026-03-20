from __future__ import annotations

import asyncio
from datetime import datetime, time

from zoneinfo import ZoneInfo

from .prediction_service import process_pending_predictions_once


async def _should_run_now() -> bool:
    """
    Return True only when Indian markets are open (Mon–Fri, 09:15–15:30 IST).
    """
    ist = ZoneInfo("Asia/Kolkata")
    now = datetime.now(ist)
    if now.weekday() >= 5:
        return False
    start = time(9, 15)
    end = time(15, 30)
    return start <= now.time() <= end


async def start_scheduler() -> None:
    """
    Background scheduler that runs every 15 minutes to:
    - process pending predictions
    - trigger automatic retraining when needed (handled inside process_pending_predictions_once)
    """
    # Small initial delay to let app start
    await asyncio.sleep(5)

    while True:
        try:
            if await _should_run_now():
                await process_pending_predictions_once()
        except Exception:
            # We intentionally swallow exceptions to avoid killing the loop.
            pass

        # Sleep for 15 minutes
        await asyncio.sleep(15 * 60)


