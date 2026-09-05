# Totontepec Mixe (mto) TS → C# port — investigation log

Port of `src/languages/totontepecmixe/{totontepecmixe,normalize,numbers}.ts` (249 lines, 3 modules) to
`csharp/Vernacula.Phonemizer/Languages/TotontepecMixe/`. Contract: `csharp/PORTING.md`.

## Run 1 — 2026-08-31 — read the source, write the four files

Read `totontepecmixe.ts` (125), `normalize.ts` (36), `numbers.ts` (88), `totontepecmixe.jsonc` (43),
`test/totontepecmixe.test.ts` (91), and `docs/investigations/mto/mto_native_bringup_investigation.md`.
Files written: `Manifest.cs`, `Numbers.cs`, `Normalize.cs`, `TotontepecMixe.cs`, plus the `Bootstrap.cs`
registration. `Registry.cs:589` already routed `mto` → `Create("totontepecmixe")`. No roman policy, no
initialisms, no symbol tier — see Run 2 for why the normalizer is one line.

Two things in the scan needed care and are spelled as escapes in the C# so nobody "fixes" them:

- The strip regex is `[̱̲́̀]` — the underline diacritic plus the acute/grave stress
  marks, applied between an NFD and an NFC. In the TS those four are literal combining marks inside a
  character class, i.e. invisible in the source.
- `NATIVE_CLASS` reads `[a-zäëöüáéíóúÄËÖǛ-ͯʼꞌ'’`-]` in the TS, and **that ⟨Ǜ⟩ is not a precomposed
  letter** — it is ⟨Ü⟩ U+00DC followed by U+0300, so what follows is the RANGE U+0300–U+036F, the
  combining marks. Written out as `ÄËÖǛ-ͯ` here. Reading it as a single precomposed ⟨Ǜ⟩ would
  have silently dropped the whole combining range from the nativiser's inventory.

## Run 2 — 2026-08-31 — ⚠ THERE IS NO GOLDEN, AND THREE OF THE FOUR GATES ARE VACUOUS

**Question.** PORTING.md says "A language is DONE when its rows are byte-identical, not before." What
does the gate say?

    $ ls csharp/goldens/ | grep -i mto
    (nothing)
    $ dotnet run --project csharp/tools/parity -- mto
    0 languages byte-identical, 0 differ (0 rows ok, 0 differ)

**Finding — and it is the central fact of this port.** *`mto` has no golden, deliberately.*
`tools/gen_parity_goldens.mts:142` says so in as many words:

> ⚠ `mto` IS DELIBERATELY ABSENT: its ASJP list carries only 3 usable headwords, under the floor, so it
> stays ungated until it has a real source.

Three. `tools/referee-eval/referees/mto.asjp-swadesh.tsv` is three lines long (ök, üts, këp). There is no
FLEURS split, no `tools/corpus/mined/mto.jsonc`, no `tools/corpus/attest/mto.jsonc` and no
`data/languages/totontepecmixe/*.tsv`. The bring-up doc records ~65 Wiktionary lemmas, none of which are
in this checkout.

⚠ **AND THE OTHER GATES INHERIT THAT.** They are golden-driven, so on `mto` they do not fail — they
report nothing, which reads identically to passing if you are not looking:

    $ … -- mto --provenance   → 0 languages · tokens 0/0 (NaN%)
    $ … -- mto --ipaspans     → 0 languages · tokens 0/0 (NaN%)
    $ … -- mto --poison       → distinct poison sites: 0

`NaN%` is the tell. **Three of the four seam gates are vacuous here**, and quoting their "0 wrong" as
evidence would be reporting the absence of a measurement as a clean measurement. (The poison figure is
additionally uninformative for a different reason: this normalizer makes no `Rewrite` call of its own, so
zero sites is what an empty file scores.)

So the definition of done has to be rebuilt for this port, and Runs 3–5 are that:
1. the TS test file ported in full (it is this language's real golden — 24 numeral rows and 13 g2p rows,
   every one an authored value with a citation behind it);
2. a large TS↔C# differential, which is the only instrument that can still speak;
3. a **temporary, uncommitted** `csharp/goldens/mto.tsv` generated *from the TypeScript engine*, purely so
   the provenance and ipaspans instruments have rows to walk — deleted afterwards, and **never committed**,
   because `gen_parity_goldens.mts` made a deliberate decision that mto stays ungated until it has a real
   source and a golden minted from our own engine is not that source.

## Run 3 — 2026-08-31 — the differential, which is now the primary instrument

Probe project in `.probe/mto/` (gitignored, own `<lang>` subdirectory), generator a **script file** taking
paths as argv. Four entry points per line: `phonemize(l,"mto")`, `phonemizeWord(l)`,
`normalizeTotontepecMixe(l)` and `numberToWords(n, raw)`.

⚠ **THE PROBE SET IS ENTIRELY SYNTHETIC, because there is no text.** No FLEURS, no mined corpus, no
attest artifact; the only in-repo text is the three-line ASJP referee. So unlike every other port in this
sweep there is no "what fraction of the real corpus exercised this" table to produce — there is no real
corpus. 5,861 lines:

- the referee's three headwords and every word the TS test file names;
- every grapheme the manifest carries — 5 digraphs, 9 vowels, 20 consonants, 5 apostrophe shapes — alone,
  initial, medial, final, doubled, and after each of the two voicing nasals;
- each allophony arm and the neighbour that must decline it: ⟨m n⟩ × 14 following segments, every
  vowel × vowel frame around ⟨d⟩ and ⟨g⟩, ⟨ny⟩/⟨hn⟩/⟨nh⟩/⟨hm⟩/⟨mh⟩ in both orders, and the word-final
  ⟨v⟩ terminus after /a/, after a short vowel, after a long vowel and after a consonant;
- the underline and the acute/grave in every position, alone and stacked;
- 4,500 random walks over the orthography, half with the diacritics interleaved;
- non-native letters and mixed scripts (the nativiser's job);
- **every numeral 0–1199** — i.e. the whole attested range exhaustively, plus the 1000 boundary — and the
  safe-integer edge, a 41-digit run, and numerals in running text with the punctuation branch.

**Finding.**

    rows 5861 | TS throws 0, C# throws 0
    phonemize      differ: 0
    phonemizeWord  differ: 0
    normalize      differ: 0
    numberToWords  differ: 0

23,444 comparisons, 0 divergent. Separately, every one of the 37 authored values in
`test/totontepecmixe.test.ts` reproduces exactly in C#, including the suite's property test that no
sentinel and no raw digit appears anywhere in 0–999.

## Run 4 — 2026-08-31 — making the vacuous gates speak, then putting things back

**Question.** Run 2 established that provenance and ipaspans have no rows to walk. Can they be made to
say anything without changing what the repo ships?

Generated 200 sentence-shaped rows (words, numerals, punctuation, in the proportions running text would
have) and ran them through the **TypeScript** engine to produce a golden-shaped
`input \t IPA` file. Copied it to `csharp/goldens/mto.tsv`, ran the gates, **deleted it**:

    $ dotnet run --project csharp/tools/parity -- mto              → mto OK 200 rows · 0 differ
    $ … -- mto --provenance   → tokens 1593/1593 (100.0%)
    $ … -- mto --ipaspans     → 1237/1237 (100.0%) · spans not covering what the token emitted: 0
    $ rm csharp/goldens/mto.tsv     # 189 goldens before, 189 after; `git status` clean

⚠ **THAT FILE MUST NOT BE COMMITTED AND IS NOT.** `gen_parity_goldens.mts` made a deliberate decision
that mto stays ungated until it has a *real* source, and a golden minted from our own TypeScript engine
is not one — it would turn "the two engines agree" into something that looks like "the engine is
correct", which is precisely the confusion the exclusion exists to prevent. The 200 rows are a
measurement, not a gate.

`seam-parity` needs no golden and is genuinely clean: **totontepecmixe 0 / 0, gap 0** — both sides make
zero `rewrite` calls of their own, which is right, since the normalizer's only statement is a call into
`separatorHygiene` whose rewrites live in core.

Whole fleet after the port: **185 languages byte-identical, 35,695 rows, 0 differ** (unchanged — mto adds
no rows because it has no golden). C# suite **6,198/6,198**.

⚠ **AND THE PORT BROKE A TEST, WHICH IS EXPECTED MAINTENANCE.**
`LanguageBootstrapTests.UnportedLanguageIsReportedRatherThanGuessedAt` used `mto` as its sample of a
still-unported language, and its own comment records the rule ("it was `de` until German landed, and
`nci` until Classical Nahuatl"). Repointed at `hyw`. ⚠ But the *heuristic* in that comment is now
exhausted and I rewrote it rather than moving the code name: it said to pick a language with no golden,
because a language with nothing to be byte-identical to has no gate and so is the least likely next port
— and **mto was the last such language**. All four codes still unported (cy, hyw, sk, tk) carry a 200-row
golden, so that line will now need editing every batch.

## Run 5 — 2026-08-31 — reading for correctness: one finding, and it is a real one

PORTING.md's three questions:

1. **Does the code do what its docstring promises?** Yes for every documented pass. But
   `totontepecmixe.ts:31` declares `isVowel` and **nothing calls it** — dead code, found by reading.
2. **Is every table reached?** All six manifest slices are consulted, and `ManifestMappingTests` now
   gates the key set. One member is unreachable: `velars` carries `ɣ`, but the intervocalic lenition that
   produces [ɣ] runs left-to-right at the *current* index and never rewrites the segment being looked
   ahead to, so `next.ph` can only ever be an un-lenited `ɡ`. Data redundancy, identical in the TS,
   nothing at stake — recorded because the question was asked.
3. **Which path does the instrument measure?** ⚠ **NOT THE SAME PATH, and this is the finding.**

### FINDING (filed, not fixed) — the dead `isVowel`, and the two engines it leaves behind

The scan's MISS branch — a letter with no digraph, vowel or consonant rule, handed to
`core/latinPhones.ts` — pushes `{ ph, vowel: false }` unconditionally. But `latinPhone` returns genuine
**vowel** phones for letters that reach it: measured over the Latin-1 and extended letters that fall
through both tables, `å`→[oː], `æ`→[æ], `œ`→[œ], `ø`→[ø], and the circumflex/tilde/ring vowels
`â ã ô õ î û`→[a o i u] (the acute and grave are stripped upstream, so only these survive to the miss
branch). Every one is marked a consonant. The unused `isVowel` helper is exactly the predicate that
would have classified them, which is presumably what it was written for.

The consequence is demonstrable, and both engines reproduce it identically:

    phonemizeWord("aoda") → aoða      phonemizeWord("aøda") → aøda
    phonemizeWord("aoga") → aoɣa      phonemizeWord("aøga") → aøɡa

⟨d⟩ between two vowels lenites; ⟨d⟩ between a vowel and a miss-branch vowel does not.

⚠ **AND THE SHIPPED PATH AND THE EXPORTED ONE DISAGREE ABOUT IT**, which is the `pa` shape PORTING.md's
question 3 names:

    text("aøda")           → aoða     ← the nativiser folds ø→o first, so the lenition fires
    phonemizeWord("aøda")  → aøda     ← no nativiser, so it does not

`text()` runs `nat()` before `phonemizeWord`, folding the non-native letter onto its base and hiding the
defect; the exported `phonemizeWord` — which `test/totontepecmixe.test.ts` calls directly and which
referee-eval calls — does not. So the two entry points are different engines for exactly the inputs the
dead helper was meant to cover.

**Practical severity is low right now**: mto's referee is the three ASJP headwords (ök, üts, këp), none
of which contains a miss-branch letter, so no measured number is currently wrong. **Filed rather than
fixed**, per PORTING.md: the fix belongs in the TypeScript first, with a test, and — since it would move
`phonemizeWord` output — the goldens of any language sharing the shape would have to be regenerated. Not
something to slip into a port commit, and mto has no golden to regenerate anyway.
