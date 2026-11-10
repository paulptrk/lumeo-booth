-- the DSLR booth is the one lumeo actually owns. the others are future inventory, kept inactive for now
INSERT INTO booths (id, name, type, base_price_cents, active) VALUES
  ('booth_dslr_01',   'DSLR Booth',   'dslr',   45000, true),
  ('booth_ipad_01',   'iPad Booth',   'ipad',   35000, false),
  ('booth_360_01',    '360 Booth',    '360',    60000, false),
  ('booth_mirror_01', 'Mirror Booth', 'mirror', 55000, false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO backdrops (id, name) VALUES
  ('backdrop_pillowcase_blue',  'Pillowcase - Blue'),
  ('backdrop_pillowcase_white', 'Pillowcase - White'),
  ('backdrop_sequin_gold',      'Sequin - Gold')
ON CONFLICT (id) DO NOTHING;

-- dev accounts for testing before login exists. the hashes are placeholders, not real passwords
INSERT INTO users (email, password_hash, role) VALUES
  ('customer@lumeo.dev', 'placeholder', 'customer'),
  ('staff@lumeo.dev',    'placeholder', 'staff')
ON CONFLICT (email) DO NOTHING;
