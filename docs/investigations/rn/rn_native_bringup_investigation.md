# Kirundi (rn) native bring-up

Kirundi / Ikirundi (rn) — Bantu, Rwanda-Rundi (JD62); the principal language of Burundi and a national language
(~11M incl. L2). Latin orthography. Kirundi and Kinyarwanda (rw, JD61) are mutually intelligible — Kirundi is a
**near-clone** of the already-done rw, so this bring-up reuses the rw engine.

**Scope gate — passes, but the WEAKEST referee of the recent bring-ups.** The only machine referee is **epitran
run-Latn**, which is (a) rule-based → an epitran-vs-ours comparison is partly **circular** (like uz/lg), and (b)
**crude** — a 33-entry map with no pre/post rules, no vowel length, and no ⟨ng⟩→ŋ. No kaikki/wikipron `run`. The
`bho` doubly-circular trap is *avoided*, though: epitran `run` is genuinely DIFFERENT from `kin` (it encodes real
Kirundi features — see below), so it is not just a relabelled Kinyarwanda clone.

## Run 1 — near-clone reuse, 91.7% folded

**Method.** Diffed epitran `run-Latn` vs `kin-Latn` and ran the *existing rw engine* against a `run` referee (the
shared CC0 Common Voice wordlist, 1600 words). The rw engine already matched `run` on 1251/1600 (78%) with zero
Kirundi work — confirming the near-clone. The 349 divergences fall into four classes:
1. **⟨j⟩**: rw ʒ vs run d͡ʒ. This is the **textbook Kirundi/Kinyarwanda difference** — Kirundi ⟨j⟩ is the voiced
   palatal *affricate* [d͡ʒ], Kinyarwanda's is the *fricative* [ʒ]. → the ONE delta we adopt (j→d͡ʒ).
2. **NC-spirantisation**: run mp→mh, nt→nh, nk→ŋx (blanket). Only epitran attests this — Wikipedia is silent, Cox
   isn't on hand, and [mp]→[mh] (p fully → h) looks over-applied. → we do NOT follow it (unverified); it is the
   bulk of the residual (~100 words).
3. **⟨ng⟩**: rw ŋ (Cox) vs run n+ɡ. epitran run is DEFICIENT (lacks the ⟨ng⟩→ŋ entry that `kin` has). → we keep ŋ,
   fold the referee's nɡ→ŋ.
4. **Vowel length**: rw aː vs run aa. epitran run has NO length entries, though Wikipedia confirms Kirundi length is
   phonemic. → we keep aː, fold it away for scoring (epitran can't provide it).

**Module.** `src/languages/kirundi/{kirundi.ts, manifest.ts, kirundi.jsonc, numbers.ts}` — the rw greedy scan +
grapheme table + Cox palatal series verbatim, with **j→d͡ʒ** the only change. Reuses the rw number words (shared).

**Result.** `npx tsx tools/referee-eval/eval.ts rn` → **91.7% folded (1467/1600)**, raw 80.3%. Folds: ʲ~j
(palatalisation), tie-bar, length ː (epitran deficient), nɡ→ŋ (epitran deficient). The ~8% residual is exactly the
**spirantisation we deliberately don't clone** (~100 words) + **⟨c⟩→t͡ʃ** (Cox) vs epitran's [c] (~30 — the same
residual rw has). rn differs from rw ONLY on ⟨j⟩ (ijana→id͡ʒana vs iʒana), otherwise byte-identical.

## Verdict: 🔷 single-source near-clone (weaker than rw)

Kirundi is faithfully a near-clone of rw, grounded in the Cox comparative grammar (which covers both languages),
with the one well-attested delta (⟨j⟩→d͡ʒ). But its verification is the weakest of the recent bring-ups: the only
referee (epitran run) is rule-based (partly circular) AND crude, and the one genuinely Kirundi-specific process it
encodes — NC-spirantisation — cannot be independently confirmed, so we conservatively do not implement it (and it
sits unresolved in the residual). Deferred: **TONE** (H/L, unwritten, as in rw) and the finer NC-spirantisation
question. Gold: `test/kirundi.test.ts`. Floor `rn: 0.90`.
