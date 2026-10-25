-- Bookings made on the website (instant bookings and booking requests)
CREATE TABLE bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ref TEXT NOT NULL UNIQUE,
  property TEXT NOT NULL,
  check_in TEXT NOT NULL,            -- YYYY-MM-DD
  check_out TEXT NOT NULL,           -- YYYY-MM-DD
  guests INTEGER NOT NULL,
  nights_json TEXT NOT NULL,         -- [{date, base, price}] in pence
  extras_json TEXT NOT NULL,         -- [{id, label, price}] in pence
  subtotal_pence INTEGER NOT NULL,
  discount_pence INTEGER NOT NULL,
  extras_pence INTEGER NOT NULL,
  total_pence INTEGER NOT NULL,
  status TEXT NOT NULL,              -- pending | confirmed | requested | cancelled | refunded | conflict | expired
  mode TEXT NOT NULL,                -- instant | request
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  arrival_time TEXT,
  work_trip INTEGER NOT NULL DEFAULT 0,
  company TEXT,
  notes TEXT,
  terms_version TEXT NOT NULL,
  terms_accepted_at TEXT NOT NULL,
  terms_ip TEXT,
  stripe_session_id TEXT,
  payment_intent TEXT,
  pms_ref TEXT,
  pre_arrival_sent INTEGER NOT NULL DEFAULT 0,
  checkin_followup_sent INTEGER NOT NULL DEFAULT 0,
  thank_you_sent INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX bookings_property_dates ON bookings(property, check_in, check_out);
CREATE INDEX bookings_session ON bookings(stripe_session_id);

-- Short-lived holds while a guest is paying, so two direct guests can't pay for the same nights
CREATE TABLE holds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_ref TEXT NOT NULL,
  property TEXT NOT NULL,
  check_in TEXT NOT NULL,
  check_out TEXT NOT NULL,
  expires_at TEXT NOT NULL           -- ISO timestamp
);
CREATE INDEX holds_property ON holds(property, expires_at);

-- Long-stay, work-stay and general enquiries
CREATE TABLE enquiries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,                -- long_stay | work | contact
  property TEXT,
  check_in TEXT,
  check_out TEXT,
  guests INTEGER,
  company TEXT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  purpose TEXT,
  needs_invoice INTEGER NOT NULL DEFAULT 0,
  message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- First-party funnel events, no cookies
CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,                -- quote | checkout_open | paid | request | enquiry | cancel
  property TEXT,
  meta TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX events_type_date ON events(type, created_at);
