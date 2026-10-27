# Example — The Stuck Protocol in Action

Three realistic failures from autonomous builds and how the protocol resolves them without a human.

---

## Case 1: native dependency will not install

```text
npm i bcrypt
gyp ERR! stack Error: not found: make
```

- Attempt 1: retry install → same error. Attempt 2: `npm rebuild` → same error.
- **Hypothesis (written to PROGRESS.md):** no C toolchain in the environment; prebuilt binary unavailable for this platform.
- **Change approach, not parameters** (ref 22 §2): use a pure-JS or built-in alternative — Node's `crypto.scrypt`.
- Logged as a decision (D-004) with the trade-off. Total time lost: ~3 minutes instead of a long install-retry loop.

## Case 2: a test passes alone but fails in the suite

```text
✖ sessions expire
  Expected 401, received 200
```

- Classified as **test isolation**, not a product bug: another test advanced the shared clock /
  reused a session (ref 22 §4).
- Wrong fixes the protocol forbids: adding `sleep`, deleting the assertion, marking it skipped.
- Right fix: inject the clock (`createApp({ now })`), give each test file its own in-memory DB and
  its own users. The test now fails if expiry is broken and passes deterministically otherwise.

## Case 3: a feature will not converge

Goal: drag-and-drop task reordering with persistent order.

- Approach 1 (fractional ranks): 3 attempts, precision bugs after many moves.
- Approach 2 (integer positions with renumbering): conflicts under concurrent edits, flaky e2e.
- Budget exhausted (2 approaches × 3 attempts) → **stuck protocol step 4:**
  1. Cut the optional part: ordering is a *should*, not a must (PRD).
  2. Remove the half-built UI so there are no dead affordances; keep `created_at` ordering.
  3. Record `B-005 drag-and-drop ordering — two approaches tried, notes on why each failed`.
  4. Mention it in the delivery report's limitations.
- The core loop stays green and shippable.

---

## Signals that you are looping (stop immediately)
- The same error text three times in a row.
- Reverting your own previous edit.
- Editing a test so it agrees with behaviour the PRD says is wrong.
- Adding sleeps, retries or `any`/`# type: ignore` to make red turn green.
