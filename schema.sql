PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS reservations (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS raffle_numbers (
  number INTEGER PRIMARY KEY NOT NULL CHECK (number BETWEEN 0 AND 300),
  reservation_id TEXT NOT NULL,
  FOREIGN KEY (reservation_id) REFERENCES reservations(id)
);

CREATE INDEX IF NOT EXISTS raffle_numbers_reservation_id_idx
  ON raffle_numbers (reservation_id);
