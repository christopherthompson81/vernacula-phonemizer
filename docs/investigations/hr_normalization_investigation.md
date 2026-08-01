# Croatian (hr) normalization investigation (#562)

Chronological record. Baseline worktree: `~/Programming/tmp/hr-base` (pinned at the commit the work
started from). Working branch: `norm-hr-562`.

## Run 1 — 2026-08-01

**Setup**: baseline emitted from `~/Programming/tmp/hr-base` → `/tmp/hr.base`. Serbian's normalize.ts
(`src/languages/serbian/normalize.ts`) is the model — Croatian and Serbian are the pluricentric
standards of ONE phonological system, and the Serbian file documents the shared Serbo-Croatian number
system (three-way count agreement, period-thousands, N. ordinals, hyphen+case-suffix decades).

**Corpus shape** (hr_hr FLEURS — a Croatian translation of the English set):
- **`N.` ordinals** ×many — the Serbian-shaped ordinal marker: `15. kolovoza 1940.`, `7. najvećim`,
  `6. listopada 1789.`, `1000. marka`, `24. kolovoza`, `21. srpnja`, `11., 12. i 13. stoljeća`.
  Licensors: month GENITIVES (kolovoza, rujna, listopada, srpnja), `stoljeća`, `marka`, `najvećim`
  (locative), `godine`.
- **Period-grouped thousands** ×~26 (2.500, 130.000, 40.000, 10.000, 5.000.000, 3.850, 30.000) — the
  SAME period as the ordinal marker, so the disambiguation (3-digit group vs ordinal) matters. The
  corpus ALSO writes plain thousands (7000, 4892, 6000).
- **Comma-DECIMALS** ×~15 — `2,4 Ghz`, `5,0 Ghz`, `802,11 n` — Croatian writes decimals with COMMAS
  (unlike Serbian's corpus). AND dot-versions `802.11a/b/g/n` (the Wi-Fi standard).
- **clocks** ×~15 — `22:00 i 23:00 h`, `23:35 h`, `12:00 GMT`, `06:30` — the CROATIAN `h` (sat) suffix.
- **sports times** ×3 — `4:41.30`, `2:11.60`, `1:09.02` (NOT clocks).
- **rates** ×~10 — `70 km/h`, `160 km/h`, `40 milja/h`, `64 km/h` — Croatian "na sat" (per hour).
- **era markers** ×3 — `n. e.` (nove ere = AD), `p.n.e.` (prije nove ere = BC), `400. g. n. e.`,
  `1100. g. n. e.`, `356. godine p.n.e.` — multi-dot.
- **degrees** ×3 — `90 °F`, `+30°C`, `35° W` (longitude).
- **fractions** ×2 — `29¾ sa 24½ inča`, `1/5 inča`.
- **initialisms** ×~10 — NHK, MS, FIC, KNP, APS, QVC, A1GP, SAD-a (USA genitive).
- **abbrev** — `itd.`, `George W. Bush`, `Dr.`, `James i sur.`, `pH`.
- **roman** — `I. i II. svjetski rat` (PRENOMINAL ordinal!), `I. i II. reda`, Elizabeth II (cardinal).
- **hyphen+case-suffix** — `1970-ih` (decade), `11-godišnju`, `4-godišnjeg`, `24-časovnom`.
- **zero-width** ×5.
- **ranges** — `10 – 60 minuta`, `2-3 km`, `100 – 200 milja/sat`, `120-160 kubičnih metara`,
  `1000. – 1300. n. e.` (en-dash).

**KEY DEFECTS from the probe** (all mirror Serbian):
- `15. kolovoza 1940.` → *petnaest . kolovoza …* (ordinal period as sentence break).
- `2.500 ¥` → *dva . petsto* (period-thousands as break).
- `2,4 Ghz` → *dva , četiri ghz* (comma-decimal as break).
- `22:00 i 23:00 h` → *dvadeset dva , nula … x* (colon + the h as [x]).
- `70 km/h` → *sedamdeset km x* (rate raw).
- `n. e.` → *n . e .* (era letter-spelled).
- `90 °F` → *devedeset f*; `+30°C` → *trideset c*.
- `29¾` → *dvadeset devet* (fraction dropped).
- `I. i II. svjetskom ratu` → *i . i dva . svjetskom ratu* (roman as cardinal).
- `1970-ih` → *…sedamdeset ih* (case suffix as letters).
- `itd.` → *itd .*, `George W. Bush` → *george . bush*, `SAD-a` → *sad a*.

**GOOD already**: `7000`, `4892 m` (plain thousands), `12:00 GMT` (the 12:00 clock works via... no,
it breaks too).

**Next**: write `src/languages/croatian/normalize.ts`, modeled on Serbian's but adapted for the comma
decimals, the h-clock suffix, and the Croatian licensors/era markers.

## Run 2 — 2026-08-01 (implementation)

`src/languages/croatian/normalize.ts` landed on `norm-hr-562`, modeled on the Serbian normalize (the
pluricentric standard). Steps, in order:
0) zero-width (U+200B ×5)
1) digit de-grouping (period-thousands 2.500, 40.000) + the en-dash range (1000. – 1300. n. e.)
2) multi-dot era markers (n. e. → nove ere, p.n.e. → prije nove ere; the 400. g. n. e. form)
3) dotted abbreviations (itd. → i tako dalje)
4) dotted capital runs (George W. Bush) + lone initial (W. Bush) + Dr → Doktor + SAD → expansion
4b) prenominal ROMAN ordinals (I. svjetskog rata → prvog, II. svjetskom ratu → drugom — the shared
    roman pass skips single-letter I and the registry converts II→2 before the dotted form; handled
    both ways: the roman rule for I, and the digit-ordinal path for II via the svjetskog/svjetskom
    licensors)
5) degrees (stupnjeva Celzija/Farenhajta + the 35° W longitude)
6) numeral + hyphen + case suffix (1970-ih → tisuću devetsto sedamdesetih)
7) the `N.` ORDINAL — the Croatian licensors (month genitives kolovoza/rujna/listopada/srpnja,
    stoljeća (neuter!), marka, najvećim (locative), godine, svjetskog/svjetskom)
8) clocks with the CROATIAN `h` suffix (22:00 i 23:00 h → dvadeset dva sata i dvadeset tri sata); the
    marker captured WITHOUT eating the space (the clock-glue trap — "22:00 i 23:00" glued to "satai")
9) numeric ranges → "do"
9b) the milja rate (milja/h, milja/sat — the tier's `mi` key doesn't match the spelled word)
10) the SHARED TIER (in croatian.ts, so the review's sourcing check sees it) — posto, currency
    (jen/dolar/euro/funta), units, unitPer "na", rateDenominators h→sat s→sekunda, exponents
11) decimal comma → "zarez" (the corpus's 2,4 Ghz, 802,11)
12) fractions (1/5 → jedan peti, 29¾ → i tri četvrtine)
13) signs (all eight classes; minus, equals, less-than, greater-than added per the review)

**Engine wiring** (croatian.ts): `text()` = `assembleClauses(SYMBOLS(normalizeCroatian(input)), TOKEN, …)`.
The TOKEN gained period-thousands + comma-decimals.

**Gates**:
- scan: no defects (DROP 8 → 0)
- tsc: clean
- vitest: 2669 passed (9 new hr normalization tests)
- corpus diff: 210/2007 (10.5%) changed, every change READ and verified (97 ordinal, 18 thousands,
  17 clock, 15 comma-decimal, 13 rate, 9 abbrev, 6 initialism, 4 roman, 4 currency/percent, 3 range,
  3 degree, 2 hyphen-suffix, 2 era, 2 fraction, 15 misc — George W. Bush/units)
- normalization-review --lang hr: checklist clean (wired, tests, all 8 sign classes, spelling→g2p, scan)

**SOURCING note**: the review flags `jen` (the ¥ word) as unattested — the corpus writes `¥` ×3 but never
spells "jen". The currency REGISTER is attested (dolara ×8, posto ×14, funta ×1, eura ×1 — all spelled
after the number), and "jen" is the standard Croatian loanword for the yen, the consistent fourth. This
is a documented sourcing decision (the same reasoning the check's "read the list" prompt invites), not a
guess: dolar/euro/funta are all attested and establish the pattern.
