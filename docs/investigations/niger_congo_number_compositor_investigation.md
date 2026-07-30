# Niger-Congo cardinal-number compositor repair (zu, xh, ak, rw, rn, nya)

A number-audit probe (`probe.mts`: renders 0–100 + 101/111/555/999/1000/1001/12345/10⁶/10⁹ through
`phonemize()` and flags EMPTY / DIGIT-LEAK / SENTINEL / SLOT-GAP / duplicate outputs) reported six
Niger-Congo languages as producing silently corrupted numerals. This log is the diagnosis.

## Run 1 — 2026-07-29 — reproduce the reported signatures

Command:

```
npx tsx probe.mts zu xh ak rw rn nya
```

Raw finding (counts of flagged numbers):

| lang | flagged | reported signature |
| --- | --- | --- |
| zu | 20 | SENTINEL on 13, 15, 23, 25, 33, 35 … 555, 12345 (units 3 and 5) |
| xh | 20 | identical to zu |
| ak | 22 | SENTINEL on 4, 14, 24, 34, 40–49, 54, 64 … and on 10⁶, 10⁹ |
| rw | 19 | SENTINEL on 8, 18, 28 … 80–89, 98 |
| rn | 19 | identical to rw |
| nya | 4 | 60=DUP-OF-51, 70=DUP-OF-52, 80=DUP-OF-53, 90=DUP-OF-54 |

Question the run was meant to answer: is the shared `tens[String(Math.floor(n/10))]` key bug (the
documented bug class) present in these languages? **No** — none of the six uses the `core/numbers.ts`
`tens` map; all six have a bespoke `numbers.ts`/composer. So the SENTINEL had to come from somewhere
else, and the per-language signatures (always the *same unit digit*) did not look like a table hole:
a hole in `units[3]` would also break 3 itself, and 3 was clean.

## Run 2 — 2026-07-29 — dump the actual strings instead of trusting the flag

Printing `phonemize(String(n), lang)` directly for the flagged numbers:

```
zu 13  → "i˥˩ʃˈuː˥˩mi˩ nantʼˈaːtʰu"      (ishumi nantathu)
zu 15  → "i˥˩ʃˈuː˥˩mi˩ nanɬˈaːnu"        (ishumi nanhlanu)
ak  4  → "nnan"                            (nnan)
ak 40  → "adwanan"                         (aduanan)
rw  8  → "umunani"                         (umunani)
ak 10⁶ → "mpem undefined"                  ← a REAL sentinel
nya 60 → "makumi zisanu ⁿdi t͡ʃimod͡zi"  ← real, and identical to 51
```

**Root cause of the bulk of the report: a false positive in the probe, not in the languages.** The
probe's sentinel regex is `/undefined|null|NaN|\[object/i` — **case-insensitive**, so it matches the
substring `nan` anywhere. Every "broken" number was a legitimate Bantu numeral containing `nan`:

- zu/xh — the *connective* `na-` unit series: **nan**tathu (3), **nan**hlanu (5). Only the na- series
  contains it, which is exactly why the standalone forms (kuthathu, kuhlanu) looked fine and the
  compounds looked broken.
- ak — **nnan** (4) and adua**nan** (40), hence 4/14/…/40–49/54/64/…
- rw/rn — umu**nan**i (8), hence 8/18/…/80–89/98.

Re-ran with a case-sensitive `\bnull\b`-tightened regex (`probe_cs.mts`): zu, xh, rw, rn are **CLEAN**
with no code change; ak drops from 22 flags to 2 (10⁶, 10⁹); nya keeps its 4 real duplicates.

Implication: only three real defects exist, and they are in ak and nya (plus accuracy problems in
rw/rn found while reading the tables). **The probe's regex should be case-sensitive** — otherwise any
Bantu, Japanese (nan-), or Indic numeral table with an `n-a-n` sequence is unfixable by construction.

## Run 3 — 2026-07-29 — the three real defects

### ak — no 10⁶/10⁹ branch (real SENTINEL)

`numberWords` in `akan.ts` did `th = Math.floor(n/1000)` and then `under1000(th)`. For n = 10⁶ that is
`under1000(1000)` → `hundreds[10-1]` → `undefined` → `"mpem undefined"`. Fixed by giving the composer
billion/million/thousand tiers and a ≥10¹² digit-by-digit fallback. Words from Omniglot "Numbers in
Twi": ɔpepem 10⁶, ɔpepepem 10⁹, plurals mpepem/mpepepem by the regular ɔ- → m- class change.

### nya — the tens multiplier used the wrong noun class (real DUP)

Chichewa numerals 1–5 are bound stems taking the concord of what they count, and the compositor had
only ONE series (the class-8/10 citation forms chimodzi/ziwiri/…). The tens are `makumi` (class 6),
whose multiplier is the a-/li- series, and — crucially — 60–90 are formed *multiplicatively on the
tens*: 60 is literally "five tens and ONE (ten)" = makumi asanu ndi **limodzi**. Using the class-8
series produced `makumi zisanu ndi chimodzi`, byte-identical to 51 (= five tens and one *unit*). Same
error would surface at 70/80/90 vs 52/53/54, exactly the reported duplicates.

Fix: a second `classSix` series in `chichewa.jsonc` used for the makumi/mazana multipliers; the
class-8 `zikwi` (thousands) legitimately keeps the `units` series. Also corrected the hundreds
(`zana` cl.5 → plural `mazana` cl.6, so 200 = mazana awiri, not \*zana ziwiri) and made 1000 the
native `chikwi`/`zikwi` rather than the English loan `sauzande`. Sources: Omniglot "Numbers in
Chichewa" (tens), Wiktionary (zana cl.5/mazana cl.6; chikwi cl.7/zikwi cl.8).

### rw/rn — no real sentinel, but the tens/hundreds/thousands were wrong

Reading the tables while confirming the false positive: both languages had a single bare
`"tens": "makumi"` + citation units, giving \*makumi kabiri for 20. Attested Kinyarwanda is
`makumyabiri` (fused, irregular) and `mirongo itatu / ine / itanu / itandatu / irindwi / inani /
icyenda` for 30–90 — i.e. tens select mirongo + an **i-** series, hundreds select magana + an **a-**
series (magana abiri), thousands select ibihumbi + a **bi-** series (ibihumbi bibiri). Three
independent sources agree (languagesandnumbers `kin` rule text, Omniglot, kinyarwanda.mofeko.com), and
Harvard ELIAS states the governing rule: numerals 1–7 take class concord, 8/9/10 are invariable.
Kirundi is the same system with 7 = indwi, 9 = icenda (no ⟨cy⟩), 20 = the regular mirongo ibiri,
plural amajana, 10⁶ = umuriyoni.

Since the numeral morphology is shared, the compositor was de-duplicated: `kinyarwanda/numbers.ts`
exports `composeRwandaRundi(n, table)` and `kirundi/numbers.ts` calls it with the Kirundi table —
matching the g2p near-clone relationship the two already have. Previously the two files were
byte-identical apart from doc comments.

## Run 4 — 2026-07-29 — verify

```
npx tsx probe_cs.mts ak rw rn nya zu xh   → all six CLEAN
npx tsc --noEmit                          → clean
npx vitest run test/{akan,kirundi,zulu,xhosa,chichewa,kinyarwanda}.test.ts → 38 passed
```

`test/chichewa.test.ts` and `test/kinyarwanda.test.ts` are new (neither language had one); the
Chichewa file asserts explicitly that 60/70/80/90 are **not** equal to 51/52/53/54.

## Judgment calls / what is still simplified

- **Which form for a bare numeral.** All six languages have noun-class concord, so a numeral has no
  single form. Everywhere a choice was forced, the **counting/citation** form was used — what a TTS
  should speak for a lone digit: Chichewa class-8/10 (chimodzi, ziwiri), Rwanda-Rundi rimwe/kabiri/…,
  Zulu/Xhosa the standalone ku- series. Multiplier positions get the magnitude's own class instead.
- **rw/rn ≥10 thousand-multipliers** revert to the citation series (ibihumbi icumi na kabiri) rather
  than a full class-8 concord; the `na` connector is not elided before vowels (icumi na umunani, not
  icumi n'umunani).
- **nya ≥10⁶** still falls back to digit-by-digit. Chichewa has no well-attested native million; the
  loan "miliyoni" could not be sourced to the standard this repo requires, so no numeral was invented.
- **rw/rn ≥10⁹** falls back to digit-by-digit (miriyoni/umuriyoni are sourced, a billion word is not).
- **zu/xh were not changed at all** — their tables and composer were already correct, and the report
  against them was entirely the regex artefact.
