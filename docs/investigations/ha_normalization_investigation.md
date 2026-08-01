# Hausa (ha) normalization investigation (#562)

Chronological record. Baseline worktree: `~/Programming/tmp/ha-base` (pinned at the commit the work
started from). Working branch: `norm-ha-562`.

## Run 1 — 2026-08-01

**Setup**: referee baseline `folded backbone: 1669/1849 (90.3%)` in the working tree.

**Corpus shape** (1,495 unique ha_ng utterances — a FLEURS English translation into Hausa):
- **comma-thousands** ×26 (783,562, 300,948, 5,000,000, 3,000, 100,000, 6,387, 2,400, 9,000) — the
  TOKEN `\d+` splits these on the comma. + **dot-decimals** (1.1, 1.5, 2.8, 12.8, 4.2-3.9).
- **`kashi N%`** ×4 — the corpus's percent register is "kashi 80%" (kashi = portion, BEFORE the
  number). The `%` is currently dropped (no tier percent word).
- **clocks** ×16 — `8:46 na safe` (na safe = a.m.), `8:30 na yamma` (na yamma = p.m.), `12.00 GMT`,
  `15.00 UTC`, `11:29`, `11:00 (UTC+1)`. NOTE the corpus uses the Hausa "na safe"/"na yamma" AND the
  English GMT/UTC; the dot-clock (12.00 GMT) is a 24h time.
- **era markers** ×2 — `1000 B.C.`, `10,000 BCE`.
- **rates** ×7 — `160km / h`, `480 km/h`, `133 m/s`, `300 mph`, `600Mbit/s`, `100-200 mil/awa`,
  `64 kph`. The corpus's own prose "mil/awa" (miles per hour) is Hausa text.
- **currency** ×7 — `US $ 30`, `$11,000`, `US$14.7 biliyan`, `¥2,500`, `¥130,000`, `£27`.
- **units** ×14 — 90kg, 16kg, 35 mm, 36 by 24 mm, 6,387 km, 3,980 mil, 5 mm, 3,850 km².
- **fractions** ×2 — `4/4` (four-wheel drive), `inci 1/5` (one fifth of an inch).
- **degrees** ×2 — `+30°C`, `35°W` (longitude).
- **ranges** ×11 — `2-3 km`, `4.2-3.9 miliyan`, `1644-1912`, `5-3`, `2-5`, `100-200 mil/awa`.
- **initialisms** ×96 — AOL, AU, OPEC, OHA, UN, PSTN, A1GP, GPS, NPWS, B&amp;Bs.
- **abbrev** — `George W. Bush`, `Roe v. Wade`.
- **roman** — Elizabeth II, Yaƙin Duniya na I/II (World War I/II — prenominal!).
- **signs** — `US $ 30` (the $), `(UTC+1)`.

**KEY DEFECTS from the probe**:
- `kashi 80%` → *kashi tamanin* (the % dropped — no percent word).
- `8:46 na safe` → colon pause + [na safe] (na safe is text, but the colon breaks).
- `1000 B.C.` → *dubu b. tʃ.* (era marker letter-spelled).
- `160km / h` → *...km h* (rate raw).
- `$11,000` → *goma sha ɗaya, sifili* (comma pause, $ dropped).
- `US$14.7` → *us goma sha hudu. bakwa* (prefix + dot pause).
- `6,387 km` → *shida, ɗari uku... km* (comma pause, km raw).
- `35 mm` → *...mm* (unit raw — the tier has no units!).
- `30°C` → [tʃ], `35°W` → [w].
- `Hoto na 1.1` → *ɗaya. ɗaya* (dot pause).
- `A1GP` → *a ɗaya gp* (letters+digits, GP cluster).
- `B&amp;Bs` → *b bs* (HTML entity dropped).
- `AOL` → [aol], `AU` → [au], `UN` → [un], `OHA` → [oha].
- `Roe v. Wade` → the v. dot.
- `4/4` → *hudu hudu* (four-wheel drive → should be "hudu-hudu"? the corpus means a 4x4 vehicle).

**GOOD already**: `1998` → *dubu da ɗari tara da casa'in da takwas* (the compositor works), `2.8 miliyan`
(dot pause — needs fixing), plain years, roman numerals (II → na biyu), `kashi` in prose.

**Next**: write `src/languages/hausa/normalize.ts`, wire into `text()`.

## Run 2 — 2026-08-01 (implementation)

`src/languages/hausa/normalize.ts` landed on `norm-ha-562`. Steps, in order:
1) HTML entities (&amp; → da)
2) era markers (B.C./BCE → kafin haihuwar Yesu)
3) dotted capital runs (George W. Bush) + the legal `v.` (Roe v. Wade → da)
3b) currency prefixes (US$ / US $ → dollar)
4) ranges/scores → "zuwa" (to)
5) clocks in the COLON form, with the corpus's own "na safe"/"na yamma" kept and p.m./a.m. → those;
   the marker captured without eating the space (the clock-glue trap)
6) clocks in the DOT form before a timezone (12.00 GMT, 15.00 UTC)
7) version dots and dot-decimals → "maki" (point), fraction digit-by-digit; units claimed with the word
   (12.8 km → kilomita); version letters spaced (802.11n); Ghz claimed first
7c) comma-decimals → maki (the review's leak guard)
8) fractions (4/4 → hudu bisa hudu; inci 1/5 → ɗaya bisa biyar)
9) degrees (digiri Celsius/Fahrenheit + the 35°W longitude → digiri yamma)
10) rates (km/h → kilomita a awa; m/s → mita a daƙiƙa; mph/kph/mil/awa; Mbit/s → megabit a daƙiƙa)
11) signs (+ → ƙari, - → rashin, & → da, × → sau, = < >)
12) initialisms (A1GP → a ɗaya ga pa, H5N1 → ha biyar na ɗaya, PSTN letter-spelled; OPEC/UN as words)

**Engine wiring** (hausa.ts): `text()` = `assembleClauses(SYMBOLS(normalizeHausa(input)), TOKEN, …)`.
The TOKEN gained comma-thousands + dot-decimals; the tier gained percent "kashi" (PREFIX), currency
(dollar/euro/yen/fam), units (kilomita/mita/kilogram/milimita/santimita), exponentWords
(murabba'i/cubic). "kashi" and "maki" are both attested (the review's sourcing check passes).

**Gates**:
- scan: no defects (DROP 13 → 0; REDUNDANT percent ×2 — the "kashi 80%" cases where "kashi" is already
  in the sentence, a permissible trap-12 drop)
- tsc: clean
- vitest: 2664 passed (8 new ha normalization tests)
- referee: 1669/1849 (90.3%) — identical to the worktree baseline
- corpus diff: 149/1497 (10.0%) changed, every change READ and verified an improvement (54 initialism,
  26 comma-thousands, 18 dot-decimal, 10 clock, 9 range, 6 currency/percent, 4 rate, 3 unit, 3 abbrev,
  2 degree, 2 fraction, 1 era, 1 sign, 10 misc — A1GP/H5N1/KV62/3136mm2)
- normalization-review --lang ha: checklist clean (wired, tests, all 8 sign classes, spelling→g2p,
  SOURCING 1 high-traffic word attested, scan)

**Notes**: the review probes `12,5` (comma-decimal → maki), `1.234` (maki digit-by-digit), `5 000`
(space-grouped, corpus-absent) all read correctly. `6×6` → "shida sau shida" (× → sau = times). The
referee eval prints two "folded backbone" lines (two referee sets); both worktrees agree.
