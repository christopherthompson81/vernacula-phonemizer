# Azerbaijani (az) normalization investigation (#562)

Chronological record. Baseline worktree: `<sibling checkout>/az-base` (pinned at the commit the work
started from). Working branch: `norm-az-562`.

## Run 1 — 2026-07-31

**Setup**: baseline emitted from `<sibling checkout>/az-base` via
`npx tsx tools/normalization/corpus-diff.ts emit --lang az --corpus az_az --out /tmp/az.base`;
identical to `/tmp/az.before` (main tree). Referee baseline: `folded backbone: 3293/4034 (81.6%)`.

**Corpus shape** (1,919 unique az_az utterances — Azerbaijani is Latin-script Turkic, the Oghuz sibling
of Turkish):
- **`N-ci` ordinal suffix ×~250** — the corpus's defining form: `1767-ci ildə`, `1978-ci ilin`,
  `190-cı yerdə`, `24-cü pillədə`, `13-cü əsrlər`, `7-ci ən böyük`, `2010-cu ilin`. The suffix agrees
  in four-way vowel harmony (-cı/-ci/-cu/-cü written; -ıncı/-inci/-uncu/-üncü spoken on the last
  cardinal word). RomanOrdinals.ts already owns the harmony logic.
- **space-grouped thousands** — 400 000, 30 000, 330 000, 800 000, 40 000.
- **comma decimals** — 6,5 / 1,2 / 3,50 / 2,8 / 2,3 (decimalConnector "tam").
- **comma-grouped** — 104,500.
- **clocks** — 12:00 GMT, 21:20, 23:35-ə.
- **version dots** — 2.4Ghz, 5.0 Ghz, 802.11n, 802.11a/b/g.
- **percent ×11** — 30%-i, 100%, 3%-ni, 80%-ni, 88%-ni, 32%, 29%-i, 93%-i (the -i/-ni are possessive
  suffixes).
- **era markers** — e.ə. (eramızdan əvvəl = BC), E.ə., BE (before era).
- **degrees** — +30°C, 35° (longitude).
- **units** — km, mm, km², mil, yard. **rates** — km/s, km/saat, m/s, Mbit/s.
- **currency** — 1000$, $14,7. **fractions** — 24½, 29¾, 1/5, 1/3.
- **roman** — II Dünya Müharibəsi ×2 (World War II), I, III, VIII, XVI Luis.
- **initialisms** — ABŞ (a word [ɑbʃ] — correct), BMT, GPS, GMT, MS, KNP, CEP, FTB, AOL, UNESCO.
- **abbrev** — Dr., Corc V. Buş.

**KEY FINDINGS from the probe**:
- The `-ci` ordinal reads as cardinal + bare "ci" syllable (*m'in jed:ˈi ... d͡ʒˈi ild'æ*).
- `+30°C` → + dropped, °C → [dʒ]. `35°` → degree dropped.
- `e.ə.` → "e . ə .". `BE` → "be".
- `12:00 GMT` → colon pause, GMT → [ɟmt].
- `400 000` → "dörd yüz sıfır". `30%-i` → % dropped, suffix -i read as [i].
- `km²` → "km dir". `80 km` → km raw.
- `II Dünya Müharibəsi` → "iki" (cardinal, should be İkinci).
- `Corc V. Buş` → "v ." break. `Dr. Moll` → "dr .".
- `1000$`, `$14,7` → $ dropped.
- `24½`, `29¾` → the fraction glyphs dropped.

**Next**: write `src/languages/azerbaijani/normalize.ts`, wire into `text()`, add the shared symbol tier.

## Run 2 — 2026-08-01

**Implementation landed** on `norm-az-562`. `normalize.ts` steps, in order (each coupling stated in the file):
1) era markers (e.ə. → eramızdan əvvəl, BE → bizim eradan əvvəl)
2) dotted capital runs (Corc V. Buş)
3) single-dot abbrevs (Dr → Doktor, Şək → şəkil)
4) `N-ci` ORDINALS — the defining rule; spoken -ıncı/-inci/-uncu/-üncü on the last cardinal word
5) space-grouped thousands (400 000 → 400000)
6) clocks (colon form; 12:00 GMT → on iki + letter-spelled GMT)
7) version dots (2.4Ghz, 5.0 Ghz, 802.11n, Şək. 1.1 → nöqtə; `1.234`-style 3-digit fractions left alone)
8) rates PREFIXED per the corpus's own prose (saatda N kilometr, saniyədə N metr, metrdə N yard,
   Mbit/s → meqabit); Ghz → giqahers
9) percent with a possessive suffix (30%-i → faizi, 3%-ni → faizni; the bare N% is the tier's faiz)
10) degrees (dərəcə selsi/farenheyt)
11) signs (+ → üstəgəl, - → mənfi with a range guard, & → və, = < > ×)
12) fractions (N½ → yarım, N¾ → üçdə dörd, N/M → M-də N)
13) regnal II before Dünya Müharibəsi → İkinci
14) initialisms (ABŞ stays [ɑbʃ]; BMT/GPS/MS/KNP/CEP/GMT letter-spelled)

**Engine wiring** (azerbaijani.ts): `text()` = `assembleClauses(SYMBOLS(normalizeAzerbaijani(normalized)), TOKEN, …)`.
TOKEN swallows `\d+,\d+` (decimal) and plain `\d+`; the space-grouping is de-grouped in normalize. SYMBOLS:
percent faiz, currency avro/dollar/funt sterlinq/yen, units km/sm/mm/kg/m/mil/yard, exponent "kvadrat"
before, magnitudes milyon/milyard/trilyon. RATES are NOT in the tier — they're claimed in normalize
prefixed (the tier's "N kilometr saatda" shape is wrong for Azerbaijani).

**Gates, all green**:
- scan: no defects (DROP 15 → 0)
- tsc: clean
- vitest: 2624 passed (200 files) — 19 az tests
- referee: folded backbone 3293/4034 (81.6%) — IDENTICAL to the worktree baseline
- corpus diff: 290/1919 (15.1%) changed, every sample-tier change READ and verified an improvement
- normalization/review.ts --lang az: checklist clean (wired, tests, all 8 sign classes, spelling→g2p, scan)

**Notes**:
- the review probe `1.234` reads "bir . iki yüz..." — a synthetic dot-decimal the corpus never writes
  (Azerbaijani decimals are comma-based); the baseline reads it identically, not a regression. The
  version-dot rule is guarded to a 1-2 digit fraction at a phrase boundary so it cannot claim `1.234`.
- `$14,7 milyard ABŞ dolları` reads "on dörd tam yeddi milyard dollar abş dolları" — the shared tier's
  `$` → dollar plus the text's own "ABŞ dolları" (the corpus's currency noun is the possessive form
  "dolları" the tier's saidAfter check cannot match). Per the parent's #590 policy (redundant is a
  PERMISSIBLE drop), the word IS spoken, so this is accepted rather than flagged.

## Run 3 — 2026-08-01 (PR #593 review pass)

**Question**: which shapes does the corpus carry that these rules only half-handle? ~35 probes, then every
gate re-run. **Seven defects, four of them on live corpus text — and the two biggest are the same mistake in
two places: a case suffix written after a digit belongs ON the word the digit is read as.**

1. **The clock's case suffix, ×9** — nine of the corpus's twenty-one clocks carry one (`10:00-da`,
   `11:00-dan`, `01:15-də`, `23:35-ə`, `11:20-də`, `8:46-da`, `07:19-da`, `09:30-da`, `11:00-dan`). The rule
   captured a SINGLE character, so the hyphen was dropped and the suffix read as its own token: `10:00-da`
   → *on dɑ*, two words where Azerbaijani has one (*onda*). Now glued.
2. **…and harmonised, not just glued.** The written suffix agrees with the DIGITS; the spoken one must agree
   with the WORDS, and they diverge: the corpus writes `11:00-dan`, which is read *on birdən* — `bir` is
   front, so the ablative is -dən however the numeral was written. Added `harmoniseSuffix`, which applies
   the four-way high class and the two-way low class (a/ə) and inserts the buffer `y` after a vowel-final
   stem. One helper, three users (clock, percent, fraction locative).
3. **Percent took only two of its five suffix shapes, ×6.** The guard was `\b`, which is ASCII-defined
   (playbook trap 1 (`\b` is ASCII-defined)), so `46%-dən` and `1%-nin` — suffixes ending in a non-ASCII letter — silently declined
   and read the suffix as a bare word (*faiz dən*). And `-ni` produced *faizni*, a cluster the language does
   not allow: an n-initial suffix assumes a vowel-final stem, so `88%-ni` is *faizini* (three instances).
4. **`¾` read as 4/3.** `üçdə dörd` is "four in three"; ¾ is *dörddə üç*, which is exactly the shape the
   file's own slash-fraction rule builds. One corpus instance (`29¾ düym`).
5. **The locative did not harmonise**: `${dw}də` gave *ondə* and *altıdə* for 1/10 and 1/6 (back-vowel
   stems take -da). No corpus instance; wrong for the language.
6. **The version-dot rule claimed the period-THOUSANDS** the engine reads as one number — `1.234 nəfər` →
   *1 nöqtə 234nəfər*, with the space eaten as well. Capped the fraction at two digits and preserved the
   space. Zero corpus instances (az_az groups with spaces), but the second commit on this branch exists
   precisely to read `1.234` as a number, so the two rules contradicted each other.
7. **The clock claimed a dot-separated sports time.** The corpus's three are colon-separated (`4:41:30`) and
   correctly stay bare numbers, but `4:41.30` — the variant Afrikaans shipped — had its head claimed and its
   tail stranded. Guard is now "no digit, no colon, and no dot-plus-digit"; a bare `.` still passes, since a
   clause may end on a clock.

Also removed: `WRITTEN_CLASS`, declared and never read (the ordinal recomputes harmony from the cardinal,
which is right), and a typo in the word-acronym set (`unecso`).

**Gates**: vitest 2627 (200 files, +4 tests); tsc clean; scan no defects; `normalization/review.ts --lang az`
checklist clean; referee **identical** at wikipron 3293/4034; corpus diff **15/1919** with every counter
0 → 0 — 9 clock suffixes, 4 percent suffixes, 1 fraction, 1 clock suffix harmonised, each classified.
