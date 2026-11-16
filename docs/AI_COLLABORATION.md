# AI Collaboration Log

Course requirement (SOEN 387 §6.2): three to five representative examples of working with an AI assistant. Each one shows the prompt, what the assistant produced, and what I changed and why. The goal is to show where the assistant was **wrong, incomplete or insecure**, and how I caught and fixed it.

This file has two parts:
1. **Final entries**: the 3–5 that go in the report. Written up in full, with the real prompt.
2. **Candidates**: a running list of things worth writing up. Add to it as the project goes. Promote the strongest ones to final entries.

## Entry template

```
### N. <short title>
**Category:** wrong | incomplete | insecure
**Commit:** <hash or link>

**Prompt:** what I asked (paste the real prompt)

**What the assistant produced:** what it generated, and the specific flaw

**How I found it:** review, test, failing demo, reading the spec...

**What I changed and why:** the fix, and the reasoning I can defend in the oral exam

**Evidence:** the test or script that proves the fix
```

---

## Final entries

_None written yet. Pick 3–5 from the candidates below._

---

## Candidates

Status: `idea` (noticed, not written up) · `drafted` · `final`

| # | Candidate | Category | Where in the code | Status |
|---|---|---|---|---|
| 1 | **Check-then-insert availability race.** A "is it free?" SELECT followed by an INSERT lets two requests both pass the check. Fixed by dropping the check and letting the unique partial index decide. | wrong (concurrency) | `migrations/001_initial_schema.sql` (`bookings_one_active_per_booth_date`), `BookingRepository.insert` | idea |
| 2 | **Idempotency key scoped per customer.** A global key lets customer B send customer A's key and get A's booking back. The primary key is `(customer_id, key)`. | insecure (missing authorization) | `migrations/002_idempotency_keys.sql`, `IdempotencyRepository` | idea |
| 3 | **Request-hash check on key reuse.** Without it, the same key with a different body silently returns the first booking, so the client thinks its second request succeeded. Now it's a 422 `idempotency_key_reused`. | wrong (subtly non-idempotent) | `hashRequest` and `createBooking` in `bookingService.js` | idea |
| 4 | **Key claimed in the same transaction as the insert.** If the key were saved separately and the insert then failed, a retry would find a dead key. In one transaction, both roll back together. | wrong (unsafe retry) | `createBooking` in `bookingService.js`, `withTransaction` | idea |
| 5 | **`FOR UPDATE` on cancel.** Without the row lock, a cancel and a payment confirm on the same booking can overwrite each other (lost update). | wrong (concurrency) | `cancelBooking`, `BookingRepository.findById({ lock: true })` | idea |

### Added as we work

_Planned: Phase 1 will add the `fakeAuth` entry (trusted client input: 500s on bad ids, spoofable `X-User-Role: staff`)._

---

## Notes for writing up

- Write the entry **at the time** it happens, while the prompt and the wrong output are still on screen.
- Keep the real prompt. A paraphrase is weaker evidence.
- The strongest entries have a test or script that fails on the assistant's version and passes on mine.
- Be ready to explain every line of the fix in the oral defense.
