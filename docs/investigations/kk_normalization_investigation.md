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
- normalization-review --lang kk: checklist clean (wired, tests, all 8 sign classes, spelling→g2p,
  SOURCING all 2 high-traffic words attested, scan)

**Notes**: the review probe `1 km` (Latin km) reads "бір км" — the corpus writes Cyrillic км ×19, never
Latin, so the probe is corpus-absent. The trap-14 design (wordify-then-agree) is the whole point of the
case-suffix rule; the "last vowel" harmony computation was fixed to scan the whole word (the first-dot
regex matched the FIRST vowel).
