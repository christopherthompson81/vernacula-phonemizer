# Welsh (cy) normalization investigation (#562)

Chronological record. Baseline worktree: `~/Programming/tmp/cy-base` (pinned at the commit the work
started from). Working branch: `norm-cy-562`.

## Run 1 — 2026-08-01

**Setup**: referee baseline `folded backbone: 12034/14376 (83.7%)` identical in the worktree baseline.
Baseline emitted from `~/Programming/tmp/cy-base` → `/tmp/cy.base` (2009 utterances).

**Corpus shape** (2,004 unique cy_gb utterances — a FLEURS English translation, modern DECIMAL Welsh):
- **`Nfed`/`Ned` ordinal suffix** — `7fed`, `190fed`, `1,000fed`, `6ed`. Welsh ordinals: table for 1–10
  (cyntaf, ail, trydydd, pedwerydd, pumed, chweched, seithfed, wythfed, nawfed, degfed), composition
  above 10 = cardinal with the ordinal ending on the LAST word (190fed → cant naw ddegfed). The corpus
  also spells ordinals in prose (drydydd ar ddeg, bymthegfed, nawfed) — already text.
- **comma-thousands** (1,400, 7,000, 19,500, 400,000, 5,000,000 — the TOKEN `\d+` splits these on the
  comma!) + **dot-decimals** ($2.3, UD $14.7 — 1-2 digit fractions) + **version dots** (802.11n, 2.4Ghz).
- **clocks ×21** — `11:35 p.m.`, `06:30 a 07:30`, `10:00-11:00 yr hwyr MDT`, `8:30 p.m.`, `1:15 a.m.`,
  `07:19 a.m.`, `09:19 p.m. GMT`, `10:08 p.m.`. NOTE: p.m./a.m. are LOWERCASE with DOTS.
- **era markers ×7** — `400 O.C.` (Oed Crist = AD), `1000 C.C.` (Cyn Crist = BC), `OC 1000–1300`
  (undotted). These are dotted-capital runs → letter-spelled [o. k.] / [k. k.].
- **currency ×9** — `$5 a $100`, `$2.3 biliwn`, `AUD$45 miliwn`, `US$11,000 i $22,500`, `¥ 2,500 a
  ¥ 130,000`, `¥7,000`, `£27 miliwn`, `UD $14.7 biliwn`. NOTE the GLUED prefixes AUD$/US$ and the bare
  "UD" (yr UD = the US).
- **rates ×2** — `480 cilomedr/awr` (kilometers per hour), `100 llath/metr`, `25 llath/metr` — the
  slash. The corpus also writes "milltir yr awr" (miles per hour) as prose.
- **units ×15** — 35mm, 90kg, 1040 km, 36mm, 24mm, 160km, 4892 m, 645 milltir. NOTE: `m` (metre) is
  NOT in the tier — "4892 m" → the bare letter [m].
- **degrees ×1** — `+30°C` → plus sign dropped, [k].
- **fractions ×1** — `1/5 modfedd` → *un pump* (should be un pumed).
- **initialisms ×124** — NHK, KNP, NPWS, NSW, PA, MS, FAA, XDR-TB, APS, GPS, MDT, GMT. The engine reads
  them as raw clusters ([n̥k], [knp], [npˈuːs]).
- **abbrev** — `George W. Bush` (the W. run), `ayb.` (Welsh "ac yn y blaen" = etc.), `James et al.`.
- **ranges ×18** — `6-6`, `7-2`, `10-60 munud`, `35-40 milltir`, `1894-1895` — the hyphen is fine
  (two numbers). En-dash `OC 1000–1300` too.
- **roman ×2** — Lealofi III, Elizabeth II → postposed CARDINAL (correct per the shared pass, which
  converts to digits before text()).
- **letter-name** — `21 i 20` (a score; Welsh "i" = to). Plain numbers in prose are text already.

**KEY DEFECTS from the probe**:
- `7fed` → *saith vēd*; `190fed` → *cant nawdeg fed*; `1,000fed` → *un, dim fed*; `6ed` → *chwech ēd*.
- `1,400` → *un, pedwar cant* (comma → pause). All comma-thousands break.
- `11:35 p.m.` → *un deg un, tri deg pump p.m.* (colon pause + [p.m.] cluster).
- `400 O.C.` → *pedwar cant ō. k.*; `1000 C.C.` → *mil k.k.* (era markers letter-spelled).
- `2.4Ghz` → *dau. pedwar ghz* (version dot + [ɡhz] cluster).
- `$2.3 biliwn` → *dau. tri doler* (dot-decimal → pause, 2.3 → 23→ "dau tri"?? — the `\d+` TOKEN reads
  "2.3" as TWO numbers with a pause: *dau. tri*).
- `AUD$45` → *aud pedwar deg pump* (the `$` swallowed by the glued prefix, no "doler").
- `480 cilomedr/awr` → *cilomedr awr* (the / is a break).
- `1/5 modfedd` → *un pump* (fraction → two numbers).
- `+30°C` → *tri deg k*.
- `4892 m` → *...dau m* (bare metre letter).
- `George W. Bush` → *...w. bush* (the W. dot survives).
- `ayb.` → *aib.* (unexpanded).
- `NHK` → [n̥k], `KNP` → [knp], `NSW` → [nsˈuː], `FAA` → [vˈaa], `XDR-TB` → [ksdrtb].

**GOOD already**: `%` → "y cant" (tier), `$` → doler, `£` → punt, `¥` → yen (tier), comma-free years
(1755, 1978), roman numerals (III → tri, II → dau), en-dash ranges (two numbers), `21 i 20` scores,
`160km yr awr` (the prose rate), plain ordinals written out.

**Next**: write `src/languages/welsh/normalize.ts`.

## Run 2 — 2026-08-01 (the ordinal register — audio evidence)

The corpus's digit ordinals `37fed`, `60fed`, `190fed` are ambiguous between the vigesimal reading
(trigainfed, degfed a naw ugain) and a decimal-composed one (chwe degfed, cant naw ddegfed). The parent
warned espeak's Welsh synthesis is unreliable, so this was settled by three independent signals:

1. **The corpus's own prose register**: "ganrif ar bymtheg" (17th), "ganrif ar ddeg" (13th),
   "ddeunawfed ganrif" (18th), "ugeinfed" (20th), "unfed ar ddeg" (11th), "unfed ar bymtheg" (16th),
   "bedwerydd ar hugain" (24th) — ALL vigesimal.
2. **The FLEURS audio via Parakeet** (playbook step 5b): `60fed` reads "Drigain Ved" = **trigainfed**
   (the vigesimal form), not "chwe degfed". Extracted
   train/6594362348805236948.wav (190fed), 16483264425119638206.wav (60fed), 7836685488256134186.wav
   (37fed) from the cy_gb audio cache; 60fed was legible, the other two too noisy for the English-trained
   model, but 60fed is the decisive datapoint.
3. **The wikipron NW referee's pieces**: trigain, ugain, pymtheg, hugain, ddeuddegfed, ddeunawfed,
   nawfed, degfed, canfed, milfed all attested.

CONCLUSION: Welsh digit ordinals read VIGESIMAL. The composition follows the Wikipedia table
(https://en.wikipedia.org/wiki/Welsh_numerals § Ordinal numbers): 1af=cyntaf, 2ail=ail, 3ydd=trydydd,
4ydd=pedwerydd, 5ed=pumed, 6ed=chweched, 7fed=seithfed, 8fed=wythfed, 9fed=nawfed, 10fed=degfed,
11eg=unfed ar ddeg, 12fed=deuddegfed, 13eg=trydydd ar ddeg, 14eg=pedwerydd ar ddeg, 15fed=pymthegfed,
16eg=unfed ar bymtheg, 17eg=ail ar bymtheg, 18fed=deunawfed, 19eg=pedwerydd ar bymtheg, 20fed=ugeinfed,
21ain=unfed ar hugain, …, 30ain=degfed ar hugain, 40fed=deugainfed, 50fed=degfed ar ddeugain,
60fed=trigainfed, 70fed=degfed ar trigain, 80fed=pedwar ugeinfed, 90fed=degfed a phedwar ugain,
100fed=canfed, 200fed=dau ganfed, 1,000fed=milfed, 2,000fed=dwy filfed, 10,000fed=deng milfed,
100,000fed=can milfed, 1,000,000fed=miliynfed.

So: 37fed = 17 ar hugain → "ail ar bymtheg ar hugain"; 190fed = 10 a naw ugain → "degfed a naw ugain";
60fed = "trigainfed". This is the vigesimal composition, NOT the decimal-composed forms the cardinal
compositor in numbers.ts would suggest.

## Run 3 — 2026-08-01 (implementation)

`src/languages/welsh/normalize.ts` landed on `norm-cy-562`. Steps, in order:
1) era markers (O.C. → Oed Crist, C.C. → Cyn Crist, undotted OC range)
1b) currency prefixes (AUD$ → doler Awstralia, US$ → doler yr Unol Daleithiau) + UD/U.D. → Unol
    Daleithiau
1c) Welsh abbreviations DU → Deyrnas Unedig, UDA → Unol Daleithiau America, AS → Aelod Seneddol —
    CASE-SENSITIVE, because the lowercase "du" is the Welsh for "black" (y Môr Du = the Black Sea) and
    the initial case-insensitive rule produced false positives on every "du" in prose (trap 7)
2) dotted capital runs (George W. Bush)
3) single-dot abbrevs (ayb. → ac yn y blaen)
4) `Nfed`/`Ned`/`Neg`/`Naf`/`Nydd`/`Nain` ORDINALS — the VIGESIMAL table + composition (trap 13 branch
   pins in the tests); comma-thousands allowed inside the digit run (1,000fed)
5) decades (1970au → the -au is a plural suffix, not a word) — NOT `\b`, which finds no boundary
   between the digit and the attached -au (trap 1)
5b) clock ranges (10:00-11:00 → the hyphen is "i" = to)
6) clocks in the COLON form, with p.m./a.m. → y prynhawn / y bore (the corpus's own register)
6b) clocks in the DOT form before a timezone (15.00 UTC, 12.00 GMT — the dot would otherwise read pwynt)
7) version dots and dot-decimals (802.11n, 2.4Ghz, 1.5 miliwn → pwynt)
8) fractions (1/5 → un pumed, ¾ → a thri chwarter)
9) degrees (+30°C → gradd Celsius)
10) rates (cilomedr/awr → yr awr; llath/metr → neu fetr — the "/" is an OR)
11) Ghz → gigahertz
12) signs (+ → plws, - → minws range-guarded, & → a, = → yn hafal i, < > ×)
13) initialisms, letter-spelled (NHK → en aitsh ec, UCLA → u ec el a) or word-read (UNESCO, OPEC,
    COVID, NASA, FIFA, ASUS); the full corpus initialism inventory verified.

**Engine wiring** (welsh.ts): `text()` = `assembleClauses(SYMBOLS(normalizeWelsh(input)), TOKEN, …)`.
The TOKEN gained comma-thousands: `\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+\.\d+|\d+`. The tier gained `m`
(metre) for the 100m/230m running events and 4892 m; the decimal word pwynt is emitted as text by the
version rule and phonemized through the word path.

**Gates**:
- scan: no defects (DROP 2 → 0; one REDUNDANT currency note — AUD$45 now says "doler" so the drop is
  permissible, read the note)
- tsc: clean
- vitest: 2645 passed (6 new cy normalization tests, incl. the trap-13 ordinal branch pins)
- referee: 12034/14376 (83.7%) — IDENTICAL to the worktree baseline
- corpus diff: 219/2009 (10.9%) changed, every change READ and verified an improvement (97 initialism,
  31 comma-thousands, 25 ordinal, 16 dot-decimal, 14 decade, 10 abbrev, 8 clock, 2 unit, 2 era, 2 rate,
  2 degree/fraction, 10 misc — M16/H5N1/KV62/A1GP letter-spelling and George W. Bush)
- normalization-review --lang cy: checklist clean

**Trap 7 caught live**: the DU/UDA/AS expansions were initially case-INSENSITIVE (`giu`), and the corpus
diff immediately showed "y Môr Du" (the Black Sea), "Un byr du yw espresso", "Oldsmobile du", "Cirque du
Soleil" all expanding "du" → "Deyrnas Unedig". Made case-sensitive; the diff dropped to 208 then 219
with the decade fix. Zero false positives remain.

**Notes**: the review probes `12,5`, `1.234`, `5 000` are all corpus-absent shapes (Welsh groups with
commas and writes decimals with dots), and each has a defensible reading.

## Run 4 — 2026-08-01 (re-review against the playbook traps)

The parent asked for a re-review with `docs/normalization_playbook.md` in mind. Two real defects plus
one dead branch, all found by probing the adversarial neighbour:

- **Clock glue (the big one)**: the colon-clock rule's trailing `\s*(p\.?m\.?|a\.?m\.?)?` consumed the
  space after the minutes even when no marker followed, so the corpus's `10:00-11:00 yr hwyr` read the
  range "i" glued onto "deg" → *degi*. The marker is now captured as `(?:\s*(p\.?m\.?|a\.?m\.?))?` —
  the space only attaches when a marker is present. The corpus output was identical (the corpus's only
  clock range is handled by the 5b hyphen rule BEFORE the colon-clock), but the synthetic `10:00-11:00
  yr hwyr` probe was wrong. Pinned by a test.
- **Fraction noun branch (trap 13, exactly the Catalan lesson)**: the fraction rule used `ordinalWords`
  for the denominator, so `2/3` read *dau drydydd* and `3/4` *tri pedwerydd*. The referee attests the
  FRACTION NOUNS traean (a third) and chwarter (a quarter) — distinct from the ordinals trydydd/
  pedwerydd. The corpus's only fraction is 1/5 (pumed, where ordinal = noun), so the 3/4 noun branch
  was never read. Special-cased: den 3 → traean, den 4 → chwarter. Pinned by tests.
- **Dead clock-range rule 7b (trap 9)**: a second `digit-hyphen-digit` → "i" rule after the colon-clock
  matched ZERO corpus instances (the only clock range is handled by 5b before the clocks) AND carried a
  `\b` (trap 1). Removed.

**Verified non-issues**: the DU/UDA/AS expansions are case-sensitive (the lowercase "du" = black, "as" =
a real word) — re-confirmed no false positives; the UD/U.D./O.C./C.C./OC rules are case-insensitive but
no lowercase collisions exist in the corpus; the `ain` ordinal suffix routes to valid vigesimal forms;
`-5` → minws while `5-10` ranges stay; the `20s` vigesimal composition (21fed → unfed ar hugain, 39fed →
pedwerydd ar bymtheg ar hugain) verified correct.

**Post-fix gates**: corpus diff 219/2009 (10.9%) — the changed set is byte-identical to the pre-review
run (no regression); 2645 tests; referee 83.7% unchanged; scan no defects; review checklist clean.

## Run 5 — 2026-08-01 (the parent's probe review: range/dot joiners)

The parent ran `normalization/review.ts --lang cy` and flagged three ordinary-text probes:

- **`1990-1995` → no "to" joiner** — real defect. Welsh reads ranges and scores with "i" (to):
  *chwech i chwech* (6-6), *pump i dri* (5-3), *mil wyth cant naw deg pedwar i fil wyth cant naw deg
  pump* (1894-1895). The corpus has 18 digit-ranges (scores and periods), none a minus. Added a general
  range rule `\d+[-–]\d+` → "i", replacing the clock-specific 5b. The `(?<![\d.,])`/`(?![\d.])`
  lookarounds keep `4.2-3.9` (a decimal range) and `-5` (a minus) out of it; the decimal range gets its
  own "i" join before the dot rule.
- **`1.234` → no dot joiner** — real defect. The old version rule claimed only 1-2 digit fractions, so
  `1.234` fell to the TOKEN as a float → digit-by-digit "un dau tri pedwar" with no "pwynt". Welsh has
  ZERO dot-thousands (verified `\d\.\d{3,}` count = 0; thousands are comma-grouped), so a dot is ALWAYS
  a decimal. The rule now claims all fraction lengths, reading "pwynt" with the fraction digit-by-digit
  (1.234 → un pwynt dau tri pedwar — NOT "un pwynt dau gant tri deg pedwar", which a whole-number
  reading of the fraction would give).
- **`12,5` → no comma joiner** — NOT a defect. The corpus has zero comma-decimals; Welsh follows English
  (comma-thousands 1,400 + dot-decimals 1.5). `12,5` is a form Welsh never writes, and the comma reads
  as a pause. Left as-is, documented.

**Regression caught while making the dot fix**: converting "12.8" → "12 pwynt wyth" destroyed the
tier's number-unit adjacency, so "12.8 km" lost its kilometr (the playbook's "units before decimals"
coupling). Fixed by claiming the unit's WORD inside the dot rule (`12.8 km` → 12 pwynt wyth cilometr).
Also `2.4Ghz` needed the Ghz claim moved BEFORE the dot rule (it converted the fraction to words the
Ghz rule could no longer see), and the version LETTER (802.11n) is emitted spaced so it reads as the
letter name rather than gluing onto the last fraction digit.

**Post-fix gates**: corpus diff 230/2009 (11.4%), all 16 range changes read and verified (scores and
periods join "i", decimals keep pwynt+unit); 2647 tests (2 new range/decimal pins); referee 83.7%
unchanged; scan no defects; review checklist clean.
