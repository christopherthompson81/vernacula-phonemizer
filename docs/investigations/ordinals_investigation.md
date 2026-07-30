# Ordinals — capability & demand audit

Issue #562. Scope of this entry: find which languages lack ordinals. No implementation.

## Run 1 — 2026-07-29

### Q1: which languages can form an ordinal from an integer?

Enumerated all 191 registered codes from `registry.ts`, checked each language dir for
`romanOrdinals.ts` (which carries `ROMAN_POLICY.ordinal(n)`) and for any other ordinal
machinery.

- **14 have an `ordinal(n)` former**: es, es-419, pt, pt-BR, it, ro, ca, ru, pl, uk, hu, az, kk, uz.
- **1 more has general ordinal support**: en (`ordinals` table in the manifest + suffix reading
  in `normalize.ts`), plus fr with a bounded `FR_ORDINAL` map reachable only from its Roman rule.
- **~176 have none.**

A grep for `/ordinal/i` across `src/languages/` matches 27 files, but **most are false
positives** and the raw count is misleading. `ordinal` in german/swedish/luxembourgish means
*syllable index* for stress placement. mandarin's is the 第一 yī-sandhi trigger, not ordinal
formation. guarani's `numbers.ts` says ordinals are explicitly out of scope. lingala's jsonc
key `"ordinals"` holds its **cardinal** stems (Meeuwis §3.6: cardinal = connective *ya* + that
stem) — a naming quirk. Do not trust the grep count.

### Q2: range of the 14 existing formers

Probed each `ROMAN_POLICY.ordinal` at n = 1, 3, 11, 21, 40, 58, 100, 137, 1988:

| languages | coverage |
|---|---|
| it, ro, ca | unbounded — correct at 1988 (`millenovecentoottantottesimo`) |
| es, es-419, pt, pt-BR | correct to 137, `undefined` at 1988 |
| ru, pl, uk, hu, az, kk, uz | correct to 100, `undefined` at 137 and above |

### Q3: demand — does ordinal notation actually occur in the corpora?

Measured the FLEURS transcripts with **per-language** ordinal-notation patterns. A generic
"digit + suffix" regex was tried first and discarded as noise-dominated: it counted units
(`km`, `мили`, `ไมล`), Hindi/Marathi case markers, and CJK date words 年/月/日.

Notation found in 25 of the 30 corpora with a defined pattern. Highest: az 279 hits
(`1988-ci`), el 100 (`19ο αιώνα`), da 97 (`24. august`), ta 58 (`2009 ஆம்`), en 55 (`8th`),
nl 52 (`18e eeuw`), zsm/id ~45 (`abad ke-18`), bg 46, am 42 (`19ኛው`), uk 40, kk 34, cy 30
(`37fed`). The bare `N.` style (de/cs/sk/hu/fi/tr/nb/sv/pl/sl/et/lv/lt) is **excluded from
these counts** — a regex cannot distinguish it from a sentence-final digit or a list marker,
so real demand in those languages is higher than measured.

### Q4: what does the engine do with that notation today? (the real finding)

Ran the notation verbatim through `phonemize`. **Only English is correct.** The others fail in
three distinct ways — and note this is *not* the documented "reads a cardinal instead of an
ordinal" limit in `core/roman.ts`; the suffix itself becomes audible garbage.

1. **Suffix spoken as a stray word** — it tokenizes separately and gets phonemized:
   `nl 18e` → `ˈɑxtin ˈeː` ("eighteen ee"); `el 19ο` → `ðeka enea o`; `sv 1:a` → `ɛtː : ɑː`;
   `bg 9-ти` → `dɛvɛt ti`; `uk 17-го` → `sʲimnadʲt͡sʲatʲ ɦɔ`; `ru 5-е` → `pʲætʲ je`;
   `kk 19-шы` → `ontoʁəz ʃə`; `az 1988-ci` → `…sæcːˈiz d͡ʒˈi`; `cy 37fed` → `…sˈaᶦθ vˈeːd`;
   `am 19ኛው` → `…zətʼəɲ ɲaw`; `hi 16वीं` → `sˈoːləɦ ʋˈiː̃`; `ca 1r` → `un r`.
2. **Period notation left as a literal `.` token** — `da 24.` → `ˈfiːɐɐwˈtyːvə . ˈɑwɡɔsd`;
   `tr 2.` → `icˈi . dˈynja`; `de 3.` → `dʁaɪ̯ . ɔktˈoːbɐ`; `pl 19.` → SLOT-GAP with a bare `.`.
   This is the same class as the reported English `St. James` bug: the stray period also drives
   a spurious pause in the segmenter, so it is audible twice.
3. **Correct by accident** — `vi thứ 18`, `cmn 第37`, `ja 第7`, `ko 제2` work because the ordinal
   marker is a separate real word already in the dictionary. `zsm/id ke-18` → `kə` + cardinal is
   genuinely correct Malay/Indonesian read aloud.

### Q5: `º`/`ª` leak (separate defect, found incidentally)

The masculine/feminine ordinal indicators **U+00BA and U+00AA reach the phoneme string raw** in
es-419, it, ca, gl, ro (and pt emits `ũ º`). `phonemize("1º","pt")` → `"ũ º"`. A non-IPA
character in output is a sentinel-class defect and is independent of the ordinal question — the
symbol normalizer should consume it regardless of whether an ordinal reading follows. The degree
sign `°` U+00B0 is *not* affected; it is already dropped.

### Implications for the next step

- The gap is not 14-vs-177 on paper; **behaviourally it is en-vs-everything**. Even the 14
  languages with a working former cannot use it on digit notation — `ordinal(n)` is reachable
  only from the Roman-numeral path in `normalizeRomans`. Wiring digit+suffix notation to the
  same former is the cheap high-value fix and immediately covers es/pt/it/ca/ro/ru/pl/uk/hu/az/kk/uz.
- Fix `º`/`ª` first: it is a one-line-per-language normalizer change, independent, and it is the
  only defect here that puts a non-phoneme in the output.
- The `N.` period style needs a *detector*, not ordinal data — distinguishing ordinal-`.` from
  sentence-final `.` is the hard part and is where de/tr/pl/cs/sk/fi/nb/da demand sits.
- Extending the 7 formers that stop at 100 is small (they already compose regularly); es/pt
  stopping below 1988 matters less, since four-digit ordinals are rare outside year-as-ordinal.
