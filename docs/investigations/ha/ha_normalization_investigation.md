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
- normalization/review.ts --lang ha: checklist clean (wired, tests, all 8 sign classes, spelling→g2p,
  SOURCING 1 high-traffic word attested, scan)

**Notes**: the review probes `12,5` (comma-decimal → maki), `1.234` (maki digit-by-digit), `5 000`
(space-grouped, corpus-absent) all read correctly. `6×6` → "shida sau shida" (× → sau = times). The
referee eval prints two "folded backbone" lines (two referee sets); both worktrees agree.

## Run 3 — 2026-08-01 (re-review against the playbook traps)

The parent asked for a re-review with `docs/normalization_playbook.md` in mind. Three real defects,
all found by probing the adversarial neighbour (trap 8 (zero corpus instances is not evidence of…)), none visible in the original corpus diff:

- **The decimal-percent leak (the Fula/Irish lesson)**: `3.5%` read "uku maki biyar" with the `%`
  silently dropped — the dot rule converted the number to words, so the tier's digit-adjacent kashi
  could not see it. Fixed by claiming the word-form percent ("X maki …" → "kashi X maki …"). Guarded
  against a preceding "kashi" (the corpus writes "kashi 3.5%" — adding another would double).
- **The rate-after-decimal glue**: `12.8 km/h` read "...kilomita h" — step 7's unit alternation matched
  the bare `km` before `km/h` (alternation order), and the rate rule ran after the dot rule had claimed
  the number. Fixed: longest-first alternation (`km/h|m/s|km/u` before `km|m`) in the version-dot unit
  rule; `/u` added to the step-10 rate denominator (the corpus's km/u spelling).
- **The B.C.kafin dedupe**: the corpus's ONE B.C. instance writes "1000 B.C.kafin zuwan" — the "kafin"
  (before) already follows, so B.C. expanding to "kafin haihuwar Yesu" doubled the "kafin" AND left a
  stray dot ("kafin haihuwar Yesu.kafin"). Fixed: B.C. is removed when immediately followed by
  "kafin"; bare BCE still expands.

**Verified non-issues**: the fraction denominators (2/3, 3/4, 1/2, 2/5, 5/8); 30°F/30°/35°E/35°N; the
minus-vs-range guard (-5 → rashin, 5-10 → zuwa, -5°C); the comma-decimal vs comma-thousands
(12,5/12,50 → maki, 6,387/5,000,000 → thousands); the currency amounts (£27, ¥2,500, $2.3, $1000,
US$14.7); the dot-clock vs decimal (12.00 GMT vs 12.5); "zuwa" and "a awa" do not trigger agreement.

**Post-fix gates**: corpus diff 149/1497 (10.0%) — 1 utterance changed by the B.C. fix, verified
correct; 2664 tests (2 new trap pins); referee 90.3% unchanged; scan no defects; review checklist
clean, sourcing check passes.

## Run N+1 — 2026-08-01 (PR #598 review pass)

**Four defects. The first was found by fixing the review tool**, whose sourcing check reported "all 1
high-traffic words attested" for a tier that declares four currency names — it was pairing quotes in the
wrong phase over `"$": ["dollar"]` and never seeing the values at all.

1. **The dollar was the English spelling.** `dollar` appears in neither the corpus nor the referee; the
   corpus names the currency twice and both times it is **dala** — "dalar Amurka" and "biliyoyin dalolin
   Amurka". Fixed in the tier AND in normalize's `US$` prefix rule, which had its own copy. Seven corpus
   emissions across five utterances.
   `dala` is polysemous — four of its seven corpus hits are "pyramid" ("dala ta Giza", "mai siffar dala") —
   but the tier only emits it after a currency sign, so the other sense is unreachable. `yen` stays as a
   STATED assumption: the corpus writes ¥ ×2, so the word is spoken, but the word itself is attested
   nowhere here.
2. **A DECIMAL range never reached the range rule.** The plain-range lookbehind `(?<![\d.,])` blocks a
   digit that follows a dot, so `4.2-3.9 miliyan` — the corpus's one decimal range, and a shape this PR's
   own header claims — never matched; the decimal rule then converted each side to words and the hyphen was
   dropped with no joiner (*huɗu maki biyu uku maki tara*). A decimal-range rule now runs first.
3. **The hooked consonants were declared as VOWELS.** `vowels: /[aeiouƙƴɓɗ]/u` in the phonotactics test —
   ɓ ɗ ƙ ƴ are consonants, and are already in `legalOnsets`. Any letter run containing one counted as
   pronounceable, so it would never be spelled out.
4. **A padded replacement left an edge space** (`+30°C` → ` ƙari …`). Collapsed and trimmed on the way out.

**Verified NOT a defect** (the hypothesis this review started from): `kashi 80%` does not double the percent
word. Two of the corpus's four percent instances already write `kashi` and two do not, and the shared tier's
already-said guard handles both — "kashi 80%" → *kashi tamanin*, "93%" → *kashi casa'in da uku*. The scan
reports the two pre-written ones as permissible `REDUNDANT percent`, which is exactly right.

**Gates**: vitest 2664 (200 files); tsc clean; scan no defects (two permissible REDUNDANT percent notes);
`normalization/review.ts --lang ha` checklist clean apart from the `yen` sourcing prompt; referee
**identical** at 1669/1849; corpus diff **6/1497** with every counter 0 → 0 — 7 dollar→dala and one range
joiner, each classified.
