# Should a pronounceable uppercase Latin run spell out? — a measurement pass

`core/initialisms.ts` decides in five steps, and the last one is the question:

```
tok.length < 2        -> spell     attached code, a letter never a word
acronymLetters.has    -> spell     lexical: a listed exception
isRecorded            -> word      lexical: the dictionary owns it
isUnreadable          -> spell     OOV: nothing else could be said
otherwise             -> WORD      OOV but pronounceable
```

The objection, raised after the `ucla` result: that final line is an **English phonotactic test deciding
what a Turkish or Greek reader does with foreign letters**. A native speaker code-switches on a Latin
acronym; whether the letters happen to be syllabifiable in English is beside the point. Evidence pointed
the same way — the Greek reader spelled `ucla`, a perfectly pronounceable run.

**Verdict: REJECTED, at 0.11:1, and for a better reason than the ratio.**

## Run 1 — 2026-08-20 — the A/B

**Command.** A temporary scaffold in `core/initialisms.ts` making the last step spell out under
`SPELL_PRONOUNCEABLE=1`. Every corpus row whose text carries an uppercase Latin run of ≥2 letters —
**16,390 rows across 101 languages** — phonemized both ways and scored against the recognizer. Scaffold
reverted after.

**Raw finding.** 3,017 rows changed.

```
lang       better  worse   gained     lost    ratio
  et_ee         9      2    0.158    0.007   21.3:1
  ga_ie        12      5    0.168    0.056    3.0:1
  sv_se        13      3    0.142    0.070    2.0:1
  de_de         8      3    0.068    0.030    2.3:1
  hu_hu         9      9    0.127    0.097    1.3:1
  …
  tr_tr         4     48    0.060    0.424    0.1:1
  gl_es       253    209    0.492    2.375    0.2:1
  cy_gb         2    238    0.042    2.172    0.0:1
  es_419        5    573    0.073    6.421    0.0:1
  ca_es        14    625    0.201    8.061    0.0:1
  it_it         7    814    0.185   10.781    0.0:1

TOTAL   gained 3.495   lost 31.360   =  0.11:1
```

## Run 2 — 2026-08-20 — WHY it loses, which is the part worth keeping

The losses are one token. `UN` — ×802 in Italian, ×627 Catalan, ×571 Spanish, ×436 Galician, ×215 Welsh.
That is the **Romance indefinite article**, and `un` is in `INITIALISM_UPPERCASE` because the UN
organisation is spelled out in English.

It is on that list safely, and the reason is exactly the step the inversion would remove:

```
it  un=ˈun    UN=ˈun      same        ca  un=un   UN=un     same
es  un=un     UN=un       same        gl  un=uŋ   UN=uŋ     same
cy  un=ˈɨːn   UN=ˈɨːn     same        fr  un=ˈœ̃   UN=ˈœ̃    same
en  un=ˈʌn    UN=jˈuː ˈɛn  ⚠ DIFFERENT — and correct, English spells it
```

**The repair list can contain collision-prone tokens BECAUSE a pronounceable run falls through to the word
reading.** That is the "collision test" the list's own docstring refers to (`usa` "passes the collision
test the same way `un` did"). Inverting the default deletes the property the list is built on, and reads
2,651 occurrences of the Romance indefinite article as letters.

**Implication.** The current default is not arbitrary and not an English accident — it is load-bearing for
the casing repair one layer up. The English phonotactic test is a poor *description* of the rule, but the
rule it implements ("when in doubt, a pronounceable run is a word") is what makes an aggressive,
cross-language uppercase list safe.

## What to do about the real cases instead

The objection was right that `ucla` was mis-read. The architecture already prescribes the fix, and the
Turkish module names it while declining to guess:

> *readable-but-letter-spelled acronyms — AOL ×3, CEO ×2, USOC ×2, IOC, IP, CET. The phonotactic OOV test
> lets them through as words because they ARE syllabifiable; whether Turkish spells each of them out is a
> lexical fact I could not source per token, and `acronymLetters` is where it would go if I could.*

So the vehicle exists (`acronymLetters`, per language, 41 engines wire it) and the blocker is **sourcing**,
not mechanism. This corpus can now source it — that is what the `ucla` entry is — but only where the
sample supports it:

- `ucla` worked because FLEURS is parallel: 22 languages × the same sentence, and one row moved 0.21.
- Turkish's own list (AOL ×3, CEO ×2, USOC ×2) is **below the noise floor** established in run 59: effect
  sizes of ±0.01 on three rows are indistinguishable from recognizer error.

**So: no default change. Add `acronymLetters` entries per language where the audio can carry them, and
accept that most tokens cannot be sourced this way.**

## ⚠ And the "22 languages cannot spell Latin acronyms" framing was overstated

Run 59 called it a hole that a Latin run in a non-Latin host is routed to the ENGLISH engine whole
(`ru UNESCO → juːnˈɛskoᶷ`). On the evidence here that reads as a reasonable default rather than a defect:

- **The corpus itself shows readers code-switching to English for Latin material.** The Greek reader spelled
  `ucla` as *yoo-see-el-ay* — **English letter names**, not Greek *ipsilon-si-lamda-alfa*. Where the source
  is Latin, the reader reached for English, which is what the fallback already does.
- A Russian reader saying UNESCO produces something much nearer [juˈnɛsko] than any Cyrillic-native reading
  of those letters would be. English is not an arbitrary choice for foreign Latin material; it is the
  language most of that material comes from.
- The inversion would not have touched these languages anyway: `ru UNESCO` is unchanged under the scaffold,
  because a Latin run in a Cyrillic host never reaches this pass at all.

What remains true is narrower and worth stating that way: the English fallback renders with full American
phonology, `ɚ` and all, so a residual accent question exists for long Latin words in a non-Latin stream.
Nothing measured here says that is costing anything, and no change is proposed.

## Closing this line

The question is answered rather than left open. The default stays; `acronymLetters` is the vehicle for the
cases that are genuinely wrong; and this corpus can source an entry only where the sample carries it, which
for most tokens it does not.
