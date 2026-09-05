# Number compositors: fleet-wide audit + 14-agent fan-out (issue #562)

Goal: `phonemize("<integer>", lang)` must speak the number in every registered language. This log covers
the audit that found the gaps, the tooling bug that nearly corrupted the audit, and the parallel
implementation pass. Per-language detail lives in each language's own investigation doc.

## Run 1 — 2026-07-29 — first audit sweep: 24 probes × 191 language codes

Method: probe each registered code with `0 1 2 5 9 10 11 15 20 21 25 40 99 100 101 200 999 1000 1001
2000 12345 1000000 3.5 1,5`, flagging **empty output**, **digit leak** (a digit survives into the IPA),
and **duplicate output** for different inputs.

Result: 67 languages with no compositor at all, 8 with a partial one, 16 flagged only for reading `1,5`
as `15` (correct for English/Indic, where comma is the thousands separator — not a defect), 100 clean.

## Run 2 — same day — the audit was too weak; two rounds of detector work

`phonemize("25","ti")` **passed** Run 1 while emitting `" ħamuʃtə"` — a leading space where the tens word
should be. Root cause in `tigrinya.ts`: `NUM.tens[String(Math.floor(n/10))]` looks up `"2"` in a table
keyed `"20".."90"`, so the lookup returns `undefined`, which stringifies to nothing. **The exact bug fixed
in Amharic in the OmniVoice corpus work (Run 29 there) was still live in Tigrinya and Pashto.**

Rewrote the detector to sweep **0–100 plus magnitudes** and flag four signatures:
- `EMPTY` / `DIGIT-LEAK` (as before)
- `SENTINEL` — a stringified `undefined`/`NaN`/`null` reaching the output
- **`SLOT-GAP`** — leading, trailing or doubled whitespace, i.e. a word slot that resolved to nothing.
  This is the signature that catches the tens-lookup class, and it is what Run 1 lacked.
- `DUP` — two different integers producing identical output

Result: **67 absent + 14 defective = 81 languages**, six more defects than Run 1 saw.

## Run 3 — the detector itself was wrong (found by a subagent, not by me)

The sentinel regex was `/undefined|null|NaN|\[object/i`. **The `i` flag made `NaN` match the letters
`nan` inside legitimate numerals** — Zulu's connective series (na**nan**thathu 3, na**nan**hlanu 5), Akan
`n**nan**` 4, Kinyarwanda umu**nan**i 8 — and `null` matched as a bare substring, which is the *zero word*
in German, Danish and Norwegian. So Zulu and Xhosa were flagged as corrupt when they were correct, and the
Germanic group was one step from "fixing" a correct zero.

Fixed to `/\bundefined\b|\bnull\b|\bNaN\b|\[object/` (case-sensitive, word-bounded) and broadcast the
correction to all twelve in-flight agents. **Lesson: a linguistic-data detector must not use case-insensitive
substring matching against natural-language output — the data legitimately contains the sentinel strings.**

### What the corrected picture was
- **Real defects (12):** ti + ps (tens-lookup, 75 numbers each); nya (tens formation — 51==60, 52==70,
  53==80, 54==90, because one citation series was used for the class-6 `makumi` multiplier); ak (10⁶ →
  `mpem undefined`); am, bg, pcm, eu, ha, ln (missing magnitudes / missing zero / magnitude collapse).
- **False positives (2):** zu, xh — no change needed; regression goldens added so nobody "fixes" them.
- **Invisible to the probe (2):** rw, rn had *well-formed but wrong* data (`makumi kabiri` for 20 instead
  of the fused irregular `makumyabiri`). Found by reading, not probing.

**The probe detects structural failure only.** A numeral that is well-formed and wrong passes it. Source
citation is the only guard for semantics — which is why every agent was required to cite.

## Run 4 — fan-out: 14 agents grouped by numeral SYSTEM, not by alphabet

Each agent got: the two implementation patterns with exemplars, a mandatory source citation per numeral
table, the tens-lookup bug class, the probe, and hard constraints — **no edits to `core/`, `registry.ts`,
`index.ts`, or another group's languages** (their per-language file sets are disjoint, so parallel work in
one tree is safe) and **no git commands** (the orchestrator commits).

A session usage cap killed 9 agents mid-flight; all 9 resumed from transcript via SendMessage with a
measured state summary, and several turned out to have finished more than their last line suggested.

**Result: 81/81 languages probe-clean.** Full suite 196 files / 1954 tests. `tsc` clean. Shared files
untouched.

### Languages that silently SWALLOWED digits (no number branch at all — worse than a leak)
`umb` Umbundu · `ff` Fula · `bo` Tibetan (for ASCII digits — its tokenizer matched only Tibetan digits, so
`"21"` was dropped entirely). Issue #562's framing, "missing or deficient compositors", understated this
class.

### Native-digit support added where the script has its own digits
Adlam 𞥐–𞥙 (ff), N'Ko ߀–߉ (bm), Khmer ០–៩ (km), plus Shan and Tibetan. **Open question worth a sweep:
which other scripts have native digits the tokenizers still ignore?**

## Run 5 — five places where MY brief was wrong, corrected by agents with sources

1. **Pattern A would fit "most" Romance** → it fit **none** of the seven. `westernNumberWords` has no
   connector slot, no compound slot and a flat `hundreds[]`; every one of oc/an/ast/rup/pap/ht/kea needs at
   least one. Asturian's context-sensitive `cien`/`cientu` and Papiamentu's "everything below 1000 is one
   word" are simply unencodable in the current schema.
2. **Ewe "partially vigesimal"** → the modern standard tens are a regular `bla-`+unit series where
   `blaene` is 10×4, **not** 20×2. A vigesimal composer would emit wrong numbers. The 20-pivot is real in
   traditional Gbe counting but is not what the standard forms encode.
3. **Mooré "base-5 influence in 6–9"** → both sources state flatly that Mooré is decimal; the quinary
   influence is etymological only.
4. **Bambara implied quinary** → explicitly not; 6–9 are opaque stems, unlike its Atlantic neighbours.
5. **Tashelhit "Arabic dominates above 3"** → that is the Central Moroccan/Tarifiyt/Kabyle picture.
   Tashelhit keeps the **full native decade** *and* a native vigesimal 11–99 (Kossmann 2013 via Aspinion
   1953). The Arabic-loan implementation is still right, but for a sourced reason.

Confirmed as briefed: Wolof quinary (`juróom` + n), Fula quinary with a vigesimal relic at 20 (`noogaas`
is its own lexeme, not 2×10), Khmer bi-quinary, and vigesimal Danish / Georgian / Abkhaz / K'iche' /
Nahuatl / Mixe.

## Run 6 — shared-code findings (deferred: `core/` was locked during the fan-out)

- **`slavicCountForm` is not pan-Slavic.** It is calibrated for ru/cs and consumed only by them. **Polish
  differs**: a compound ending in *jeden* takes the genitive plural (`dwadzieścia jeden tysięcy`, 3 corpus
  hits; `…tysiąc` 0), unlike Russian *двадцать одна тысяча*. Lithuanian differs again — three-way Baltic
  concord, and 21000 is `dvidešimt vienas tūkstantis` (singular), the opposite of Polish. Add a warning
  comment before anyone wires pl/lt to it.
- **Latgalian `tyukstūša` is feminine** (vs Latvian masculine `tūkstotis`) — copying the Latvian
  compositor would mis-gender every thousands group.
- **Three composers are parked in language dirs awaiting a lift into `core/`:**
  `danish/unitsFirstNumbers.ts` (used by da/fo/lb/bar; its author notes German and Swedish could collapse
  onto it too), `kikuyu/e5xNumbers.ts` (ki/kam), and nine near-identical local Turkic composers.
  When lifting, add the two features agents independently needed: an optional **connector as a function of
  the two words it joins** (Luxembourgish's Eifeler Rule; Occitan's twenties-only `e`) and a
  **context-aware hundreds hook** (Asturian).
- **ARCHITECTURAL: compositor-generated number words bypass the neural OOV tier.**
  `phonemizeAsync("femoghalvfjerds","da")` → `ˈfɛmˀɐwhalfjɛɐs` (BiLSTM; the internal *og* reduces
  correctly), but `phonemizeAsync("75","da")` → `fˈemoɡhalvfjeʁds` (rule g2p, the poor reading).
  `wordLevelNeuralPrepass` scans the **input text** for words; the input is a digit, so nothing is tagged,
  and the number words are generated later inside the sync render where `oovOverride` has no entry.
  Affects any language whose compositor emits words missing from its lexicon (67 of 106 Danish number words
  are absent from its 37k lexicon), and it matters for the OmniVoice corpus, which is built with
  `phonemizeAsync`. Fix concept: pre-tag each language's **closed** number-word inventory during the
  prepass and always include it in `oovOverride`.

## Run 7 — sourcing notes worth keeping

Verification methods that beat eyeballing, and are worth reusing:
- **Cherokee**: a checker that diffed all 100 compositor outputs against the Cherokee Nation Language
  Department syllabary poster — byte-identical, and it caught a real off-by-one in the teens array.
- **Nahuatl**: diffed against all 214 attested cardinals — 212 exact, and **both divergences are errors in
  the source** (580 drops a macron; 60,000 is given a form summing to 58,000).
- **Tigrinya**: 38 gold verbalizations extracted from Fitsum Gaim, *Tigrinya Number Verbalization*
  (arXiv:2601.03403) — all 38 reproduce exactly, and the paper supplied the ን-conjunction algorithm.
- **Kalaallisut**: how a bare digit is *read* was established empirically from **allomorph distribution**
  over an 834k-word GiellaLT corpus — `-t` after a vowel vs `-it` after a consonant gives 20/30/40 → `-t`,
  50–90 → `-it`, 100 → `-t`, which matches Danish and only Danish. A second test on the date allomorph
  `-ani`/`-iani` agrees. Native Kalaallisut numerals **stop at 20** in the reference analyser, so anything
  above that would be invented; Greenland's language authority also marks Danish spelling as correct and
  Greenlandicised respellings as speller *errors*.
- **Kamba**: the Peace Corps manual was recovered by running `pdftotext` **locally** after WebFetch
  returned only compressed-stream noise — and it states the composition rule in running prose, including
  1957 spelled out, now locked as a test.
- **Georgian / Abkhaz**: Wikipedia **year articles** were the only attestation for compounds above 100
  (`1959` → `ათას ცხრაას ორმოცდაცხრამეტი`), and they exposed an Abkhaz asymmetry invisible elsewhere —
  the `-и` connective marks a non-final hundred but not the thousand.

Sources refused, with reasons — the discipline that matters most here:
- **Andrews** was *not* cited for Nahuatl numerals: §2 is the orthography chapter and does not tabulate
  them. **Crawford 1963** was *not* cited for Mixe: it is a phonology. Both are the repo's existing
  citations for those languages, and using them would have been provenance laundering.
- `languagesandnumbers.com` **has no K'iche', Santali or Nama page** (the Santali URL 302-redirects to
  German, their fallback for unsupported languages) and was unreachable for several others.
- Wiktionary's `Module:number_list/data/kaa` is **not Karakalpak** — it is a verbatim Crimean Tatar table
  written with letters absent from the Karakalpak alphabet. Its `data/shi` builds tens from a nonstandard
  `idaw` and its 100 entry is an editor's extrapolation.
- GiellaLT's Kalaallisut `digit2text` transcriptor is an **unedited Plains Cree template**, never
  localised, with stray Sámi leftovers and its root lexicon commented out.
- A research subagent was asked by another session to "resend" a Guaraní report **it had never produced**
  and correctly refused to fabricate one. Guaraní stayed un-researched rather than invented — the right
  state for it to be in.

Ranges are stated per language rather than smoothed over: where a system is attested only to a limit
(K'iche' 3,999; Mixe 999; Cherokee 999,999; Shan 10⁵ because no source attests a Tai 10⁶ cognate; Mooré
and Ewe with no attested word above thousand/million), the compositor implements that range and falls back
to digit-by-digit above it, with the boundary documented in the file header.

## Run 8 — 2026-07-29 — GENDER and COUNT agreement on the magnitude nouns (uk, be, ro, sr, hr, bs, sk)

Question: a magnitude word is a NOUN with its own gender, and the multiplier must agree with THAT noun —
internal to the number, so a mismatch is unambiguously wrong rather than a citation-form choice. Which
compositors store one string per magnitude and therefore cannot agree?

Method: dumped the composed TEXT (not IPA) for `1 2 5 11 12 20 21 100 200 1000 2000 3000 5000 11000 12000
20000 21000 22000 100000 200000 1e6 2e6 5e6 12e6 21e6 1e9` from every Slavic/Romance compositor, and read
the correct ones (ru, pl, cs) alongside. Raw before-state:

| lang | 2000 | 5000 | 2e6 | 21000 | 100 / 100000 |
|---|---|---|---|---|---|
| uk | `два тисяча` | `п'ять тисяча` | `два мільйон` | `двадцять один тисяча` | — |
| be | `два тысяча` | `пяць тысяча` | `два мільён` | `дваццаць адзін тысяча` | — |
| ro | `doi mii` | `cinci mii` | `doi milioane` | `douăzeci și unu mii` | `sută` / `sută mii` |
| sr | `dva hiljade` | ok | ok | `dvadeset jedan hiljada` | — |
| hr | `dva tisuće` | ok | ok | `dvadeset jedan tisuća` | — |
| bs | `dva hiljade` | ok | ok | `dvadeset jedan hiljada` | — |
| sk | `dve tisíce` | ok | `dve milióny` | ok | — |

Root causes, three different shapes:
- **uk/be** had no `numbers.ts` at all — a single string per magnitude in the JSONC, composed by the shared
  `core/numbers.ts` `westernNumberWords`, which concatenates. Both the gender AND the count form were
  missing. `core/` is shared with Armenian, so the fix is a LOCAL East-Slavic composer (uk owns it, be
  imports it — the croatian←serbian pattern) that recurses into `westernNumberWords` for sub-1000 groups.
- **sr/hr/bs** already had the count paradigm (`one/few/many`) but not the GENDER: hiljada/tisuća are
  feminine, so `dva`/`jedan` had to become `dve`~`dvije`/`jedna`. Bosnian is ijekavian like Croatian → its
  feminine two is `dvije`, NOT the Serbian ekavian `dve` (the brief had guessed `dve` for bs).
- **ro** was wrong in the opposite direction *and* incomplete: sută/mie are feminine and milion is neuter
  (masculine sg, feminine pl), so `doi`→`două` and 12 `doisprezece`→`douăsprezece`; 100/1000 need the
  feminine article (`o sută`, `o mie`) and 10⁶ the masculine (`un milion`, not `unu milion`); and the `de`
  linker required from 20 up was authored in the JSONC (`"of": "de"`) but never used by the compositor.

Negative / corrected results worth keeping:
- **The brief's Slovak suspicion was right, and inverted from what the code claimed.** `sk/numbers.ts`
  forced `dve` before every magnitude with the comment "agrees with tisíc/milión". Both nouns are `m-in`
  (Wiktionary `sk-noun|m-in`), and `dva` IS the masculine-inanimate form (`dve` is feminine/neuter) — so
  the agreeing forms are `dva tisíce` / `dva milióny`, matching Czech. The prior sk bringup log recorded
  "**dve** (not dva) before a magnitude" as a *fix*; it was a regression. Residual risk noted: the fused
  invariable `dvetisíc` is attested Slovak, and `sk.wikipedia`'s numeral page and the JÚĽŠ portal were both
  unusable (no content / JS-only), so the separated form is sourced from gender agreement, not from a
  corpus count.
- **`slavicCountForm` (core) IS correct for uk/be** — 1→nom.sg, 2–4→nom.pl, else gen.pl, 11–14 always
  gen.pl. Checked against the paradigm rather than assumed (the brief warned it is not pan-Slavic; Polish's
  compound-*jeden* deviation is real, uk/be have no analogous deviation). Reused, not re-implemented.
- **Romanian's ordinal path shares the cardinal compositor**, so adding the phrasal article and `de` broke
  `al sutălea` → `al o sutălea`. Fixed by a `stem` flag on `numberWords` rather than by backing the article
  out: the ordinal is built on the bare numeral stem, the cardinal is the spoken phrase, and they genuinely
  differ. The pre-existing test for `al sutălea` is what caught it.
- **Romanian leaked `undefined` at 10⁹** (`undefined sute de milioane`) — pre-existing, not introduced:
  the billions multiplier indexed `units[10]`. It survived the Run-1/Run-3 detectors because the fleet
  probe's largest value predates the current list. Added the `miliard`/`miliarde` tier (neuter) + a
  digit-by-digit fallback above 10¹².
- **Bare-digit citation forms are all CORRECT as they stand** — the three flagged as suspicious were
  checked and left alone: Slovene `1` → `ena` ("This is the usual form used when counting or reciting
  numbers", Wiktionary `ena`), Bulgarian `1` → `едно` (Wiktionary `едно`: neuter, and a noun meaning "one
  (number or digit 1)"), Romanian `1` → `unu` (Wiktionary `unu` etymology: final /u/ survived precisely
  because "the word's use is reserved for counting only", vs the article `un`).

Verification: every new word form was phonemized STANDALONE first (49 forms, all clean — no throw, no
empty, no sentinel); the fleet number probe is CLEAN for all seven codes; the full suite is green (2075);
and the referee eval is byte-identical before/after for uk 95.1 / be 97.2 / ro 80.9 / sr 98.4 / sk 89.0
folded-backbone (hr and bs have no referee — they are covered by the shared hbs g2p). Numbers are not
referee-scored, which is exactly why these errors survived: the probe checks for leaks, not for grammar.
