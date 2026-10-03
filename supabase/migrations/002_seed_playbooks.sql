-- ClientFollow Migration 002: Seed Niche Playbooks
-- Default sequence cadences for Dentist, Agency, Photographer, Lawyer, Home Services.

-- Template structures for organizations upon registration
-- (In application logic, seeded per new organization in industry)

COMMENT ON TABLE sequence_playbooks IS 'Pre-configured and custom multi-step outreach cadences per industry.';
