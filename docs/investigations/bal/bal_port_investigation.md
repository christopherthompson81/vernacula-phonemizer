# Balochi (bal) — C# port investigation

Chronological log of the runs behind the bal port. ⚠ Written at review time rather than during the port,
which is itself the first finding: every other port in this batch (sq, an, rup, ba, eu) carries one, and
this branch shipped without it. The runs below are reconstructed from the branch and re-measured after the
rebase, so the numbers here are the ones that hold on today's `main`.

## Run 1 — scope

    wc -l src/languages/balochi/*.ts
        264 balochi.ts · 480 normalize.ts · 80 numbers.ts

⚠ **A CROSS-SCRIPT ENGINE, which is what makes this port unlike the others in the batch.** Balochi is
written in BOTH an Arabic-derived script and a Roman orthography, and the two halves have opposite
properties:

  * the **Arabic** half is a DEFECTIVE ABJAD — short /a i u/ are unwritten and ⟨و⟩/⟨ی⟩ each conflate a
    consonant with a long vowel — so its rule g2p can only recover a consonant + long-vowel SKELETON;
  * the **Roman** half is phonemic and writes every vowel.

The bridge is a cross-script lexicon keyed by BOTH spellings, tried before either g2p, which restores the
vowels the abjad loses. So `phonemizeWord` is a router, and the routing decision — which script is this
token? — is made by a character class. That class is where the defect below lived.

The port also needed one SHARED-file change: `Core/Numbers.cs` gains `MagnitudesDef.Arab`, Balochi's 10⁹
word. The TS declares it in its own `BalNumbersDef` extension of the core schema; the C# core is where
that extension binds. Purely additive (a nullable field), and the full gate confirms nothing else moved.

## Run 2 — the bidirectional fix: three letters that read as the EMPTY STRING

The off-golden probes showed a lone `ṣ` / `ṇ` / `ḷ` reading as nothing at all — **in both engines**,
because the C# had ported the bug faithfully.

Root cause: the normalizer's step-1 NFC composes `s`+`◌̣`→`ṣ` (U+1E63), `n`+`◌̣`→`ṇ` (U+1E47),
`l`+`◌̣`→`ḷ` (U+1E37). Those PRECOMPOSED forms were missing from the routing class `HAS_LATIN`, so a word
carrying one routed to the ARABIC g2p — which has no rule for a Latin letter and drops it. `ṭ ḍ ṛ` were
already in the class; the retroflex table's other three were not.

Fixed TS-first per the porting contract, in both classes (`HAS_LATIN` decides routing; `NATIVE_CLASS`
drives the nativiser's fold, and a letter missing THERE gets its mark stripped even when routing is
right), then mirrored in C# with the code points checked rather than eyeballed.

⚠ **NO GOLDEN MOVES, AND THE GATE ITSELF IS THE PROOF.** The goldens were generated from the pre-fix TS;
the C# implements the post-fix behaviour. Parity passing therefore *demonstrates* that the fix changes
nothing on any golden row — the three code points occur 0× in `bal.tsv`.

## Run 3 — 2026-08-29 ~19:30 — rebase onto `main` (through eu, #1168) and RECOUNT

The branch was cut at `ba` (#1167); `eu` (#1168) has landed since. Rebased clean — the three-way merge on
`Bootstrap.cs` and `ManifestMappingTests.cs` (the two files every port touches) resolved without conflict,
and all three registrations are present and correct.

Every count in the PR description was re-measured, because they were taken before the rebase:

    C# suite          3,035  →  3,108 pass, 0 fail
    parity, fleet     (pre-eu)  →  142 languages byte-identical, 28,104 rows, 0 differ,
                                   + bal in the "fully match except N BLOCKED" bucket
    parity, bal       77 rows OK, 1 BLOCKED on `georgian`   (unchanged)
    regex-diff        124,812 probe results identical, 0 DIFFER, 0 threw, 0 refused

## Run 4 — 2026-08-29 ~19:45 — review: does the fix GENERALISE?

The fix names three letters. The review's first question is whether they are the whole set, since "the
table's other three retroflexes" is a claim about an inventory and inventories are exactly what the ab and
rup defects were hiding in.

Checked mechanically: every distinct Latin character appearing in any key anywhere in `balochi.jsonc`
(33 of them) was run through `phonemizeRoman` and `phonemizeWord`, and any letter the Roman g2p reads but
the router sends elsewhere is the bug class.

    NO ROUTING GAP — every Roman letter the g2p reads survives phonemizeWord

⚠ **AND A WIDER SWEEP THAT LOOKED LIKE 93 MORE DEFECTS AND IS NOT.** Sweeping every precomposed
Latin+{dot below, macron, caron, dot above} form (124 of them, both cases) reports 93 where
`phonemizeRoman` returns something and `phonemizeWord` returns empty — `ạ ǎ ȧ ḅ ċ ď ẹ ḟ ḡ ḥ …`. Read
before believing:

  * none of those letters is in the Balochi inventory. `phonemizeRoman("ạ")` returns `"a"` only because
    that g2p falls back to the base letter — which is its own lenient behaviour, not evidence the
    orthography contains `ạ`;
  * `phonemizeWord` is the WORD entry and bypasses the nativiser. Through the real `text()` path a foreign
    letter *inside a word* reads fine (`ẋar` → `xar`, `Ẋavier` → `xavieːr`), because the word's other
    letters route it to the Roman g2p;
  * what remains is a LONE foreign accented letter as its own token reading as empty — the pre-existing
    treatment of anything outside the inventory, in a shape (a one-character token of an accented foreign
    letter) that Balochi text does not contain.

Widening the class to all of Latin would claim readings that are not sourced and would change routing in
genuinely Arabic-script context. `NATIVE_CLASS` is a claim ABOUT THE G2P, and `ẋ` has no rule. **Out of
scope, and recorded so the next reader does not re-derive it.**

## Run 5 — 2026-08-29 ~20:00 — the corpus differential the PR said was impossible

The PR states: *"No FLEURS text exists for `bal`, so there is no corpus-wide differential to run."* The
first half is true and the conclusion does not follow — `tools/corpus/mined/bal.jsonc` exists, and it is
the source the rup, ba and eu ports used for exactly this situation.

    tools/corpus/mined/bal.jsonc → 81 unique texts
    bal  OK  80 rows, 1 BLOCKED      0 differ, 0 throws

## Run 6 — 2026-08-29 ~20:10 — a generated haystack, and what BLOCKED actually tracks

8,000 generated inputs covering the eight normalizer steps and the cross-script routing: all three digit
systems (ASCII, Extended Arabic-Indic ۰-۹, Arabic-Indic ٠-٩) crossed with all four grouping marks and the
two decimal separators; the era markers on both arms with and without the tatweel; the SI units bare and
attached; HTML entities and ZWNJ/ZWJ; Arabic presentation forms; the ݔ (U+0754) and ۏ (U+06CF) letters
that sit outside the Arabic block; both scripts mixed inside one line; and foreign runs.

    8,000 inputs → 7,875 OK, 125 BLOCKED, 0 differ, 0 throws

⚠ **THE BLOCKED COUNT IS A USEFUL SIGNAL RATHER THAN NOISE**: it scales exactly with how many generated
rows carry the Georgian string I seeded, which confirms the golden's single blocked row is the `georgian`
dependency being named by the gate and not a bal defect hiding behind a label.

And an exhaustive numeral sweep, since the compositor is bespoke (Iranian-core / lakh-crore, Jahani & Korn
Table 11.19, with the enclitic connective carried on a U+E000 marker):

    0…2000 exhaustively + every magnitude boundary (10⁵, 10⁶, 10⁷, 10⁸, 10⁹, 10¹⁰, 10¹¹, 10¹², 2⁵³±)
    each also bare, with a noun, and with the era clitic — 2,073 rows, 0 differ

## Run 7 — 2026-08-29 ~20:20 — the tests, pinned to the reference

All 39 hard-coded expectations in `BalochiTests.cs` were extracted and re-run against the TypeScript
engine directly — `phonemizeWord`, `phonemizeRoman`, `phonemizeArabic` and the registry path, whichever
each case uses:

    ALL TEST EXPECTATIONS AGREE WITH THE TS ENGINE

And the mechanical comparison the ab/rup findings taught: every regex in both trees extracted and diffed
by codepoint (TS 18 / C# 14; 7 byte-identical, 7 differing only in `${x}` vs `{x}` interpolation, the rest
comment prose), then the interpolated constants themselves — `D` (the three digit ranges), `AR` (the
Arabic block plus the Arabic Extended-A range) and `ERA_SEP` — all MATCH by codepoint, as do both routing
classes and the `̌` the nativiser class carries.

## Read for correctness — filed, not fixed

- **The lone-foreign-letter residual** described in run 4. Out of scope, and widening the class would
  claim unsourced readings.
- **`bal` cannot reach "byte-identical" in the fleet count** while `georgian` is unported, because one
  golden row embeds a Georgian run. The gate names the dependency rather than counting it as a failure,
  which is the correct behaviour; the row will resolve itself when `ka` lands.
