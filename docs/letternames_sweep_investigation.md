# `letterNames` sweep — investigation log

The narrow, repeated lift: move each ported language's `letterNames` and `phonotactics` — the two tables
`core/initialisms.ts` reads — out of its normalize.ts and into its manifest. Sixteen languages remained after
el, de, uk, es, pt and it were done as part of their own full-language lifts.

Worked in BATCHES from here, at the user's direction: the change is the same three lines per language, so the
per-language cost is the verification, not the edit.

## Batch 1 — nl, pl, hu, tr — 2026-08-25 06:00

**Method.** A generator (`lift_letternames.py`) parses `LETTER_NAME` and the `makeUnreadableTest` block out of
a normalize.ts and emits the JSONC; an applier appends it, deletes the inline tables and rewires the two call
sites. Mechanical, but each language is verified independently.

**0 of 47 probe readings moved** across all four languages, sync and async.

**Sweep.**

```
        letterNames  vowels  onsets  codas
nl            5        2       2       3
pl            4        2       2       4
hu            3        2       2       5
tr            4        2       2       3
```

`onsets` and `codas` swept 0 in every language on the first pass — the same probe gap the it lift hit, and for
the same reason: nothing reaches a cluster rule except an all-caps run whose readability turns on it. Adding
the loanword shapes each language actually licenses (SPORT, START, TEST, MARKT, KART) reached all eight.

## ⚠ Two test defects, both found by the tests failing on CORRECT data

**1. Turkish's vowel class is wider than its letter-name table, and that is right.** The first version
asserted that every character in `phonotactics.vowels` has a `letterNames` entry. Turkish's class carries the
loanword circumflexes ⟨â î û⟩, which have no distinct letter NAME — they are said as the base letter — so the
assertion failed on correct data. `core/initialisms.ts` already handles it: `d.letterName(...) ?? m[0]` falls
back to the character, so a gap spells the letter rather than leaking the string "undefined". Verified
(`KÂR` → `kˈaɾ`, no leak). Replaced with a test of the FALLBACK rather than a demand for coverage.

**2. Asserting a table's SHAPE does not test that anything reads it.** The phonotactics test checked the
manifest's own data and passed with `legalOnsets` emptied in a normalize.ts — the sabotage that should have
been its whole point. Fixed by adding a second sentence per language: a loanword-shaped run that must be READ
rather than spelled, which is the only observable that depends on the cluster tables. Sabotage now fails.

That second one is the recurring shape of this session in miniature: an assertion that passes whether or not
the code is right is worth less than no assertion, because it looks like coverage.

## Result

`nl`, `pl`, `hu`, `tr`: `letterNames` + `phonotactics` lifted, four `Manifest.cs` types extended, one batched
coupling test on each side. 0 readings moved; C# matches Node in both modes for all four. Parity 60 languages
/ 12,000 rows / 0 differ; 447 C# tests, 5,081 TS tests.

## Batch 2 — th, vi, cmn — 2026-08-25 06:40

**⚠ THE BATCH SPLIT ITSELF ON INSPECTION.** Six languages were queued as "letterNames only"; three turned out
to hold something else entirely.

- **th, vi, cmn** hold a Record keyed by UPPERCASE LATIN — a SPELLING map, for an embedded foreign run. These
  lift as `letterNames`.
- **ta, te, kn** hold an ARRAY of native-script letter names used to BUILD A REGEX that RECOGNISES a
  dot-separated initialism run in the native script. That is a different fact with a different shape and a
  different purpose, and calling it `letterNames` would file two things under one name — the `PREFIX_GUESS`
  shape. Deferred to its own batch, to be lifted under a name that says what it is.

**No phonotactics for any of the three**, and that is not an omission: the OOV spell-it-out test does not
apply. A Latin run inside a Thai, Vietnamese or Chinese sentence is spelled because it is FOREIGN, not
because its consonant clusters are illegal.

**0 of 24 probe readings moved**, sync and async. Sweep: th 2, vi 4, cmn 4.

### ⚠ The ARPABET shape, checked rather than assumed

These tables are keyed by UPPERCASE Latin, and the engine looks a run up by the character as WRITTEN. The C#
loader applies a camelCase policy — which is exactly what mangled English's ARPABET block into 42 wrong golden
rows. Dictionary KEYS are not covered by that policy (it applies to property names), but "not covered" is a
claim, so it was tested: `ThaiManifest.LetterNames` contains `"A"` and does not contain `"a"`, 26 entries.
Both coupling tests now assert the keys are uppercase, and lower-casing them at the lookup fails.

### Two more things the guard found

`ManifestMappingTests` did not cover **Mandarin**. Adding it immediately reported two unmapped keys —
`resolve` and `phases` — which turn out to be PROSE: an ordered description of the pipeline and a
done/deferred status list, read by neither engine and not declared in the TypeScript's `CmnManifest` either.
The `note` case, not the tg `numbers.and` case, so they are listed as metadata rather than given C#
properties that would model a field neither side has.

## Batch 3 — fr, ru, jv, ha — 2026-08-25 07:20

`jv` had no `manifest.ts`: javanese.ts declared the shape inline and loaded the file itself. Added one, as
Italian needed.

**0 of 24 probe readings moved.** Sweep: letterNames fr 3, ru 2, jv 4, ha 4; vowels 1/3/1/1; ru onsets 2 and
codas 1; fr/jv/ha onsets and codas 0 — see below for why two of those zeros are NOT probe gaps.

## ⚠ Three defects the batch surfaced, none of them caused by it

**1. A tooling bug that would have shipped silently.** The C# applier decided whether to emit a `Digraphs`
line by testing `if "digraphs" in inner` — and matched the word in a COMMENT. Javanese got
`digraphs: new Set(MANIFEST.phonotactics.digraphs)` pointing at a key the generator never emitted.
`new Set(undefined)` is an EMPTY SET, so the digraph collapse would have stopped working and more runs would
have been spelled out — with nothing thrown and the type checker satisfied once the field was declared.
Caught by reading the emitted diff. The condition now matches `digraphs\s*:`.

**2. Hausa's phonotactics lists are dead data.** `legalCodas` is 16 entries and ALL SIXTEEN are single
characters; 20 of the 29 `legalOnsets` are too. `core/initialisms.ts` tests `w.slice(0, 2)` against those
sets — a two-character slice — so a one-character entry can never match. Hausa's coda list is therefore
entirely inert, and any Hausa run ending in two consonants is judged unreadable regardless of what the list
says. The core's own comment states the invariant the data violates: "`legalOnsets`/`legalCodas` stay lists of
genuine two-PHONEME clusters".

NOT FIXED: repairing it changes readings and needs Hausa-specific sourcing — what ARE its legal two-consonant
codas? — which a mechanical lift has no business guessing. Pinned in both coupling tests as a known defect,
which is also why Hausa is excluded from the batch's cluster assertions.

**3. Two of my test rows were wrong about the language, not the code.**
  · **Russian's `letterNames` is CYRILLIC-keyed.** A Latin run inside Russian goes through the script router
    to English and never reaches the table, so `USB` was the wrong spelled-run probe; `ВВП` is right.
  · **Javanese genuinely spells `SPORT`.** It licenses only ⟨ng⟩ and ⟨ny⟩ as codas, so the ⟨rt⟩ tail is
    illegal and the run is spelled — correctly. `PRO` is the right readable case: ⟨pr⟩ is a licensed ONSET and
    the word ends in a vowel, so it reaches the onset table without touching the codas.

Both failures looked like port bugs and were assertions written from an assumption about the language.

## Batch 4 — ta, te, kn — 2026-08-25 07:50 — the recognition lists

The three batch 2 deferred, because what they hold is not a `letterNames` map.

**What it actually is.** A CLOSED list of the letter-name spellings AS WRITTEN — யு.எஸ். , యూ.ఎస్. ,
ಯು.ಎಸ್. — used to build the regex that RECOGNISES a dot-separated initialism run so its interior dots can be
deleted. Nothing in the list is ever EMITTED: the names reach the output as the corpus's own spellings,
passed through unchanged. Everywhere else in the fleet `letterNames` is character → SPOKEN name, so filing
both under that name would be one name over two facts. Lifted as **`initialismLetterForms`**.

**Why the list is closed by necessity, not laziness.** A generic "short token, dot, short token" rule cannot
be written safely against a script with NO CASE DISTINCTION: the Tamil header records probing exactly that
and matching SENTENCE BOUNDARIES — "…ஆவர். கட்பேக்தான்", "…அல்ல. செங்குத்தாக". Restricting the members to
actual letter names is what makes the rule sound. Kannada's list is four entries for the same reason: only
what the corpus attests, so nothing is invented.

**0 of 11 probe readings moved.** Sweep: ta 4, te 4, kn 3 — live on the first pass, because the probe was
written from what the rule is FOR rather than from a generic template.

The three assertions that matter: the interior dots do not survive as clause pauses; every declared form
occurs in the run it was declared for; and **no declared form ever appears in the IPA**, which is what pins
"recognition list, not spelling map" as a property rather than a comment.

## Batch 5 — en — 2026-08-25 08:20 — the last one, and the one with no table

**⚠ ENGLISH HAS NO `letterNames` TABLE, AND SHOULD NOT HAVE ONE.** Its speller is a FUNCTION:

```ts
const LETTER_NAME = (l) => /^[a-z]$/.test(l) ? (l === "a" ? "ay" : l) : undefined;
```

CMUdict already carries all 26 single letters with their letter-NAME pronunciations (f = EH1 F, h = EY1 CH,
w = D AH1 B AH0 L Y UW0), so emitting the bare letter and letting the dictionary resolve it is correct. That
is a RULE, not data, and manufacturing a 26-entry table to match the other languages would be inventing a
fact the language does not have. Only the EXCEPTION is data — the dict has ⟨a⟩ as the reduced article AH0
rather than the letter name — so `letterNameExceptions: { "a": "ay" }` is what was lifted, and the rule stays
in code with its explanation.

### ⚠ English's phonotactics are nearly unreachable, and the sweep said so before I understood why

All four keys swept **0** on the first pass. Wrecking the vowel class changed nothing — not for `NASA`, not
for `TEST`, not for `STRENGTH`.

The reason is structural: `core/initialisms.ts` asks `isRecorded` BEFORE the phonotactics test, and English
is the one language in the fleet with a pronunciation dictionary. Every real word short-circuits. What can
reach the cluster tables is an all-caps run that is BOTH absent from CMUdict AND carries a vowel — which took
invented tokens to construct (`GWALT`, `GWEM`, `ZLORP`, `MELP`, `NURP`). With those, all four keys move:
letterNameExceptions 1, vowels 3, onsets 1, codas 3.

`ZLORP` is readable because ⟨zl⟩ genuinely IS in English's licensed onsets; `GWALT` is spelled because ⟨gw⟩
is not. That pair is the whole test.

**0 of 20 probe readings moved**, across `en`, `en-GB` and `en-IN`, sync and async — the variants matter here
because all four read this engine.

### Two weak assertions, caught by sabotage

- Comparing `ZLORP` against the **W** letter name — a letter ZLORP does not contain — passed whether or not
  the run was spelled. Asking for the letter the run actually STARTS with is the fix.
- Comparing a spelled ⟨w⟩ against the phrase `"double you"` fails on a CORRECT reading: the dictionary
  renders it as ONE token (dʌbəɫjuː) and the phrase is two. Ask for the bare letter.
- And the ⟨a⟩ exception cannot catch its own decoupling — re-hardcoding it is observationally identical while
  the data agrees. Stated in the test; the manifest sweep is what holds it.

## The sweep is complete

Sixteen languages, five batches. Every `letterNames`/`phonotactics` table the fleet's ported engines carry now
lives in a manifest, except where the honest answer was that there is no table:

  · **en** — the speller is a rule over CMUdict; only the ⟨a⟩ exception is data.
  · **ta, te, kn** — a RECOGNITION list, not a spelling map, lifted as `initialismLetterForms`.
  · **th, vi, cmn** — spelling maps with no phonotactics, because a Latin run there is spelled for being
    FOREIGN rather than for being unpronounceable.

Three defects were surfaced and left recorded rather than fixed, each because fixing it changes readings and
needs language-specific sourcing a mechanical lift has no business guessing: Hausa's dead cluster lists,
Italian's degree agreement (since fixed, #968), and Italian's case-sensitive compass class.
  · `jv` has no manifest.ts and needs one.
  · `th`, `vi`, `ta`, `te`, `kn`, `cmn` have no phonotactics block — letterNames only.
  · `en` last: the largest engine, neural, and four accent variants read it.
