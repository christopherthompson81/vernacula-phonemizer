# Balochi (bal / Southern, bcc) text-normalization investigation

Chronological log of the normalization run for `bal` — Southern Balochi, Balochi Arabic script (the engine
is cross-script: Arabic + a Roman orthography).

**The evidence situation, stated first, because it governs everything below.**

- **No FLEURS corpus.**
- **No referee at all**: kaikki = 0, wikipron = 0, espeak does not ship Balochi in any variety.
- **No Wikipedia.** `bal`, `bcc`, `bgn` and `bgp` all fail DNS on `*.wikipedia.org` and none appears in
  Wikimedia's `sitematrix`. Balochi lives only on **Wikimedia Incubator**, in four separate projects —
  `Wp/bal`, `Wp/bcc` (Southern), `Wp/bgn` (Western), `Wp/bgp` (Eastern).
- Balochi is a **macrolanguage**. The engine targets **Southern** (bcc). Western (bgn) and Eastern (bgp)
  text is recorded here as *labelled* evidence and never allowed to stand as Southern attestation.

So `attest.ts` (a CirrusSearch probe against `<lang>.wikipedia.org`) has no wiki to probe for this
language, and every "gate" below has to be read as either a real meter or a tripwire. Which is which is
stated per run.

---

## Run 0 — 2026-08-12 — what evidence exists at all

Question: before designing anything, what can actually referee a Balochi reading?

```
npx tsx tools/normalization/sources.ts --lang bal
  [NONE] letter-names     espeak does not ship this language at all
  [NONE] decimal-point    no _dpt, no _., no manifest word — read the fraction digit-by-digit
  [  · ] era-phrase / scale-names / percent-word / currency-word / fraction-series / every sign class
         → "no … in the corpus"   (there IS no corpus: `espeak: NOT SHIPPED · referee: none · corpus: none`)
```

```
curl … meta.wikimedia.org sitematrix                      → no Balochi project of any code
curl … bal|bcc|bgn|bgp.wikipedia.org                      → DNS failure (exit 6) for all four
curl … incubator.wikimedia.org prefixsearch Wp/<code>     → all four exist
  Wp/bal  102 pages (titles largely ROMAN: "Lílok", "Bunták", "Ballàtin e Gàlband", some Arabic)
  Wp/bcc  ≥500 pages (Arabic script — "ایران", "سیستان")        ← Southern Balochi, the target
  Wp/bgn  ≥500 pages (Arabic script)                             ← Western, off-target
  Wp/bgp   17 pages (Roman: "Balócistán")                        ← Eastern, off-target
```

Raw finding: the only Southern-Balochi text corpus that exists anywhere reachable is an Incubator project
of a few hundred pages. Implication: the corpus artifact must be mined from the Incubator dump with
`wikidump-to-text.py --title-prefix "Wp/bcc/"` — the route `cjy` and `hsn` already use — and the Western
and Eastern projects must be extracted *separately* so that no bgn/bgp sentence can be miscounted as
Southern evidence.

## Run 1 — 2026-08-12 — building the corpus, and how much of it is not Balochi

Question: the four Incubator projects are one wiki namespaced by title. How much Southern-Balochi text is
actually there, and is it Balochi?

```
python3 tools/normalization/wikidump-to-text.py incubator.xml.bz2 <out> --title-prefix "Wp/<code>/" --jobs 4
  Wp/bcc  527,854 pages seen →  5,917 paragraph lines   ← SOUTHERN, the target
  Wp/bgn                     →  7,196                    ← WESTERN
  Wp/bal                     →    599                    ← macrolanguage code, Roman-heavy
  Wp/bgp                     →      7                    ← EASTERN
```

Top tokens of the raw Wp/bcc text were the tell: `در`×487 `که`×444 `به`×415 `از`×413 `می`×294 `های`×245
`است`×228 `این`×161 `را`×173 — that is a **Persian** frequency profile, not a Balochi one.

`filter-by-language.py` had no `bal` row, so one was written. Building it took three passes and each failure
is worth keeping:

1. **A first marker list containing `بلوچی`/`بلوچستان` scored whole URDU articles as Balochi** — Wp/bcc's
   tribal-history pages are in Urdu and are *about* Balochistan. A topic word is not a language marker; the
   row now contains function words and verb stems only.
2. **`تھا` looked like the Urdu past tense and is Balochi `tahā` "in"** — ×89 inside unambiguous Balochi in
   Wp/bgn (`آسیاءِ تھا`, "in Asia"). Putting it in the Urdu contrast set would have discarded the most
   Balochi paragraphs in the corpus. Trap 34: read the instances.
3. **The Persian contrast set had to be measured, not assumed.** Counted over the strongly-Balochi
   paragraphs of both projects: `که`×1273 `به`×2688 `تا`×1464 `یا`×148 `هم`×234 `و`×7300 `یک`×1715 are all
   ordinary Balochi and are excluded; `از` — which looks equally shared — is ×413 in raw Wp/bcc and **×3 in
   103k tokens of Balochi**, because Balochi says `چہ`/`شه`. It is the sharpest discriminator in the set.

Result, after `filter-markup.py` then `filter-by-language.py --lang bal`:

```
Wp/bcc   kept 383 (6.5%)   dropped: contrast 336 (5.7%)   undecidable 133   short 5,065
Wp/bgn   kept 2,747        dropped: contrast 640          undecidable 238
```

Over paragraphs long enough to judge, **37.4% of Southern Balochi's only corpus is Persian or Urdu** — worse
than `bar`'s 24% German and `ht`'s 15.1% French.

Implication: the committed artifact is mined from **Wp/bcc only**. Wp/bgn is four times larger and covers
24/35 cells against Southern's 16/35, and it is *Western* Balochi — it is used below as a labelled second
opinion on ORTHOGRAPHIC conventions and never as the source of a word.

## Run 2 — 2026-08-12 — the artifact, and what the engine does with it

```
npx tsx tools/normalization/mine.ts mine --in <bcc.bal.txt> --out tools/corpus/mined/bal.jsonc --lang bal \
    --segment paragraph --per-cell 6 --sample 40 --source "…"
  378 unique paragraphs → 51 hard + 40 sample, covered 16/35 cells
```

The populated cells are the whole shape of this language's problem: `zero-width` 88, `digit-run` 71
(**an ASCII-only `\d` would find 13 of them** — Balochi writes ۰-۹), `year` 68, `latin-in-native` 47,
`abbrev` 35, `letter-name` 7, `initialism` 6, `ranges` 3, `era-marker` 3, `dotted` 3, `decimals` 2,
`signs` 2, `grouped` 1, `fractions` 1, `ampersand` 1, `quote-letter` 1. Degrees, clock, units, currency,
percent, rate, exponent, roman, ordinals: **zero**.

`mine.ts scan` → `DROP currency ×2` (a Bitcoin ₿), `DROP math-sign ×1`, `DROP ampersand ×1`. Baseline
`corpus-diff emit` → **85 utterances**, taken before any edit.

`referee-eval.ts bal` → **not a registered code at all**; there is nothing to measure and there never was.

Probing the engine on real corpus shapes (playbook step 2):

```
2.5           → d̪oː . pant͡ʃ                the decimal point is a PAUSE
12,000        → d̪uwaːzd̪ah , sifr           grouping comma → pause, and the tail reads "ZERO"
۶۵۲،۸۶۰       → ʃiʃ sad̪u pand͡ʒaːhu d̪oː , haʃt̪ sad̪u ʃast̪     same, with the Arabic comma
۳/۸ ملیون     → sai haʃt̪                   the Iranian decimal slash, read as two cardinals
٪۵۰ / 50%     → pand͡ʒaːh                   the percent sign is SILENT
A & B         → a b                         the ampersand is SILENT
۱۹۱۷ / 1917   → hazaːru noː sad̪u habd̪ah    ✓ native digits already fold at the registry
```

Implication: the numeric classes are small (2 decimals, 4 grouped, 2 percent signs) — and they are *not*
where this language's damage is. That turned up next.

## Run 3 — 2026-08-12 — the reading defect that is 39% of the corpus

Question (the `ug` hazard, asked explicitly): does any letter fall outside the engine's token class or its
inventory, and read as nothing?

Tabulating every character in the corpus against `balochi.jsonc` and against the engine's token class
`[ؠ-ۿ]` = U+0620–U+06FF:

```
ہ  U+06C1  ×813   HEH GOAL                         in the token class, NOT in the manifest → deleted
ۏ  U+06CF  ×578   WAW WITH DOT ABOVE               "                                       → deleted
ݔ  U+0754  ×506   BEH WITH TWO DOTS BELOW+ABOVE    OUTSIDE the token class → deleted AND splits the word
ګ  U+06AB  ×256   KAF WITH RING                    → deleted
ؤ  ×77 · ك ×45 · ړ ×25 · ې ×21 · ډ ×18 · ټ ×17 · ي ×16 · ۇ ×13 · ښ ×10 · ۍ ×3 · ۓ ×2 · څ ×2 · ځ ×2
presentation forms U+FB50–U+FEFF  ×110 across 5 segments
```

```
وڈݔن   → "wɖ n"      the letter vanishes and the word FRAGMENTS
شݔر    → "ʃ r"
ﻫﻨﺪ    → ""          the whole word, as ug's 8 segments did
```

**149 of the 383 Southern paragraphs (38.9%) contain ݔ.** This is the largest reading defect in the corpus
and, exactly as ug found, it is invisible to every DROP class — they hunt a symbol that SURVIVES.

What the letters are, sourced twice over. Wikipedia's *Balochi alphabets* gives the Balochi Standard
Alphabet (Balochi Academy Sarbaz, 32 letters): **ݔ "Cappi Yà" is the initial/medial form of long ē, whose
final form is ے "bari ye"**, and **ۏ "Cappi Wà" is long ō**. The corpus and this repo's own lexicon confirm
both independently:

```
ݔ word-final ×2, non-final ×489     — matches the positional claim exactly
ݔ ≡ ی  32 self-gloss type pairs      مزنݔن/مزنین 17/32 · انگرݔزی/انگریزی 26/3 · گݔشتر/گیشتر · نݔست/نیست
ۏ ≡ و  19 self-gloss type pairs      گۏن/گون 63/6 · بلۏچستان/بلوچستان 21/23 · کۏہ/کوہ · تۏک/توک
ګ ≡ گ  21 pairs · ہ ≡ ه  28 pairs (کہ/که 201/162) · ك ≡ ک 12 · ؤ ≡ و 15 · ي ≡ ی 5
balochi-lexicon.tsv: نیمگ→nēmag /neːmaɡ/ (corpus نݔمگ) · بلوچ→balōč · روچ→rōč · کوه→kōh (corpus بلۏچ رۏچ کۏہ)
```

So the corpus **glosses its own orthography**, which is the strongest attestation there is and the same one
ug's era table rests on.

⚠ **ډ ټ ړ ښ څ ځ ۍ are PASHTO**, and reading their instances is what says so: `وکړ`, `وګړي`, `پیړۍ`, `لري`,
`يې`, `چې`, `پېښليک`, `خوښ`, `پوځي` — Pashto text quoted inside Wp/bcc's Afghanistan articles. ډ ټ ړ carry
the SAME retroflex values in both languages (ɖ ʈ ɽ = Balochi ڈ ٹ ڑ), so folding them is safe whichever
language the token is in — and `جوړ`/`جوڑ` ×11/×1 is a Balochi self-gloss pair for one of them. ښ (/ʂ~x/),
څ (/t͡s/), ځ (/d͡z/) and ۍ (/əi/) are Pashto-only phonemes with no Balochi value, ×17 together: **declined**,
they stay unread.

Implication and the split between homes (playbook step 3 — fix the defect where it lives):

- **ݔ and ۏ are letters the manifest LACKS and that carry a distinction it declares unrecoverable.** They
  belong in `balochi.jsonc`, with the token class widened to reach U+0754.
- **Everything else is an orthographic VARIANT of a letter the manifest already has** (ug's ه→ھ shape).
  Those belong in `normalize.ts`.
- Lexicon-first, because the two are in tension: `نݔمگ` folded to `نیمگ` is a lexicon hit and returns the
  full-voweled *neːmaɡ*, while `نݔمگ` read through a new ݔ→eː rule returns the skeleton *neːmɡ*. Measured
  over the corpus, lexicon hits go **875 → 1,101 tokens (+25.8%)** when the fold is tried against the
  lexicon and harakat are stripped for the lookup.

## Run 4 — 2026-08-12 — sourcing the words, and the one that is Western-only

Question: which of the classes the corpus contains can be given a WORD, and from where?

| class | Southern (Wp/bcc) | Western (Wp/bgn) | verdict |
|---|---|---|---|
| percent | `٪` ×2, word ×0 | `فیصد` ×14 **in slot** | **declined** — Western only |
| era `ھ.ق` | abbrev ×4, `هجری کمری` ×3 | `هجری قمری` ×3, `کمری` ×0 | **adopted**, Southern spelling |
| era `ق.م` | abbrev ×1, `پیش چه میلاد` ×1 | ×0 | **adopted** |
| era `ھ.ش` | abbrev ×0, `هجری شمسی` ×2 | ×5 | **declined** — no abbreviation to claim (trap 9) |
| decimal point | no word in either | no word in either | **declined** — substitute a space |
| currency ₿ / `&` / `+` | ×1 each | — | **declined** — none is the class it looks like |
| range connective | ×3 dashes; `شه … تا …` written out | same | **declined** — a circumfix is not an infix |
| initialisms | ×6, all inside `(پہ انگرݔزی: …)` | — | **declined** — English text, and no letter table |

Two things this table is doing that a single-corpus run would not:

- **`کمری` with ک is the Southern spelling and `قمری` the Western one**, ×3/×0 each way. That is exactly
  what this engine's own manifest predicts (ق→k, no native /q/), and it is the payoff for keeping the two
  projects apart rather than pooling them for volume.
- **The percent refusal is the one the brief warns about.** `فیصد` is real, frequent and in the right slot
  — in the *wrong variety*. The Southern candidate `سدی` ×1 is the CENTURY (`دھمی سدی ءَ`), the same shape
  as ug's `تەڭ` and Fula's `hakkunde`. A silence-based refusal needs a dictionary check, so one was tried:
  webonary.org's Balochi dictionary is dialect-labelled and would have settled it, and returns **HTTP 403**
  to a fetch; the Balochi Academy Sarbaz site surfaced no entry. The check ran and did not resolve, which is
  not the same as not running it.

`attest.ts --lang bal` exits with `bal.wikipedia.org does not respond as a wiki — a negative from here is
NOT evidence`, and writes no cache. That is the correct failure and it is the honest state of this gate:
**there is nothing to probe**. Pointing `--wiki` at `incubator` was considered and rejected — an Incubator
search spans every incubating language at once, so every hit would be trap 34 by construction.

## Run 5 — 2026-08-12 — the layer, and what it changed

Written: `src/languages/balochi/normalize.ts` (variant fold, de-grouping, era, decimals), plus two
manifest letters and one clause mark in `balochi.jsonc`, plus the Arabic Supplement in the engine's token
class. `corpus-diff compare` over the committed artifact:

```
changed 67/85 (78.8%)
  before  { DIGIT: 0, SLOT-GAP: 0, RAWMARK: 0, DROP: 3, THROW: 0 }
  after   { DIGIT: 0, SLOT-GAP: 0, RAWMARK: 0, DROP: 3, THROW: 0 }
```

DROP stays 3 and that is the intended outcome, not an unfixed defect: the three are the ₿, the `+` and the
`&`, each declined above and now recorded per-instance in `ACCEPTED_SILENT` and per-class in
`ACCEPTED_SIGN_SILENCE`.

**One rule was wrong and the corpus diff is what said so.** The era pattern `[ھه]\s?\.?\s?ق` claimed
`1355ھ. ق.` and silently missed `1373ﻫـ .ﻕ.` — U+0640 TATWEEL, and the dot on the far side of the space.
It typechecked, ran, and covered one instance of four. No probe would have found it; reading the diff did.
Fixed with an explicit `[ـ\s]*\.?[ـ\s]*` separator (elongation cannot follow a digit, so admitting it is
safe), and both forms are pinned in `test/balochi.test.ts`.

## Run 6 — 2026-08-12 — the labelled Western regression check, word by word

`attest.ts` cannot run and the artifact is 85 utterances, so the layer needed a second, larger ruler. A
pinned baseline worktree at the pre-change commit (the playbook's fan-out recipe — never `git stash`) was
run against BOTH corpora, with Western labelled as such:

```
                      BEFORE                                AFTER
Wp/bcc  (Southern)    383 lines, 0 empty, 0 threw,  84,245 IPA chars →  87,343  (+3.7%)
Wp/bgn  (Western)   2,747 lines, 0 empty, 0 threw, 761,766 IPA chars → 768,528  (+0.9%)
```

Then per WORD TYPE over the Southern corpus, which is the measurement that matters for a fold:

```
4,244 types · 636 changed (15.0%) · newly EMPTY 0 · no-longer-empty 5 · readings that got SHORTER 9
```

- **The five recovered from the empty string** are `يې`, `ګټ`, `ۇ`, `ۏ`, `ݔ` — words that consisted only of
  letters the g2p deleted.
- **The nine that got SHORTER are the interesting ones, and they are an improvement.** `مزنݔن` read
  *mazan n* before and reads *mzneːn* now. The old reading looks richer because the deleted ݔ SPLIT the
  word, and the orphaned prefix `مزن` happened to be a lexicon headword (*mazan*) — so the short vowel came
  from a fragment that was never the word, beside a stranded bare `n`. The new reading is one word with the
  right vowel quality and no stray consonant, minus the short /a/ the abjad does not write. An accidental
  lexicon hit on half a word is not evidence, and losing it is the fold working.
- **Zero types regressed to silence, in either variety**, which is the property the fold had to have.

**The lexicon-first respelling was audited exhaustively rather than sampled**: every word in the corpus that
the fold rewrites into a lexicon hit was listed and read — 23 types, 185 tokens, and all 23 are correct
(`گۏن→گون` ×63, `بلۏچ→بلوچ` ×22, `ګون→گون` ×21, `رۏچ→روچ` ×17, `نݔمگ→نیمگ` ×8, `گچݔن→گچین` ×4, …). The
only questionable member is `کې→کی` ×8, which is Pashto `ke` inside Pashto quotations being read as the
Balochi `kai`; it was a bare `k` before, so nothing got worse.

## Gates — before / after

| gate | before | after |
|---|---|---|
| `npx vitest run` | 3740 pass | 3746 pass (11 in `test/balochi.test.ts`, was 4) |
| `npx tsc --noEmit` | clean | clean |
| `referee-eval.ts bal` | **not a registered code — nothing to measure** | unchanged |
| `corpus-diff` | DROP 3 / 85 utterances | DROP 3, **67/85 changed** |
| `mine.ts scan` | DROP currency ×2, math-sign ×1, ampersand ×1 | same, now all three accepted with reasons |
| `review.ts --lang bal` | `[FAIL] normalizer missing` | **checklist clean**, `sourcing` still `[??]` |
| `sources.ts --lang bal` | `corpus: none` | `corpus: 91 lines`; 2 `chk?` (₿, `&`), both declined |
| `attest.ts --lang bal` | — | **refuses: no wiki exists at any code**; writes no cache |
| `languageCatalogue.test.ts` | stale by 1 cell after the change | regenerated, passes |

**Which of these are real meters and which are tripwires** — the honest accounting for a language with no
referee:

- **Meters**: the corpus diff (85 utterances, read by hand), the word-type diff over 4,244 types, the
  labelled Western run over 2,747 paragraphs, and the exhaustive audit of the 23 lexicon respellings. Each
  compares two engine states over real Balochi text.
- **Tripwires only**: `review.ts` (it checks that things are wired and that no class is silently dropped —
  it cannot tell whether a Balochi reading is right), `mine.ts scan` (a differential that is blind to a
  letter that VANISHES, which is what this language's whole defect was), `tsc`, and the catalogue test.
- **Not available at all**: `referee-eval.ts` and `attest.ts`. Nothing in this run was checked against a
  human transcription of Balochi, because no such resource exists in or out of this repository. The
  strongest evidence available is the corpus glossing its own orthography, and that is what every letter
  claim here rests on.
