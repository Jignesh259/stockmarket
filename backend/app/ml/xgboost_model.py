from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, Optional, Tuple
import logging

import numpy as np
import pandas as pd
from xgboost import XGBClassifier

from ..services.indicators import FEATURE_COLUMNS

# Setup logging for model accuracy display
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')
logger = logging.getLogger(__name__)


@dataclass
class PriceMovementModel:
    """
    Wrapper around XGBoost classifier for 15-minute price direction.
    Target: 1 = UP, 0 = DOWN.
    """

    model: Optional[XGBClassifier] = None
    training_data: pd.DataFrame = field(default_factory=lambda: pd.DataFrame(columns=FEATURE_COLUMNS + ["target"]))

    def _ensure_model(self) -> None:
        if self.model is None:
            self.model = XGBClassifier(
                n_estimators=80,
                max_depth=4,
                learning_rate=0.08,
                subsample=0.9,
                colsample_bytree=0.9,
                objective="binary:logistic",
                eval_metric="logloss",
                n_jobs=2,
            )

    def fit_if_needed(self) -> None:
        if self.training_data.empty or len(self.training_data) < 40:
            # Not enough data; train a simple dummy model using synthetic data
            self._train_synthetic()
            return

        self._ensure_model()
        X = self.training_data[FEATURE_COLUMNS].fillna(method="ffill").fillna(method="bfill").values
        y = self.training_data["target"].values
        self.model.fit(X, y)
        
        # Calculate and display accuracy
        accuracy = self.model.score(X, y)
        logger.info(f"🎯 Model Trained | Accuracy: {accuracy:.2%} | Samples: {len(y)} | Features: {len(FEATURE_COLUMNS)}")

    def _train_synthetic(self) -> None:
        self._ensure_model()
        rng = np.random.default_rng(42)
        n = 200
        X_syn = rng.normal(0, 1, size=(n, len(FEATURE_COLUMNS)))
        # Simple rule: if macd (index 5) + rsi (index 4) positive, label UP, else DOWN
        macd_idx = FEATURE_COLUMNS.index("macd")
        rsi_idx = FEATURE_COLUMNS.index("rsi_14")
        y_syn = ((X_syn[:, macd_idx] + X_syn[:, rsi_idx]) > 0).astype(int)
        self.model.fit(X_syn, y_syn)
        
        # Calculate and display synthetic model accuracy
        accuracy = self.model.score(X_syn, y_syn)
        logger.info(f"🤖 Synthetic Model Trained | Accuracy: {accuracy:.2%} | Samples: {n} (Demo Mode)")

    def predict_proba(self, features: Dict) -> Tuple[float, float]:
        if self.model is None:
            self.fit_if_needed()
        x = np.array([[features.get(col, 0.0) for col in FEATURE_COLUMNS]], dtype=float)
        proba = self.model.predict_proba(x)[0]
        # proba[1] is probability of class 1 (UP)
        return float(proba[0]), float(proba[1])

    def add_training_sample(self, features: Dict, target: int) -> None:
        row = {col: float(features.get(col, 0.0)) for col in FEATURE_COLUMNS}
        row["target"] = int(target)
        self.training_data = pd.concat(
            [self.training_data, pd.DataFrame.from_records([row])],
            ignore_index=True,
        )

    def retrain(self) -> None:
        logger.info(f"♻️  Retraining Model | Training samples available: {len(self.training_data)}")
        self.fit_if_needed()


GLOBAL_MODEL = PriceMovementModel()

