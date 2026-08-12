# bar (Bavarian) text-normalization investigation

Working log for giving `bar` a `normalize.ts`. Method: `docs/normalization_playbook.md`.

Context: `bar` was falsely marked `inherited` in the planning query because it borrows one function
(`unitsFirstNumberToWords`) from Danish (`src/languages/danish/unitsFirstNumbers.ts`). It has no
normalization layer of its own and no delegation to German. See commit `966fcbf`.

---

## Run 0 — 2026-08-12 08:15 — orientation

**Commands.** `ls src/languages/bavarian/`, read `bavarian.ts`, `bavarian.jsonc`, `numbers.ts`,
`test/bavarian.test.ts`, `src/languages/german/normalize.ts`, `tools/corpus/mined/bar.jsonc` head.

**Question.** What exists, and what does the engine do with non-word text today?

**Raw finding.**

- `src/languages/bavarian/` holds `bavarian.ts` (grapheme g2p), `bavarian.jsonc` (manifest), `numbers.ts`
  (units-first compositor over the Danish helper). No `normalize.ts`.
- `BavarianPhonemizer.text()` calls `assembleClauses` with
  `TOKEN = (hostWordRun(["Latin"],"'-"))|(\d+)|([.!?…,;:])`. So: **anything that is not a Latin word
  run, a bare digit run, or one of seven clause marks is DISCARDED silently.** No `makeSymbolNormalizer`
  is wired; the manifest declares no `percent`, no `currency`, no `units`, no `decimalWord`.
- The mined artifact `tools/corpus/mined/bar.jsonc` already exists: dump-sourced,
  `totalSegments: 152832`, `cellsCovered: 33`, `cellsTotal: 35` (current `CELLS` length is 35 — not stale).
- ⚠ The artifact's `source` is `bar.wikipedia.org dump (pages-articles, paragraphs)` with **no
  language filter recorded**. Reading the hard-set, Standard German contamination is obvious and heavy:
  a whole Beethoven opus list fills the `clock` cell (`Opus 120: 33 Variationen …`), and the `era-marker`
  and `year` cells are largely German-language bibliography entries (`Peter Polenz: Deutsche
  Sprachgeschichte …`). This is playbook §0b (the su.wikipedia trap) in its acute form, and it is exactly
  the trap the task warns about: a Standard German word must not stand in for a Bavarian one.

**Implication.** Two things must happen before any rule is written: (1) measure every count over the
**Bavarian subset** using `filter-by-language.py`, and say so; (2) probe the engine on the attested
surface forms, because with no symbol tier wired the expected defect is wholesale silent deletion.

---

## Run 1 — 2026-08-12 08:35 — the "before" gates

**Commands.**

```
npx tsx tools/normalization/corpus-diff.ts emit --lang bar --corpus mined:bar --out /tmp/bar.before
npx tsx tools/normalization/mine.ts scan --in tools/corpus/mined/bar.jsonc --lang bar
npx tsx tools/normalization/review.ts --lang bar
npx tsx tools/normalization/sources.ts --lang bar
npx tsx tools/referee-eval/eval.ts bar
```

**Question.** What is the baseline on every gate?

**Raw finding.**

- `corpus-diff emit` → **450 utterances**.
- `mine.ts scan` → `DROP exponent ×26 · currency ×24 · math-sign ×23 · percent ×20 · degree ×12 ·
  minus ×11 · ampersand ×4`, plus `MARKUP percent ×1 · math-sign ×1` (one x86 assembly listing,
  `movl $4,%eax`). **Seven droppable classes, every one live.**
- `review.ts` → `[FAIL] normalizer — src/languages/bavarian/normalize.ts missing`. 1 failing.
- `sources.ts` → `letter-names [NONE] espeak does not ship this language at all`; `decimal-point
  [NONE]`; `scale-names [part] Celsius`; percent/currency/minus/equals/times/ampersand/exponent all
  `[chk?]` (sign occurs, no declaration).
- `eval.ts bar` → raw exact **208/1380 (15.1%)**, folded backbone **833/1380 (60.4%)**, symbol
  accuracy **89.9%**.

**Implication.** Everything is open. espeak ships no Bavarian, so the letter-name table is
structurally unavailable and `core/initialisms.ts` is a no-op for bar — that class is blocked at the
source, not at the code (playbook §"Before you defer a class, look it up").

---

## Run 2 — 2026-08-12 08:50 — how much of bar.wikipedia is not Bavarian

**Command.** Added a `bar` row to `tools/normalization/filter-by-language.py`, plus a `CONTRAST`
mapping, because the stock test contrasts the target against **English** and bar.wikipedia's
contaminant is **Standard German** — German shares no function word with the English list, so the
unmodified tool would have kept every German paragraph as "Bavarian".

```
python3 tools/normalization/filter-by-language.py --lang bar --in bar_sample.txt --out bar_sample.bar.txt
python3 tools/normalization/filter-by-language.py --lang bar --in bar_hard.txt   --out bar_hard.bar.txt
```

**Question.** How contaminated is the evidence, and does the contamination concentrate in the cells
the rules would be written from?

**Raw finding.** On the **uniform sample tier** (a stride over the whole dump, so this is a fact
about bar.wikipedia and not about the fetch):

```
kept (Bavarian)        101  (50.5%)
dropped: undecidable    51  (25.5%)
dropped: contrast       48  (24.0%)      ← Standard German / English
```

Hard tier: 145 kept / 59 undecidable / 48 contrast (19.0%). **~24% of bar.wikipedia is not
Bavarian** — nearly twice su.wikipedia's 12.9%. Spot-checking the dropped set confirms the test:
it dropped the Beethoven opus catalogue, German-language bibliography entries (`Peter Polenz:
Deutsche Sprachgeschichte …`), and an English David Bowie quotation.

And it concentrates exactly where the playbook says it will. Per-form counts, all 452 segments vs
the 246 Bavarian ones:

| form | all | Bavarian | what the difference is |
|---|---:|---:|---|
| `N:NN` colon clock | 12 | 3 | the Opus catalogue (`Opus 120: 33 Variationen`) and `TWV 32:13` |
| `u. a.` | 6 | **0** | entirely German bibliography (`Minga u. a. 2006`) |
| sign + digit | 154 | 32 | German-language ISBN hyphens |
| fraction `N/N` | 27 | 12 | |
| `&` | 107 | 83 | see below |
| grouping dot | 75 | 56 | |
| percent | 56 | 52 | genuinely Bavarian |

**Implication.** Every count quoted in `normalize.ts` must be the Bavarian-subset one, and the clock
and the ampersand in particular would have been badly over-rated from the raw artifact.

---

## Run 3 — 2026-08-12 09:05 — probing the engine on the attested forms

**Command.** A scratch probe driving `createBavarian().text()` over forms tabulated from the
Bavarian subset.

**Question.** What does the engine produce today for each attested shape?

**Raw finding.**

```
"67&nbsp;km"          → "simɑseçt͡sɡ̥ nb̥sb̥ , km"          ← HTML entity read as a WORD + a pause
"30.528 km²"          → "d̥rɑɛ̯sɡ̥ . fimf hund̥ɑd̥ ɔxd̥ɑt͡sʋɔnt͡sɡ̥ km"  ← grouping dot = a PAUSE; ² dropped
"10,5 Millionan"      → "t͡seɑ , fimf milionɑn"            ← decimal comma = a PAUSE
"59% vo da …"         → "nɑɛ̯nɑfuxt͡sɡ̥ fo d̥ɐ …"           ← % silently DELETED
"am 10. November"     → "ɑm t͡seɑ . nofemb̥ɐ"               ← ordinal = cardinal + a PAUSE (trap 4)
"12:15 Uhr"           → "t͡sʋœif , fuxt͡seɑ uɐ̯"            ← colon = a PAUSE
"47°16′15″"           → "simɑfiɐ̯t͡sɡ̥ seçt͡seɑ fuxt͡seɑ"  ← ° ′ ″ all deleted
"z. B. in da"         → "t͡s . b̥ . in d̥ɐ"                  ← two letters + two spurious pauses
"2/3"                 → "t͡sʋoɐ̯ d̥rɑɛ̯"                     ← two bare cardinals
"$4"                  → "fiɐ̯ɐ̯"                             ← currency sign deleted
"2 = 3" / "5 > 3"     → "t͡sʋoɐ̯ d̥rɑɛ̯" / "fimf d̥rɑɛ̯"     ← signs deleted
"1938" (in 1938/39)   → "d̥ɑɔ̯snd̥ nɑɛ̯n hund̥ɑd̥ …"        ← "ein-tausend-neun-hundert", not "neunzehnhundert"
```

**⚠ The single biggest one is not a language defect at all: `&nbsp;`.** The dump-to-text kept the
HTML entity, and the engine's `TOKEN` sees `nbsp` as a Latin word run, so it is **phonemized as a
word** — `nb̥sb̥` — and the trailing `;` is a `clausePunctuation` entry, so it also emits a comma
pause. In the Bavarian subset **83 of 83 ampersands are `&nbsp;`** and there are **zero real
ampersands**; the only four real `&` in the whole artifact are German publisher names
(`Königshausen & Neumann`, `W W Norton & Co`, `Quelle & Meyer`, `Rosa & Karl`).

**And `&nbsp;` is also blinding every guard downstream of it.** My first `°C` count over the
Bavarian subset was **0** — because the corpus writes `-13&nbsp;°C`, and a pattern expecting a space
or nothing between the number and the sign cannot match. Substituting `&nbsp;`→space first, the true
count is **11 real temperatures**. This is playbook trap 49's shape (an injected character sequence
makes downstream guards misfire) arriving via markup rather than mojibake, and trap 27's (a guard
that assumes a space).

**Implication.** `&nbsp;` must be folded to a space as **step 1**, before anything else, or half the
rules below cannot see their own evidence. Everything else follows German's ordering.

---

## Run 4 — 2026-08-12 09:30 — sourcing every word, and two that failed

**Command.** `npx tsx tools/normalization/attest.ts --lang bar --words …` in batches, plus
`WebFetch` of `bar.wikipedia.org/w/index.php?search=insource:/…/` where the probe was rate-limited,
plus `bar.wikipedia.org/wiki/Jenna` for the month table.

**Question.** For every word this layer would put in a speaker's mouth: is it Bavarian, and is it the
right sense?

**Raw finding — the ones that passed.**

| word | hits/articles | the prose that settles the sense |
|---|---|---|
| `Prozent` | 128/19 | "a Minus vo 23,6 Prozent seit 1998", "86,01 Prozent Weißn" |
| `Dollar` | 105/17 | "Dollar is da Name vo vaschiedne Weahrunga … kimmt vom deitschn Woat Taler" |
| `Kilometa` | — | "De Läng vo da Außngrenz is 2009 Kilometa. Davo foin auf Östareich 366 Kilometa…" |
| `Quadratkilometa` | — | a DEFINITIONAL article: "As Zeichn is km². A Quadratkilometa is a million moi so grouß wia a Quadratmeta." |
| `Kubikmeta` | 9 articles | "an Rauminhoit vo 2.047.840.000 Kubikmeta", "175 Kubikmeta in da Sekund" |
| `Grad`/`Celsius` | 37/20, 35/20 | "0 bis –4 Grad Celsius", "unta Nui Grad foin" |
| `minus` | 19/15 | "unta minus 15 Grod", "Moi via, minus 10%", "kauna mit an Minus nix aunfaunga … des Vuazeichn" |
| `Pfund` | — | "WÄHRUNG = Pfund Sterling (£, GBP)" — the sign-to-word mapping stated outright |

**Raw finding — the three that did NOT.**

1. **⚠ `Euro` is the Standard German word; the Bavarian one is `Eiro`.** The probe scores `Euro`
   60 token hits in 20 articles, which looks decisive. Reading the prose: bar.wikipedia's own euro
   article opens **`Da Eiro (amtli: Euro, Symboi: €)`** — it labels `Euro` as the *official* form and
   uses `Eiro` throughout ("100 Zent san a Eiro", "5-Eiro Banknotn", "Eiro-Scheine", "Eiro-Lända").
   The 60 `Euro` hits are German book titles (`Euro für alle`, `Review of the International Role of
   the Euro`) and `Euro-Katalog`. **This is precisely the failure the task warned about**, caught by
   the sense check and by nothing else. Same shape one line down: `A Uah (dt.: Uhr, engl.: clock)`,
   though there `Uhr` IS what the wiki writes in the time-of-day slot and is kept for that slot only.

2. **⚠ `Komma` is a VERB.** 24 token hits in 19 articles, and every example is `komma` = "kommen wir"
   / "kumma": "do komma genau segn", "Heitzutog komma am Gleis grod noc wandan", "zu Schadn komma",
   "der Dreißgjährige Kriag komma is". The Fula `tere` failure caught in the act, in the
   highest-traffic slot the layer has. Follow-ups, because the playbook requires a dictionary check
   before a refusal may rest on silence: `insource:/[0-9] Komma [0-9]/` → **zero hits**;
   bar.wiktionary `Komma` → **404**. And the homograph is not incidental — `zeah komma fimf` is a
   real Bavarian phrase, pronounced identically, meaning "ten come five".
   → **The decimal comma is left unread.** 79 instances in the Bavarian subset.

3. **`plus` is attested ×45/18 and every example is `Adblock Plus`** — a software product name, trap
   37's shape exactly. Kept anyway, but on other evidence: the corpus's own `£ 795 plus Steia`, and
   the fact that this corpus pairs the signs in one sentence (`bei -13 °C im Winta und +15 °C im
   Summa`) so dropping the plus loses a contrast the author wrote.

**Also declined on sourcing.** `Stund`/`Sekundn` (rate denominators) — unattested, *and* the Bavarian
subset has **zero** `km/h` and zero `m/s`, so `unitPer` came back out even though `pro` itself is
attested ("30 Eihwohna pro Quadratkilometa"). An unsourced word for an unattested shape buys nothing.

**Implication.** Two words were within one keystroke of shipping wrong (`Euro`, `Komma`), and the
count alone endorsed both. The examples column is the whole of the check.

---

## Run 5 — 2026-08-12 09:55 — the ordinal series, and why it is a table

**Question.** Can the ordinal be composed from bar's own cardinals, the way German composes its?

**Raw finding.** No, and the language's own data refutes it. The German rule is cardinal + `-t` below
20 and + `-st` above. `bavarian.jsonc` gives `zeah` (10) and `zwånzg` (20), which would compose to
\*zeaht and \*zwånzgst. bar.wikipedia writes **`zehnte`** ("da zehnte Buachstob im Hebräischn
Alphabet", "da Dezemba da zehnte Monat") and **`zwanzigste`** ("bis ins zwanzigste Joahundat"). Both
values I can check are wrong under composition. Bavarian's ordinal series sits on a different,
German-shaped stem from its own counting numerals.

Attested, with prose, and nothing else: `eascht` (1), `zwoat` (2), `dritt` (3), `zehnt` (10),
`zwanzigst` (20). Web search for a Bavarian ordinal table returned only Standard German material;
`languagesandnumbers.com/how-to-count-in-bavarian` has cardinals only; bar.wikipedia's own
*Boarische Grammatik* defines `Zolwerter` without giving one example.

**Implication.** Ship the five as a TABLE and return `undefined` for everything else, so the rule
declines rather than invents. `De 4. Auflage` keeps reading as it does today. This is trap 8's advice
("prefer composing") losing to trap 13's warning ("the rule's branches and the corpus's instances are
different sets") on measured evidence, and it is worth recording that the two can conflict.

---

## Run 6 — 2026-08-12 10:20 — reading the output, which found four defects the probes did not

**Command.** The scratch probe over every attested shape, then `corpus-diff compare`.

**Raw finding.** Four defects, none visible in a count and all of them introduced *by* the new rules:

1. `5:00-9:00 Uhr` → `fimf uɐ̯nɑɛ̯n uɐ̯`. The rule turned the clocks into WORDS, and this engine's
   `TOKEN` admits `-` **inside** a word run (`hostWordRun(["Latin"], "'-")`), so `Uhr-nein` fused
   into one token. Trap 14's "a rule that stops re-emitting an operand verbatim changes what the
   tokenizer does with the punctuation next to it", one step further on. Fixed by claiming the clock
   RANGE first, with the corpus's own `bis`.
2. `90°-Winkl` → `ɡ̥rɑd̥ʋiŋɡ̥l`. Identical cause, in the degree rule, and it was a REGRESSION —
   before the rule existed those were two clean tokens. Fixed by consuming the compound hyphen.
3. `Seitnvoöitnis 39:15:36` → "…neinadreißg , fuchzea **UHR** sechsadreißg". `(?<!\p{Nd})` stops a
   match beginning at the FRONT of a digit run but not one beginning in the MIDDLE: rejected at
   `39`, the engine retried and matched `15:36`. Trap 28's lesson in a different rule. Fixed by
   excluding a colon in the lookbehind.
4. `21,905 Mrd. €` → `…mɐ̯d̥ .`, with the `€` gone too. The abbreviation's continuation lookahead was
   `[\p{L}\p{Nd}]` and what follows is `€`, so it matched neither arm; and with `Mrd.` unexpanded the
   tier had no magnitude to hop and dropped the sign. Fixed by admitting `\p{Sc}`, and by declaring
   `magnitudes`.

And one the corpus diff found on its own: `wer oan Stich håt 1/3` → **`oans Driddl`**, where `oans` is
the counting form and the language writes the article `a` ("a hoiwe Milliardn", "A Quadratkilometa is
a million moi so grouß"). Only a fraction exposes it, because nothing else puts a bare 1 before a noun.

**Implication.** Every one of these was invisible to `tsc`, to the unit probes and to the defect
counts, and three of them were regressions the rules themselves caused. The playbook's "read the
sampled changes; do not just check the counts" earned its keep five times in one run.

---

## Run 7 — 2026-08-12 10:45 — `review.ts`, and the three things it added

**Command.** `npx tsx tools/normalization/review.ts --lang bar`

**Raw finding.** Three items the corpus diff and the scan had both missed:

1. **`5 000` → `fimf nul`.** SPACE-grouped thousands, ×2 in the Bavarian subset (`549 000 €`,
   `43 000 €`). Added, with the same three-digit discipline as the dot form.
2. **`1990-1995` reads as two bare years.** Measured the range class over the Bavarian subset: **7
   true positives** (`Beziak 5 - 8`, `in 6-9`, `1961 -1990`, `2003-2004`, `1863–1952`, `1465–1472`,
   `1472–1474`) against **1 counter-example** — `ÖNORM B 8115-2`, an Austrian standard's part number.
   The discriminator that keeps all seven and rejects the one is that **a range ascends** (2 < 8115).
   The chain guards do the rest: `3-86520` also ascends, so a dash on either side of the pair
   disqualifies it, which is what keeps this rule safe in a corpus whose largest hyphen population is
   German-language ISBNs. Verified against three real ISBNs and the ordinal range `10.–23.`
3. **`Pfund — in NO source`.** Probed: bar.wikipedia writes `WÄHRUNG = Pfund Sterling (£, GBP)`,
   i.e. the sign-to-word mapping outright, across the Sterling/Egyptian/Lebanese/Falkland pound
   articles. The weight sense exists (`6.000 Pfund Goid`) — the `ms paun` hazard — but the
   declaration is sign-keyed, so it can only fire beside a `£`.

**And one FAIL that stays RED.** `[FAIL] sign classes DROPPED: minus`, because the synthetic probe is
a bare `-5` with no degree word. That is correct for this language: of 32 sign+digit shapes in the
Bavarian subset, every real sign is followed by a degree word and every counter-example is a range, an
ISBN, a designation or EasyTimeline markup — including `shift:(-10,5)`, a **bracket-opening** minus,
which is the arm Hindi used to break its own refusal and which therefore is not available here.
Trap 24: do not fix the FAIL.

---

## Run 8 — 2026-08-12 11:00 — the gates, before and after

| gate | before | after |
|---|---|---|
| `corpus-diff` DROP | 102 | **34** (159/450 utterances changed, 35.3%) |
| `corpus-diff` DIGIT / SLOT-GAP / RAWMARK / THROW | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 |
| `mine.ts scan` | `DROP exponent ×26 · currency ×24 · math-sign ×23 · percent ×20 · degree ×12 · minus ×11 · ampersand ×4` | **`no defects`** (every remaining line an argued acceptance) |
| `review.ts` | `[FAIL] normalizer missing` | 10 ok, 1 FAIL (`minus`, the sourced refusal — trap 24) |
| `sources.ts` | percent/currency/minus/exponent all `[chk?]`, scale-names `[part]` | all four `[ok]`, scale-names `[ok] Celsius Fahrenheit` |
| `eval.ts bar` | 208/1380 raw · 833/1380 folded · 89.9% symbol | **unchanged** — the referee is a word list and this layer touches no bare word |
| `npx tsc --noEmit` | clean | clean |
| `npx vitest run` | 3685 pass | 3705 pass (20 new) |

**Implication.** The scan's remaining lines are all in `ACCEPTED_SIGN_SILENCE` / `ACCEPTED_SILENT`
with their measurements, so a regression in any of them becomes visible again immediately.

---

## Run 9 — 2026-08-12 11:40 — the signed range, found by probing the adversarial neighbour

**Command.** `normalizeBavarian("−1 bis −2 °C")`, a corpus sentence I had probed only in its
single-operand form.

**Question.** Does the degree-guarded sign rule fire on both ends of a signed temperature RANGE?

**Raw finding.** No — and the half-fire is worse than not firing at all:

```
"−1 bis −2 °C"  →  "−1 bis minus 2 Grad Celsius"
```

Only the second operand has a degree word directly after it, so the lookahead saw nothing for the
first. The reading is a span **from positive one to minus two**. The playbook's own formulation is the
argument: *omitting a plus is lossless and omitting a minus INVERTS*. Three corpus sentences take this
shape and they use two different joiners, both the corpus's own: `−1 bis −2 °C` and, in the climate
tables, `-0,5 beziehungsweise -1,4 °C` (beside an unsigned `18 beziahungsweis 17 °C` that must stay
untouched).

Fixed by letting the degree lookahead reach across `bis|beziehungsweise|beziahungsweis` plus an
optional sign. Verified on all four shapes, and the unsigned range is unchanged.

**Implication.** Trap 8 — probe the adversarial neighbour of every rule. I had probed `-13 °C`,
`+15 °C` and `−45,9 Grad Celsius` and all three passed; the range was the shape I had counted in the
corpus and not run through the rule.

---

## Run 10 — 2026-08-12 12:10 — `attest.ts` could not be re-run, and that is my error

**Command.** `npx tsx tools/normalization/attest.ts --lang bar --words …` repeatedly.

**Raw finding.** bar.wikipedia now answers **429 Too Many Requests** to every probe, after four
successful batches earlier in the session. Two things compounded:

1. **`attest.ts`'s carry-forward is broken for files it wrote itself.** Its cache-merge regex is
   `/\{\s*"word":[\s\S]*?\n        \}/gu` — a closing brace at **8** spaces — while the writer emits
   blocks closing at **12**. So a second run finds zero prior blocks and refuses to write rather than
   deleting them (`REFUSING TO WRITE: 9 existing finding(s) could not be parsed`). Loud, which is the
   right failure, but it means the cache can only ever be built by ONE run covering every word.
2. **So I deleted the cache to force a single clean run — and the single clean run never got through.**
   That was the mistake: the delete removed nine recorded findings whose only other copy is this
   document, in exchange for a run that the rate limit then blocked.

**What survives.** Every verdict, count and prose quotation is in Run 4 above, verbatim, including the
two sense failures (`Euro`, `Komma`) that decided two rules. What is missing is
`tools/corpus/attest/bar.jsonc`, the machine-readable tier, so `review.ts`'s sourcing line reports
`wikipedia NOT probed` for words that were in fact probed.

**Implication for the next reader.** The probe is a re-runnable measurement; run it once, with the
whole word list, when the wiki is not rate-limiting:

```
npx tsx tools/normalization/attest.ts --lang bar --words \
  Prozent,Eiro,Dollar,Pfund,Kilometa,Quadratkilometa,Kubikmeta,Grad,Celsius,Uhr,minus,plus,\
easchte,zwoate,dritte,zehnte,zwanzigste,Komma,zirka,Beispui
```

And the carry-forward regex is worth fixing first (`\n {8,12}\}`), so the cache can be built
incrementally instead of in one all-or-nothing run. Not fixed here: three sibling agents are editing
this tool's directory in the same batch, and a shared-tool change is the reviewer's call.
