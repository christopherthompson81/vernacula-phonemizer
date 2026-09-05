# The shared symbol tier's required fields — making the tier declarable by a language that cannot fill every cell

`SymbolData.percent` in `src/core/normalizeSymbols.ts` was a REQUIRED field and its arm unconditional, so a
language with no sourceable percent word could not declare the shared tier at all. Reported by the shi
(Tashelhit) run — see `docs/investigations/shi/shi_normalization_investigation.md` and the header of
`src/languages/tashelhit/normalize.ts`, which names it as a fifth reason for playbook trap 47's list: not
idiom, not ordering, but a mandatory data field the language cannot fill.

This log is the fix, the audit of the other fields, and the measurement that the change is inert for the
languages already on the tier.

---

## Run 1 — 2026-08-13 19:5x — the field audit

**Question.** Which fields on `SymbolData` are required, and which of those are genuinely load-bearing?

**Command.** Read of the interface in `src/core/normalizeSymbols.ts`, then
`grep -rn "percent:" src/languages/*/*.ts` for how the field is actually sourced.

**Raw finding.** Of the SIXTEEN top-level fields on `SymbolData`, exactly ONE was required:

| field | before | genuinely load-bearing? |
|---|---|---|
| `percent` | **required** | **no** — the defect; see below |
| `currency`, `units`, `magnitudes`, `magnitudeConnective`, `rateDenominators`, `unitPer`, `exponentWords`, `bareExponent`, `multiply`, `ampersand` | optional | n/a — each already has a documented "undeclared ⇒ arm skipped" path |
| `countForm`, `percentPrefix`, `currencyPrefix`, `unitPrefix`, `unspacedScript` | optional | n/a — behaviour switches with defaults |

So the audit's count is **1 field required, 1 made optional, 0 left required**. Two NESTED requirements
were checked and are being KEPT:

* `multiply.times` — required inside `multiply`. Load-bearing: the object exists only to carry it, and `by`
  is documented as defaulting to it, so a `multiply` without a `times` has no meaning to fall back on. A
  language with no multiplication word omits `multiply`, which is already the supported route.
* `SignWords` — all nine required, but that interface is NOT read by the tier (each language's own
  normalize.ts applies it) and is already defended by `test/manifest-signwords.test.ts`. Out of scope, and
  deliberately so: the sign words are the case where a partial declaration IS a defect.

**How `percent` is sourced, which decides the hazard.** 86 of the 88 tier consumers write a literal
(`percent: ["…"]`). TWO source it from a manifest — `abkhaz/normalize.ts` (`[MANIFEST.symbols.percent]`)
and `yoruba/normalize.ts` (`[SYM.percentBefore]`). That is exactly the `loadManifest<T>` casting hazard
this module's own header states and that `test/manifest-signwords.test.ts` exists for: a .jsonc that lost
the key type-checks CLEANLY and the miss reaches the output as the literal six-letter word `undefined`.

**Implication.** Making the field optional is a two-sided change, not a one-sided one. ABSENT must be inert
(arm skipped, sign left visible) and MALFORMED must be LOUD — otherwise optionality converts a manifest
typo from a crash into a silent dropped sign. The type cannot express that difference, so it is enforced by
a construction-time check (`assertForms`) and asserted by two tests.

---

## Run 2 — 2026-08-13 20:0x — the core change, and is it inert?

**Question.** Does making `percent` optional change ANY reading for the 130+ languages already on the tier?

**Commands.**

```
npx tsc --noEmit
npx vitest run
# baselines emitted from the CLEAN tree before any edit, then re-emitted after it:
corpus-diff.ts emit --lang <l> --corpus mined:<l> --out <l>.before   # pre-change
corpus-diff.ts emit --lang <l> --corpus mined:<l> --out <l>.core     # post-change
corpus-diff.ts compare --before <l>.before --after <l>.core --corpus mined:<l>
```

Five languages NOT converted, chosen to hit different arms of the tier: **ru** (Slavic `countForm`,
three-way percent agreement), **tr** (`percentPrefix`), **sw** (`currencyPrefix` + `unitPrefix`), **ml**
(the "already said it" percent suppression — the `93% ശതമാനം` case), **es** (`magnitudeConnective`). Plus
**shi**, which at this point is still on its local table and should be untouched.

**Raw finding.**

* `npx tsc --noEmit` — clean.
* `npx vitest run` — 242 files, 4010 passed, 5 skipped, 0 failed. ⚠ Notably the new `assertForms` check did
  NOT fire anywhere in the fleet: no shipped language declares an empty or undefined count form. That is a
  real result, not a vacuous pass — it says the validator can be added without an allowlist.
* corpus-diff `compare`, all six: **`first 0 changes`** each. Leak/DROP summaries identical on both sides
  (ru/tr/sw/ml/es all zero; shi `DROP 172` before and after, its known refusals).

**Implication.** The change is inert for existing consumers, by construction and by measurement: the percent
arm is now built and run only under `d.percent !== undefined`, which every existing consumer satisfies, so
the only reachable difference is for a language that omits the field — of which there are none yet. Safe to
proceed to the shi conversion.

---

## Run 3 — 2026-08-13 20:0x — converting shi to the tier

**Question.** Does moving shi's local unit/rate/exponent/currency table onto the now-declarable tier change
any reading?

**Command.** Rewrote `src/languages/tashelhit/normalize.ts` steps 5 and 7 as one `makeSymbolNormalizer`
declaration (no `percent` key), then:

```
corpus-diff.ts emit --lang shi --corpus mined:shi --out shi.after
corpus-diff.ts compare --before shi.before --after shi.after --corpus mined:shi
```

plus a 47-string spot probe running the OLD and NEW `normalizeTashelhit` side by side on every shape the
two implementations could plausibly disagree about.

**Raw finding — the corpus.** `changed 0/402 (0.0%)`, leak/DROP summaries identical (`DROP 172` both
sides). The whole retained corpus reads byte-identically.

**Raw finding — the probe.** Three differences on the first pass, and two more the corpus could not see:

1. `5 M` — old `5 mitru`, new `5 M`. **Improvement, and the tier is right.** The local rule was
   case-insensitive across ALL keys including the one-letter `m`; the tier folds case only for
   MULTI-character symbols, because a bare ⟨M⟩ is molar, or millions, or Roman 1000 — never metres. shi
   inherits that measurement instead of contradicting it.
2. `$1.5` — old `1 dulaṛ 5`, new `1 5 dulaṛ`. **Improvement.** The local layer ran currency LAST, after the
   decimal step had already split `$1.5` into `$1 5`, so the noun landed inside its own number. The tier
   runs before the decimal step. No such instance in this corpus; the shape was reachable.
3. `$440 mlyun` — old `440 mlyun dulaṛ`, new `440 mlyun n dulaṛ`. **A REGRESSION, and it was mine, not the
   tier's.** I had declared `magnitudeConnective: "n"` to make the corpus's `€3 id mlyun n Wuṛu`
   suppression work. But shi writes the linker after the PLURAL magnitude only — `2 id mlyun n Uṛu`,
   `€3 id mlyun n Wuṛu` against `40 mlyun dulaṛ`, `440 mlyun dulaṛ amirikani`, `18 mlyun Uṛu` — and the
   field is one string for every magnitude. Backed out. The suppression is now carried by extra `currency`
   entries (`"€": ["uṛu", "n Wuṛu", "n Uṛu"]`), which the tier documents as the purpose of further
   CountForms — the guard tests every declared form — with `countForm: () => 0` so they can never be SAID.
   Re-probed: 0 regressions, only the two improvements above.
4. `60000 m²` — old `mitr amkkuẓ`, new `mitru amkkuẓ`. **Caught by `test/tashelhit.test.ts`, NOT by the
   corpus diff**, because every squared unit in the artifact is `km²`. ⚠ THIS IS A REAL LIMIT OF THE TIER
   AND IS WORTH RECORDING: shi's metre loses its final vowel under a measure word — `1 351 m` is *mitru*
   alone, but `60,000 id mitr amkkuẓ` and `24.3 mitr mukaɛɛab` are the annexed form. `exponentWords`
   composes head + measure word and cannot change the HEAD, so composition produced a form the corpus does
   not write. The kilometre has no such alternation, which is why the defect hid. Fixed by declaring
   `m²`/`m2`/`m³`/`m3` as explicit `units` keys — the same escape hatch already needed for `m³/s`.
5. `24.3 m³/s` — preserved only BECAUSE of that escape hatch. The tier composes an exponent on the
   DENOMINATOR (`katao/km²`) but not on the HEAD: after `m`, the alternation offers `/denominator` OR an
   exponent, never both, so a composed `m³/s` reads "mitr mukaɛɛab" and strands the `/s`. Declared whole.

**Implication.** The conversion is reading-neutral on the corpus and reading-POSITIVE on two probe shapes.
Two limits of the tier are now documented in the shi declaration rather than discovered again: no head
exponent under a rate, and no head-form alternation under a measure word. Both have the same workaround (an
explicit compound `units` key), which is why neither is being fixed in core here — a fix would be an
interface change with no second language asking for it yet.

**Also gained, and worth stating because it was invisible before:** `sources.ts --lang shi` now reports
`[ ok ] unit-word — 7 unit word(s) in the symbol tier, all attested`. That check greps the TIER declaration,
so a language with a local table is simply not covered by it. shi was uncovered; it no longer is.

---

## Run 4 — 2026-08-13 20:1x — the gates

**Command / raw finding.**

* `npx tsc --noEmit` — clean.
* `npx vitest run` — 242 files, 4010 passed, 5 skipped. (One intermediate failure, `test/tashelhit.test.ts`
  `60000 m²`, is finding 4 above — kept in this log because the corpus diff would have shipped it.)
* `corpus-diff compare` shi — `changed 0/402 (0.0%)`; ru/tr/sw/ml/es — `first 0 changes` each.
* `mine.ts scan --in tools/corpus/mined/shi.jsonc --lang shi` — unchanged from the shi run's own baseline:
  `DROP minus ×8`, `DROP degree ×5`, `LEAK RAW-LATIN km ×1`, `LEAK RAW-LATIN kg ×1`, `DROP exponent ×1`,
  `REDUNDANT currency ×1`. Every one is a refusal that file's header already argues for.
* `review.ts --lang shi` — the same 2 pre-existing FAILs (`sign classes: DROPPED minus`, `artifact scan`),
  both the documented refusals; the checklist rows are all `ok`.
* `sources.ts --lang shi` — `[chk?] percent-word: % in corpus, no declaration found`. ⚠ EXPECTED AND
  CORRECT: shi still declares no percent word. The tool reports the gap; it does not require it be filled.

**Implication.** Nothing regressed, and shi's refusal survived the conversion intact — which was the one
thing the task said must not be undone.

---

## Run 5 — 2026-08-13 20:1x — who else wrote a local table for this reason?

**Question.** Trap 47 lists four legitimate reasons a language keeps its own symbol table, and this defect
was reported as a candidate fifth. How many languages is the fifth reason actually true of, and does any of
them convert now?

**Command.** `grep -rln makeBareUnitNormalizer src/languages/*/normalize.ts` (the engines that keep a local
table call the shared bare-unit pass directly rather than `makeSymbolNormalizer`), then a read of each
file's header and body, and of any `docs/investigations/<code>_normalization_investigation.md`.

**Raw finding.** Ten files matched; TWO of them are not local at all — `somali` and `oromo` both declare
`makeSymbolNormalizer` WITH a percent word (`boqolkiiba`, `parsantii`) and call the bare-unit pass only for
the residue the tier refuses on purpose. So the real population is eight, and the fifth reason is true of
exactly **two** of them, shi excluded:

| lang | percent word? | why local, as the file states it | verdict |
|---|---|---|---|
| **bal** | **none** — `فیصد` is ×14 in WESTERN Balochi and ×0 in Southern; `سدی` is the century | *"the reason is this language's own percent refusal. `SymbolData.percent` is a REQUIRED field … A layer does not get to invent a word as the price of admission to a seam."* | **the same defect, named verbatim.** NOT converted — see below |
| **mos** | **none** — `\d ?%` is ×1,328 and the corpus never spells the reading; the one composed candidate has the wrong position | states reason 2 (noun before the figure), not the percent field | NOT converted — reason 2 is genuinely true of it |
| bm, ln | yes (`kɛmɛsarada`, `likolo ya mokama`) | reason 2, plus guards the tier has no field for | firmly local |
| ak | yes (`ɔha mu nkyekyɛmu`, preposed) | unstated; has a 60-character trap-12 redundancy window the tier's adjacency-only guard cannot do | firmly local |
| ht, hmn, ro | yes (`pousan`, `feem pua`, `la sută`) | unstated | **not this defect** — trap 47's "simply older than the tier" case. `ro` even re-implements `NOT_VERSION` by hand and says so |

**Why bal is NOT being converted even though the door is now open.** Its own comment answers it: the corpus
writes `چارسریکی کیلومتر` ("square kilometre") as WORDS already and `km/h` is ×0 in BOTH Balochi corpora, so
the rate and exponent paths — the whole of what the tier composes that a hand table cannot — would buy
nothing. What is left is a table of single substitutions, which is what a local table is allowed to be. It
also deliberately admits a decimal operand shape that the tier's `NOT_VERSION` rejects, so conversion would
CHANGE readings for no gain. Declining is the right call, and "the tier refused me" is no longer the reason.

⚠ THE ONE THING THAT WAS FIXED THERE IS THE COMMENT. `balochi/normalize.ts` asserted a fact about `src/core`
that this branch made false. A stale reason is how a layer drifts, so the paragraph now says the field is
optional, the door is open, and this layer is DECLINING rather than being refused — with the condition
under which to revisit (a rate or an exponent appearing in the evidence). Comment-only; `npx tsc --noEmit`
clean and `test/balochi.test.ts` 13/13.

**Implication.** The fifth reason was real but NARROW — two languages, and only one of them (shi) had
anything to gain. The three "older than the tier" engines (ht, hmn, ro) are a separate backlog that this
change neither helps nor hinders, and bm/ln/ak/mos are correctly local for reasons the tier still cannot
express. Trap 47's list is not being edited from this branch (another worktree owns the playbook), but the
fifth reason should now be recorded there as **spent**: the defect it described has been fixed.
