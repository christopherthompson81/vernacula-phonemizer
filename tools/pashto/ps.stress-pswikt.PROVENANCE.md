# ps.stress-pswikt.tsv — provenance

**Artifact:** `tools/pashto/ps.stress-pswikt.tsv` — 463 `word ⇥ IPA-with-ˈ` rows. The repo's **only** Pashto
stress referee. Tools-only; not under `src/`, not loaded by the runtime.

## Source and licence

**ps.wiktionary**, same dump and same builder as the silver tranche —
`build_pswiktionary_silver.py --stress-out` — so the licence is identical: Wikimedia content, **CC-BY-SA 3.0
/ GFDL**. See `tools/perso-arabic/silver.pswikt-ps.PROVENANCE.md` for the source, the romanization map, and
the corruption in the dump. Regenerate with the command there plus `--stress-out`.

## Why it exists

`phonemizeWordCore` assigns stress by rule, and **the referee-eval BACKBONE fold strips stress before
comparing**, so `eval.ts` has never been able to see it. The rule shipped unmeasured from the day the engine
was written until 2026-08-11. ps.wiktionary's romanization marks the accent on **87% of its values**, which
is the only Pashto stress data within reach of this repo.

## Membership: stricter than the silver

A row needs everything the silver tranche needs (skeleton check, mapped characters, single word), **plus**:

- **exactly one accent.** 17 values carry two — real compound stress (`arzán-báya`, `ánd-o-žwánd`) — and
  which is primary is a question the dump does not answer. Kept out rather than guessed at.
- **the accent must land on a vowel.** A few sit on a consonant or a stray Greek iota, i.e. typos.

603 single-word values with a non-empty template → **463 rows**.

## ⚠ What it is evidence about, and what it is not

**POSITION ONLY.** The segments in this file come from the same romanization map as the silver and are no
better than it — ps scores ~47% segmentally, and comparing whole stressed strings would just report that
error again. `eval_ps_stress.ts` therefore compares **which nucleus** carries the accent, and only on words
where both sides have the same nucleus count (390 of 463; the other 73 are segmental failures, reported
separately rather than scored as stress errors).

⚠⚠ **AND IT IS CIRCULAR AGAINST THE SHIPPED LEXICON UNLESS THE TOOL EXCLUDES IT.** This referee is built from
ps.wiktionary, and so is a silver tranche of `pashto/lexicon.tsv` — **197 of these 463 words carry a lexicon
row mined from the very romanization scored against**. Those rows fix the short vowels, which decides the
nucleus count the stress index is measured over. `eval_ps_stress.ts` therefore excludes ps.wiktionary-derived
lexicon rows **by default**; `--shipped` restores the circular figure and is not the number to quote.

```
                            comparable   accuracy
shipped lexicon                    390    83.8%
ps.wiktionary rows excluded        314    75.5%   ← what the tool reports
```

An engine rule change was built on the 83.8% figure and reverted when this was found (investigation Run 17).

⚠ **And the register caveat from the silver applies here too** — these are largely Pashto Academy
neologisms and compounds. Compound stress may not generalize to ordinary vocabulary. The 463 rows are the
only stress evidence available, not a representative sample of the language.
