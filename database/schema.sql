-- SQLite schema used by this project

CREATE TABLE IF NOT EXISTS predictions (
  id TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  prediction_time_epoch INTEGER NOT NULL,
  horizon_minutes INTEGER NOT NULL,
  base_price REAL NOT NULL,
  predicted_price REAL NOT NULL,
  direction TEXT NOT NULL,
  confidence REAL NOT NULL,
  actual_price REAL,
  correct INTEGER,
  features_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_predictions_symbol_time
  ON predictions(symbol, prediction_time_epoch);

CREATE TABLE IF NOT EXISTS training_samples (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  created_time_epoch INTEGER NOT NULL,
  target INTEGER NOT NULL,
  features_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_training_samples_symbol_time
  ON training_samples(symbol, created_time_epoch);

