// reads and validates the settings the auth code needs from the environment.
// takes the env object as an argument so tests don't have to touch process.env.

const MIN_SECRET_LENGTH = 32;

export function loadConfig(env = process.env) {
  const jwtSecret = env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error("JWT_SECRET is not set. Add it to .env (see .env.example)");
  }
  // an HS256 secret is a shared key: a short one can be brute-forced and then
  // anyone can forge a token
  if (jwtSecret.length < MIN_SECRET_LENGTH) {
    throw new Error(`JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters (try: openssl rand -base64 48)`);
  }
  return { jwtSecret };
}
