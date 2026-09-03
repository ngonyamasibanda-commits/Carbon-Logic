-- Run this in Supabase SQL Editor to enable cloud persistence

CREATE TABLE IF NOT EXISTS emission_entries (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default_user',
    category TEXT NOT NULL,
    scope TEXT,
    emissions_tco2e DOUBLE PRECISION NOT NULL DEFAULT 0,
    details TEXT,
    amount DOUBLE PRECISION,
    unit TEXT,
    comment TEXT,
    link TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS emission_factors (
    id BIGSERIAL PRIMARY KEY,
    activity_type TEXT UNIQUE NOT NULL,
    co2e_factor DOUBLE PRECISION NOT NULL,
    unit TEXT NOT NULL,
    source TEXT DEFAULT 'DEFRA/UK'
);

-- RLS must be on for both tables. Do not add USING (true) policies for anon —
-- the publishable key is in the browser bundle, so those policies would expose
-- every row. Membership-scoped policies come from the auth/tenancy migration.
-- DROP the legacy open policies so re-running this file cannot reopen them.
ALTER TABLE emission_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE emission_factors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon read emission_entries" ON emission_entries;
DROP POLICY IF EXISTS "Allow anon insert emission_entries" ON emission_entries;
DROP POLICY IF EXISTS "Allow anon delete emission_entries" ON emission_entries;
DROP POLICY IF EXISTS "Allow anon update emission_entries" ON emission_entries;
DROP POLICY IF EXISTS "Allow anon read emission_factors" ON emission_factors;
DROP POLICY IF EXISTS "Allow anon insert emission_factors" ON emission_factors;
DROP POLICY IF EXISTS "Allow anon update emission_factors" ON emission_factors;
DROP POLICY IF EXISTS "Allow anon delete emission_factors" ON emission_factors;

-- Seed common factors (optional)
INSERT INTO emission_factors (activity_type, co2e_factor, unit) VALUES
    ('electricity_grid_kwh', 0.20707, 'kWh'),
    ('petrol_litre', 2.3126, 'L'),
    ('diesel_litre', 2.6835, 'L'),
    ('flight_economy_pkm', 0.109, 'passenger-km')
ON CONFLICT DO NOTHING;
