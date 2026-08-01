# Macedonian (mk) text-normalization investigation (#562)

Macedonian is the next language in the corpus sweep, treated from the FLEURS mk_mk mined artifact
(`tools/corpus/mined/mk.jsonc`, 1,857 unique utterances). The engine (macedonian.ts) already composes
cardinals and handles the antepenultimate stress + South-Slavic phonotactics; what is missing is the whole
normalization layer.

## Run 1 — corpus tabulation

The corpus's own writing conventions, distinct from its Slavic siblings:

- **Grouping is a PERIOD and the decimal is a COMMA** — `400.000`, `19.500`, `5.000.000`, `3.850`, and
  `6,5`, `12,8`, `2,3 милиjарди`. The comma is ALSO used as a thousands separator in English-influenced
  spots (`1,400 луѓе`, `30,000`), so the comma+3-digit rule must read it as grouping, exactly like Czech.
- **The ordinal is a SUFFIX, not a dot**: `N-ти`, `N-тиот`, `N-от`, `N-ви`, `N-миот`, `N-ма`, `N-та`,
  `N-те`, `N-тите`, `N-тина`, plus the bare `N век` (century, without suffix). No `N.` ordinal-dot shape
  exists — `4. jули` is the one Germanic remnant, and `1770.` is a sentence period.
- **Year abbreviations** `N г.` (33×) and `N год.`, era markers `г. н.е.` / `п.н.е.` / `пр. н. е.`.
- **Units are Cyrillic AND Latin**: `км`/`km`, `км²`, `мм`/`mm`, `м`, `cm`. Rates `км/ч`, `km/h`,
  `милjи/час`, `mph`, `kph`.
- **Cyrillic initialisms are dense**: САД (25), ОН, ФБИ, ДНК, НАСА, УНЕСКО, ТВ, СССР …
- Clock: `06:30`, `22:00-23:00`, `23:35 ч`, `2:30`. The `ч` after a clock means "часот".
- `-тина` approximatives: `40-тина`, `20-тина` ("about forty").
- Decades: `1970-тите`, `1850-те години`, `1970-ите години`, `1920- тите` (space).

## Run 2 — implementation (normalize.ts + numbers.ts + engine wiring)

Decisions taken, each measured against the corpus:

- **Ordinal suffix system.** The written suffix IS the last letters of the spoken ordinal (Russian's
  ending-matching idea, but encoding GENDER + DEFINITENESS rather than case):
  -ти / -ви / -ми masculine indefinite (60-ти → шеесетти, 21-ви → дваесет и први, 1-ви → први)
  -тиот / -от / -миот masculine definite (18-тиот → осумнаесеттиот, 7-миот → седмиот)
  -ма feminine indefinite (37-ма → триесет и седма)
  -та feminine definite (1-та → првата, 3-та → третата), EXCEPT a round thousand/million where the
  feminine indefinite already ends in -та (1.000-та → илjадита, because "Неговата" carries definiteness)
  -те definite plural — "the N" (116-те → сто и шеснаесетте) OR a decade when the number is a year
  followed by "години" (1850-те години → илjада осумстотини и педесеттите години)
  -тите / -ите decade (1970-тите → илjада деветстотини и седумдесеттите)
  -тина approximative (40-тина → четириесетина, "some forty")
  Only the LAST element of a compound ordinalizes: 1970 → "илjада деветстотини и седумдесетти".
- **Clock**: hour и minute, :00 drops minutes (06:30 → шест и триесет); trailing ч → часот.
- **Decimal comma** stays adjacent for the shared tier; the TOKEN reads "запирка" + digit-by-digit, with
  the 3-digit comma-block read as one number (grouping).
- **Regnal ordinals** after roman→digit: the number after a capitalised name (2–39) is read as an ordinal,
  feminine after a name ending in -а (Елизабета II → втора, Луј XVI → шеснаесетти).
- **Rates**: милjи/час, mph, kph, Mbit/s locally; км/ч, km/h via the shared tier's rate machinery.

## Run 3 — verification gates (all green)

- scan: "no defects" (DROP 9 → 0)
- tsc --noEmit clean; vitest 200 files / 2567 tests pass
- referee-eval mk: folded backbone 62375/63024 (99.0%) — UNCHANGED from the pristine worktree
- corpus diff: 271/1857 changed (14.6%); before DROP 9 → after DROP 0; every sample-tier change audited
  as an improvement (grouped thousands, suffix ordinals, decades, clocks, dates, era markers, units,
  rates, initialisms, regnal ordinals).

## Run 4 — notable traps found while debugging

- The clock rule's optional `ч` group is non-capturing, so the callback's "4th arg" was the OFFSET, not
  the ч text — the "часот" appended on every clock. Fixed by capturing and `typeof`-checking.
- `\b` is ASCII-defined — the `Д-р`/`Г-дин` rules never fired next to Cyrillic until rewritten with
  `(?![\p{L}\p{M}])`. The same trap bit the "и" test in the century list rule.
- The OOV unreadable-test vowel/onset/coda sets must include BOTH scripts: the Latin embedded words
  (ASUS, PALM, MINAE, JAS) route to the foreign engine, while vowel-less Latin runs (GPS, DVD) must
  letter-spell.
- The `\d{2}` regnal guard wrongly rejected the single-digit regnal names (III→3, II→2); the real guard
  is value 2–39 + punctuation-after, which also excludes "Формула 1." (Formula ONE, cardinal) and
  "Цели 20 проценти"/"Имаше 2 гола" (counts).
