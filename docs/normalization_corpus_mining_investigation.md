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
