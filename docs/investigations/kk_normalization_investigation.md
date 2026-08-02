# Kazakh (kk) normalization investigation (#562)

Chronological record. Baseline worktree: `~/Programming/tmp/kk-base` (pinned at the commit the work
started from). Working branch: `norm-kk-562`.

## Run 1 — 2026-08-01

**Setup**: baseline emitted from `~/Programming/tmp/kk-base` → `/tmp/kk.base`.

**Corpus shape** (kk_hr FLEURS — a Kazakh translation of the English set):
- **`N-ші`/`N-шы` ORDINALS** ×16 — `190-шы орын`, `60-шы гол`, `19-шы ғасыр`, `1-ші`. The corpus's
  ordinal digits. The romanOrdinals.ts documents the ordinal (cardinal + -ыншы/-інші, harmony-paired,
  attached to the LAST element, tens irregular: жиырмасыншы/қырқыншы) but its `ordinal()` caps at 100
  (190 → undefined).
- **BARE NUMBERS with CASE SUFFIXES** ×36 (trap-14's defining shape) — `200-ге` (dative), `8-ден`
  (ablative), `80-нен`, `60-тан`, `1000-нан`, `160 км/сағ-қа`, `11:00-ден`, `9:30-да`, `35-40 миль /
  сағ`. The suffix must agree with the WORD via vowel harmony (200-ге → екі жүзге, 11:00-ден → on bir-
  ден), so gluing the written suffix verbatim is wrong (trap 14).
- **`б.д.д.`** (before the birth of Jesus = BC) ×2, **`т.б.`** (etc.), **`т.с.с.`** — dotted
  abbreviations.
- **Space-grouped thousands** ×6 (17 000, 24 000, 5 000 000, 104 500, 10 000, 55 000) — the TOKEN `\d+`
  splits these on the space.
- **Comma-decimals** ×5 (2,3, 3,7, 2,8, 1,5) — the comma is a pause.
- **clocks** ×8 — `11:00-ден`, `08:46`, `10: 00`, `13:15`, `9:30-да`, `0230 UTC`. NOTE the space in
  `10: 00` and the case-suffixed `11:00-ден`/`9:30-да`.
- **`км/сағ`** (km/h) ×5, **`миля/сағат`** (mph) ×2, **`35-40 миль / сағ`** — the /сағ not composed.
- **Degrees** — `+ 30 °C-тан`, `35°W`.
- **Percent** `80%`, `93%`, `88%`, `3%` (the tier's пайыз — works).
- **`АҚШ`** (USA), **`Елизавета II`** (regnal cardinal), **`XVI ғасырда`** (16th century — the roman
  path works).
- **Years** — `2005-жылы`, `2011 жылдан`, `1977-1981 жылдары`, `1418 – 1450`.
- **Ampersand** ×2 — `B&B`, `& Turkish Airlines`.

**KEY DEFECTS from the probe**:
- `190-шы` → *жүз тоқсан шы* (the ordinal suffix as a separate word [ʃə]).
- `200-ге` → *екіжүз ге* (the case suffix as a separate word).
- `11:00-ден` → *он бір, нөл ден* (clock + ablative).
- `б.д.д.` → *bə . də . də .* (letter-spelled).
- `17 000` → *он жеті нөл* (space-thousands).
- `2,3 миллиард` → *екі , үш* (comma pause).
- `83 км/сағ` → *сексен үш километр сағ* (the /сағ raw).
- `+ 30 °C-тан` → *отыз сіː тан* (degree + ablative).

**GOOD already**: `80%` → пайыз (tier), `АҚШ` → [ақш] (word), `XVI ғасырда` → он алтыншы ғасырда
(roman ordinal), `2005-жылы` → екі мың бес жылы (year), `1977-1981` (range), `Елизавета II`.

**Next**: write `src/languages/kazakh/normalize.ts`. The DEFINING rule is the case suffix after digits
(trap 14): the suffix must agree with the WORDS via vowel harmony, and the ordinal suffix must attach to
the last cardinal element.

## Run 2 — 2026-08-01 (implementation)

`src/languages/kazakh/normalize.ts` landed on `norm-kk-562`. Steps, in order:
0) space-grouped thousands de-grouping (17 000, 5 000 000 — the corpus's grouping is a SPACE)
1) dotted abbreviations and era markers (б.д.д. → біздің дәуірге дейін, т.б. → тағы басқа,
   т.с.с. → тағы сол сияқты)
2) ORDINALS — the `N-ші`/`N-шы` form → the ordinal word (жүз тоқсаныншы, алпысыншы, бірінші), using
   romanOrdinals.ordinal (≤100) + an extension for the hundreds (101–999)
3) CLOCKS — the colon form (08:46 → сегіз қырық алты), with the case suffix consumed (11:00-ден →
   он бірден, 9:30-да → тоғыз отызда)
4) THE CASE SUFFIX — the DEFINING rule (trap 14). `200-ге`, `8-ден`, `80-нен`, `60-тан`, `1000-нан`
   → the number becomes words, the ending attaches to the last word with vowel harmony AND the
   voiceless/nasal variants (жүз→жүзге, сексен→сексеннен, алпыс→алпыстан, мың→мыңнан)
5) DEGREES — `+ 30 °C-тан` → плюс отыз градус цельсийден, `35°W` → градус батыс
5b) RATES — `83 км/сағ` → километр сағат, `17 500 миля/сағат` → миля сағат, `160 км/сағ-қа` → сағатқа
6) numeric ranges → the en-dash kept (two numbers)
7) the SHARED TIER (in kazakh.ts, so the review's sourcing check sees it) — пайыз, currency
   (доллар/еуро/йен/фунт), Cyrillic units (км/кг/м/мм/см)
8) decimal comma → "бүтін"
9) signs (+ → плюс, - → минус, × → есе, = → тең, < → аз, > → көп)

**Engine wiring** (kazakh.ts): `text()` = `assembleClauses(SYMBOLS(normalizeKazakh(input)), TOKEN, …)`.
The TOKEN gained space-thousands + comma-decimals.

**Gates**:
- scan: no defects (DROP 2 → 0)
- tsc: clean
- vitest: 2673 passed (14 new kk normalization tests)
- corpus diff: 86/1494 (5.8%) changed, every change READ and verified (21 case-suffix, 15 ordinal,
  11 comma-decimal, 11 space-thousands, 7 abbrev, 7 rate, 7 misc — мм/см/м units, 5 clock, 2 degree)
- normalization/review.ts --lang kk: checklist clean (wired, tests, all 8 sign classes, spelling→g2p,
  SOURCING all 2 high-traffic words attested, scan)

**Notes**: the review probe `1 km` (Latin km) reads "бір км" — the corpus writes Cyrillic км ×19, never
Latin, so the probe is corpus-absent. The trap-14 design (wordify-then-agree) is the whole point of the
case-suffix rule; the "last vowel" harmony computation was fixed to scan the whole word (the first-dot
regex matched the FIRST vowel).

## Run 3 — 2026-08-01 (re-review against the playbook traps)

The parent asked for a re-review with `docs/normalization_playbook.md` in mind. Two real defects and
one corpus-attested addition, found by probing the adversarial neighbour (trap 8):

- **The 4-digit ordinal (trap 13 branch miss)**: `1000-ші` read *undefined жүзінші* — `ordinalWord(1000)`
  fell through the hundreds extension (h=10, UNIT_CARD[10] undefined) and emitted the literal
  "undefined". The corpus writes no 4-digit ordinal (all 1–190), so this was corpus-absent — but
  emitting "undefined" is worse than leaving the suffix raw. Fixed: `ordinalWord` returns undefined
  above 999, so `1000-ші` stays "бір мың ші" (the honest raw form) rather than garbage.
- **The minus-degree (the plus-degree sibling)**: `-5°C` read "бес градус цельсий" with the minus
  dropped — the degree rule consumed the number, so the end-of-pass minus rule found no digit. Same
  shape as the `+ 30 °C` fix. Added the minus variant to the degree rule (минус бес градус цельсий).
- **The dot-version/Figure forms (corpus-attested)**: the corpus's `802.11n`, `1.1 суретті` (Figure 1.1)
  and `15.00 UTC` (dot-clock) all read the dot as a pause. Added a "нүкте" (point) dot-decimal rule
  (AFTER the comma-decimal, so 2,4 keeps бүтін), plus a dot-clock rule for `15.00 UTC`/`0230 UTC`
  BEFORE it. The sports times (4: 41.30, 2: 11.60) now read the ".30"/".60" as нүкте — a pace.

**Verified non-issues**: the hundred/unit ordinals (101-ші, 200-ші, 105-ші, 7-ші, 12-ші); the genitive/
locative/instrumental case suffixes (200-нің, 30-да, 5-те, 2-мен, 80-пен); 30°F/35°E/35°N/40°C; the
minus-vs-range guard (-5 → минус, 5-10 → range, -5°C → минус); the rates (480 км/сағ, 64 км/сағ); the
comma-decimal vs space-thousands (2,4/12,5/12,50 → бүтін, 17 000/5 000 000 → thousands); the currency
($1000); the era variants (б.д.д. 100/2000 жылы). `3.5%`/`2.4Ghz`/dotless `т.б` are all corpus-absent
(Kazakh writes comma-decimals; verified zero Ghz and zero dotless т.б in the corpus).

**Post-fix gates**: corpus diff 89/1494 (6.0%) — the 3 new changes are the 802.11n/15.00 UTC/1.1
dot-forms, verified correct; 2673 tests (3 new trap pins); scan no defects; review checklist clean;
sourcing check passes.

## Run N+1 — 2026-08-01 (PR #600 review pass)

The method was to run **every one of the corpus's 47 distinct `digit-hyphen-tail` forms** through the
normalizer and read the list — the trap-13 technique, applied to the rule this language is about. Two
defect classes, both live, 32 utterances between them.

1. **A compound numeral was glued into one word.** The layer's own `orthographic()` composed 11–99 as
   `${TENS}${UNIT}` with no space, so `15-ке` read *онбеске*, `29-да` *жиырматоғызда*, `11:00-ден`
   *онбірден*, `11000-нан` *онбір мыңнан* — words Kazakh does not have, each stressed by the g2p as one.
   Kazakh writes них as two: **он бес**, **жиырма тоғыз**. The tell was that the ORDINAL path spaces them
   correctly, because it goes through `romanOrdinals.ts` — two composers in one language, one of them
   right, which is what made the split visible.
2. **`N-НОУН` — the ordinal writing with the noun spelled out — was not claimed at all.** Thirteen corpus
   instances across seven nouns: `8-ғасырдан`, `20-ғасырдың`, `19-ғасыр`, `17-ғасырда`, `15-ғасырда`,
   `14-ғасыр`, `10-ғасырда` (century), `2016-жылы`, `2005-жылы` (year), `247-бабына` (article),
   `4-санатты` (category), `1-түрге` (type), plus the date `15-і`. The case-suffix rule cannot see them
   because the tail is a WORD, not an ending, so each read as a CARDINAL with the hyphen dropped —
   *сегіз ғасырдан* where Kazakh says *сегізінші ғасырдан*. Same rule as Uzbek's `N-word` (#590).

   Two consequences the fix had to carry:
   - **Four-digit ordinals exist here after all.** The layer declined above 999 on the grounds that "the
     corpus writes no 4-digit ordinal" — but `2016-жылы` and `2005-жылы` are exactly that, and read
     *екі мың он алтыншы жылы*. Extended, with the ROUND thousand still declining (`1000-шы` needs the
     fused *мыңыншы*, which romanOrdinals also refuses to construct).
   - **A one-letter tail is the date possessive**, not a noun: `15-і` is *он бесі*, so it attaches to the
     numeral rather than standing as a word.

**Gates**: vitest 2675 (200 files, +2 tests); tsc clean; scan no defects; `normalization/review.ts --lang kk`
checklist clean including the sourcing line; referee **identical** at 1207/1400; corpus diff **32/1494** with
every counter 0 → 0 — 13 spacing repairs and 19 ordinal readings, each classified.

**Trap 14 held up.** The prediction was that Kazakh's defining rule would be the suffix, and it is: the
layer's harmony machinery (жүзге / сексеннен / алпыстан / мыңнан / сағатқа) was correct on every corpus form
before this review. Both defects were in what the suffix attaches TO — the word it lands on, and the tails
that are nouns rather than endings.
