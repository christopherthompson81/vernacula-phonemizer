# The symbols English reads as nothing

Came out of triaging every divergence against misaki's `us_gold` (the lexicon Kokoro-82M was trained
on). A first probe said we silently dropped 16 symbols misaki speaks. That count was wrong in both
directions, and the frequency evidence moved the scope a long way from where it started.

## Run 1 — 2026-09-16 13:40 — the first probe was unfair, in both directions

The probe framed every symbol as `A <sym> B`. That mismatches how several of them are actually
written, and `normalize.ts` deliberately digit-gates `×`/`÷`/`<`/`>` because those signs can be
markup. Re-probed in realistic contexts:

**We are fine, and the first probe libelled us:** `€50`, `£50`, `≈`, `≠`, `±`, `90°`, `12 ÷ 4`,
`3 × 4` all read correctly. On `¥50` we are BETTER than the reference — misaki drops the yen sign
outright and reads "fifty".

**Both engines drop:** `• † ∆ ‰`. A bullet is a list marker and dropping it is right.

**Genuinely dropped by us:** `→ ← ↑ ↓ ∞ µ § ¶ © ® ™ √ ∑`.

## Run 2 — 2026-09-16 13:55 — frequency, over 14.1M characters of mined running text

`normalize.ts` argues from counts, so this did too. Across all 163 mined corpora:

| symbol | n | | symbol | n |
|---|---|---|---|---|
| **μ** U+03BC | **490** | | ‰ | 26 |
| • | 224 | | ← | 12 |
| † | 48 | | § | 8 |
| → | 27 | | √ | 6 |
| **µ** U+00B5 | **14** | | ↑ ↓ ® | 5 3 3 |

Micro dominates by an order of magnitude — and **460 of those 490 `μ` are Greek letter-runs**, not
unit prefixes. So the count that matters is the gated one, but the class is real and spread across
languages: `470 µg/g`, `94 μg/mL`, `6 μm`, `25 µmol/L`, `100–1000 μm`.

Everything else is single digits to low tens across 14M characters. The "16 dropped symbols"
headline was real but mostly trivial.

## What was fixed, and why only this

**Micro-prefixed units.** This is the one whose drop is a WRONG UNIT rather than a missing word —
the class this file's parent ranks worst. `5 µg` had no key, so the sign fell out and the bare `g`
reached the initialism pass and was SPELLED: *fˈaᶦv ʤˈiː*, "five gee". A dose read as grams when the
page says micrograms is off by a thousand, and nothing in the stream looks wrong: no leak, no drop,
no symbol left over for a gate to notice.

⚠ **BOTH CODE POINTS.** U+00B5 MICRO SIGN is what the "micro" key produces; U+03BC GREEK SMALL
LETTER MU is what typesetting and copy-paste produce, and it outnumbers the micro sign 35:1 here.
Neither folds to the other — `toLowerCase` leaves both alone — so both are declared, exactly as ℃ is
declared beside `°c` for the same single-code-point reason.

⚠ **TWO OF THEM ARE SPELLED AS TWO WORDS**, and the reason is the lexicon, not orthography:
"micrometer" is recorded as the CALIPER (`maᶦkɹˈɑːmət̬ɚ`, "mi-CROM-eter"), and "microliter" comes out
with an unstressed `li`. The British spellings do not rescue it — the dictionary disagrees with
itself, `micrometre` giving the caliper and `micrometres` the unit, and `microlitres` reading
"lit-rays". `micro meter` / `micro liter` compose from two words the lexicon is sure about. gram,
second and mole need no help and stay single words.

## Run 3 — 2026-09-16 14:40 — the fix reintroduced the failure it removes

Found on review, not by a gate. `µM` is MICROMOLAR and `µS` is MICROSIEMENS — different units from
`µm` and `µs`, not case-sloppy spellings of them. `resolveUnitSymbol` folds case for any multi-
character key, so adding `µm`/`µs` made `25 µM` read **"twenty-five micro METERS"** and
`5 µS` read **"five microSECONDS"**.

Before the change those were merely dropped. After it they were WRONG UNITS — precisely the class
these keys exist to remove, reintroduced by the fix for it, and on the harder-to-notice side: a
dropped symbol leaves a gap, a wrong unit reads fluently.

The mechanism was already in the file, three lines below, in the ⟨W⟩ comment: "#763 resolves a
one-letter symbol case-SENSITIVELY, so a lower-case ⟨w⟩ is not a unit." `resolveUnitSymbol` consults
the declared table with the EXACT written form before it folds, so declaring `µM`/`µS` is enough.
⟨L⟩ needs no such twin — µL and µl are the same unit, as ⟨L⟩/⟨l⟩ are.

⚠ A COMMENT WRITTEN FOR THE FIX WAS ALSO WRONG, and is worth recording because a wrong rationale is
how the flap rule drifted (en_flap_secondary_stress_investigation.md): it claimed the declaration
order keeps `25 UM` reading as micrometers. `UM` has no `µ` in it and was never a unit key. The
ordering is defensive, not load-bearing — with both exact forms declared, nothing reaches the folded
slot at all — and the comment now says that instead.

**The arrow, digit-gated.** Every arrow in the documents this was measured against is
`NUMBER → NUMBER` — "16 → 28 h", "8 → 94 h" — which is a transition, and the rule directly above it
already says a dash between two numbers is "to". So the reading is not a new decision: an arrow in
that position is the same claim written with a different mark. misaki reads "sixteen RIGHT ARROW
twenty-eight", faithful to the glyph and not to the sentence.

Between WORDS it is left unread. There the reading is genuinely contested — "implies", "gives",
"leads to", or the literal name — and this file's rule is that a missing word beats a wrong one.

**Not done, deliberately:** `§ ¶ © ® ™ √ ∑ ∞ ← ↑ ↓`. Each occurs single-digit times in 14M
characters, and several have contested readings (`®` and `™` are skipped by human readers far more
often than voiced). They are recorded here so the next person has the counts rather than the
impression.

## ⚠ The parity gate does not cover this change

`check:goldens` came back **0 stale** — not because the ports agree, but because no golden row
contains a `µ` or a numeric arrow. The cross-implementation gate was blind to the whole change.

Closed two ways. A direct TS-vs-C# differential over 17 inputs (both code points, glued `5µg`,
unspaced `16→28`, double-spaced, the Greek-letter negative) — byte-identical. And
`csharp/regex-corpus.jsonl`, which extracts every TS regex literal and replays it through
`Core/JsRegex.cs`, needed regenerating: `test/regex-corpus-fresh.test.ts` failed until the new
pattern was registered. That harness is the dialect check; the two test files are the behaviour
check.

⚠ **The differential caught a stale binary — again.** The first run showed 13 divergences with
the C# port producing pre-change output on every one. The phonemizer solution had been rebuilt and
its own tests passed; the separate harness that links it had not. This is the second time in two
investigations, and the rule written down last time ("verify the binary on known probes before
trusting a comparison") was not applied because the comparison did not feel like a sweep. It is the
same failure whatever the shape: a result from a binary nobody confirmed.


## Not done, and worth knowing

`ms` (millisecond) is not a key either, so `10 ms` reads *tʰˈɛn mˈɪz* — "ten miz", the abbreviation
arriving as a word. That is pre-existing rather than introduced here, and it is the same shape as
the `µg` defect one SI prefix over. Left alone to keep this change to what the corpus evidence
covers, but it is the obvious next row.
