# Mined-corpus health: is this wiki's text trustworthy? (#585)

#585 extends the normalization gate past FLEURS by mining wiki text for the corpus-less languages, and
names two risks to measure **before** trusting such a corpus:

- **Bot-generated wikis.** `ceb` is ~99% bot-created from geographic databases. A corpus drawn from it has a
  uniform, template-shaped symbol distribution — *the diff would look clean while testing nothing.*
- **Language contamination.** Small wikis carry heavy untranslated quotation and foreign proper nouns, the
  exact input class that trips the embedded-Latin fallback (`core/foreign.ts`), which could mask real
  defects in the `--foreign` scan.

The issue asserts both are "detectable up front from sentence-length distribution, template density, and a
symbol histogram compared against a known-good corpus." That assertion had never been tested. Nothing in the
tree measured any of the three.

---

## Run 1 — 2026-08-05 08:10 · what has actually been done under #585, and what has not

Command:

```
# registry codes vs mined artifacts vs referees
npx tsx <scratch>/triage.ts
```

Question: the issue is open — is the tooling missing, the application missing, or both?

Raw finding:

```
fleet 188 · mined 67 · to mine 121
  with any referee: 103 · kaikki 33 · wikipron 60 · NO referee 18
  no referee: apd bs zsm pnb pcm wuu cjy hak hsn gan bal mag bgc hne umb ig st nso
  has FLEURS but unmined: (none)
```

**The tooling exists and the application does not.** `mine.ts` (fetch/mine/scan), `cells.ts` (the 40-cell
inventory) and the `review.ts` staleness gate were all built under #585, piloted on Burmese, and the
`\d`-is-ASCII trap the issue warns about is fixed throughout (`\p{Nd}`). But **all 67 mined artifacts are
FLEURS languages** — the set is exactly the corpus languages. Not one corpus-less code has been mined. The
gate has not moved beyond FLEURS at all; only the means to move it exist.

Implication: the remaining work is a 121-language sweep, and the first question is which of the 121 can be
mined at all.

### The issue's own framing is off by one resource

The issue counts candidates by **word-level referee** ("90 have a word-level referee … which means there is
running text behind the route we are already using for pronunciation"). That inference does not hold. A
referee is a *pronunciation lexicon* — `kaikki`/`wikipron` are word→IPA tables extracted from Wiktionary.
Wiktionary entries are not running text, and a referee's existence says nothing about whether the language
has a **Wikipedia with prose in it**, which is the resource mining actually consumes. The two are
independent: `ka` (Georgian) has both, `ig` (Igbo) has a live wiki and *no* referee, and `hil`
(Hiligaynon) has a referee and *no wiki whatsoever*.

So the referee column is the wrong denominator, and 90 is not the number of minable languages.

---

## Run 2 — 2026-08-05 08:12 · how many of the 121 have a wiki, from the authoritative list

Command:

```
curl 'https://meta.wikimedia.org/w/api.php?action=sitematrix&smtype=language&smlangprop=code|site'
```

Question: which of the 121 unmined codes have a Wikipedia, without 121 speculative DNS probes?

`sitematrix` is one request and returns every WMF wiki with a `closed` flag. Raw finding, matching the 121
against it **on the registry code alone**:

```
direct open wiki: 87
CLOSED wiki:  2 -> kl ak
no wiki under that code: 32 -> es-419 apc apd acm afb ayl ajp acw kmr hil zsm cjy hsn
                              kea mto smj nci nog quc naq chv rkt hmn bal bho bgc hne
                              umb nya kam luo grc
```

Confirmed the negatives are real rather than a sitematrix artifact — 18 of the 32 probed directly:

```
for c in hil hmn grc smj bal umb kam luo naq nog mto quc nci kea rkt bgc hne apc; do
  curl -s -o /dev/null -w '%{http_code}' "https://$c.wikipedia.org/w/api.php?..."
done
→ 000 for all eighteen (DNS does not resolve)
```

So sitematrix is authoritative and a missing code means a missing wiki, not a lookup bug.

**But the registry code is not the wiki code.** Several of the 32 have a wiki under a different code —
Chuvash is `cv` not `chv`, Bhojpuri is `bh` not `bho`, Chichewa is `ny` not `nya`, Kurmanji is `ku`,
Classical Nahuatl is `nah`. Verified present in sitematrix: `cv bh ny ku nah ms` all True. That mapping has
to be explicit and hand-checked; guessing it is how a live wiki gets recorded as absent.

Implication: the minable set is somewhere between 87 and ~95, not 90-by-referee, and a
registry-code→wiki-code override table is a required piece of the sweep.

`kl` and `ak` are **closed**, which is not the same as absent: a closed wiki stops accepting edits and keeps
serving its content through the API. Frozen text is still minable text. Worth checking rather than
discarding.

---

## Run 3 — 2026-08-05 08:15 · calibrating the health metrics on de vs ceb

Command:

```
npx tsx tools/normalization/mine.ts fetch --wiki de  --out de.raw.txt  --random 400
npx tsx tools/normalization/mine.ts fetch --wiki ceb --out ceb.raw.txt --random 400
npx tsx tools/normalization/mine.ts fetch --wiki ka  --out ka.raw.txt  --random 400
```

Question: do sentence-length distribution, template density and a symbol histogram actually separate a
bot-built wiki from a human-written one — and by how much, so a threshold can be set from measurement
rather than from taste?

Why these three: `de` is the known-good control **and** a FLEURS language, so its wiki text can be compared
against real read-aloud prose in the same language; `ceb` is the issue's named bot wiki; `ka` is non-Latin
with a live wiki, which is where Latin contamination would show up.

Raw finding, on completed 400-article fetches (~370 segments each), paragraph segmentation:

| metric | de (control) | ka (human, non-Latin) | ceb (bot) | separates? |
|---|---|---|---|---|
| length CV | 0.71 | — | 0.65 | **no** |
| template reuse | 0.2% | 1.0% | **10.1%** | **yes, ~10×** |
| type/token (word) | 0.375 | 0.469 | **0.084** | **yes, ~4×** |
| histogram divergence (TV) | 0.462 | 0.585 | 0.580 | **no** |
| top-5 cell mass | 84.1% | 76.8% | 62.5% | **no — inverted** |
| empty cells vs baseline | 5 | 7 | 11 | ordered, 4 cells of margin |

**Of the three signals the issue proposes, one works.**

- **Length distribution fails outright.** `de` 0.71 vs `ceb` 0.65 is not a separation, and the `de_de` FLEURS
  baseline itself sits at **0.35** — *lower than the bot wiki*. Cebuano's generated articles vary in length
  because the generator emits a variable number of template sentences per article. Dropped as a trigger,
  kept as a printed figure.
- **Template density works, and it is the best signal available.** The most-reused 30-char shingle in `ceb`
  is `"Alang sa ubang mga dapit sa ma"` — *"For other places named…"* — carried by **106 of 375 segments**.
  That is the bot signature, legible in one line.
- **The histogram cannot be thresholded**, because the baseline is necessarily *another language*. A
  corpus-less language has no same-language corpus by construction, so every comparison mixes "this text is
  degenerate" with "this language is not German". Georgian has no `ordinal-latin` because it does not write
  Latin ordinal suffixes — orthography, not ill health. Kept in the tool because it is excellent for
  *reading* a corpus: `ceb`'s saturation of `degrees` / `units` / `grouped` / `signed-number` **is** its
  coordinate template, and it shows you exactly what a clean diff against it would not have exercised.
- **The metric that works as well as template density was not in the issue's list at all** — type/token
  ratio, 4× separation.

### The first thresholds passed ceb

Written before the measurement, from the shape of the argument: `templateReuse > 0.30`, `ttr < 0.10`,
`lenCV < 0.35`. Against the real numbers, `ceb` tripped **none** of them and the tool printed
`VERDICT usable`. It cleared the one wiki the issue names as the reason the check exists. Recorded because
it is this file's own subject one level up: a check that reports safety.

Final thresholds: `templateReuse > 0.03`, `ttr < 0.18` (word only), `latinShare > 0.20` in non-Latin text,
`segments >= 150`. Each about 3× clear of the nearest reading on either side.

---

## Run 4 — 2026-08-05 08:30 · a partially-written file reads exactly like a small wiki

Question: none — this was an error, and it is the most transferable thing in this document.

The `ka` figures in Run 3 were first taken while a **backgrounded fetch was still writing the file**. It
measured 52 segments, and 52 segments is a completely plausible reading: a mid-size wiki whose intros mostly
fall below the paragraph minimum. On that sample `ka`'s empty-cell count was **11 — identical to the bot
wiki**, which supported a confident conclusion ("the empty-cell metric does not separate at all") that
dissolved the moment the fetch finished and the same wiki measured **358 segments and 7**.

Every metric here is a proportion, and **a truncated fetch is indistinguishable from a poor wiki by all of
them**. Hence the `MIN_SEGMENTS = 150` floor, which guards both cases with one check, and which then earned
its keep immediately in Run 6.

---

## Run 5 — 2026-08-05 08:35 · what the triage actually shows, and a manufactured negative of my own

Command:

```
npx tsx tools/normalization/candidates.ts
npx tsx tools/normalization/candidates.ts --blocked
```

Question: of the 121 unmined codes, how many have minable text — counting the resource mining consumes
rather than the referee count?

**93 usable · 28 blocked.** The blocked set is bigger and differently composed than the issue's twelve:

- **7 Arabic dialect codes** (`apc apd acm afb ayl ajp acw`) have no wiki of their own. `arz` and `ary` do.
- **`rup` is listed as an open wiki by sitematrix and redirects to Wikimedia Incubator** — it never
  launched. sitematrix's `site` list is not proof of a live wiki.
- **`kl` and `ak` are closed AND empty.** "Closed is not absent" was the plausible expectation — a closed
  wiki keeps serving content — so they were checked rather than dropped. The check said no: `kl` reports
  1,293 pages and **0 articles / 18 words** of indexed article text, `ak` 1,709 pages and 17 words.

`cirrussearch-article-words` turns out to be the right volume signal, and article count actively misleads:
`chr` has 1,034 articles and `ti` 366, which ranks Cherokee first — but Cherokee averages **39 words per
article** and Tigrinya 266. Six wikis in the usable set are flagged as stub farms on that ratio
(`nan` 62, `crh` 49, `cdo` 54, `hak` 63, `gan` 63, `nci` 43, `chr` 39).

### And then the tool manufactured a negative, twice over

Running `candidates.ts` a second time immediately after the first, it reported **`he`, `ka`, `lt`, `hy`,
`ky`, `km`, `yo`, `ig` and fifteen others as never-launched incubator wikis** — the same codes the first run
had listed with 20–270 *million* words each. Hebrew Wikipedia is not in incubator.

Cause: `catch { return undefined }`, with `undefined` read as "incubator". Concurrency 8 against the API
twice in quick succession dropped connections, and **a dropped connection was being laundered into a verdict
about a wiki's existence**. Same shape as the `attest.ts` `exlimit` bug and the missing User-Agent in
`mine.ts` — a third instance in the same toolchain.

Fixed by keeping three outcomes apart, only one of which is a finding: a 200 whose body is not statistics
JSON is *incubator* (a fact about the wiki, decided on the body, unreachable by a transport failure); a
network or HTTP failure after retries is *unknown* (a fact about the run, printed separately with an
instruction to re-run, and in **neither** the usable nor the blocked list); statistics JSON is the volume.
Concurrency dropped 8 → 4.

---

## Run 6 — 2026-08-05 08:40 · ten non-Latin wikis, and the failure that scales with the sweep

Command:

```
for w in ug sat bo chr ba he km lo ti si; do
  npx tsx tools/normalization/mine.ts fetch --wiki $w --out $w.raw.txt --random 400
done
npx tsx tools/normalization/wiki-health.ts --in $w.raw.txt --label $w
```

Question: does the Latin-contamination threshold ever fire, and how does the health check behave on small
non-Latin wikis?

Raw finding — **three of the ten produced an empty file and the tool exited 0.**

```
he.fetch.log:  random batch 0..19: 429 Your bot is making too many requests …
               random: 0 passages
               wrote 0 passages → he.raw.txt        ← exit code 0
```

`he` has 269 million words of article text. `ba` and `chr` the same, `bo` got 17 of 400 articles. Ten
sequential wikis tripped Wikimedia's bot rate limit, every batch was caught and logged, and the run reported
success. **Under a 93-language sweep that yields empty corpora at a success exit code**, and the next stage
would mine them, report "0 segments", and record the language as having no minable text — a claim about the
wiki, produced by the request rate.

The `MIN_SEGMENTS` floor from Run 4 caught all four (`⚠ only 0 segments — too few to judge`), which is the
one piece of this that worked as intended.

Fixed in `mine.ts`: 429 and 5xx are retried with exponential backoff honouring `Retry-After`; the random
loop reports `n passages from X/Y batches` with an explicit count of what was lost; and an empty fetch
**exits 2** with a note that this is a fact about the run and not about the wiki.

### The contamination threshold does not fire, and is therefore uncalibrated

Latin share of letters in the seven wikis that fetched: `ug` 2.7% (Arabic), `sat` 2.1% (Ol Chiki), `km` 6.9%
(Khmer), `lo` 8.6% (Lao), `ti` 5.1% (Ethiopic), `si` 4.5% (Sinhala), `ka` 4.6% (Georgian). The threshold is
20%. **Seven true negatives and no positive case**, so it is validated only against false alarms. Recorded
as a known gap rather than as a calibrated figure.

### Unspaced scripts get one detector, not two

`km` and `lo` classify as *spaced* (0.058 and 0.063 spaces/char, threshold 0.04) and their word type/token
lands at 0.482 and 0.498 — safely high, so no false alarm. But character type/token was measured as a
substitute for genuinely unspaced text and **does not separate the cases**: `ceb` 0.0011 against `de` 0.0021,
two-fold and confounded by alphabet size, where the word ratio separates them four-fold. Token length does
not rescue it (`km` and `lo` both median 5, identical to Latin).

So the unspaced path asserts nothing about vocabulary, and template reuse — counted over characters, so
script-agnostic by construction — is its only health metric. A template-built wiki in an unspaced script has
one detector here instead of two.

---

## Run 7 — 2026-08-05 08:40 · Georgian end to end, and the fill step's ★ claim tested

Commands:

```
npx tsx tools/normalization/mine.ts mine  --in ka.raw.txt --out ka.jsonc --per-cell 8 --sample 200 --audit-ascii
npx tsx tools/normalization/mine.ts fetch --wiki ka --out ka.fill.txt --digits 0-9 --per-cell-articles 10 \
    --concurrency 2 --fill clock,era-marker,ordinal-latin,units,currency,signed-number,ordinal-range,\
sports-time,version-dot,scaled-currency,ordinal-caps,iteration
npx tsx tools/normalization/mine.ts mine --in ka.all.txt --out tools/corpus/mined/ka.jsonc --segment paragraph …
npx tsx tools/normalization/mine.ts scan --in tools/corpus/mined/ka.jsonc --lang ka
```

Question: does the whole pipeline produce a usable artifact for a corpus-less language, and does the gate
then find anything?

**Random text alone covered 20/35 cells.** `mine.ts`'s header makes a strong claim about the empty ones —
that an empty cell is *"a query to run, not a fact about the language"*, because random sampling reads
intros and intros are biographical. Tested on Georgian's fifteen empty cells, and it is emphatically right:

```
clock            5394 hits on the wiki → pulled 10 articles
signed-number    8228 hits
ordinal-latin    2860 hits
currency         1636 hits
version-dot       281 hits
units             241 hits
era-marker        170 hits
sports-time       148 hits
ordinal-caps      146 hits
scaled-currency   120 hits
ordinal-range      15 hits
iteration           1 hit
```

Not one of those cells was genuinely absent, and two of them run to thousands of articles. **20/35 → 28/35**
on 111 extra passages. The residual seven are `ordinal-native` and `calendar` (lexical — they need
`--terms`), `zero-width`/`iteration`/`version-dot`/`ordinal-caps` (rare), and `units`, which is the
interesting one: 241 wiki hits, ten articles pulled, still zero matches in the extracted text. Unit
abbreviations in Georgian articles live in infoboxes and tables, and those do not survive plain-text
extraction.

### The gate then found 73 silent drops in a language with no corpus

```
DROP exponent      ×44
DROP percent       ×16
DROP math-sign     ×7
DROP degree        ×4
DROP ampersand     ×2
REDUNDANT currency ×1
```

Georgian has no `normalize.ts` — none of the 93 minable languages does, since #562's sweep only treated
FLEURS languages — so every one of those is a symbol the engine reads today by ignoring it. This is #585's
thesis demonstrated once, end to end: the gate needed no audio, and it works on a language that has never
had a corpus. The REDUNDANT classification also held: the one currency drop is a sentence that names the
US dollar in words, where silence is the correct reading.

---

## Run 8 — 2026-08-05 08:45 · six more, and the health check's first real sweep

Commands: `fetch --random 400` then `wiki-health.ts` then `mine --segment paragraph`, for `he fi eu gl ast be`
— the densest healthy heads of the ranked list.

All six fetched clean at **20/20 batches** with the new backoff in place (377–399 passages each), which is
the first evidence that the 429 fix in Run 6 holds under a sequential multi-language sweep.

| code | segments | template reuse | type/token | scripts | cells | verdict |
|---|---|---|---|---|---|---|
| he | 357 | 0.1% | 0.454 | Hebrew 93.8 · Latin 5.5 | 23/35 | usable |
| fi | 357 | 0.2% | 0.476 | Latin 99.6 | 24/35 | usable |
| eu | 387 | 1.2% | 0.452 | Latin 99.7 | 22/35 | usable |
| gl | 367 | 0.7% | **0.283** | Latin 99.8 | 24/35 | usable |
| ast | 347 | **1.5%** | **0.299** | Latin 99.7 | 25/35 | usable |
| be | 349 | 1.3% | 0.453 | Cyrillic 95.9 · Latin 4.0 | 23/35 | usable |

Six for six on health, and the spread is informative: every reading sits in the same band the `de`/`ka`
calibration established, with `ast` and `gl` the closest to a threshold — 1.5% template reuse and 0.283
type/token, both still 2× clear. Worth watching as the sweep reaches smaller wikis, since `ast` and `gl` are
Wikipedias with a known share of bot-assisted geographic stubs and this is what that looks like *without*
tipping into `ceb` territory: an order of magnitude short of it on reuse.

Latin share in the two non-Latin wikis (`he` 5.5%, `be` 4.0%) matches the seven measured in Run 6 — still
no positive case for the contamination threshold anywhere in the fleet so far.

---

## Run 9 — 2026-08-05 09:15 · the fill step was doing nothing, and the plausible explanation was wrong

Command: `fetch --fill …` for six languages, then re-mine.

Question: the fill reported thousands of `insource:` hits per cell and "pulled 8 articles" for each. Why did
coverage then move only 23→24, 24→25, 22→**22**?

Raw finding. The fetched fill text *does* contain the patterns — `grep -o '[$€£¥₪]'` finds 32 currency
symbols in `he`'s fill against 1 in its random sample, 99 in `gl`'s. So the text arrived and the cell still
read zero. Measuring the segmentation instead of the content:

```
he/raw:  386 lines, median   298 chars →  357 paragraph segments
he/fill:  65 lines, median 19029 chars →    1 paragraph segment
fi/fill:  59 lines, median 33167 chars →    2
gl/fill:  64 lines, median 18876 chars →    6
ka/fill: 111 lines, median 17569 chars →   12
```

**`extracts()` collapsed `\s+` across the whole extract.** That is right for an intro, which is one
paragraph, and catastrophic for the full article the fill pulls: the article became a single line of median
19,029 characters, `segment()` in paragraph mode splits on `\n` alone (deliberately — so no dot is ever
interpreted), and the 1,200-character ceiling then discarded it. **65 filled articles produced one usable
segment.** The entire fill step — the feature that makes an empty cell "a query to run, not a fact about the
language" — had been doing nothing.

### ⚠ The plausible explanation was already in this document, and it was wrong

Run 7 recorded, for Georgian's `units` cell: *"241 wiki hits, ten articles pulled, still zero matches in the
extracted text. Unit abbreviations in Georgian articles live in infoboxes and tables, and those do not
survive plain-text extraction."*

That reading fits every observation, it is mechanically true of infoboxes, and it is not what happened. It
was a bug in the extractor, and it would have gone into the record as a **limit of the method** — the most
expensive kind of wrong answer, because nobody re-investigates a documented limit.

What should have caught it: `segment()`'s own comment states the contract that was being violated — *"The
extractor writes one paragraph per line, so the boundary is already decided and no dot is ever
interpreted."* It didn't write one paragraph per line. A stated invariant with nothing asserting it.

Fixed: `extracts()` splits on newlines and collapses whitespace *within* a paragraph only. Pinned by two
tests. The log line also changed — `got` counts paragraphs, not articles, and calling them articles
overstated the fetch by two orders of magnitude once the fix landed.

Same queries, same 8 articles per cell, after the fix:

| | fill passages before | after |
|---|---|---|
| ka | 111 | 5,677 |
| he | 65 | 5,463 |
| fi | 59 | 5,252 |
| eu | 72 | 6,283 |
| gl | 64 | 4,532 |
| ast | 57 | 2,804 |
| be | 64 | 2,433 |

---

## Run 10 — 2026-08-05 09:45 · seven artifacts, and what the gate finds in untreated languages

| code | cells, random only | after fill | remaining empty |
|---|---|---|---|
| ka | 20/35 | **28/35** | ordinal-native units zero-width iteration calendar version-dot ordinal-caps |
| he | 23/35 | **29/35** | ordinal-native zero-width ordinal-range iteration calendar ordinal-caps |
| fi | 24/35 | **31/35** | ordinal-native calendar version-dot ordinal-caps |
| eu | 22/35 | **32/35** | ordinal-native iteration calendar |
| gl | 24/35 | **32/35** | ordinal-native iteration calendar |
| ast | 25/35 | **32/35** | ordinal-native iteration calendar |
| be | 23/35 | **30/35** | ordinal-native iteration calendar version-dot ordinal-caps |

The residual is almost entirely the two **lexical** cells, which have no shape to query and need `--terms`
(`ordinal-native`, `calendar`), plus `iteration` — a script-specific repetition mark (Thai ๆ, Japanese 々,
Khmer ៗ) that is *correctly* absent from Latin, Cyrillic, Hebrew and Georgian text. `zero-width` has no
queryable shape by construction.

**`ka`'s `units` cell is a genuine cell limitation, not a fill failure** — it survived the fix at 494 hits
and 552 paragraphs. The cell's regex lists Latin abbreviations (`km|kg|cm|…`); Georgian writes კმ, კგ. This
is the same split the inventory already makes between `ordinal-latin` and `ordinal-native`, one cell short:
units need a native tier too.

### The scan: ~770 silent drops across seven languages that have never had a corpus

| code | drops found (top classes) |
|---|---|
| ka | percent 38 · exponent 32 · math-sign 22 · currency 18 · degree 13 · ampersand 11 · minus 5 |
| he | percent 24 · math-sign 16 · ampersand 12 · degree 8 · minus 8 · currency 4 · exponent 4 |
| fi | percent 21 · exponent 14 · ampersand 13 · degree 8 · math-sign 6 · currency 5 · minus 2 |
| eu | math-sign 28 · percent 28 · exponent 19 · minus 12 · degree 11 · ampersand 8 · currency 7 |
| gl | math-sign 29 · percent 23 · exponent 14 · minus 14 · currency 13 · degree 9 · ampersand 9 |
| ast | exponent 44 · percent 31 · math-sign 19 · ampersand 11 · degree 9 · minus 8 · currency 8 |
| be | exponent 28 · math-sign 27 · percent 20 · degree 18 · currency 16 · minus 12 · ampersand 10 |

No THROWs anywhere. `REDUNDANT currency` was correctly separated from the defect count in `eu` (1), `gl` (2)
and `ast` (2) — sentences that name the currency in words, where silence is the right reading.

The `ast` examples are worth quoting because they are the same sentence pair: `Un oxetu sobro'l Polu Norte
celeste tien una dec. de +90°` and `… Polu Sur … de −90°`. A declination sign, dropped in both directions,
found by a gate on a language with no corpus and no `normalize.ts`.

---

## Run 11 — 2026-08-05 10:05 · the dump route was already in the tree, and I had not used it

Question (raised by the user): could full dumps replace the rate-limited API route for the smaller wikis?

**Yes, and `tools/normalization/wikidump-to-text.py` already existed and was used for the Burmese pilot** —
`my.jsonc` records `"source": "my.wikipedia.org dump (pages-articles, paragraphs)"`. Its header argues the
case and adds a reason I had not weighed:

> A local dump removes all three and — the reason that matters for the two-tier design — restores TRUE
> FREQUENCY, which a search-ranked sample cannot give.

That indicts the seven API-mined artifacts specifically. Their `sample` tier is documented as *"the
representative tier … for anything that needs real proportions"*, and a deterministic stride over random
intros plus search-ranked fill is not representative of anything. The `×33` / `22.1% of the corpus` counts
that drove #562's prioritisation cannot be recovered from what I built.

Measured, Pashto: **50 MB in 11s; 45,293 pages → 132,981 paragraphs in 46s.** The API route was producing
~700 paragraphs per language. Two orders of magnitude, complete, no rate limit.

Dump survey of the 82 remaining candidates: **81 under 0.5 GB, 2.91 GB total**; only `hy` (564 MB) over. The
user then raised the cap to 0.6 GB, which takes the whole set. Of the seven already mined, `he` (1,082 MB) and
`fi` (934 MB) are over and keep their API artifacts.

Coverage settles the question on the merits too: **mean 30.0/35 cells from dumps alone, with no fill step**,
against 22–27/35 with fill on the API route and 20/35 for the original Burmese random sample.

---

## Run 12 — 2026-08-05 10:10 · two health metrics that broke on the first dump

`health()` **threw**: `RangeError: Map maximum size exceeded`. 132,981 paragraphs at stride 3 is ~39M
shingles, past V8's Map limit. Every metric here is a proportion, so none needs the whole corpus — now a
deterministic stride subsample capped at 20,000 segments, with the true total and the measured count reported
as separate fields.

**Type/token is not size-invariant, and that made the threshold meaningless on a dump.** Types accumulate
sublinearly in tokens (Heaps' law), so more text drives distinct/total down mechanically, for flawless prose
as much as for a template. Calibrated on ~370-segment samples, applied to 187,322:

```
plain distinct/total      ps (full dump) 0.084 · ceb (bot) 0.084     ← IDENTICAL
MSTTR, 500-token windows  ps 0.557 · ceb 0.340 · de 0.644 · ka 0.799
```

Pashto Wikipedia is ordinary prose — different topics, different vocabulary per paragraph. Under the plain
ratio this check would have condemned **every corpus the dump route produces**. Replaced with MSTTR over
500-token windows, floor 0.45.

---

## Run 13 — 2026-08-05 10:25 · a Latin share is not contamination

Question (raised by the user): indigenous languages are conventionally Latinized and borrow heavily from a
colonial language, especially in the academic register a Wikipedia is written in; several are dual-script. Is
a Latin share a defect at all?

It is not, and the character-level metric could not tell the cases apart. Classifying the Cherokee dump line
by line:

| | share | what it is |
|---|---|---|
| all/mostly Cherokee | 54% | the language |
| mixed | 15% | dual-script orthography and borrowing — **correct** |
| mostly/all Latin | **32%** | English prose: *"Cherokee New Testament Online. Online translation of the…"* |

A third of `chr` is not Cherokee. That has a concrete consequence — those lines phonemize as Cherokee, so they
produce nonsense or make foreign phonemes the expected background of the `--foreign` scan, which is the exact
masking risk #585 names — and it is fixed by filtering lines, never by condemning the language.

> **⚠ CORRECTION (Run 15).** The 32% figure above is measured over RAW UNFILTERED LINES with looser script
> thresholds, and it overstates what reaches an artifact. Two things shrink it. Much of that "Latin" was
> media and table MARKUP, which is Latin by nature and is now stripped; and `segment()` discards anything
> under 40 characters, which removes most of the short English fragments. Measured on the same wiki after
> filtering: **59.2% native, 19.6% mixed, 21.2% foreign over lines** — and **10.9% foreign over the segments
> that are actually mined**, which is the population that matters and is well under the 25% threshold. `chr`
> passes. The reasoning in this run stands; the number attached to it was the wrong number.

Now three-way and per line; only the foreign share is asserted on (25%); `mixed` is printed and never a
finding.

**Recorded but not closed:** a Latin-skewed wiki under-exercises the native-script path, so its artifact tests
the Latin rules rather than the language's own. That is the same gap as the lexical-only `ordinal-native` and
the Latin-abbreviation-only `units` cell (Georgian writes კმ, კგ). The inventory needs native tiers for the
script-bound cells. Deferred: adding a cell marks all 104 artifacts stale.

---

## Run 14 — 2026-08-05 10:35 · what separates a bot from a merely repetitive language

Question (raised by the user): most languages are highly repetitive in some register — why is repetition a
bot indicator?

It largely is not, and the vocabulary metric was measuring the language. `haw` read MSTTR 0.364 against the
bot wiki's 0.340; Hawaiian has 13 phonemes, short words and dense particle use, so any Hawaiian text repeats.

The discriminator is not how much a word repeats but **what kind of word is frequent**. A template slot
appears in a huge share of segments **exactly once in each** — the generator writes it once per article —
while a function word recurs *within* a sentence. Document frequency > 15%, occurrences-per-carrying-segment
< 1.25:

```
ceb (bot)  61   nahimutang df62% · ulohan df55% rate 1.00 · giiniton/kinainitan/kinabugnawan df45% rate 1.00
de          6   ist, ein, eine, war, als, auch — copulas and articles
bm          4   fichier, px, right, jpg  ← not words at all
ka          3   all grammatical
haw         0   ← exonerated
wo          0   ← exonerated; its 5.7% shingle reuse is not a generated template either
```

The same signal from the frequency ranks: `ceb`'s top ten tokens include `palibot`, `nasod`, `km` and
`milimetro`, where `de` (20% top-10 share), `ps` (26%) and `haw` (32%) are pure grammar. Content words
outranking grammar is the bot signature; a high top-10 *share* on its own is not.

### The detector found a converter bug on its first run

`bm`'s four most field-like "words" were `fichier`, `px`, `right`, `jpg`. `RE_FILE` matched
`File|Image|Category|Wikipedia` only, and bm.wikipedia writes
`[[Fichier:Drall.jpg|droite|200px|vignette|…]]`, so whole media links survived into the mined text. The
largest contamination found so far, an order of magnitude past the nested-table residue:

```
bm 19.2% of lines · chr 18.5% · syl 11.1% · ltg 9.7% · haw 8.7% · hak 8.7% · wo 8.1% · gd 7.1%
```

Fixed twice over, since a prefix list is inherently incomplete: 19 languages' localized prefixes, plus a
language-agnostic rule keyed on the media extension, which no localization changes.

### Repairing an already-converted fleet, without re-downloading it

Both contamination classes are line-level discards, so `filter-markup.py` applies them to extracted text with
no wikitext needed — the `.bz2` files are deleted after conversion. The cost of whole-line dropping was
measured before choosing it over re-conversion: of the residue lines, only **2% (bm) / 4% (gd)** still hold
>80 characters of prose once the media link is stripped, i.e. **0.40% and 0.48% of the corpus** respectively,
and most of even that is captions. Re-downloading 3 GB to recover 0.4% is not worth it.

Confirmed the fixed converter needs no filtering: languages converted after the fix read **0.0%** residue
(`fo`, `kaa`, `mai`, `mad`) against 8–19% before it.

---

## Run 15 — 2026-08-05 11:00 · the fleet health pass, and five metrics that were measuring the instrument

Command: `wiki-health.ts --in <lang>.dump.txt --tsv` over every converted dump.

Result on the first 49: **46 ok · 3 SUSPECT · 10 single-signal reported without failing.** Pre-corroboration
logic would have failed all thirteen.

| language | verdict | reading |
|---|---|---|
| `nan` | **bot** | reuse 11.4% + MSTTR 0.266 + 29 fields — the strongest readings in the fleet, and the volume probe had already flagged it independently: 434,486 articles averaging 62 words |
| `bpy` | **bot** | *discovered* by the field detector, not from a list. Most-reused shingle "…according to the census population" in 2,715 of 63,454 segments; fields জনসংখ্যা "population" and মানুলেহা "census" at df 31%, rate 1.00 |
| `mg` | **usable, reviewed** | two signals and not a bot corpus — see below |
| `ary st tn cdo wo crh hak haw ilo mos` | ok | one signal each, reported and cleared |

### The tally of what each metric turned out to measure

Five candidate metrics were dropped or corrected during this work, and all five failed the same way — a
confident verdict about a *language*, produced by a property of the *instrument*:

| metric | what it was actually measuring |
|---|---|
| sentence-length CV | nothing — it does not separate (`de` 0.71 vs `ceb` 0.65, baseline 0.35) |
| plain type/token | corpus SIZE (`ps` full dump 0.084 = `ceb` 0.084) |
| Latin character share | ordinary orthography in a Latinized or dual-script language |
| MSTTR alone | the language's own phonology (`haw` 13 phonemes; `hak`/`cdo` romanized monosyllabic) |
| foreign-line share | the gaps in this tool's own `SCRIPTS` table (`syl` → "100% foreign") |

The two that survive — **template reuse** and **template fields** — survive because each measures something a
generator does that no language does: reusing a frame with the slots refilled, and placing a content word in a
large share of segments exactly once each.

### `mg`: the case that required reading rather than a threshold

Two signals fired. Reading it: the reuse comes from a French-commune stub set (`"Ny INSEE dia mampiasa ny
kaodi…"`), which is real and covers **1,270 of 282,663 segments — 0.45%**. Only 4 fields, two of them
grammatical (`ilay`, `no`). The prose is ordinary Malagasy history — Gallieni's *politique de races*, the First
Republic, Tsiranana. The low MSTTR is the language's particle density.

So `REVIEWED` now records per-language verdicts a human has read, with the evidence cited rather than the
outcome asserted — the alternative being to re-investigate the same language on every sweep, which is trap 16.

---

## Run 16 — 2026-08-05 11:10 · the health check's premise, measured

Command: `mine.ts scan --in tools/corpus/mined/<lang>.jsonc --lang <lang>` over every settled artifact.

Question: does a bot corpus actually fail to find defects — the thing #585 asserts and nothing had tested?

**Yes, by a factor of forty, and with better-than-average cell coverage.**

| | segments | cells covered | hard-set lines scanned | drop classes | drops found |
|---|---|---|---|---|---|
| `bpy` (health: BOT) | 63,454 | **30/35** | 199 | 1 | **3** |
| `chv` (healthy) | 234,134 | — | 254 | 7 | **131** |
| `km` (healthy) | 114,963 | — | 253 | — | 211 |

The hard-set sizes are comparable, so the scan reads a similar volume for each: the same effort yields 3
defects from Bishnupriya and 131 from Chuvash.

This is precisely what the issue predicted — *"the diff would look clean while testing nothing"* — and what
`wiki-health.ts`'s header asserts about coverage: **`bpy` covers 30 of 35 cells, better than the fleet mean,
and finds almost nothing.** Without the health check it would have been recorded as a well-covered language
whose engine handles symbols nearly perfectly. A false all-clear, from a corpus that cannot fail.

Coverage is not health, and this is the measurement that proves it.

---

## Run 17 — 2026-08-05 11:25 · what the gate found, and a Wu defect that was never a normalization defect

Command: `mine.ts scan --in tools/corpus/mined/<lang>.jsonc --lang <lang>` across the settled fleet.

**6,205 silent drops across 64 artifacts, and ZERO throws.** The engine does not crash on any of this text; it
declines to read symbols. Highest yields: `km` 211, `shi` 205, `wuu` 163, `ug` 158, `kaa` 148, `mg` 147,
`an` 140, `ky` 135, `chv` 131, `mt` 128 — all in languages with no FLEURS corpus and, in nearly every case, no
`normalize.ts` at all. Dominant classes fleet-wide are `percent`, `math-sign`, `exponent`, `degree`,
`currency`, matching what the seven API-mined languages showed.

### Two false leads, followed and dropped

`awa` reported a `LEAK DIGIT`, and its example was not Awadhi: `Tapietkn' f ww di x ,c. Q gVd. Dyh sw w.` —
nonsense Latin with a long digit run. **One line in 18,117**, i.e. a vandalized or test page. It reached the
artifact because the hard-set selects ADVERSARIALLY, so garbage containing symbols is *preferentially*
surfaced. A guard was considered — reject a line where >40% of tokens are 1-2 characters — and REJECTED on
measurement: it would drop 12.76% of Aragonese and 14.57% of Bambara, both legitimately full of short function
words. So this stays a thing a reviewer catches, not a thing a filter catches.

`wuu` reported `LEAK DIGIT ×23`, and the first hypothesis was numeric tone notation. Checked: the engine emits
tone LETTERS (`˨˦˥˧`) for wuu, gan and yue, so there is no false positive from tones.

### The real Wu finding: a known fallback whose size was never measured

Localising the leaks by clause showed the digits are not from the source at all — the ENGINE emits them:

```
出现单仰萍   → t͡sʰəʔ˥ ji˧˩ tɛ˥˧ knian1 bɪɲ˩˧      仰 → "knian1"
为粉质粘土   → wɛ˩˧ fəɲ˧˦ t͡səʔ˥ kni5 tʰu˧˩        粘 → "kni5"
本名沙姆斯丁  → pəɲ˥ mɪɲ˧˩ sa˥˧ mh1 sɿ˥˧ tɪɲ˥˧     → "mh1"
```

`knian1`, `kni5`, `mh1` are raw Wugniu romanization with a tone digit, not IPA. And this is **deliberate**:
`src/languages/wu/wu.ts:63` reads `return syl; // unknown rime → leave the romanization visible`. A
visible-failure fallback, by design.

What the gate adds is the number, which nobody had:

| | |
|---|---|
| `dict.tsv` entries whose value is romanization + tone digit rather than IPA | **11,714 of 101,308 (11.6%)** |
| mined lines carrying an unconverted token | **23 of 442 (5.2%)** |
| distinct leaking tokens | 13, every one `kni-` / `knian-` / `kniau-` / `mh-` |

The initials cluster tightly — `kni` and `mh` are Wugniu for the palatal nasal and the voiceless labial nasal —
so this is one or two missing rows in the syllable map rather than scattered dictionary rot, and it reaches 5%
of real Wu text. None of the six sibling Sinitic languages (`gan hak cdo nan yue cmn`) leaks at all, which
localises it further.

⚠ THIS IS NOT A NORMALIZATION DEFECT, and that is the point worth keeping. It is a g2p/lexicon gap, already
acknowledged in a code comment, surfaced and quantified by a normalization gate on a language that has never
had a corpus. The gate's value is not confined to the layer it was built for.

---

## Bot contamination is a baby/bathwater problem — the question is whether it MISLEADS

Raised by the user: contamination existing is not the issue; being misled by *harmful* contamination is. Nearly
every large wiki carries some generated content, and condemning a corpus for containing any of it discards the
human text alongside. The template does harm two ways only — by crowding out the real signal, or by making a
clean diff look meaningful.

That makes "ungateable", which is how Run 16 described `bpy`, too blunt. And the field detector can **partition**
instead of condemning, because it already names the template's slot words: counting how many distinct field
words a segment carries separates the populations. Share of segments carrying **zero** field words:

| | zero-field segments | scaled to the full corpus |
|---|---|---|
| `mg` | **61.4%** | mostly human, as the reading found |
| `bpy` | **22.2%** | ~14,000 segments — a substantial remainder |
| `nan` | 2.7% | ~11,000 segments of a very large corpus |
| `ceb` | 0.5% | genuinely ~99% template, matching its reputation |

So `bpy` and `nan` both have human remainders that discarding the corpus would have thrown away, and `ceb`'s
reputation is quantitatively earned.

### ⚠ But the partition is a starting point, not a clean corpus

Reading `bpy`'s zero-field segments: one is genuine prose about world literature translated into Bishnupriya
Manipuri; the next is a navbox link list (`সংখ্যা • Hypercomplex numbers • Quaternions • Octonions •`). Median
length 83 characters, p90 191 — so many are fragments rather than paragraphs. The remainder is worth keeping
and still needs reading.

A further caveat that follows from the method: a zero-field subset of a bot wiki is BIASED — it is whichever
articles the generator did not write — so its `sample` tier cannot support a frequency claim even though the
corpus is dump-sourced. For hard-set purposes, which ask only whether the engine reads a symbol, a
biased-but-human subset is fine.

`REVIEWED` now carries a `gateable` field recording that share where measured. Nothing partitions
automatically yet; this measurement is what would justify building it.

---

## ⚠ The issue's density claim is not supported — dumps deliver VOLUME, not density

#585 argues that "written sources are **denser** in the patterns the normalizer handles than read-aloud news
prose is", citing `hu_hu` containing zero `$`. Tested on comparable languages, measured per 1,000 segments so
corpus size cannot confound it:

| | source | segments | `percent` instances | per 1,000 segments |
|---|---|---|---|---|
| `pnb` | wiki dump | 444,075 | 1,126 | **2.5** |
| `hi` | FLEURS | 11,295 | 191 | **16.9** |
| `sd` | FLEURS | 2,000 | 4 | 2.0 |
| `ur` | FLEURS | 1,639 | 1 | 0.6 |

**Hindi's read-aloud news corpus is nearly seven times denser in percent signs than Punjabi's entire wiki
dump.** The claim does not hold as stated; FLEURS is not uniformly sparse, and density varies by language far
more than by source type.

What a dump delivers is VOLUME: 1,126 real instances to test a percent rule against, versus 1. That is still
the decisive advantage, and it is a different claim from the one the issue makes.

⚠ Recorded because the wrong version was nearly written down. Comparing ABSOLUTE counts — pnb 1,126 against
ur 1 — reads as a thousandfold density advantage for dumps, and it is entirely an artifact of 444,075 segments
against 1,639. The rate is the only comparable figure, and computing it reversed the conclusion.

---

## ⚠ CORRECTION — what `coverage.ts` is actually limited by

An earlier version of this section, and the body of the pull request that merged this work, claimed that
`coverage.ts` "reads FLEURS corpora directly and prints `N/67`", and that the denominator "was never a choice —
it is the number of languages that had a corpus". **Both halves are wrong**, and the file says so plainly if
read rather than skimmed.

- `evidence()` **already prefers the mined artifact** and falls back to FLEURS only when none exists. That has
  been true since #585's Burmese pilot, which is listed in its own map as *"No FLEURS corpus — checked entirely
  from its mined artifact"*. The file even documents a period when a wrong relative path made the artifact
  branch silently never fire — so the behaviour was not only intended, it was debugged.
- The `/67` denominator is `TREATED`, derived from **the presence of `src/languages/<dir>/normalize.ts`**.
  Measured: 67 directories have a normalization layer, 66 FLEURS corpora exist, 154 artifacts are committed. The
  denominator tracks TREATMENT, not evidence.

So the artifacts do not unlock a larger denominator by being pointed at — they are already being read. What
bounds the audit is that it only examines languages which already have a normalization layer, because a DROP
there is a regression in finished work.

**The real gap is the other direction.** The 87 newly mined languages have evidence and no layer, so this audit
skips them entirely — while an ad-hoc `mine.ts scan` across their artifacts found thousands of dropped symbols.
Those are not regressions; they are the work items for treating each language. Extending the audit to report
them, separated from the treated set so the two are never confused, is what would make the denominator 154.

Recording the correction rather than quietly editing the claim, because the wrong version is already in a merged
commit message and cannot be edited there.

## Open gaps, recorded rather than rediscovered

**1. The inventory has no native tier for the script-bound cells.** Raised by the user as a consequence of
dual-script orthography: a wiki that skews Latin produces an artifact exercising the Latin rules and not the
language's own script. Two cells show it concretely:

- `units` lists LATIN abbreviations (`km|kg|cm|mm|ml|mg|GB|MB|…`). Georgian writes კმ, კგ, so the cell survived
  a fill of 494 wiki hits and 552 paragraphs at zero. It is the same split the inventory already makes for
  `ordinal-latin` vs `ordinal-native` — one cell short.
- `ordinal-native` and `calendar` are LEXICAL: no shape to query, fillable only from a per-language `--terms`
  list, and no such lists exist. They are the residual empty cells in nearly every artifact in this sweep.

Deliberately NOT done here. Adding a cell changes `CELLS.length`, which marks **all 143 artifacts stale** by
`review.ts`'s own staleness gate — including the 67 FLEURS artifacts this work does not otherwise touch. The
right moment is a pass that regenerates the whole fleet, with the term lists authored first; doing it mid-sweep
buys nothing, because a lexical cell fills only from lists that would still be empty.

**2. Frequency is unavailable for two languages.** `he` (1,082 MB) and `fi` (934 MB) exceed the 0.6 GB dump cap,
so they keep API-built artifacts whose `sample` tier is a stride over random intros plus search-ranked fill.
`SAMPLE_CAVEAT` now makes each artifact say so in the file. Anyone needing a rate for those two must re-mine
from the dump.

**3. `mag` has no dump at all.** Its dump run publishes only a status file. It stays on the API route at 25/35
cells, which is the ceiling for a 3,657-article wiki.

**4. The adversarial hard-set preferentially surfaces garbage.** A single vandalized page in Awadhi
(1 line in 18,117) reached the artifact because it contained a digit run and a minus, which is exactly what the
selector hunts. The obvious guard was measured and rejected — see Run 17. This is a thing a reviewer catches.

**5. Two health signals do not work on unspaced scripts.** MSTTR falls back to characters, where it does not
separate (`ceb` 0.0011 vs `de` 0.0021, confounded by alphabet size), and the template-field detector tokenizes
on word boundaries that Han, Thai, Khmer, Burmese and Lao do not have. Template reuse — counted over characters
— is the only signal that works there, so those languages have one detector instead of three.

### Known gap: `review.ts` cannot reach its artifact checks for these languages

`review.ts --lang ka` fails at check 1 (`normalize.ts missing`) and exits before the artifact-tracked,
artifact-current and artifact-scan checks. That is right for a treated language and wrong for the sweep:
**all 93 will fail at step 1 forever**, so three of the five gates are unreachable for exactly the languages
this work exists to serve. Not changed here — it is a shared gate and mid-sweep is the wrong time — and
`mine.ts scan` covers the important part directly. Recorded as the next tooling item.
