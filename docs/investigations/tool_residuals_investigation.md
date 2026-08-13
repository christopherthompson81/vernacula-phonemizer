# Tool residuals — three findings other runs left behind, each with its evidence already taken

Three items, independent of each other. Item 1 is a ruler that had drifted, item 2 is a guard whose cost was
measured but not acted on, item 3 is wiring with no routing behind it.

All fleet numbers below come from the 161 committed mined artifacts (`hard` + `sample`, deduplicated and
mojibake-repaired exactly as `corpus-diff emit` ingests them): **45,306 readings**.

---

## Item 1 — `corpus-diff.ts` carried a private, stale copy of the leak table

`corpus-diff.ts` held its own `DEFECTS` table: `\p{Nd}`, the slot gap, a hand-listed RAWMARK set, and its own
`DROP` marker. It predated `ZERO-WIDTH` and `RAW-CAPS`, which is why the hmn run moved 95.7 % of that
language's utterances and its leak summary did not move at all — the class that went 100 → 0 was not in the
table. Third drifted copy found this week (`coverage.ts` was the second, fixed in `9a3626c`).

### Run 1 — 2026-08-13 13:15

**Command** a fleet scan phonemizing every mined line and applying (a) the file's old private table and
(b) the table derived from `LEAK_CLASSES`, to the same readings.

**Question** What does deriving actually cost — which classes newly fire, and on how many lines?

**Raw finding**

```
langs 161  lines 45306   (throws 0, drop-annotated 5188)
OLD                     { DIGIT: 0, SLOT-GAP: 2, RAWMARK: 2, DROP: 5188 }
NEW (annotated line)    { DIGIT: 0, SLOT-GAP: 2, RAWMARK: 2, ZERO-WIDTH: 0, RAW-CAPS: 5188, DROP: 5188 }
NEW (reading only)      { DIGIT: 0, SLOT-GAP: 1, RAWMARK: 2, ZERO-WIDTH: 0, RAW-CAPS: 0,    DROP: 0 }
```

**Implication** Two separate findings in one table.

1. The derivation itself is free: `ZERO-WIDTH` 0 lines, `RAW-CAPS` 0 lines, and the RAWMARK widening from a
   hand-listed `$€£¥` to `\p{Sc}` moves nobody — the same 2 lines fire before and after (bo, ka; Run 2).
   `DIGIT` and `SLOT-GAP` are character-identical to what stood there. **No number any investigation doc
   quotes moves.**
2. ⚠ **A NAIVE DERIVATION WOULD HAVE FABRICATED A CLASS.** `emit` appends ` ⟪DROP:currency⟫` to a reading
   that silently lost a symbol, and that annotation contains `DROP` in uppercase ASCII — exactly what
   `RAW-CAPS` detects. Scanning the annotated line reports `RAW-CAPS` on **5,188 of 45,306** readings
   (11.4 %), every one of them the tool's own writing. `compare` prints `⚠ REGRESSED` on any class that
   rises, so a change that merely surfaced one more silent drop would have turned a leak class red.

So the class is measured on the READING: the annotation is stripped (with its leading space — trimming
afterwards instead would erase a genuine trailing-space defect) and ` THROW` placeholders, which are not
readings and carry both a leading space and uppercase letters, are excluded and keep their own column.

### Run 2 — 2026-08-13 13:20

**Question** Which exact lines move, and is the RAWMARK widening really a no-op?

**Raw finding** Every line that fires, old table vs derived, printed with its source:

- `RAWMARK` bo ×1 and ka ×1 — the SAME two lines under both tables. The `\p{Sc}` widening adds nothing here.
- `SLOT-GAP` jv ×1 — same line under both.
- `SLOT-GAP` cjy ×1 — ⚠ **fires only on the annotated line**. The source is a wiki table fragment
  (`{| style="border-spacing…`) that reads as the EMPTY STRING; the annotation gave that empty reading a
  LEADING space, which `SLOT-GAP` reports. The old table had this bug too, at one line fleet-wide.

**Implication** The old private table's own count was already 1 line of self-report. Measuring the reading
rather than the annotated line is a fix in both directions, not just for the new classes.

### Run 3 — 2026-08-13 14:20 — the emit/compare cycle, both rulers over the same artifacts

**Command** a real cycle on four languages — `emit` a baseline from the tree at the start commit, `emit`
again from this tree, then `compare` TWICE over the identical pair of artifacts: once with the file as it
stood, once with the derived table. The engine difference is item 2's; the only thing that differs between
the two compares is the RULER.

**Question** What moves in a real before/after cycle, and does the annotation strip hold in the live tool?

**Raw finding**

| lang | changed | old ruler | new ruler |
|---|---|---|---|
| ary | 11/431 (2.6 %) | `DIGIT 0, SLOT-GAP 0, RAWMARK 0, DROP 15, THROW 0` | the same, **plus** `ZERO-WIDTH 0, RAW-CAPS 0` |
| pt | 1/115 (0.9 %) | `… DROP 0` | the same, plus both new classes at 0 |
| so | 1/447 (0.2 %) | `… DROP 2` | the same, plus both new classes at 0 |
| ak | 0/237 (0.0 %) | `… DROP 26` | the same, plus both new classes at 0 |

**Implication** Two things are shown at once. The two rulers agree on every class they share, so no reported
number changes; and ary carries **15 DROP-annotated readings** while the new ruler reports `RAW-CAPS 0` on
that same file — the annotation strip holds in the live tool, not only in the offline scan. ⚠ ak at 0/237 is
also item 3's gate: removing the dead reader changes no reading at all.

---

## Item 2 — the glued `NOT_VERSION` guard cost 24 measurements to catch 9

Reproduced, not trusted: the small-backlog run measured 30 suppressed instances (4 versions, 26
measurements) by asking the engine about each matched substring. This run asks the same question of the
whole fleet at line granularity, by emitting every mined artifact twice.

### Run 1 — 2026-08-13 13:40

**Command** emit all 161 artifacts at HEAD; patch the guard's shape half away
(`NOT_VERSION = "(?<![\\d.,])"`); emit again; diff line by line.

**Question** What is the existing guard doing to the fleet, in readings rather than in matched substrings?

**Raw finding** **33 readings change, in 19 languages.**

| | lines | where |
|---|---|---|
| IEEE `802.11a/b/g` designations | **9** | ar bn cmn de el es id ja pt — the same sentence, translated |
| genuine measurements | **24** | ary ×11, awa ×3, pcm ×2, lo mad nan pnb pt rw si so ×1 |

The measurements are airport terminal areas (`28.000m²`, `76.000m²`), a mountain height (pt `4.892m`,
Vinson Massif), a stadium capacity line (pcm `25,000 m²`), a rope length (pcm `3.7m`), a drug volume
(rw `1,5l`).

**Implication** The direction of the earlier measurement is confirmed and its magnitude is sharper at line
granularity: the guard suppresses 24 real measurements to catch 9 designation lines. And the suppression is
a MIS-READ, not a silence — ary `28.000m²` reads *… sˤifr sˤifr sˤifr ˈɛm skwˈɛɹd*, an English letter name
inside Moroccan Arabic prose, where `28.000 m²` reads *mˈitr murˈabːaʕ*.

### Run 2 — 2026-08-13 13:45 — ⚠ the stated reason for refusing was measurably not the case

**Command** with the shape half fully removed, probe the magnitude shape directly:
`en "$1.5m"`, `en "£2.3m"`, `en "a $1.5m grant"`, `pcm "$1.5m"`, and the unit shape beside it.

**Question** Is the magnitude case (`$1.5m` = 1.5 MILLION in English news style) separable from the unit
case — the reason the previous run gave for leaving the guard alone?

**Raw finding** It is not merely separable; **it was never joined**.

```
                  guard as shipped              guard's shape half REMOVED
en  $1.5m         wˈʌn pʰɔᶦnt fˈaᶦv dˈɑːlɚzəm    wˈʌn pʰɔᶦnt fˈaᶦv dˈɑːlɚzəm     (identical)
en  £2.3m         tʰˈuː pʰɔᶦnt θɹˈiː pʰˈɔːəndzm  tʰˈuː pʰɔᶦnt θɹˈiː pʰˈɔːəndzm   (identical)
pcm $1.5m         wan pɔint faiv dolam           wan pɔint faiv dolam            (identical)
de  1,5m          aɪ̯ns kˈɔma fʏnf m              aɪ̯ns kˈɔma fʏnf mˈeːtɐ          (the unit case, freed)
```

The currency rule runs BEFORE the unit rule and consumes the number: by the time the unit pattern is tried
the string is `1.5 dollarsm`, and `m` has no number to attach to. `NOT_VERSION` never governed `$1.5m` — it
cannot, because the currency sign has already taken the digits. The magnitude-vs-unit question is real and
still open (`$1.5m` reads *dˈɑːlɚzəm* today, which is neither million nor metres), but it lives in the
currency path and is untouched by anything here.

**Implication** The blocker recorded in the earlier run is removed by measurement rather than by argument, so
the guard can be narrowed on its own merits.

### Run 3 — 2026-08-13 14:05 — the designation anchor, measured on the fleet

**Command** anchor the guard on the designation instead of the shape —
`DESIGNATIONS = ["802[.,]11"]`, both separators because a designation is not localised but the text around it
is — then emit all 161 artifacts again and diff against the baseline emit.

**Question** Does anchoring get all 33 right, and does it move anything else?

**Raw finding** **Exactly 24 readings change, and they are exactly the 24 measurements.** The 9 designation
lines are byte-identical to the baseline; nothing outside the 33 moves.

```
ary 11 · awa 3 · pcm 2 · lo mad nan pnb pt rw si so 1 each     (24 lines, 11 languages)

pt   … e nuvˈẽtɐ e dˈojʃ m no mˈõtɨ vˈĩsõ      →  … e dˈojʃ mˈɛtɾuʃ no mˈõtɨ vˈĩsõ
so   … ɖibiʕ ʃan m ɡarbaha quruːr               →  … ɖibiʕ ʃan mitir ɡarbaha quruːr
si   … ˈɛs dˈiː ˈɑːɹ hˈæʈənˌəʋəjə               →  … ˈɛs dˈiː ˈɑːɹ mˈiːʈər hˈæʈənˌəʋəjə
awa  … sˈaːt̪ sˈuːnj ˈɛm wˈeᶦt                   →  … sˈaːt̪ sˈuːnj mˈiːʈəɾ wˈeᶦt
rw   … ku iʒana ɾimwe ɡatanu l kuɾi heɡitaɾi    →  … ku iʒana litiɾo ɾimwe ɡatanu kuɾi heɡitaɾi
nan  … ti̯am˥˩ d͡ʑi˧ m̩˥ ,                        →  … ti̯am˥˩ d͡ʑi˧ kɔŋ˧ t͡ɕʰi̯oʔ˧˨ ,
```

**Implication** The guard ships anchored on the designation. The list has one member and is named for what it
is — evidence, not a rule about shapes — with the instruction that a second member needs the same
measurement. ⚠ **A DEFECT COUNTER CANNOT SEE THIS FIX**: `mine.ts scan --lang ary` is byte-identical before
and after (`DROP exponent ×11, DROP minus ×2, DROP degree ×1, DROP math-sign ×1`), because a MIS-READ is
neither a leak nor a drop — the suppressed `m²` was being read aloud, in English. The before/after diff is
the only instrument that shows it, which is the same lesson the unit-abbreviation round recorded.

### Run 4 — 2026-08-13 14:35 — gates

`npx vitest run`: 3,940 passed, 1 failed — `test/onnx-optional.test.ts`, the known 5 s timeout under
concurrent load, discounted. `npx tsc --noEmit`: clean.

⚠ **One golden moved, and it is this item's own pin.** `test/normalize-multilang.test.ts` asserted
`n("4.892m") === "4.892m"` under the comment "the measured cost: a decimal GLUED to a one-letter unit is no
longer read". That is precisely the cost being removed: it now reads `4.892 metre`, which is the height of
the Vinson Massif in pt. The test is rewritten to pin the new contract in both directions — `802.11g`,
`802.11n` and `802,11g` still refuse, `4.892m` and `28.000m` now read, and `$1.5m` is pinned as unchanged so
the magnitude question stays visible where it actually lives.

---

## Item 3 — `registry.ts` wired an English reader that `createAkan` ignored

### Run 1 — 2026-08-13 13:25

**Command** for every `create*` the registry hands a reader to, resolve the factory and ask whether the
reader is ever INVOKED — directly, through a field, or by being forwarded to a shared core.

**Question** Is Akan the only one, and what is the fleet count?

**Raw finding** **45 registry cases hand a factory a reader. 9 of those factories never invoke it.**

- `ak` — the parameter is not even stored; the body never mentions it.
- am, bal, ckb, ig, my (Burmese), nan (Min Nan), ti, yo — each stores it as `private foreign` and never
  reads the field. Their embedded Latin is served by the `setDefaultForeign` / script-router path in
  `core/foreign.ts` instead, which takes no per-language argument.
- The other 36 either call it (`this.foreign(…)`) or forward it to a shared core that does
  (`makeNativeHindi`, `createHanDictPhonemizer`, `createIndonesian`).

**Implication** The pattern is fleet-wide vestigial wiring left over from before `core/foreign.ts` existed,
not an Akan-specific mistake. Only `ak` is touched here — the other eight are engines this change does not
own, and each needs its own language's gates.

### Run 2 — 2026-08-13 13:30 — wire it, or remove it?

**Question** Akan reads `February` as *febrwarj*. Would wiring the reader for real be the fix?

**Raw finding** There is no seam to wire. Akan is a Latin-script language: `TOKEN` is
`(LATIN_RUN)|(\d+)|([.?!,;:])`, so every Latin run is claimed by the word arm; `nat()` folds any
out-of-inventory letter to a base the g2p has a rule for; `phonemizeWord` always answers. Nothing is ever
"unclaimed", so a foreign reader would have to be invoked on the basis of a decision the engine cannot make —
"is this Latin word Akan?" — which needs a lexicon this repo does not have for this language. Script routing
does not help either: it fires only ACROSS scripts (`core/hostWord.ts`), and there is no script boundary
inside Akan text.

**Implication** Remove the argument. `normalize.ts`'s own header records the second reason, which is why the
removal is not merely a tidy-up: an English reader would make `February` read *ˈfɛbɹuɛɹi* — a plausible
English word, and therefore a defect that HIDES, where *febrwarj* is gibberish that gets reported. The rules
in `normalize.ts` were written against the no-reader behaviour and were probed against it.

### Run 3 — 2026-08-13 14:15 — gates

`corpus-diff` ak, baseline vs this tree: **changed 0/237 (0.0 %)** — the removal is a proven no-op, which is
the whole reason it needed no language gates beyond this.

`mine.ts scan --lang ak` and `review.ts --lang ak`: unchanged from what the ak run recorded. review reports
the same 2 pre-existing FAILs — the deliberate `minus` refusal (no Akan negative-number word is attested, so
it is not in `ACCEPTED_SILENT` and the gate stays red on purpose) and the artifact scan's residual
`DROP minus ×3`, `DROP currency ×3` and five `LEAK RAW-LATIN` runs (`ft php lb fr vs`), each already
classified. Nothing new appears and nothing green turns red.

⚠ The eight other factories that ignore their reader are NOT touched: each is a live engine whose embedded
Latin is currently served by `core/foreign.ts`, and cutting a parameter there is a per-language change with
per-language gates. The count is recorded here and in the commit message so the next run does not have to
rediscover it.
