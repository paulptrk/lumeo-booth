# AI Collaboration Log

Examples where the AI assistant was wrong or incomplete, and how it was fixed (SOEN 387 §6.2). Each entry has what the AI did, the prompt that called out the error, and a short explanation.

---

## 1. Id guard let oversized ids through (500 instead of 401/404)

**What the AI did:** For the `X-User-Id` bug, it added a guard that only checked the id was digits (`/^\d+$/`) before the database lookup, and wrote tests using `999999999`. Tests passed and the fix was reported as done.

**Prompt that called out the error:** "is it possible that the ai agent is so good that i have nothing to add to the ai log"

**What happened:** That question made the AI re-review its own fix. A 20-digit id like `99999999999999999999` passes the digits check but is too large for a Postgres BIGINT, so Postgres threw "value out of range" and the API returned a 500, on both `GET /bookings` and `GET /bookings/:id`. The tests missed it because the test id fit in a BIGINT. It was reproduced with curl (500), then fixed by checking the id is 1–19 digits and no larger than the BIGINT maximum, with a regression test for max BIGINT + 1. The AI had fixed the reported symptom but only tested one side of the type's limit.

---

## 2. Treated "a 400 error" as exactly status 400

**What the AI did:** Asked to validate booking ids and "return a 400 error" when validation fails, it hardcoded status 400 for the new `invalid_id` error. It did not check the existing error-to-status map first.

**Prompt that called out the error:** "i did not mean should return exaclly code 400. i meant it should return an approriate 400 level error. fix this mistake"

**What happened:** The request meant "an appropriate 4xx", not literally 400. The project already returns 422 for invalid values in an otherwise valid request (`invalid_event_date`, `invalid_package`) and uses 400 only for unparseable JSON, so a hardcoded 400 was inconsistent. The status was changed to 422, and a test now pins the code-to-status mapping. The AI resolved an ambiguous requirement silently instead of checking it against the existing error model.

---

## 3. Database credentials hard-coded in docker-compose.yml

**What the AI did:** When adding the app service to `docker-compose.yml`, it wrote the full database url with the username and password in plain text (`postgres://lumeo:lumeo@db:5432/lumeo`), duplicating the credentials already hard-coded for the `db` service. Its plan even justified it as "dev-only credentials already in compose, not secrets", and it committed the file that way.

**Prompt that called out the error:** "There is an issue with the docker compose yml. The creds for postgress are exposed. They should be env vars and not plain text in the docker compose"

**What happened:** The course requires no secrets in source (SOEN 387 §4), and a committed compose file is source. Calling the password "dev-only" was an excuse, not a reason, and copying it into a second place made it worse. The fix moved the user, password and database name (and the healthcheck's hard-coded user) into `POSTGRES_*` variables read from the gitignored `.env`, with no defaults so compose refuses to start if one is missing. `.env.example` gets a placeholder password.

---

## Unconfirmed ideas

Design choices already in the code that may be worth writing up **only if** an AI session actually got them wrong first: the availability race (unique partial index instead of check-then-insert), idempotency keys scoped per customer, the request-hash check on key reuse, claiming the key in the same transaction as the insert, and `FOR UPDATE` on cancel.
