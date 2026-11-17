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

-- dev accounts. both use the dev password "dev-password-123" (not a secret, only for local use).
-- the hash is bcrypt cost 10, made with: node -e 'require("bcrypt").hash("dev-password-123",10).then(console.log)'
-- an account that still has the old placeholder hash gets the real one, other passwords are left alone
INSERT INTO users (email, password_hash, role) VALUES
  ('customer@lumeo.dev', '$2b$10$XXwljnAMGDKTmFRfJGbXQ.uDjuOzE6LvVJzGQftNKpwe4kpFGTEyy', 'customer'),
  ('staff@lumeo.dev',    '$2b$10$XXwljnAMGDKTmFRfJGbXQ.uDjuOzE6LvVJzGQftNKpwe4kpFGTEyy', 'staff')
ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
  WHERE users.password_hash = 'placeholder';
