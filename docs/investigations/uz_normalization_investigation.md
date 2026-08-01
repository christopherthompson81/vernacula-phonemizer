# Uzbek (uz) normalization investigation (#562)

Chronological record. Baseline worktree: `~/Programming/tmp/uz-base` (pinned at the commit the work started from).

## Run 1 — 2026-07-31

**Setup**: baseline emitted from `~/Programming/tmp/uz-base` via
`npx tsx tools/normalization-corpus-diff.ts emit --lang uz --corpus uz_uz --out /tmp/uz.base`;
identical to `/tmp/uz.before` (main tree). Referee baseline: `folded backbone: 328/330 (99.4%)`.

**Corpus shape** (1,957 unique uz_uz utterances):
- `N-word` hyphen ordinal forms: **452 total** (`N-yil*` years, `N-asr*` centuries, `N-месяц` dates,
  plus `-eng` (7-eng yirik = "7th largest"), `-toifa`, `-sonli`, `-raqamli`, `-o'rin` (190-o'rinni),
  `-markasi`, `-moddasiga`, `-goli`, `-bet`, `-kuni`, `-polklarni`, `-gussarlar`).
- Space-grouped thousands: 19 500, 800 000, 130 000, 330 000, 40 000, 10 000, 104 500 …
- Comma decimals: 6,5 / 1,5 / 6,34 / 2,4 / 5,0 / 2,3.
- Clocks: 10:00, 11:35, 06:30, 07:30, 12:00 GMT, 11:00 da, 8:46 …
- Percent: 88%, 80%, 93%, 3% (+ one spelled-out "8 foizga" — the word is **foiz**).
- Currency: 5$, 100$, 2500 ¥, 130 000 ¥, 7000 ¥.
- Era markers: `m.a.` ×4 (miloddan avval = BC); `m.` (milodiy = AD); "avvalgi" ×9, "milodiy" ×2 already words.
- Abbrev: `h.k.` (va hokazo = etc.), `mln.` (million), `T. rex` (personal initial).
- Rates: km/s, km/soat, m/s, milya/soat, mil/soat. Degrees: +30°C. Signs: +, &, UTC+1.
- Fractions: 29¾, 24½, 1/5. Ranges: 7–2, 6–6, 10–60, 1469–1539, 1995–96 …
- Initialisms: AQSH ×77, AOL, AI, MS, NBA, GPS, COVID, OHA, BMT, GMT, ASUS, CCTV, ISHID, NSA, UTC, OIV, RSPCA, OPEC, DVD, ROV, USOC …

**KEY SOURCING RESULT**: `src/languages/uzbek/romanOrdinals.ts` states the orthographic rule explicitly:
"written with an ARABIC numeral it takes a hyphen for the suffix (7-sinf, 1991-yilning 1-sentabri)". So
**`N-word` hyphen = the ORDINAL writing**. That makes `1978-yil` read *ming to'qqiz yuz yetmish
sakkizinchi yil*, `6-oktyabrida` *oltinchi oktyabrida*, `190-o'rinni` *bir yuz to'qsoninchi o'rinni*,
`7-eng yirik` *yettinchi eng yirik*. Century is ordinal too (`15-asrda` → o'n beshinchi asrda) — the
roman policy already does this for Roman numerals; the Arabic-digit case is the same convention.

**Uzbek ordinal form**: cardinal + suffix on the LAST word; `-nchi` after a vowel, `-inchi` after a
consonant. Reuses the romanOrdinals `suffixed()` logic; needs to extend beyond 100 (years reach 2010).

**Letter names** (espeak-uz dictionary, ~authoritative): a, be, de, e, ef, ge, ha, i, je, ka, el, em,
en, o, pe, qa, er, es, te, u, ve, xa, ye, ze. (oʻ/gʻ/sh/ch/ng are letters too but rarely spelled.)

**Next**: write `src/languages/uzbek/normalize.ts`, wire into `text()`, add the shared symbol tier.

## Run 2 — 2026-07-31

**Implementation landed.** `normalize.ts` steps, in order (each coupling stated in the file):
0) digit de-grouping (space-grouped thousands, two passes — 800 000 → 800000)
1) era markers (m.a. → miloddan avval, m. → milodiy before a number)
2) dotted abbreviations (h.k. → hokazo, mln. → million)
3) clock (H:MM → hour [space minute]; :00 drops the minutes; GMT/UTC left for initialisms)
4) version dots (802.11n → 802 nuqta 11 n; a trailing hyphen-word is consumed so `1.1-rasmga` → 1 nuqta 1 rasmga)
5) ordinal `N-word` (the defining rule; exceptions `regbi`/`moliviy` stay cardinal)
6) regnal ordinals (digit after a capitalized name, followed by ning/hukmron or break, 2–39, comma-guard `(?![,\d])` — the "Izmir 3,7" case)
7) fractions (N¾ → N va uch chorak, N½ → N va yarim, 1/5 → beshdan bir)
8) degrees (N°C → N daraja)
9) signs (+ → plyus, − → minus, & → be va be (letter names), = → teng, < → kichik, > → katta, × → karra, ÷ → boʻlish)
9b) percent possessive (93%i → 93 foizi)
10) rates (km/s → soatiga N kilometr; km/soatgacha → soatiga N kilometrgacha; m/s → soniyasiga N metr; ranges 35–40 mil/s → soatiga 35 dan 40 mil; Gs → gigagerts)
10b) lone personal initials (T. rex → te rex; the shared LONE_INITIAL can't claim capital-before-lowercase)
11) initialisms (letter names; AQSH kept as the word [aqʃ] via isRecorded; PA/TO/OHA/AOL in acronymLetters)

**Engine wiring** (uzbek.ts): `text()` = `assembleClauses(SYMBOLS(normalizeUzbek(input)), TOKEN, …)`.
TOKEN now carries the decimal comma `(\d+(?:,\d+)?)` and the number path emits "vergul" (comma) +
digit-by-digit between the integer and fraction — matching Turkish's virgül. SYMBOLS: percent ["foiz"],
currency $/¥ (iyena), units km/mm/sm/m, exponentWords { squared: ["kvadrat"], position: "before" }.

**Gates, all green**:
- scan: no defects (DROP 7 → 0)
- tsc: clean
- vitest: 2588 passed (200 files) — 8 core + 11 normalization tests in test/uzbek.test.ts
- referee: folded backbone 328/330 (99.4%) — IDENTICAL to the worktree baseline
- corpus diff: 321/1957 (16.4%) changed, every sample-tier change READ and verified an improvement

**Key corrections found while diffing** (each a real defect caught by the sample tier):
- the ordinal rule's regex double-wrapped DIGITS → group indices shifted, `w` grabbed the digit; fixed
- `va h.k.` → the expansion must be the bare noun (the va is already in the text)
- version-dot must consume the trailing hyphen-word or the ordinal rule claims `1-rasmga`
- the & rule needs a letter-name map (B&B → be va be, not "b va b")
- lone personal initials need a local rule for capital-before-lowercase (T. rex, N. Ueyn)
- regnal rule needed the comma-guard `(?![,\d])` — "Izmir 3,7 million" would otherwise read *uchinchi,7*
- rate rules needed case-suffix capture (km/soatgacha → kilometrgacha) and range handling (35–40 → 35 dan 40)
- the review tool's "wired into text()"/"tests" checks FALSE-FAIL for languages whose engine file sorts
  after numbers.ts/g2p.ts (Turkish fails identically) — the wiring is proven by the corpus diff instead
