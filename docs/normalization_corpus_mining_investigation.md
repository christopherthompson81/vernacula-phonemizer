# Normalization corpus mining — investigation log

Can the #562 normalization gate be extended to the ~90 languages that have a pronunciation referee but no
FLEURS corpus, by MINING running text for excerpts that challenge the normalizer? See #585.

---

## Run 1 — 2026-07-31

**Question.** Does a mined hard-set behave like a corpus for gating purposes, and what does the yield per
pattern-cell actually look like? Burmese (`my`) chosen as the test language: it has a kaikki referee, no
FLEURS corpus, and — the reason it was picked over the alternatives — it writes its own digits ၀-၉, so it
also tests whether the selectors are ASCII-blind.

**Source.** 573 random `my.wikipedia.org` article intros via the MediaWiki API (`generator=random`,
`prop=extracts&explaintext`), 371k chars. A User-Agent header is required; without one the API returns
non-JSON and the fetch silently yields nothing.

**Command.**

```
npx tsx tools/normalization-mine.ts --in my_raw.txt --out my.hard.tsv --per-cell 8 --sample 60
```

**Raw finding — 2949 unique sentences, 14 of 20 cells covered.**

```
cell             langs   matched   picked   ascii-only-would-find
digit-run         19       902        8          14  (888 missed)
era-date          14       902        8          14  (888 missed)
latin-in-native    6       551        8         551
zero-width         4       327        8         327
signs             17        83        8          83
initialism         3        41        8          41
ordinals          11        20        8           2  (18 missed)
ranges             7        17        8           0  ← ASCII BLIND
grouped            3         7        1           1  (6 missed)
decimals          12         6        6           0  ← ASCII BLIND
fractions         18         3        3           0  ← ASCII BLIND
units              9         2        2           1
currency           6         2        2           2
roman              3         2        2           2
EMPTY: degrees clock dotted abbrev percent rate
```

**The ASCII trap is real and large, not theoretical.** 902 digit-run matches; an ASCII-only selector finds
**14**. Three cells are entirely invisible to `\d`. A miner written with `\d` would have reported a nearly
empty hard-set for Burmese and looked like it had simply found a clean language.

**This same bug was already shipped.** `tools/normalization-corpus-diff.ts` defined its DIGIT defect class
as `/\d/u`. Its RAWMARK class lists the Devanagari, Arabic-Indic and Persian digit ranges, which disguised
the gap — those three scripts were covered by accident, and Burmese, Thai, Bengali, Khmer and Lao were not
covered at all. A digit leak in any of them would have passed the gate clean. Fixed to `\p{Nd}` in this
run.

**Defect scan of the mined set: ZERO.** All 140 mined lines pass the shipped DIGIT / SLOT-GAP / RAWMARK
classes, plus added checks for any-script digits, surviving zero-width marks, and leaked wiki markup. The
Burmese engine handles native digits correctly (`၂၀၂၄ ခုနှစ်` → `n̥ɪʔtʰaʊ˥ˀɴn̥ɪʔ sʰɛ˥ˀle˥˩ kʰu˥ˀn̥ɪʔ`).

**But `my` is NOT clean, and the mined set could not see it.** The synthetic audit flags `my` for both
PCT-DROP and CUR-DROP, and directly probing confirms it:

```
၅၀%  → ŋa˥˩sʰɛ˨        ၅ → ŋa˥˩      (the % contributes nothing)
$5   → ŋa˥˩            5 → ŋa˥˩      (the $ contributes nothing)
```

The mined corpus matched **zero** `%` instances across 2949 sentences, and its two `currency` hits were
prose *about* the rupee sign (a Unicode discussion), not amounts. So the hard-set would have certified a
language that silently drops two symbol classes.

**Implication for the next step.** This is the #584 lesson recurring in a new source: corpus-driven work
covers what the corpus contains, whatever the corpus is. Mining raises the density but does not close the
hole — Burmese Wikipedia intros genuinely do not use `%`. The two methods are complementary and both are
required:

- the **synthetic audit** answers "what can this engine not say at all" (no corpus needed),
- the **mined hard-set** answers "does it handle the things it will actually meet" (no audio needed).

Neither subsumes the other. The gate for a corpus-less language should be both, and the empty cells above
(`degrees clock dotted abbrev percent rate`) are a *targeted fetch list* rather than a dead end — they say
which patterns to go looking for specifically, e.g. by mining article categories where they concentrate
(weather, transport timetables, sports results) instead of more random articles.

**Also observed.** Plain-text extracts still carry `==` heading markup and `[[` link syntax at low rates;
`stripMarkup` does not claim those (it handles HTML tags and entities). The Burmese tokenizer ignores them
harmlessly, but a language whose TOKEN class is broader might not, so the miner should strip wiki syntax
before writing the hard-set. Not yet done.

**Not yet tested.** Whether the bot-generated-wiki risk (#585) actually materialises — `ceb` is the
candidate to check, and Burmese gave no signal either way.

---

## Run 2 — 2026-07-31

**Questions.** (a) Are the four categories spotted in English's `normalize.ts` — roman numerals, calendar,
negatives, letter names — missing from the inventory? (b) Can an empty cell be FILLED deliberately, given
the suspicion that the pattern is in the corpus but not in the intro sections?

### (a) Four cells added, and one of them is a design problem

- **negative** — worth its own cell precisely because it is the ambiguous half of `ranges`: the same
  character, and the two rules compete for it. Only `fr` has authored the rule so far.
- **letter-name** — a LONE Latin capital, which the initialism pass cannot claim (it requires two) and
  which reaches the g2p as a bare consonant. Distinct from `initialism`.
- **roman** — the previous regex could match capitalised English words with roman-ish letters; tightened
  to require the whole token be roman letters.
- **era-marker split from year** — these had been conflated. In the treated languages ERA is a *dotted*
  marker (kn ಕ್ರಿ.ಪೂ, te క్రీ.శ, tr M.Ö., ta கி.மு.) that must be claimed BEFORE the abbreviation rule.
  Different rule, different ordering constraint, different search pattern from a bare 4-digit year.
- **calendar** — CANNOT be regex-mined, and this is structural rather than a gap in effort. Month names
  and non-Gregorian era words (Thai พ.ศ., Ethiopian, Hijri) are *lexical*: they have no shape. The cell
  therefore takes a per-language `--terms` list and the fill query searches those words directly. Same
  principle as `acronymLetters` in core/initialisms.ts — a lexical fact belongs in data, not in logic.

### (b) The hypothesis was right, and the earlier conclusion was wrong

Run 1 left six cells empty and the natural reading — "Burmese does not write those" — was **false**. A
CirrusSearch `insource:` regex query, with the language's own digit range substituted in:

```
percent      1013 hits on the wiki      clock      330 hits
roman        2739 hits                  negative   539 hits
calendar    19242 hits                  degrees    134 hits
letter-name   104 hits                  currency   317 hits
```

None of it had surfaced because random sampling reads INTROS, and intros are biographical while
percentages live in demographics and results sections. **An empty cell is a query to run, not a fact about
the language.** `fetch --fill` now issues one targeted search per empty cell and pulls those articles' FULL
text; the miner prints the exact fill command for whatever is still empty.

Coverage after filling: **20/24 cells**, from 14/20. `percent` 0 → 198 matching sentences, `clock` 0 → 51,
`degrees` 0 → 19, and all four new cells populated.

**API trap worth recording:** `prop=extracts` accepts `exlimit=20` only alongside `exintro`. For FULL text
the cap is 1, and a batched request silently returns a single article — which reads as "this wiki has
almost nothing" rather than as an error. Titles must be fetched one at a time.

**Still empty: `dotted`, `era-marker`, `abbrev`, `rate`.** Not for lack of hits — `dotted` reported 2557 and
`abbrev` 3387 — but those hits are in *wikitext*, i.e. citation metadata and templates, which plain-text
extraction strips. Search hits in wikitext are not prose occurrences, and the gap between the two is a
second thing to watch.

### The finding that matters most: the gate cannot see a DROP

The filled 199-line hard-set scored **zero defects** under the shipped classes (DIGIT / SLOT-GAP /
RAWMARK). It is not clean. Taking a real mined sentence and deleting only its percent sign:

```
… အများပြည်သူနာရီ ၉၈% သည် ၁၈၅၅ ခုမတိုင်မီ …
with %    ɡəɹeɪʔbəɹi˥ˀte˨ɪɴ ʃi˥ˀ ʔəmja˥˩ pji˨ðu˨ na˨ji˨ ko˥˩ sʰɛ˥ˀʃɪʔ ðɛ˨ …
without % ɡəɹeɪʔbəɹi˥ˀte˨ɪɴ ʃi˥ˀ ʔəmja˥˩ pji˨ðu˨ na˨ji˨ ko˥˩ sʰɛ˥ˀʃɪʔ ðɛ˨ …
IDENTICAL: true
```

The leak classes detect a character that **survives**; they are blind by construction to one that
**vanishes**. That is the structural reason the currency drop in #584 went unnoticed through 37 languages
of corpus-driven work — not carelessness, an unobservable defect class.

Added a `scan` mode with a differential DROP test: phonemize, then phonemize again with the symbol
deleted, and flag identity. On the same hard-set that had just scored clean:

```
DROP math-sign ×23   DROP minus ×9   DROP percent ×9   DROP degree ×7   DROP currency ×4
```

**52 defects in a set the leak classes called clean.** This test costs one extra phonemize per symbol-
bearing sentence and should be added to `normalization-corpus-diff.ts` as well, where it would have caught
#584 in the original batches.

### Next: local dumps rather than the API

Dump sizes for candidate languages (`pages-articles.xml.bz2`):

```
lo 8 MB   bo 18 MB   km 31 MB   my 70 MB   si 79 MB   ka 231 MB   hy 558 MB   ceb 1845 MB
```

These are small enough to mine locally, which removes three real limits of the API route: search results
are capped at N per query (so a cell is filled from the top hits rather than from everything), every fetch
is rate-limited and slow, and full-text extraction costs one request per article. A local dump also
restores TRUE FREQUENCY, which the two-tier design needs for the representative sample and which the API
route can only approximate.

**Note `ceb` at 1845 MB — 26× Burmese.** That is the bot-generated-wiki risk from #585 showing up in the
file size before a single byte is parsed, and it is a cheap pre-filter: dump size wildly out of proportion
to the language's encyclopedic footprint is the signature.

Cost of the dump route: wikitext → plain text needs a real extractor (the API gave that for free).

---

## Run 3 — 2026-07-31 — local dump, and the tooling hardened

**Question.** Does the local-dump route close the last cells, and is the pipeline reproducible enough to
commit its output as a reviewable artifact?

**Dump route.** `mywiki-latest-pages-articles.xml.bz2`, 71 MB, extracted by a purpose-written
`tools/wikidump-to-text.py` (no wikitext library was available; `wikitextparser` and `mwparserfromhell` are
both absent). 160,490 pages → **454,821 paragraphs** in 98 seconds. That is 578× the text the API route
produced in dozens of rate-limited requests.

### The three stubborn cells were a TOOL BUG, not a language fact

Mining the dump still reported `dotted`, `era-marker` and `abbrev` at **zero** — across 786k sentences.
Grepping the same extracted text:

```
$ grep -coE "[A-Za-z]\.[A-Za-z]\." my_dump.txt
1437          # K.S.  A.T.  U.S.  G.H. …
```

The sentence splitter treats `.` as a terminator, so `U.S.` split into `U.` and `S.`, each below the
20-char minimum, and both were discarded. **The three empty cells were exactly the three that depend on a
period.** Run 2 had blamed the extractor for stripping citations; that was wrong, and the real cause was
one level up in the miner.

Two fixes, and the first is the better one:

1. **`--segment paragraph`.** A sentence splitter must decide what a period MEANS, and when the mining
   target *is* the period that decision is the thing under test. A paragraph boundary requires no such
   decision. The extractor now emits one paragraph per line so the miner can choose.
2. In sentence mode, abbreviation dots are protected before splitting and restored after.

Result: **24/24 cells covered**, from 21/24. `dotted` 1511, `abbrev` 2780, `era-marker` 63.

Counts are NOT comparable across segmentation modes — a paragraph holding five sentences counts once, but
is likelier to contain any given pattern (`clock` reads 1213 by sentence and 3104 by paragraph). Compare
within a mode only.

### Reproducibility

The miner exports its internals and is covered by `tools/normalization-mine.test.ts` (7 tests): stable
selection across runs, stable JSONC rendering, the dot-splitting regression, paragraph mode, the
native-digit assertion (`asciiCounts.percent === 0` — `\d` finds none of them), and a guard that no fill
query hardcodes `0-9`. Two full mine runs over the 454k-paragraph dump are **byte-identical**.

One thing this exposed: the tool ran its CLI on import, so the test suite died on `process.exit(2)` before
collecting a single test. Now guarded on being the entry point.

### The artifact

`tools/corpus/mined/my.jsonc` — 245 lines, 144 hard + 40 sample. Header comments carry the provenance and
the two warnings a reader needs (why `hard` is not frequency-representative, why an empty cell is not
evidence), so the file explains itself. Parsed with the repo's own `parseJsonc`, not a regex strip — the
counts block carries TRAILING comments that a line-anchored strip leaves behind.

### DROP is now in the corpus-diff gate, and it fires on real corpora

Added to `normalization-corpus-diff.ts` as a fourth defect class. Only utterances carrying the symbol pay
for the second phonemize, so the cost is a few percent rather than a doubling.

Validation on FLEURS corpora:

```
hu_hu   1995 utterances → 0 markers     (correct: hu_hu contains no $ at all — this IS #584)
ro_ro   1958 utterances → 12 markers    8 percent, 2 currency, 2 degree
```

Romanian has a corpus, was audited, and was reading `%` as nothing — invisible to DIGIT / SLOT-GAP /
RAWMARK because the sign VANISHES rather than leaking. The class is retrospective: it would have caught
this in the original batches.

Drop scan of the Burmese artifact: `minus ×10, math-sign ×10, percent ×8, degree ×6, currency ×6`.

### Open

- `hu_hu` shows the limit that remains: a differential test cannot fire on a symbol the corpus never
  contains. The synthetic audit stays necessary; neither check subsumes the other.
- The bot-generated-wiki risk is still untested. `ceb` at 1845 MB versus Burmese at 71 MB is the signal to
  check, and dump size is a free pre-filter.
- Only `my` has been mined. The other ~89 corpus-less languages need a terms list each for the `calendar`
  cell, which is the one genuinely per-language input the pipeline requires.
