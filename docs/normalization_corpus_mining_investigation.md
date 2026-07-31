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

---

## Run 4 — 2026-07-31 — closing the loop: Burmese normalized from the mined corpus

**Question.** Can a language with no FLEURS data be normalized using only the mined artifact — as both the
test set and the source of the words the rules emit?

**Yes.** `src/languages/burmese/normalize.ts` is the 38th normalization layer and the first authored
without a FLEURS corpus.

### The corpus was also the dictionary

This is the part that makes the route viable rather than merely possible. Every word a rule emits was
attested in the same 454,821 paragraphs, with counts, before it was used:

```
ရာခိုင်နှုန်း 3139   ဒီဂရီ 2007   ဒေါ်လာ 2791   ကျပ် 3290   ကီလိုမီတာ 1867
ဒသမ (decimal)  536   နာရီ 2457    မိနစ် 1216    စင်တီဂရိတ် 383   ဖာရင်ဟိုက် 337
```

And the corpus settled the WORD ORDER questions that no dictionary would have:

- **Percent is postposed** — `၉၈ ရာခိုင်နှုန်း`. Measured 2426 postposed : 97 preposed.
- **A fraction is denominator-first** — `၃/၄` is `၄ ပုံ ၃ ပုံ`, 213 instances of the shape. Emitting it
  numerator-first would have been backwards and no probe would have shown it.
- **A negative is a word, not a sign** — `အနုတ် ၉၃ ဒီဂရီ`, the word BEFORE the number.

### Two negative results the counts overturned

1. **No bare-sign negative rule.** The `negative` cell reported 1934 hits and the DROP scan said
   `minus ×10`, which reads as an obvious missing rule. Reading the contexts instead: a hyphen before
   digits is a compound or a date (`ဒီ-၂၀`, `-၂၈ နိုဝင်ဘာ`), and U+2212 — 3259 occurrences, MORE than the
   hyphen — is overwhelmingly a list bullet (`၎င်းတို့မှာ −`). A rule keying on the sign would have
   corrupted dates and bullets to fix a case Burmese does not write.
2. **`°` stands alone.** A first sample showed `၅၉° ဒီဂရီ` — sign plus word — which would make an
   expanding rule double it. Counting properly: 735 `°`, of which 3 are followed by ဒီဂရီ and 168 are
   `°C`/`°F`. Four sampled instances would have produced the wrong rule.

### Before → after

Eleven defects fixed. Baseline emitted from a pristine worktree, so this is a real before/after:

```
၉၈%          ko sʰɛʃɪʔ                    →  … ja˨ɡaɪ˨ɴn̥oʊ˥˩ɴ        (was: % dropped)
$5           ŋa˥˩                          →  ŋa˥˩ dɔ˨la˨             (was: $ dropped)
၅၀,၀၀၀       ŋa˥˩sʰɛ˨ , θo˨ʊɴɲa˥ˀ         →  ŋa˥˩θaʊ˥˩ɴ              (was: "fifty , thousand")
၈၆.၄         ʃɪʔ sʰɛ˥ˀt͡ɕʰaʊʔ . le˥˩       →  … da˥ˀθəma˥ˀ le˥˩        (was: a SENTENCE BREAK)
၃၅°C         … sˈiː                        →  … di˨ɡəɹi˨ sɪ˨ɴti˨ɡəjeɪʔ (was: English letter name)
၁၄:၃၀        sʰɛ˥ˀle˥˩ θoʊ˥˩ɴsʰɛ˨          →  … na˨ji˨ … mi˥ˀnɪʔ       (was: colon dropped)
U.S.         jˈuː . ˈɛs .                  →  jˈuː ˈɛs                (was: 2 spurious breaks)
```

DROP classes on the artifact: `percent 8→0, degree 6→0, currency 6→0`.

**Gates:** 2478 tests (19 in `test/burmese.test.ts`), `tsc` clean, referee **unchanged** at 95.7% / 99.8%
folded backbone — as expected, since normalization touches `text()` and the referee is word-level.

### ★ The representative tier earned its place

The corpus diff over the artifact changed **77 of 184** utterances, and exactly **1 of 40** in the
representative sample. That one was a REGRESSION I had introduced:

```
၂၀-၁-၂၀၂၄  →  ၂၀ မှ ၁ အထိ …      # a D-M-Y date read as "the 20th to the 1st"
```

945 hyphenated dates in the corpus against 6033 genuine two-number pairs. The hard-set could never have
shown this — it proves a rule FIRES; only ordinary text shows what a rule BREAKS. The two-tier design was
argued for on principle in #585 and this is the first time it paid, on its first use.

Fixing it took two attempts, both worth recording:

- The first guard had the lookbehind BACKWARDS (`dash then digits` where the text is `digits then dash`),
  so it did nothing.
- The second guard caused BACKTRACKING: with a trailing `(?!…အထိ)` the engine matched a SHORTER second
  number to satisfy it, and `၁၂ - ၁၃ အထိ` came out as `၁၂ မှ ၁ အထိ၃ အထိ` — a numeral spliced in half. It
  needs an explicit `(?!digit)` completeness anchor after the group.

### What remains, and why it is not being fixed

`DROP math-sign ×10` survives. Reading every instance: they are glosses and formulae — `(gêeo = Earth)`,
`မိုင်း = ကြီးမား`, `E = mc²` — where `=` is not spoken as "equals", plus one real arithmetic expression
(`၃+၁=၄`). ညီမျှ ("equals") is attested 1110 times, so a rule is *authorable*; it would be wrong in the
majority of instances. Recorded rather than guessed at.

`DROP minus ×5` is likewise not a missing negative rule: the residue is compound hyphens
(`အမျိုးအစား-၂`) and NEGATIVE EXPONENTS in scientific notation (`9.1093837 × 10 -31 kg`). The exponent
case is real and is a cell the miner does not yet have.

---

## Run 5 — 2026-07-31 — auditing the inventory itself

**Question.** The Burmese run left `DROP math-sign ×10` unexplained. Is the pattern inventory itself
incomplete — i.e. were there categories the 37 treated languages needed that the miner has no cell for?

**Yes, four, and one of them would have ranked second in the whole table.**

| added cell | evidence for it | why it was invisible |
|---|---|---|
| `exponent` | **24 languages declare `exponentWords` in their DATA** | no cell at all; no mined corpus could ever exercise them |
| `arithmetic` | the unexplained `DROP math-sign` | swallowed by the catch-all `signs` cell, which any currency or percent already satisfies |
| `ampersand` | Dutch authored a rule; 2403 in the Burmese corpus | never surfaced separately |
| `iteration` | Thai ๆ — **the largest single defect in that language**, 16.7% of utterances | script-specific mark, invisible to every shape-based cell |

`exponentWords` being declared in 24 manifests is a harder signal than any comment grep, and it is the
measure worth trusting: the data says the category is real whatever the prose says.

### The ASCII trap recurred one level up, in a cell I wrote after documenting it

The `ordinals` cell listed LATIN suffixes only — `st|nd|rd|th|er|ème|º|ª`. It matched `21st` and found
NOTHING in ၂၁ ကြိမ်မြောက် / २१वीं / 21е / 21. It looked correct because it worked for English, which is
exactly the shape of the `\d`-is-ASCII bug, committed in a file whose header warns about that bug. 32
treated languages have an ordinal rule.

**Widening it over-corrected, and the count said so.** "Digit followed by letters in any script" took
Burmese from 462 to **35,504** — because Burmese writes numbers directly against words (၂၀၂၄ခုနှစ်), so
the cell matched 8% of all text and stopped meaning anything. A cell that matches everything cannot answer
"does this language have ordinals".

The fix is the split the evidence implies: the Latin form is a SHAPE, the native form is LEXICAL — the
suffix is a word (वीं, е, မြောက်, ที่) exactly as month names are. With a scoped term list:

```
ordinal-latin    1357        ordinal-native   1688        (was: one cell reading 35,504)
```

That required per-cell term scoping (`cell<TAB>term`), since two lexical cells now exist and a flat list
would have made each match the other's evidence.

**Coverage: 29/29 cells on Burmese.**

### Two more real Burmese defects, found only because the cells existed

```
၃၈၅၀ km²  →  "kilometre"          the ² dropped outright — the area lost entirely
A&B       →  "ə biː"              the & dropped; A read as the reduced English article
```

Fixed. And the corpus settled another word-order question that no probe would have: **the squared modifier
PRECEDES the unit** — စတုရန်းကီလိုမီတာ, 1859 instances against 3 the other way. Postposing it like the
percent word would have been backwards.

Gates: 2480 tests (21 in the Burmese file), tsc clean.

### Answering the question honestly

Most of what needs normalizing was found — the first 24 cells came from 338 rules that 37 languages
actually wrote, and Burmese needed 13 of them. But the inventory was **derived from what had already been
treated**, so it could only ever be as complete as that history, and two of the four additions above
(`exponent`, `iteration`) were categories with real declared data behind them that simply never got a
cell. The lesson is that the inventory needs auditing against the DATA declarations (`exponentWords`,
`unitPer`, `countForm`) and not only against rule comments.

Still unfixed and deliberately so: `DROP math-sign` is glosses and formulae (`gêeo = Earth`, `E = mc²`)
where `=` is not spoken as "equals"; ညီမျှ is attested 1110 times so a rule is authorable and would be
wrong in the majority of instances. `DROP minus` residue is compound hyphens and negative exponents in
scientific notation — the latter now has a cell but not yet a rule.

---

## Run 6 — 2026-07-31 — retroactive audit of the 37 treated languages

**Question.** The inventory was derived FROM the treated languages, so it is newer than all of them. How
much did the early languages miss?

**Command.** `npx tsx tools/normalization-coverage.ts --max 250` — for each treated language × cell,
report `·` (absent from that corpus), `ok`, `DROP` (a symbol vanishes, differential test) or `LEAK` (a
digit or raw mark survives).

**Result: 38 defective language×cell pairs across 24 of 37 treated languages.** Collapsing the cases where
one utterance trips several cells, **33 distinct defects**:

```
12  ampersand DROP     cmn de en fa gu it ml mr pt ru uk yue
10  currency  DROP     am bn es id mr ne nl or pa pt
 5  exponent  DROP     en id it ne pl
 4  degrees   DROP     fr id ja sr
 1  percent   DROP     ml
 1  ordinal   LEAK     pt
```

**English — the first language ever treated — drops both `km²` and `&`.** `&` is not exotic; it survived
because nothing could see it. The corpus diff detects a character that SURVIVES and is blind by
construction to one that VANISHES (#584), and there was no `ampersand` cell to prompt anyone to look.

### The one LEAK, and why counting cells overstates

Portuguese reported LEAK on six cells — `digit-run`, `year`, `decimals`, `ordinal-latin`,
`latin-in-native`, `grouped` — all from a SINGLE utterance:

```
Seu 1.000º selo …   →   sew mˈiɫ º sˈelu        # the º reaches the IPA raw
12º                 →   dˈɛsimu sɨɡˈũdu         # a bare ordinal is fine
```

So it is one defect (the ordinal indicator survives when attached to a period-grouped number), not six.
Cells are not exclusive and a dense utterance satisfies many at once — the matrix is a map of where to
look, not a defect count. Worth stating because the headline number is otherwise misleading.

This is also the `º` / `ª` class the Italian run found the RAWMARK scan blind to; it is still live in pt.

### What this says about process

The audit took minutes to run and found defects in 65% of the languages that were marked done. The cause
is ordering, not carelessness: a language treated in batch 1 was judged against roughly a third of the
cells that exist now, and each later batch discovered something that was applied only forward. The
inventory should be re-derived and re-run after each sweep — see #586 for the two-round proposal.

One method note that generalises: the inventory was built by reading rule-header comments, which is why
`exponent` was missed — that category lives in the manifests as `exponentWords` (24 languages), not in a
comment. **Data declarations are the harder signal.** `unitPer` (16 languages) should get the same check.

---

## Run 7 — 2026-07-31 — the artifact becomes the standard record

**Decision.** The retroactive fixes (#586) wait until every language has had a first pass — re-treating
the 37 now would measure them against *today's* inventory, which the remaining first pass will keep
changing, buying a third round rather than avoiding one. But the corpus process itself is used and updated
**as we go**, so the tail of round two is short.

**What that required.**

1. **The miner reads FLEURS directly** (`--in fleurs:<corpus>`), so a corpus-backed language produces the
   same artifact as a mined one. FLEURS is one utterance per line and already sentence-sized, so it is
   segmented as paragraphs — re-splitting would re-open the abbreviation-dot problem for no gain.
2. **The coverage audit is artifact-FIRST**, falling back to FLEURS only when no artifact exists. A
   language treated from a mined corpus is now checkable by exactly the same command as one treated from
   FLEURS — which is what lets Burmese, with no FLEURS data at all, appear in the same audit.
3. **The playbook makes it step 0b**, before reading anything by hand, with the four reasons the artifact
   beats an ad-hoc tabulation — chiefly that `covered N/29` and the `EMPTY:` line answer a question a hand
   count cannot, since you cannot count what you did not think of. Step 5d adds the DROP scan.

**Generated for all 38 treated languages.** 1.4 MB total, median coverage **22/29** cells.

**Nine languages sit below 20/29 from FLEURS alone:** ar 15, fa 16, cmn 17, ja 17, yue 18, hi 18, pa 18,
ur 18, ko 19. That is not a property of those languages — it is the #584 finding again, that read-aloud
news prose is symbol-poor. Those are the artifacts to supplement from a Wikipedia dump in round two, and
the numbers say which, which is exactly the kind of question that previously had no answer at all.

**Audit on artifacts: 36 defective cells across 22 of 38.** Slightly lower than the 38/24 measured against
full FLEURS corpora, because an artifact holds a bounded sample per cell rather than every utterance —
the artifact is a *tripwire*, and the full corpus stays the exhaustive check when one fires.

Burmese's own two residuals are both the deferral already recorded in Run 5: the `²` of `E = mc²` (a
formula, where "square" is not the reading) and a Japanese kana iteration mark quoted inside a table about
Japanese. Neither is a new gap.

---

## Run 8 — 2026-07-31 — script routing: a default reader per script

**Correction to Run 5.** I called `E = mc²` a case where "square is not the reading". That was sloppy —
"square" and "squared" are both ordinary English readings. The real question is whether a Burmese speaker
reads an embedded English formula in ENGLISH at all, which is a language-SELECTION question, not a wording
one. That reframing is what prompted this run.

**The finding, which is much larger than the kana case that raised it.** The foreign-run fallback handled
LATIN only, and `emitUnclaimed` said so outright: "Everything else in a gap … stays dropped exactly as
before." Measured:

```
Cyrillic inside Greek      Ο Πούτιν και ο Владимир   →  o putin ce o            Владимир GONE
Greek inside English       The word λόγος means word →  ðə wˈɝd mˈiːnz wˈɝd     λόγος GONE
Cyrillic inside Japanese   これは Москва です          →  Москва GONE
Greek inside Thai          คำว่า Ελλάδα คือ           →  Ελλάδα GONE
Latin inside Russian       Слово hello значит        →  works — Latin is the special case
```

**Every non-Latin third script was dropped entirely**, in every engine. A dropped run is invisible to
every leak-based check — nothing survives into the IPA to flag — the same blindness that hid the currency
drops in #584.

The choice was also duplicated: `getPhonemizer("en")` appears as the foreign reader at **44 registry call
sites** plus the global default. "Latin defaults to English" was a decision made 45 times and never
written down as one.

### The model

`core/scripts.ts`: a default reader per script, overridable per host language. The defaults are labelled
by confidence, because a near-deterministic mapping and a pragmatic guess should not look alike to whoever
edits it next — Greek/Hangul/Thai/Armenian/Georgian are nearly deterministic, Cyrillic→ru and Latin→en are
dominant, and **Han→cmn is explicitly pragmatic**, which is why `OVERRIDES` exists: a Han run inside
Japanese is Japanese, inside Korean it is hanja read as Korean.

Two guards that matter:

- **Self-routing is refused.** If the target equals the host, the router declines — otherwise the engine
  is handed back text its own tokenizer just refused, and recurses.
- **The host is a STACK, not a variable.** Reading a foreign run calls back into another engine, which
  re-enters the same wrapper; a plain variable is clobbered by the inner call and never restored. Depth is
  capped at 3.

Result: five of the six cases above now read. `Владимир` → `vɫɐdʲˈimʲɪr`, `Москва` → `mɐskvˈa`,
`Ελλάδα` → `elaða`.

### Recorded limit: a lone Greek letter is probably mathematics

`α`, `β`, `π`, `Δ` in Latin-script text are variables, and should be read as the host's letter NAME
("alpha", "pi") — not as a Greek word. The router cannot tell that from a one-letter Greek word, so it
requires two or more Greek characters before routing, and a single stray letter stays dropped. Doing
better needs a per-host letter-name table, which is lexical data belonging to the host language.

### What this does NOT fix

**Greek inside English still drops.** English has its own scan and never calls `emitUnclaimed` — its
tokenizer comment says "Non-Latin scripts stay unmatched, as before — English is not the engine for them."
**149 of 181 engines use the shared clause path**; the other 32 have bespoke scans and each needs the gap
pass added individually. English is the most-used engine, so it is the one that matters most, and it is
not done.

One test was superseded rather than fixed: `foreign-runs.test.ts` asserted that a third script stays
dropped. That was the deliberate scope of the original change; it is now the behaviour being removed.

---

## Run 9 — 2026-07-31 — do the 32 bespoke engines need their own scan?

**Question.** 149 of 181 engines use the shared clause path. Can the other 32 adopt it, or do they truly
need their own?

**Most of the 32 are not bespoke at all.** They are variant directories that delegate to a base engine.
Probing each with an embedded Cyrillic run separates them:

```
already fine (delegate to a shared-path engine):  as gu mr ne skr bho bpy awa mag mai hne rkt hyw pt-BR es-419
genuinely dropping:                               en en-GB en-IN · fr · yue wuu nan gan hak hsn cjy cdo · hmn · shi
```

So it is **four engine families**, not 32: English, French, Sinitic, Hmong, Tashelhit.

### The distinction that matters: TOKENIZATION vs the GAP PASS

English genuinely cannot use `assembleClauses` — that is a **streaming sink** model, and English is a
**two-phase pipeline**: it builds a token list, runs a POS tagger across the whole utterance, then
resolves each word with its tag. Neither shape can be expressed in the other.

But the gap pass is *separable from the clause model*. `burmese.ts` already makes exactly this split — its
own `exec` loop, with an explicit `emitUnclaimed` call for the gaps. So the answer is not "adopt the shared
path"; it is "the gap pass is a component, not a property of the clause model".

For English that meant a fourth token kind carrying **IPA rather than text**, because there is no English
pronunciation of Владимир to look up — it must bypass both the tagger and the resolver:

```
The word λόγος means word   →  ðə wˈɝd loɣos mˈiːnz wˈɝd
Vladimir Владимир Putin     →  vlˈæd̬əmɪɹ vɫɐdʲˈimʲɪr pʰˈuːt̬ɪn
Tokyo 東京 is big            →  tʰˈoᶷkiʲˌoᶷ toŋ˥˥ t͡ɕiŋ˥˥ ɪz bˈɪɡ
```

**The alignment hazard is the interesting part.** The tagger holds one expectation per English word, and
the resolver indexes it with a running counter. A foreign unit therefore contributes **no words** — if it
contributed one, every word after a foreign run would be tagged with its neighbour's part of speech and
could resolve to the wrong homograph (`read`, `lead`, `live`). There is a test for exactly that.

**Status: 3 of 14 affected codes fixed** (en, en-GB, en-IN). Still dropping: fr, the seven Sinitic codes,
hmn, shi. Each needs the same treatment, and each has to be read first — French's loop exists for liaison
across token boundaries, which is a real constraint the way English's tagger is.

### A judgement call worth flagging

`東京` in English text now reads as **Mandarin**, because `Han → cmn` is the documented pragmatic default.
For a Japanese place name in English prose the Japanese reading is arguably right, but nothing in the run
itself says which — Han is genuinely ambiguous, and that is precisely why that entry is labelled
`pragmatic` rather than `dominant` in `DEFAULT_READER`. An English-specific override could say
`Han → ja`, and would be wrong for Chinese names. Left as the default, recorded here.

---

## Run 10 — 2026-07-31 — French

Second of the four bespoke families. French's loop exists for a different reason from English's: **liaison
looks one word AHEAD** across the whole flattened stream, so the item list must be fully built before any
phonemes are produced. `assembleClauses` is a streaming sink and cannot express that. The gap pass is
separable from it, as it was for English.

A foreign run becomes a third item variant carrying **IPA rather than text**, and it must stay OUT of the
liaison machinery entirely — which is exactly why it is a variant rather than a `word` holding phonemes.

```
Le mot λόγος veut dire mot   →  lə mo loɣos vø diʁ mˈo
Vladimir Владимир Poutine    →  vladimiʁ vɫɐdʲˈimʲɪr putˈin
```

**The hazard, and it is French-specific:** `liaisonOnto` reasons from the lexicon, and a foreign run has no
entry — so a pending liaison consonant would be spliced onto foreign phonemes. Verified both directions:

```
les amis          →  le zamˈi              liaison intact where nothing intervenes
les Москва amis   →  le mɐskvˈa amˈi       no z donated to the foreign run
deux Москва ans   →  dø mɐskvˈa ˈɑ̃
```

The existing `next && "word" in next` guard already prevents the previous word from setting a carry onto
an `ipa` item, so nothing had to change there — the item variant made the invariant hold for free, which
is the argument for modelling it as a variant.

**Incidental finding.** `createFrench(foreign?)` has taken a `foreign` parameter all along, documented
"unused for now". It is still unused: French's word class `[a-zà-ÿœæ]+` claims Latin ITSELF, so embedded
English is read with French G2P (`Tokyo` → `tɔkjo`) rather than routed to English. That is arguably
correct — a French speaker reading French prose does pronounce a Latin-script loanword French-ly — so it
is recorded rather than changed.

**Status: 5 of 14 affected codes fixed** (en, en-GB, en-IN, fr, fr-CA). Remaining: the seven Sinitic codes
(yue wuu nan gan hak hsn cjy cdo), hmn, shi.

---

## Run 11 — 2026-07-31 — the Sinitic family

Third of the four bespoke families, and the opposite case from English and French: **these engines did not
need a bespoke scan at all.** Their loops were already exactly the shape `assembleClauses` takes —
`clauseSink()` plus an `exec` over a token regex — they simply predated the shared helper and were never
migrated. So they could adopt the shared path outright instead of hand-rolling a gap pass.

Five files, eight language codes:

```
sinitic/hanDictIpa.ts   shared by gan hak cjy hsn   ← one edit fixed four codes
cantonese/cantonese.ts  yue
wu/wu.ts                wuu
minnan/minnan.ts        nan
foochow/foochow.ts      cdo
```

All eight now read a run in a script they do not own:

```
yue  世界 Москва 好  →  sɐi˧ kaːi˧ mɐskvˈa hou˧˥
hak  世界 Москва 好  →  sz̩˥˧ kiaɪ˥˧ mɐskvˈa hau˧˩
```

The migration also DELETES code rather than adding it — the private `let m: RegExpExecArray | null` loop
goes away in each. Worth stating as the general lesson from these three runs: "this engine has its own
scan" was true of 32 directories, but on inspection it meant three different things — a delegating
variant (most of them), a genuine structural need (English's two-phase tagger, French's forward-looking
liaison), and simple historical drift (all five Sinitic files). Only the middle case justified private
code, and even there only for TOKENIZATION, never for the gap pass.

### One trade-off to flag rather than bury

Foochow is written in a LATIN romanisation (BUC) and its Han front-end is deferred, so its tokenizer does
not claim Han at all. `世界` was therefore a gap, and the router now reads it as **Mandarin** —
`ʂʐ̩˥˩ t͡ɕiɛ˥˩` — because `Han → cmn` is the documented pragmatic default. For a Min Dong engine that is
the wrong variety. It is still an improvement on dropping the characters silently, and the honest options
are all bad until `cdo` has a Han dictionary of its own: read it in the wrong variety, or say nothing.
Recorded here, not silently accepted.

**Status: 13 of 14 affected codes fixed.** Remaining: `hmn`, `shi`.

---

## Run 12 — 2026-07-31 — Min Dong rename, then hmn and shi

**Naming.** `foochow` → `mindong`. "Foochow" is Chinese Postal Romanization (c. 1900, the same family as
Peking / Canton / Amoy) — **dated rather than derogatory**, so the connotation worry is largely unfounded.
The reasons to change it are that it is not the language's modern name and that it was inconsistent with
its own sibling: `minnan` is Southern Min, so `cdo` should be `mindong`, Eastern Min. The repo's PROSE was
already modern throughout ("Min Dong / Eastern Min (cdo) — Fuzhou dialect"); only the directory and
identifiers lagged.

**"Foochow Romanized" is deliberately KEPT** wherever it names the orthography. Bàng-uâ-cê is called that
in the literature, and renaming it there would break traceability to the sources rather than modernise
anything. The rename script protects the string explicitly before substituting.

No API break: the language code `cdo` is unchanged and `createFoochow` was not part of the public surface.

**hmn and shi** were the same historical-drift case as the Sinitic set — `clauseSink()` plus a private
`exec` loop that only predated `assembleClauses`. Both migrated; both now read a script they do not claim.

```
hmn  kuv Москва 7  →  ku˧˦ mɐskvˈa ça˧
shi  kuv Москва 7  →  kuv mɐskvˈa sbʕa
```

### The sweep is complete

**All 15 affected codes fixed**, with a test that asserts the property directly rather than case by case:
no registered engine silently discards a run in a script it does not own.

Final tally of what "32 engines have their own scan" actually meant:

| | count | verdict |
|---|---|---|
| delegating variants | 15 codes | never had a problem |
| genuine structural need | 2 engines (en, fr) | private scan justified — for TOKENIZATION only; both got a gap pass |
| historical drift | 7 engines (5 Sinitic + hmn + shi) | migrated to the shared path; net DELETION of code |

Only two of thirty-two needed private code, and neither needed private *gap handling*. 2496 tests.

---

## Run 13 — 2026-07-31 — Norwegian Bokmål

The 39th normalization layer, and the first done under the artifact-first playbook (step 0b) rather than
by hand tabulation. `tools/corpus/mined/nb.jsonc` generated from `fleurs:nb_no` before anything else —
23/29 cells covered, which immediately named the ten defects rather than leaving them to be noticed.

### Ten defects, all fixed

```
5 000 000    ˈfɛm ˈnʊl ˈnʊl              → ˈfɛm mɪlɪˈuːnəɾ        (one numeral read as three)
1 250        ˈeːn ˈtuːhʉndɾə ˈfɛmtɪ      → ˈtʉːsn ˈtuːhʉndɾə …
12,5         ˈtɔl , ˈfɛm                 → ˈtɔl ˈkɔmɑ ˈfɛm        (a PAUSE inside a number)
kl. 14:30    kl . ˈfjʊʈɳ , ˈtɾɛtɪ        → ˈklɔkɑ ˈfjʊʈɳ ˈtɾɛtɪ
25 %         ˈtjʉːə ˈfɛm                 → … pɾʊˈsɛnt             (sign dropped)
20 °C        ˈtjʉːə ˈseː                 → … ˈɡɾɑːdəɾ ˈsɛlsɪʊs    (C as an English letter name)
3. mai       ˈtɾeː . ˈmɑɪ                → ˈtɾeːdjə ˈmɑɪ          (a SENTENCE BREAK mid-date)
24.08.2021   … . … . …                   → tjuefjerde august 2021
km²          ˈçiːlʊˌmeːtəɾ               → kʋɑˈdɾɑːtçɪlʊˌmeːtəɾ   (area lost)
¥2500        (bare number)               → 2500 yen
```

`5 000 000` also demonstrates the earlier magnitude-paradigm work landing: it reads *fem millionER*, not
*fem million*.

### Three measured disambiguations, each of which a plausible rule gets wrong

1. **The period form is NOT a clock.** `HH.MM` looks like the Norwegian written clock and 24 instances
   occur — but reading them shows dates (`24.08.2021`), technical strings (`802.11n`), a duration
   (`1:09.02`) and an English decimal (`9.174 mi²`). **Exactly one is a clock.** Only the colon form is
   claimed; the full `D.M.YYYY` shape gets its own rule instead.
2. **A comma is the decimal separator — except where it is not.** 34 decimals (1,2 · 12,8) against 5
   English-style thousands groupings that survived translation (23,764 · 291,773 · 755,688), all with
   exactly three digits after the comma. Splitting on that shape gets both right.
3. **The ordinal dot needs a following lowercase word.** 134 before lowercase, 13 before a capital.
   Norwegian month names are lowercase, so every date is caught while a sentence ending in a year is not.

### Gates

`tsc` clean; **2508 tests** (16 in the Norwegian file); referee **unchanged** at 23.0% folded backbone,
verified against a pristine worktree — as expected, since normalization touches `text()` and the referee
is word-level.

Corpus diff: **48 of 123 changed, 4 of 40 in the representative sample — all four improvements** (decimal,
clock+abbreviation, `f.eks.`, decimal). No regression this time, unlike the Burmese run where the sample
tier caught a date read as a range. DROP classes: percent 5→0, degree 1→0, currency 1→0.

### One thing removed rather than added

`kr` was in the currency map at first. Norwegian POSTPOSES it (`10 kr`), so a sign-before-amount rule could
never fire on it — and it already reads correctly because the lexicon maps the token `kr` straight to
[ˈkɾuːnəɾ]. **An entry that can never match is worse than no entry: it reads as coverage.** Removed, with
the reason recorded in the file.

Residual, both recorded not fixed: `DROP math-sign ×2` (a `>` in a temperature comparison) and
`DROP minus ×1` (`10.–11. århundre`, an en-dash between two ordinal dots — a range of ordinals, which
neither the range rule nor the ordinal rule claims).
