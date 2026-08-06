# Yoruba and Igbo cardinal numbers — sourcing assessment before building anything

Both languages read every digit in ENGLISH: `1945` → *wˈʌn θˈaᶷzənd nˈaᶦn hˈʌndɹəd fˈɔːɹt̬i fˈaᶦv*. The engines are
fine on words (`ọkan` → ɔ˧kã˧, tones correct); neither has a `numbers.ts`, so the Latin fallback — which for
Yoruba is literally an English phonemizer passed into `createYoruba` — swallows the digits.

⚠ A dropped `%` loses information. This produces FLUENT ENGLISH inside Yoruba speech, which for TTS is worse than
silence. 46M + 31M speakers.

## Run 1 — 2026-08-05 22:00 · a fleet-wide tooling bug found while probing

The first attempt to attest Igbo numerals returned nonsense — every candidate "attested, only 0.2% whole word":

    otu    294 tokens / 129,808 substrings      ← and the header said "⚠ SPACELESS SCRIPT"

Igbo is Latin script with spaces. `corpus-words.ts` decided otherwise because of

    const spaceless = utts0.some((u) => SPACELESS.test(u));

⚠ `some` IS CATASTROPHICALLY THE WRONG QUANTIFIER. One katakana character anywhere in the corpus flips the whole
language into spaceless mode — stripping every space and switching the hit test to substring matching. Igbo tripped
it on 2,472 of 558,991 lines (0.44%), all from a Digimon article quoting デジモン.

**69 of the fleet's 154 mined artifacts contain at least one CJK/SEA character**, so 69 languages were being
measured this way. Any Wikipedia that mentions a Japanese name qualifies. Replaced with `dominantScript` from
scripts.ts, which already answers the right question and derives it from the corpus rather than a table. After the
fix Igbo reads `otu 104,534 tokens` — 355x the previous count.

## Run 2 — 2026-08-05 22:05 · is there a dictionary, as there was for Khmer? No — and that matters

`google/language-resources` has km, and also **jv and su** (54,563 / 42,901 entries, CC BY 4.0, numerals included).
It has **no yo and no ig**. Wikidata labels are thin for Yoruba (1 of 10 integers) though better for Igbo (otu,
abụọ, atọ, anọ, ise, iri). kaikki's Yoruba extract is word→IPA with no glosses. **Igbo has no referee at all** —
wikipron ibo_latn, epitran ibo-Latn and the kaikki Igbo extract are all 404, per its own referee config, which also
records that "the vigesimal numbers are deferred".

⚠ AND I HAD IGBO'S SYSTEM WRONG. I described it as "decimal and much simpler" when recommending this target. Its
own config says vigesimal; both languages are vigesimal with subtraction.

## Run 3 — 2026-08-05 22:10 · openslr.org/86 is not a lexicon, and is valuable anyway

SLR86 is a crowdsourced Yoruba speech corpus, **CC BY-SA 4.0** (ShareAlike — acceptable here; `km-lexicon.tsv`
already derives from CC-BY-SA 3.0 wikipron. NC was the blocker, not SA). No pronunciation lexicon. But
`line_index_{female,male}.tsv` are 283 KB of transcripts, and for a TONAL language that is the interesting part:

| corpus | words | carry a tone mark |
|---|---|---|
| SLR86 transcripts | 31,221 | **70.4%** |
| yo Wikipedia dump | 3,801,752 | 50.7% |

**Zero digits** in 3,583 utterances — every number is spelled out, with tone: méjì ×45, mẹ́ta ×36, mẹ́rin ×14,
mẹ́sàn ×10, mẹ́fà ×10, Ọ̀kan ×8, méje ×8, márùn ×8. Yoruba tone is phonemic, so a numeral mined from the
half-untoned Wikipedia would phonemize wrongly; this settles the orthography for the frequent forms.

It is too small for the higher numerals (ogún ×10, ogójì ×2, ọgọ́ta ×1). Those come from the dump, where the
tone-marked forms ARE attested in quantity: ọgbọ̀n 467, ọgọ́rùn 629, ẹgbẹ̀rún 574, àádọ́ta 285, ogún 949, ogójì 144.
The two sources are complementary — SLR86 for tone on the common forms, the dump for the composition machinery.

## Where this leaves the work

Attested and usable:
  · Igbo units and tens — otu 104,534 · abụọ 57,990 · iri 44,831 · atọ 26,470 · narị 11,804 · ọgụ 5,445 tokens
  · Yoruba counting forms with tone (SLR86) and the tens/particles from the dump (dín "minus", lé "plus", the
    ọgọ́- multiples of 20, the àádọ́- subtractive halves, the -lá series for 11-14)

⚠ Honest limits before committing to a compositor:
  1. **Igbo has no referee.** Nothing independent can validate a composed numeral; the only anchor is the
     adjudicated gold in `test/igbo.test.ts` (Emenanjo 1978; Green & Igwe 1963).
  2. **The composition RULES are not attested the way the words are.** The corpus shows that dín and lé exist; it
     does not state which ranges take which. Deriving a 0–999,999 system from 1–12 token attestations of the
     higher forms would be inference dressed as evidence.
  3. Both systems are vigesimal with subtraction, so a partial table is not safely extensible.

The defensible shape is therefore: compose over the range the evidence supports, fall back to DIGIT-BY-DIGIT in the
native units beyond it (an established pattern here — chichewa's compositor does exactly that above 10⁶), and never
emit English again. That converts a confidently-wrong-language reading into a correct-language, unidiomatic one,
which is a strictly better failure and is fully sourceable today.

## Run 4 — 2026-08-05 22:10 · the dump WAS extensive enough, and I was too pessimistic

Run 3 concluded the composition rules "are not attested the way the words are" and proposed a bounded partial
compositor. Challenged on it — the dump is extensive — and testing rather than arguing showed the challenge was
right. The rules ARE attested, as phrases:

| Igbo pattern | reading | hits |
|---|---|---|
| `iri abụọ` | 20 (ten·two) | 7,814 |
| `iri atọ` … `iri itoolu` | 30 … 90 | 3,094 … 774 — the ENTIRE series |
| `iri na abụọ` | 12 (ten and two) | 2,613 |
| `iri na otu` | 11 | 2,056 |
| `puku abụọ` / `narị abụọ` | 2,000 / 200 | 1,099 / 492 |
| `otu narị` / `otu puku` / `otu nde` | 100 / 1,000 / 10⁶ | 1,347 / 1,256 / 479 |
| `nde` / `ijeri` | 10⁶ / 10⁹ | 6,983 whole-word / 1,709 |

⚠ **MAGNITUDE FIRST, and it had to be counted rather than assumed.** One corpus phrase — `otu nde`, "one million" —
looks multiplier-first and would have inverted the whole table. Counting both orders in every magnitude settles it:

    iri abụọ 7,814 : abụọ iri 82      narị abụọ 492 : abụọ narị 10
    puku abụọ 1,099 : abụọ puku 4     nde abụọ 77 : abụọ nde 7     ijeri abụọ 8 : abụọ ijeri 0

11:1 to 275:1. `otu nde` is the irregular MULTIPLIER-1 form, which is why `one` is stored apart from the series.

**And the corpus writes large numbers out in full**, which is how the structure was verified instead of inferred:

    "otu nde, puku narị anọ na otu, narị asatọ na iri asaa na atọ"   = 1,401,873
     1×10⁶       1000×401              800 + 70 + 3

The compositor reproduces that exactly, except that it joins magnitude groups with `na` where the corpus writes a
comma — a comma is not spoken.

⚠ **AND MY "IGBO IS VIGESIMAL, DEFERRED" FRAMING WAS MISLEADING.** The referee config's deferral is about the
TRADITIONAL vigesimal system, and `ọgụ` (a score) is genuinely current at 5,859 whole-word hits. But the decimal
`iri abụọ` outnumbers it 7,814 to 5,859 and is what composes regularly to arbitrary size. Both are Igbo; the
decimal one is what running text uses and what a compositor can be built on. Quoting the deferral as though it
blocked the work was wrong.

**Shipped:** `igbo/numbers.ts` + the manifest table, wired so digits can never reach the `foreign` (English)
fallback again, with digit-by-digit in Igbo units above 10¹² as the floor. `1945` now reads
*otu puku na naɾɪ itoolu na iɾi anɔ na ise*.

**Still open for Igbo:** `1,500` reads *otu , naɾɪ ise* — the grouping comma is not de-grouped, because Igbo has no
`normalize.ts` either. That is the normalization layer's job and is the natural next step; the compositor cannot
fix it, since it never sees the two halves as one number.

**Yoruba remains.** Its machinery is attested but unevenly — `lé` (additive) 598/756, `dín` (subtractive) 80/42,
`méjìlá` 258, `ọ̀kànlá` 3, `ẹ́ẹ́dógún` 0 — so the same phrase-counting method needs to run per form before a
compositor can claim the same footing. SLR86 supplies the tone-marked orthography for units 1-10.

## Run 12 — 2026-08-05 — the decimal word: corpus silence was not a refusal

Closing the Igbo normalization layer. Every reading in it is a corpus count, and one of them was a REFUSAL on the
strength of a count of zero — the decimal separator, declared "[NONE], no word exists to voice it, read the
fraction digit by digit". The probes behind that:

| probe | result |
|---|---|
| digit-point-digit with any separator word between | 0 |
| `ǹtụkpọ`, `ntụkpọ`, and every diacritic variant | 0 anywhere |
| `point` (whole word) | 89 — every one inside an English-language span in the Igbo wiki |
| `ntụpọ` | 552 — but the sense is a SPOT or blemish (`ndị nwere ntụpọ`) |
| `akara` | 16,476 — a mark or score; corpus writes `akara 2.3 na 2.7`, bare period |

Five probes, all negative, on a 558,991-line dump. I recorded it as `[NONE]` and shipped `2.5` → *abʊɔ ise*.

**That was wrong, and a dictionary settled it in one lookup.** Nkọwa okwu (nkowaokwu.com) gives `ǹtụ̀kpọ`, n.,
"decimal point; decimal number", with an example that is definitional rather than incidental:

    "E ji ntụkpọ ekewapụ nọmba nnuzuroke na nọmba ọgwa"
     ntụkpọ is used to separate whole numbers from fractions

**The generalisable finding, which is the reason this run is logged:** a WRITTEN corpus is close to no evidence
about how a SYMBOL IS SPOKEN. Writers type `2.5`; they never write out how they would say it. So the spoken word
for a symbol can be in universal use and score exactly zero, and the size of the dump does not help — 559k lines
bought no more evidence about this word than 559 would have. Khmer's `យូអាន` (yuan) was the same shape earlier in
this line of work: unattested, and correct.

That does NOT retroactively rescue the other refusals in the layer, and worth being clear about why. `mụba`
(multiplication) and `ntụpọ` were declined on their SENSE — the instances exist and mean something else — and
`pound` on ambiguity with the weight unit. Those stand on the corpus alone. Only a refusal resting on SILENCE
alone was vulnerable, and that is now the narrower rule: silence about a symbol's word means check a dictionary
first, and the smaller the symbol's written footprint the less the silence means.

**Shipped**: `"decimalWord": "ntụkpọ"` in the manifest with the citation beside it, read by rule 4. Untoned, like
every other word the layer emits — Igbo standard orthography omits tone and `igbo.ts` voices it only when marked,
so the toned headword would produce ˩ tones (n̩˩tʊ˩k͡pɔ) the corpus never writes.

    2.5      → abʊɔ ntʊk͡pɔ ise
    3.14159  → atɔ ntʊk͡pɔ otu anɔ otu ise itoolu     (fraction still digit-by-digit)
    8.3%     → pasent asatɔ ntʊk͡pɔ atɔ               (percent word still leads; rule order still load-bearing)

### And the sourcing gate was lying, through a door its own comment warned about

`review.ts` said `all 4 high-traffic words attested` for a word with 0 corpus hits. The needles are EXTRACTED from
`igbo.jsonc`'s `"decimalWord"`, and the attestation haystack `add()`ed every `.jsonc` in the language's directory
— including that same file. **A declaration was its own evidence.** Confirmed by substituting `zzqqxwood` for the
word: the gate passed that too.

The file already carries a long comment about exactly this hazard for the Wikipedia attest cache ("a
self-fulfilling haystack is worse than no haystack") and the manifests walked straight past it. Fixed: `.tsv` only
from a language's own directory (lexicons are human-verified word lists, independent of what a layer declares),
never `.jsonc`. Then, since a citation IS sourcing, `CITED_WORDS` in `defects.ts` — per word, per language,
requiring a citation string specific enough to go and check, mirroring `ACCEPTED_SIGN_SILENCE`. Fleet sweep of the
sourcing line across all 69 treated languages recorded below.

### Fleet measurement of the haystack fix — 12 languages had been self-attesting, and one probe destroyed evidence

Ran the `sourcing` line for all 69 treated languages twice, once with the manifests in the haystack and once
without (a throwaway copy of the tool for the before-state, deleted after):

| | before | after |
|---|---|---|
| `[ ok ]` | 60 | 48 |
| `[ ?? ]` (advisory — never affected the exit code) | 9 | 21 |

**12 newly exposed, and every single one is a decimal word**: as/bn `দশমিক`, fa `ممیز`, gu `દશાંશ`, hi `दशमलव`,
id `koma`, kn `ದಶಾಂಶ`, ml `ദശാംശം`, ne `दशमलव`, pt `vírgula`, tr `virgül`, ur `اعشاریہ`. That the exposed set is
exactly the decimal words is the fix confirming itself — a decimal word is the one class that lives in the
manifest as `"decimalWord"` and is extracted from the manifest as a needle, so it was the class that could
attest itself. 9 of the 12 were also absent from espeak's dictsource, so the manifest was their only "source".

**Then the gate's own advice destroyed data.** The `[ ?? ]` line says "wikipedia NOT probed — try
tools/normalization/attest.ts". Running it for hi wrote the cache from that run's findings ALONE:

    → tools/corpus/attest/hi.jsonc  (replaced 7 prior finding(s))

Seven Hindi findings gone (ऋण, गुणा, भाजित, घन, माइनस, बराबर, ऋणात्मक), each one a live Wikipedia fetch, and the
notice for it reads like a status line. `review.ts` feeds on that cache for its example prose, so following the
gate's advice for one word silently un-sourced seven others. Restored from git, then fixed: prior findings are
carried forward verbatim block-for-block, a word probed in this run wins, and the log now says what was kept.

With the merge fix in place, all 12 probed. Every one `attested`, 17–177 token hits across 9–20 articles, 0–1
substring-only:

    as দশমিক 78/14 · bn দশমিক 69/11 · fa ممیز 72/15 · gu દશાંશ 38/15 · hi दशमलव 39/9 · id koma 177/20
    kn ದಶಾಂಶ 18/10 · ml ദശാംശം 17/11 · ne दशमलव 38/9 · pt vírgula 158/16 · tr virgül 62/18 · ur اعشاریہ 67/19

All 12 back to `[ ok ]`, now on evidence outside the file that declares the word.

⚠ **And the honest limit on that, because the tool's own warning applies to me too.** Several examples attest the
ADJECTIVE sense rather than the separator slot — as/bn show `দশমিক সংখ্যা পদ্ধতি` ("decimal number system"), which
proves the word exists in the right semantic field and not that it is what a reader says at the point. Two are
stronger: hi has `दशमलव बिन्दु` ("decimal point") and `दशमलव भिन्न` ("decimal fraction"), and ur is unambiguous —
*صفر اور اعشاریہ کے بعد 3*, "after zero and the decimal point, 3". So this is an upgrade from "the manifest says
so" to "a weaker independent tier says the word exists and means something decimal", not a closed sense-check.
That is the wikipedia tier's documented ceiling, and `[ ok ]` on this line has never meant more than that.

## Run 13 — 2026-08-06 — Yoruba: the corpus glosses its own numerals, which is a labelled test set

Igbo is done; Yoruba is the remaining half of this document's original scope. Fresh 123,405-paragraph dump
(yowiki-latest, 27 MB of prose). Current state, and it is the worst failure mode in the fleet:

    1945      → wˈʌn θˈaᶷzənd nˈaᶦn hˈʌndɹəd fˈɔːɹt̬i fˈaᶦv     fluent ENGLISH inside Yoruba speech
    60%       → sˈɪksti                                          the sign dropped, the number English
    ₦500      → fˈaᶦv hˈʌndɹəd
    25 °C     → twˈɛnti fˈaᶦv k                                  ° dropped, C read as an English letter
    A & B     → a˧ b

⚠ **MY FIRST PROBE MEASURED THE WRONG POSITIONS AND REPORTED `%` AS ABSENT.** It counted `digitFlanked` (digit on
both sides) and `leading` (sign then digit) and nothing else — so `60%`, with a digit BEFORE the sign and nothing
after, fell between the two: `% flanked 0, leading 3`. A postfix sign needs a TRAILING count, and with one added
the same corpus reports **1,287**. Third instance this session of measuring a position or unit the thing does not
occupy (after km's writer-delimited tokens and the corpus-words dominance bug), and the first two were caught the
same way: the number was implausible and the instances were read.

Also `count.ts`'s `leading()` is O(n²) — it slices the whole text per match to strip whitespace — so on `.` and
`,` (20k+ matches × 21 MB) it never returned. Lookbehind is linear and is what the probe uses.

### The signs, once measured properly

| sign | flanked | trailing | leading | anywhere |
|---|---|---|---|---|
| `%` | 0 | **1,287** | 3 | 1,295 |
| `-` / `–` | 3,378 / 4,159 | 2,210 / 1,866 | 2,042 / 399 | 96,624 / 8,552 |
| `°` | 55 | **390** | 5 | 475 |
| `×` | 72 | 18 | 2 | 97 |
| `+` / `=` | 9 / 7 | 30 / 43 | 61 / 53 | 360 / 993 |
| `₦` / `$` / `£` / `€` | — | — | 85 / 593+117 / 141 / 95 | — |
| `&` | 31 | 4 | 5 | 2,093 |

Grouping is COMMA (1,829 lines vs 86 period-grouped) and the decimal separator a PERIOD (3,317 vs 71) — the
Nigerian convention, same as Igbo.

### ⚠ The corpus glosses its own numerals in digits, and that is a gold set

The dump repeatedly writes a numeral out and then repeats it in figures:

    ẹgbẹ̀rún méjì (2,000)        irinwó ó lé ọgọ́rin (480)        ìdá àádọ́ta nínú ọgọ́rùn-ún (50%)
    igba ó lé ọgọ́rin (280)      ẹgbẹ̀rún kan (1000)              ọgọ́rùn-ún lọ́nà mẹ́wàá (10%)

576 glosses extracted, 186 numeral phrases glossed CONSISTENTLY. That is a labelled test set written by Yoruba
writers, and for a vigesimal-subtractive system that no referee here covers it is the only thing that can
adjudicate a composed numeral. It reads off the machinery directly: magnitude-then-multiplier (`ẹgbẹ̀rún méjì`),
`kan` as the multiplier-1 irregular, `ó lé` as the additive particle (`irinwó ó lé ọgọ́rin` = 400+80), and the
`dín`/`lé` subtractive-additive teens and tens (`mẹ́tàdínlógún` = 17, `méjìlélógún` = 22, `mẹ́ẹ̀dógún` = 15).

⚠ **AND THE FIRST TWO ROUNDS OF "CORPUS CONFLICTS" WERE BOTH MY EXTRACTOR, NOT THE CORPUS.** Worth recording
because in each case the corpus looked unreliable and was not:

1. `ogún` glossed as 20 eight times and 20,000 three times. The 20,000 instances are `ẹgbẹ̀rún lọ́nà ogún` —
   **`lọ́nà` is the MULTIPLIER particle** ("thousand by twenty"). It was missing from my numeral-word list, so the
   phrase truncated to its last word. Same for igba (200/200,000), àádọ́ta (50/50,000), ọgọ́rin (80/80,000).
2. `ọgọ́rùn-ún` glossed as 2, 3, 25, 36, 50, 62, 64, 100 and fourteen other values. `nínú` is not a numeral word,
   so in `ìdá àádọ́ta nínú ọgọ́rùn-ún (50%)` the suffix truncated to `ọgọ́rùn-ún` and EVERY percent gloss in the
   corpus keyed onto that one phrase.

Plus two filters that are honest limits rather than bugs: a 4-digit value beside a short numeral is a YEAR
(`Ìlú kan (1975)` — `kan` is the ordinary word "a/certain", and produced eleven such pairs), 18 excluded; and a
gloss can be SCALED (`mílíọ̀nù márùn-ún ó lé irinwó ẹgbẹ̀rún (5.4)` is 5,400,000 written as millions), 8 excluded.

### ⚠ Two percent constructions, and the digit form settles which to emit

    ọgọ́rùn-ún lọ́nà mẹ́wàá (10%)       "hundred by ten"            115 instances
    ìdá X nínú ọgọ́rùn-ún (50%)         "portion X in a hundred"     94 instances (ìdá 79 + ìpín 15)

Near-parity on totals, so counting them settles nothing on its own. What settles it is the form writers use when
the number is a DIGIT rather than spelled out, which is what a normalizer produces:

    ìdá <digit> nínú ọgọ́rùn-ún    21
    ọgọ́rùn-ún lọ́nà <digit>        0

All 21 read correctly in context — `ìdá 84 nínú ọgọ́rùn-ún`, `ìdá 30 nínú ọgọ́rùn-ún epo rọ̀bì` — and one glosses
itself with the sign present: `ìdá 480 nínú ọgọ́rùn ún(480%)`.

⚠ So Yoruba's percent is a **CIRCUMFIX**: a word before the number AND a phrase after it. The shared symbol tier
supports prefix (`percentPrefix`, Igbo/Turkish) and the default suffix, but not both ends, so this belongs in
Yoruba's own normalize.ts — the same door Malay used for `peratus`.

## Run 14 — 2026-08-06 — the Yoruba compositor and symbol layer, and four measurement bugs of one family

### 11-99: generate every candidate spelling, then count it

The gold glosses give the SYSTEM (1-4 past a ten add, 5-9 subtract from the ten above) but not the spelling of
all 89 forms, and Yoruba fuses them into single words with a tone change in the base. So rather than guess the
fusion rule and ship it, each candidate was generated and counted. Four rounds, and ⚠ **every gap the first three
rounds reported was MY table, not the corpus**:

| round | gaps | what was actually wrong |
|---|---|---|
| 1 | 25 of 89 | `lélógún` missing from the 20-row, so 21-24 generated NO candidates at all — the tell was an empty "tried:" list |
| 2 | 9 | 1's fusing form is `mọ́kàn-`, not `ọ̀kàn-` (mọ́kànlá 171 : ọ̀kànlá 3; and for 39 and 59 the ọ̀kàn- form is ZERO while the m- form is 12 and 13) |
| 3 | 3 | the fused àádọ́- base keeps its à — `láàdọ́ta`, not `ládọ́ta`, which had ONE hit and was probably itself a typo |
| 4 | 3 | 90's fused base drops its final -ún: `láàdọ́rùn` (13 hits) where `láàdọ́rùn-ún` found nothing |

**86 of 89 attested**, and the remaining three (87, 91, 94) sit in the 90-band where every sibling has 1-3 hits,
with the rule attested on both sides of each gap. Scored end-to-end, **96 of the 99 forms the compositor emits for
1-99 occur in the corpus**, as do all nine hundreds and every thousand form.

⚠ **AND THE DUMP HAS DUPLICATE PARAGRAPHS — 123,405 → 112,738 unique.** That inflates precisely the rare forms
this table rests on. The gloss `mẹ́tàdínlọ́gọ́rin (75%)` appeared four times and read like corroboration; it is
ONE sentence repeated four times, and it contradicts the rule 86 other values support (mẹ́tà-dín-lọ́gọ́rin is
3-from-80 = 77). Everything above is counted on the deduplicated text.

### The symbol layer

    60%        → ìdá 60 nínú ọgọ́rùn-ún        the CIRCUMFIX (21 digit-form instances : 0 for the alternative)
    3.5        → 3 àti dásímà 5               `dásímà` = a borrowing of "decimal"; fraction digit-by-digit
    1967-1970  → 1967 sí 1970                 a digit-flanked dash is a RANGE
    ₦500       → 500 náírà
    US$83.33   → 83 àti dásímà 3 3 dọ́là Amẹ́ríkà
    100,000 km² → 100000 kìlómítà onígun mẹ́rin
    1945       → ẹgbẹ̀rún kan ó lé ẹ̀ẹ́dẹ́gbẹ̀rún ó lé márùndínláàdọ́ta   (was: wˈʌn θˈaᶷzənd nˈaᶦn hˈʌndɹəd…)

⚠ **`dásímà` WAS FOUND BY ACCIDENT.** The decimal candidate list probed native compounds — ààmì, àmì, ẹ̀là,
pọ́ìntì, ojú, ẹ̀ka — every one 0 between digits, and on that evidence this layer was about to declare the
separator unreadable. The word surfaced inside a percent extraction I was reading for another reason: 18
instances, unanimous on the frame `X àti dásímà <digits>`, with the fraction read digit by digit
(`bílíọ̀nù mẹ́rin àti dásímà ọ̀kan mẹ́rin` = 4.14 billion). **A guessed candidate list is a guess, and its zeros
measure the list, not the language.** Honest limit: all 18 cluster in one topic, so the frame's other half is what
supports it beyond that cluster — `àti` separating the halves appears in percent constructions from unrelated
articles (`ìdá mẹ́fà àti mẹ́ta nínú ọgọ́rùn-ún` = 6.3%).

⚠ **AND `ẹsẹ` WAS FOUND IN A DICTIONARY AND STILL REFUSED**, which is the distinction added to the playbook
yesterday working in the other direction. Fakinlede's Yoruba–English Mathematics Dictionary (2017) gives
`Ẹsẹ` = "decimal point" — but that glossary belongs to a project explicitly modernising Yoruba numerals for
science, and `ẹsẹ`/`ẹsẹ̀` has 478 whole-word hits in this corpus meaning FOOT or LEG in every one (`ẹsẹ̀ rẹ`,
`ọwọ́ àti ẹsẹ̀`, `ẹsẹ̀ bàtà`). `3.5` would read as "three feet five". A refusal on SENSE stands on the corpus
alone; it was refusal on SILENCE that needed the dictionary check.

### ⚠ Four measurement bugs, all one family: the tool measured a position or unit the thing does not occupy

1. **`%` reported as absent.** The probe counted `digitFlanked` (digit both sides) and `leading` (sign then
   digit) and nothing else, so `60%` — digit before, nothing after — fell between them: `% flanked 0, leading 3`.
   A TRAILING count finds **1,287**.
2. **`count.ts`'s `leading()` is O(n²)** — it slices the whole text per match to strip whitespace — so on `.` and
   `,` it never returned. Lookbehind is linear.
3. **`grep -oE "(^|[^A-Za-z…])igba([^A-Za-z…]|$)"` returned 0** for a word with 21 glossed occurrences: a
   hand-rolled NEGATED CHARACTER CLASS over multibyte text is byte-wise in ERE, so it matched half a codepoint.
4. **`[ọ́o]` in the trap-12 guard never matched.** A character class cannot hold `ọ́` — there is no precomposed
   codepoint, so the class held ọ, a bare combining acute and o as three separate members. The guard silently did
   nothing and `(60%)` beside a spelled-out circumfix was read twice. Fixed by folding marks away first.

Plus one in the engine wiring: handing a composed multi-word numeral to `phonemizeWord` ran the words together, so
`1945` came out as one 40-phone blob. One `emit` per word.

Also fixed while here: **`ìlọ́po méjì` is NOT the areal square.** It has 37 hits and looked like a competing
squared word, but measured against the unit nouns it is 0 after / 1 before, where `onígun mẹ́rin` is 15 after —
`ìlọ́po méjì` is "double/twice" generally. And **`US$` had to be declared as its own currency key**: the tier is
letter-bounded on the left so a bare `$` cannot match inside `US$83.33`, which was all six of the artifact's
dropped currency signs.

`review.ts --lang yo`: 8 of 9 checks pass, the artifact scan down from 58 dropped instances to 8 — 4 isotope
superscripts (`⁸C`) and 1 currency sign inside English-language spans, and 3 dashes of the `1492 - Francesco de
Layolle` shape, where a dash separates a year from a title and silence is correct. The foreign-span discriminator
is inert for a Latin-script language by construction, so those cannot be auto-excluded.

3,086 tests pass.
