# Swedish (sv) text normalization — investigation log (#562)

Corpus: FLEURS `sv_se`, `train+dev+test`, **column 3 (original cased)**, de-duplicated → **1,863 unique
utterances**. All counts below are over that file unless stated.

## Run 1 — 2026-08-02 — what does the corpus actually write?

**Command**
```sh
cut -f3 $FLEURS/sv_se/{train,dev,test}.tsv | sort -u > col3.txt
grep -oP '[^\p{L}\p{N} ]' col3.txt | sort | uniq -c | sort -rn
```

**Raw finding — the whole non-alphanumeric inventory**

```
2169 .    1484 ,    886 "    319 -    156 )   156 (    75 :    37 ;    20 /
  16 –     15 ”     11 ?     10 !     9 '      3 $       3 %      2 °      2 ]
   2 [      2 +      2 &      1 —
```

`²` is **absent from that list because `\p{N}` includes it** — the corpus does contain `19 500 km²` and
`3 850 km²` (2). Caught only by re-grepping; a first pass concluded "no exponents".

**The decisive negative result: SWEDISH DOES NOT WRITE THE ORDINAL PERIOD.**

```sh
grep -oP '(?<![\d.])\d{1,4}\.(?!\d)'          col3.txt | wc -l   # 44
grep -oP '(?<![\d.])\d{1,4}\.(?=\s+\p{Ll})'   col3.txt | wc -l   # 0     ← the nb/da/de rule
grep -oP '(?<![\d.])\d{1,4}\.(?=\s*$)'        col3.txt | wc -l   # 39
grep -oP '(?<![\d.])\d{1,4}\.(?=\s+\p{Lu})'   col3.txt | wc -l   # 4
```

All 4 pre-capital instances read as sentence ends (`… Zachary Cuddeback, 21. Cuddeback var förare.`,
`… 4:41,30. Det var …`, `… norr om 1770. De kan …`, `… 5 september 2021. Vissa …`). **Zero of the 44 are
ordinals.** So the largest rule in Norwegian (134), Danish (112), German and Luxembourgish is *deliberately
absent here*, and no rule in this layer may touch a digit followed by a bare period. Swedish writes the
ordinal with the COLON suffix instead (`1:a`, `3:e`, `37:e`).

**The colon has five jobs, counted**

| shape | count | example |
|---|---|---|
| genitive/inflection on an initialism | 16 | `USA:s` ×8, `FN:s`, `TV:n`, `NASA:s`, `UNESCO:s`, `USOC:s`, `NBA:s`, `TT:n`, `Luno:n`, `II:s`, `Il-76:or` |
| clock `HH:MM` | 7 | `12:00`, `07:19`, `23:35`, `8:46`, `11:00`, `11:29`, `21:19` |
| ordinal suffix `N:a` / `N:e` | 5 | `1:a` ×2, `3:e`, `7:e`, `37:e` |
| sports/duration `M:SS,hh` | 3 | `4:41,30`, `2:11,60`, `1:09.02` |
| score `N:N` | 2 | `3:2`, `2:2` |
| clause colon (list / quote) | rest | already `,` in `clausePunctuation` |

**Implication** — a colon-clock rule keyed on a bare `:` misfires on all four other jobs. The clock needs
two digits of minutes; the score has one; the suffixes have letters.

## Run 2 — 2026-08-02 — the period's other jobs, and the clock Swedish actually writes

```sh
grep -oP '(?<!\d)\d{1,3}\.\d{3}(?!\d)' col3.txt | wc -l   # 0  ← NO period thousands grouping (unlike da/de)
grep -oP '(?<![\d.])\d+\.\d+(?:\.\d+)*'  col3.txt | sort | uniq -c | sort -rn
```

```
5 802.11    1 9.30  1 7.30  1 6.30  1 23.00  1 2.30  1 22.00  1 20.30
1 15.00     1 11.20 1 1.1   1 10.08 1 09.02  1 01.15
```

**Swedish writes the clock with a PERIOD, and more often than with a colon**: 12 period clocks
(`kl. 20.30`, `Klockan 11.20`, `Klockan 01.15`, `kl. 10.08`, `kl. 9.30 lokal tid (2.30 UTC)`,
`mellan 6.30 och 7.30`, `Mellan 22.00–23.00 MDT`, `(15.00 UTC)`, `kl.12.00`) against 7 colon clocks.
This is the OPPOSITE of the nb and da findings, where the period form was dates / a Wi-Fi standard and only
the colon form was claimed. Non-clock `d.dd` shapes here: `802.11` ×5 (three digits before the dot, so a
`(?<!\d)\d{1,2}` anchor excludes it), `1.1` (a figure number — only one digit after the dot), `09.02`
(inside the sports time `1:09.02`, so the sports rule must run first).

Current reading of `kl. 20.30`: `kl . ɕˈʉ̀ːɡɔ kˈɔ̀mːa treː nɔlː` — **the clock is read as a DECIMAL**
(`swedish.ts`'s TOKEN is `\d+(?:[.,]\d+)?`), plus `kl` as two bare consonants and a spurious sentence break.

## Run 3 — 2026-08-02 — grouping, and the three-decimal trap

```sh
grep -coP '\d[   ]\d{3}(?!\d)' col3.txt      # 37 space-grouped
grep -oP  '(?<!\d)\d+,\d+' col3.txt | wc -l            # 32 comma
grep -nP  '(?<!\d)\d+,\d{3}(?!\d)' col3.txt            # 3 lines, 9 instances
```

The 9 comma-plus-three-digits instances are ALL English-style thousands grouping that survived
translation, and two of the three lines are not the obvious ones:

- `… upptar 783,562 kvadratkilometer (300,948 sq mi), av vilka 755,688 … (291,773 sq mi) … 23,764 … (9,174 sq mi) …`
- `… Johnson på andra plats med 2,243.` — **NASCAR points**, i.e. 2243, not 2.243
- `… är femte respektive sjätte med 2,220 och 2,207 poäng.` — same

So Swedish has **zero** genuine three-place decimals here and the nb guard ("exactly three digits ⇒
grouping") is safe. Reading it as a decimal today: `23,764` → `ɕˈʉ̀ːɡɔtrɛ kˈɔ̀mːa ɧʉː sɛks fˈỳːra`.

Space grouping is the bigger defect: `1 400 människor` → `ɛtː fˈỳːrahɵndra` (the leading 1 spoken as its own
numeral), `5 000 000` → `feːm nɔlː nɔlː`, `24 000` → `ɕˈʉ̀ːɡɔfʏra nɔlː`.

## Run 4 — 2026-08-02 — the largest single defect is the century, not the ordinal

```sh
grep -oP '\d+-\p{Ll}[\p{Ll}]*' col3.txt | sort | uniq -c | sort -rn
grep -coP '\d+-tal' col3.txt        # 37
```

`NNNN-talet` ×37 (`1400-talet` ×5, `1500-talet` ×4, `1970-talet` ×3, `1800-talet` ×3, `1300-talet` ×3, …
`1900-tal`, `1700-talsmarknaden`, `1000-talet`, `1100-1200-talet`). Current reading:

```
1400-talet  → ˈɛ̀tːɵsɛn fˈỳːrahɵndra tˈɑːlɛt
```

Three defects in one: the year is read in the FULL cardinal style (*ettusen fyrahundra*) where Swedish reads
a year in hundreds (*fjortonhundra*); the compound is split into three words where Swedish has one
(*fjortonhundratalet*); and the hyphen is dropped rather than fused.

## Run 5 — 2026-08-02 — the initialism seam (trap 16)

```sh
grep -oP '(?<![\p{L}])[A-ZÅÄÖ]{2,6}(?![\p{L}])' col3.txt | wc -l        # 168 instances
grep -oP '(?<![\p{L}])[A-ZÅÄÖ]{2,6}(?![\p{L}])' col3.txt | sort -u | wc -l   # 92 distinct
```

Top: `USA` 27, `TV` 9, `OS` 6, `FN` 4, then `UTC` `USD` `MS` `GPS` `FBI` `DNA` `AOL` `AI` 3 each.
Current readings, probed: `TV`→[tv] `DVD`→[dvd] `BNP`→[bnp] `GPS`→[ɡps] `UTC`→[ɵtk] `USD`→[ɵsd]
`GBP`→[ɡbp] `MS`→[ms] `GHz`→[ɡhs] `MDT`→[mdt] `fvt`→[fvt] — vowel-less clusters, exactly the class
`src/core/initialisms.ts` exists to prevent. 23 languages already wire it. **In scope.**

`espeak-ng/dictsource/sv_list:12-36` carries the letter-name table ("character names"), and lines 328-330
carry `usa u-Es'A:` **and `usa:s u-Es'A:s`** — which sources both that `USA` is read as LETTERS in Swedish
and that the colon-genitive glues its `-s` onto the last letter name with no pause.

## Run 6 — 2026-08-02 — probing the engine on every attested form (the defect list)

`npx tsx probe.mts` over 120 attested forms through `phonemize(form, "sv")`. Raw findings, the ones that
became rules:

```
1400-talet      → ˈɛ̀tːɵsɛn fˈỳːrahɵndra tˈɑːlɛt     (37)  full cardinal, 3 words, hyphen dropped
år 1945         → oːr ˈɛ̀tːɵsɛn nˈìːɔhɵndrafʏʈɪɔfɛm (~85) not the hundreds reading
1 400 människor → ɛtː fˈỳːrahɵndra mˈɛ̀nːɪskɔr      (37)  leading 1 spoken as its own numeral
5 000 000       → feːm nɔlː nɔlː
kl. 20.30       → kl . ɕˈʉ̀ːɡɔ kˈɔ̀mːa treː nɔlː     (12)  clock read as a DECIMAL + 2 bare consonants
klockan 12:00   → klˈɔ̀kːan tɔlv , nɔlː             (7)   pause inside the clock
4:41,30         → fˈỳːra , fˈỳːʈɪɔɛtː kˈɔ̀mːa …     (3)   pause inside a sports time
USA:s president → ɵsˈɑː , s prɛsɪdˈɛnt              (16)  pause + a bare [s]
1:a januari     → ɛtː , ɑː janɵˈɑːrɪ                (5)   cardinal + pause + a letter name
23,764 kvadrat… → ɕˈʉ̀ːɡɔtrɛ kˈɔ̀mːa ɧʉː sɛks fˈỳːra (9)  English grouping read as a decimal
t.ex. visering  → t . ɛks . vˈìːsɛrɪŋ               (29)  letters + spurious sentence breaks
2-3 km tjock    → tvoː treː ɕɪlɔmˈeːtɛr             (11)  dash dropped, no connective
TV / DVD / BNP  → tv / dvd / bnp                    (168) vowel-less clusters
GPS / UTC / USD → ɡps / ɵtk / ɵsd
över +30°C      → ˈøːvɛr trˈɛ̀tːɪɔ k                 (2)   sign AND degree dropped, C → bare [k]
35°V            → trɛtːɪɔfˈeːm v                          the compass letter as a bare [v]
133 m/s         → … m s                             (3)   `m` was not a declared unit
160 km/t        → km t                              (1)   the Swedish variant denominator
75,6 cm x 62,2  → … sɛntɪmˈeːtɛr ks …               (1)
bed & breakfasts→ beːd brˈèːakfasts                 (2)   `&` dropped
```

Already CORRECT before this layer and left alone: `80 %` → *procent*, `$5` → *dollar*, `km²` →
*kvadratkilometer*, `km/h` → *kilometer per timme*, `12,8` → *tolv komma åtta* (the decimal comma is
`swedish.ts`'s TOKEN, not a rule here).

## Run 7 — 2026-08-02 — is the bare-year rule context-gated or unconditional?

**Question**: English's normalize.ts gates its pair-wise year on `in|of|since|…`. Does a Swedish marker
list cover enough?

```sh
M='[Åå]r|[Åå]ret|sedan|från|till|under|vid|efter|före|omkring|runt|cirka|mellan|redan|[Ss]ent|<months>'
grep -oP "(?:$M)\s+(?:1[1-9]\d\d|20\d\d)(?![\d.,:])" col3.txt | wc -l     # 41
```

**41 of ~110.** 0 false positives, but 37% coverage — so `år 1945` would read *nittonhundrafyrtiofem* and
`1945 och` *ettusenniohundrafyrtiofem* in the same corpus. That is trap 17's "the inconsistency is the
tell", and it decided the design: go UNCONDITIONAL over 1100–1999.

Enumerating all 116 in-range contexts by hand, the only non-year uses are `de 1200 skalbolag`,
`en 1600 km lång väg`, `$1000 per överträdelse` (below the floor), `över 1000 frimärken` (below),
`(1040 km)` (below). **And the two in range are not errors under the rule**: Swedish reads a round
four-digit quantity in hundreds too — *tolvhundra skalbolag*, *sextonhundra kilometer* are idiomatic. So
the gate would have bought nothing. 2000+ is left alone: *tvåtusentjugo* and *tjugohundratjugo* are both
current and the cardinal is what the engine already says.

## Run 8 — 2026-08-02 — deriving the letter-name table, and validating it

espeak `dictsource/sv_list:12-36` has a "character names" block. Derived the orthography of each name and
round-tripped it through THIS repo's g2p (playbook §5c). **26 of 29 matched espeak's mnemonic outright.**
Three did not, and each needed a different answer:

| letter | naive | this g2p says | espeak | fix | result |
|---|---|---|---|---|---|
| m | `em` | eːm | `Em` /ɛm/ | `emm` | ɛmː ✓ |
| n | `en` | ɛn (only because `en` is in the manifest's exception map — a coincidence) | `En` | `enn` | ɛnː ✓ |
| g | `ge` | jeː (⟨g⟩ softens before a front vowel; the referee records `ge → j eː`, the VERB) | `ge:` /ɡeː/ | `gé` | ɡeː ✓ |
| w | `dubbelve` | dˈɵ̀bːɛlvɛ (final vowel reduced) | `d'8b@lve:` | `dubbel ve` (two tokens) | dˈɵbːɛl veː ✓ |

`gé` works only because the manifest's `frontVowels` is `eiyäöEIYÄÖ` and excludes `é`, while its long-vowel
table maps `é` → `eː`. A test pins `GPS` → `ɡeː peː ɛsː` so that coupling cannot break silently.

**And a bonus that settled a second question**: `sv_list:328-330` carries `usa u-Es'A:` **and
`usa:s u-Es'A:s`** — sourcing both that `USA` is read as LETTERS in Swedish (27 corpus instances, currently
[ɵsˈɑː]) and that the colon-genitive glues its `-s` onto the last letter name with no pause.

## Run 9 — 2026-08-02 — corpus diff, first pass: two defects the probes missed

```sh
npx tsx tools/normalization/corpus-diff.ts compare --before /tmp/sv.before --after /tmp/sv.after
changed 278/1863 (14.9%)   DROP 2 → 0
```

Read all 278 as word-level diffs. **Two real defects, neither visible in the unit probes:**

**1. FIVE UTTERANCE-FINAL PAUSES LOST.** Counting `[.!?]$` over the emit files: 1851 before, 1846 after.
The abbreviation rules consume the final dot, and in six utterances that dot is ALSO the sentence period:
`… tar tag i ens arm, etc.`, `… storytelling, etc.)`, `… ost, tonfisk, etc.`, `… omkring 10 000 f.v.t.`,
`… templet 323 f.Kr.`, `… fram till ungefär år 1100 e.Kr.` — the Slovak `N.` collision from the
abbreviation side. Counted the discriminator before fixing:

```
terminal   (etc. f.Kr. e.Kr. f.v.t. osv.)   5 utterance-final,  0 before a mid-sentence capital
introducer (t.ex. dvs. kl. Jr. St.)         0 utterance-final,  4 before a capital
                                              (t.ex. Camp David · dvs. Northern Rock · St. Louis ·
                                               t.ex. Pennsylvania Wilds)
```

So the "followed by a capital ⇒ sentence end" test is applied to the TERMINAL group only. Applied to all
of them it would have invented 4 spurious mid-phrase breaks to save 5 real ones. After: 1852 final marks,
and the one delta versus 1851 is a GAIN — the before-file's `35°V` line had the `⟪DROP:degree⟫` marker
appended after its period. **Net: zero lost.**

**2. THE YEAR RULE ATE A UNIT.** `1 300 km av Trans-Alaska…` → *trettonhundra* + a bare **[km]**, and
`en 1600 km lång väg` the same. Converting an operand to words destroys the number–unit adjacency
`makeSymbolNormalizer` matches on — trap 14, and step 4's "units before decimals" coupling. The
un-idiomatic *ettusen trehundra kilometer* it replaced was strictly better than a lost unit. Two
utterances, measured with:

```sh
sed -E ':a;s/([0-9])[ ]([0-9]{3})([^0-9]|$)/\1\2\3/g;ta' col3.txt \
  | grep -oP '(?<![\d.,:])(1[1-9]\d\d)\s*(?:%|[$€£°²³]|(?:km|cm|mm|kg|m)(?![\p{L}]))'
```

Fixed by declining the numeral whenever a tier-claimed abbreviation follows, with a test that asserts
`1 300 km` still says *kilometer* — the coupling to `swedish.ts`'s declaration cannot be derived without a
circular import, so it is pinned instead.

**Also found by re-reading the probe output, not the diff:** the colon-inflection pass spelled EVERY
all-caps head, so `UNESCO:s` became *u enn e ess se o s* and `NASA:s` *enn a ess a s*. Both are WORDS in
Swedish; the pass had bypassed the readability test that says so. It now shares `ACRONYM_LETTERS` and
`isUnreadableSwedish` with the main pass and only deletes the colon for a word or a mixed-case name.

## Run 10 — 2026-08-02 — the mechanical review, and two things it changed

```sh
npx tsx tools/normalization/review.ts --lang sv
```

**(a) `1990-1995` → *nittonhundranittio nittonhundranittiofem*, no connective.** The first range guard was a
WHITELIST (`)` or a following lowercase word), which claimed all 11 corpus ranges and declined all 5 scores
— and also declined a bare range with nothing after it, which is not a corpus shape and so was invisible to
the diff. Replaced with a BLACKLIST: every score is followed by `-`, `.` or `,`, so reject those three and
accept everything else. `(?!\d)` heads the class because without it the right operand backtracks —
`21-20,` fails the comma test at two digits and would then match one, reading *tjugoett till två noll*.

**Verified as a pure widening**: re-emitting the whole corpus under the blacklist guard is **byte-identical**
to the whitelist version (0 changed lines of 1863), same 278/1863, same DROP 2 → 0.

**(b) A FALSE POSITIVE IN THE TRAP-6 CHECK, and it is the first one.**

```
[FAIL] spelling → g2p     "NFC" (g2p: ɛnː ɛfː seː) — wrap in the g2p
```

The literal is the argument of `.normalize("NFC")` inside `text()`. The playbook records this check as
"measured at 0 false positives across the 60 languages that have a normalizer" — which holds only because
no language that calls `.normalize()` INSIDE its `text()` body had been treated yet. Measured over the
whole tree:

```
17 languages call .normalize("NF*") inside a text() body; 0 of them has a normalize.ts today
16 of those 17 would flag when they get one  (only cv throws; ab, chr, rup, eu, crh, ee, kaa, ltg,
                                              ln, smj, cdo, nci, naq, pap, shi, mto all read "NFC")
```

`tools/**` is out of bounds for this run, so the fix here is local and cosmetic: hoist the fold into a
module-level `nfc()` helper, outside the scanned body. **Reported, not fixed** — the check needs to exempt
a `.normalize()` argument, or 16 more languages will each hit this once.

## Gate results — 2026-08-02

| gate | result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npx vitest run` | **201 files, 2746 tests, all passing** (29 in `test/swedish.test.ts`, 13 of them new) |
| `mine.ts scan --lang sv` | `no defects` (was `DROP degree ×2`, `DROP math-sign ×2`) |
| `review.ts --lang sv` | `checklist clean` — all 8 lines `ok` |
| `referee-eval sv` | raw 797/5286 (15.1%) · folded 2946/5286 (55.7%) · symbol 88.1% — **identical to main** |
| `corpus-diff sv_se` | changed 278/1863 (14.9%); DROP 2 → 0; DIGIT/SLOT-GAP/RAWMARK/THROW all 0 both sides; utterance-final pauses 1851 → 1852 (**zero lost**) |

The referee is unchanged **by construction as well as by measurement**: `tools/referee-eval/eval.ts` imports
`phonemizeWord` from `swedish.ts`, and nothing this branch touches is on that path — the diff to
`swedish.ts` is confined to `text()`, the `makeSymbolNormalizer` declaration and one hoisted helper.

## Negative results and dead ends, kept deliberately

- **The nb/da/de/lb ordinal-period rule does not port.** 44 `N.` in the corpus, 0 ordinals. Writing it would
  have converted 39 utterance-final pauses into ordinals.
- **A period between digits is a CLOCK here**, not a date (nb) and not a Wi-Fi standard (da). Same shape,
  three different conclusions, three separate measurements.
- **`ghz: ["gigahertz"]` was added to the symbol tier and reverted.** `2,4 GHz` / `5,0 GHz` (2) read as
  [ɡhs]; with the unit declared they read [jˈiːɡahɛʈs], because the g2p softens ⟨g⟩ before a front vowel.
  A different wrong answer is not a fix, and the g2p is on the referee's path.
- **The fraction rule was designed and dropped.** `1/5 tum` (1) reads *ett fem*. The shape collides with the
  Swedish `D/M` date orthography (`3/4` = 3 April), of which this corpus has 0 — so the discriminator
  cannot be measured here, and 1 instance does not justify guessing at it.
- **A marker-gated year rule was built and thrown away** (Run 7): 41 of ~110, and the partial coverage was
  worse than no gate.
- **A whitelist range guard was built and thrown away** (Run 10a).
- **`OS` (6) and `AI` (3) are almost certainly spelled in speech** — /ˈuːɛs/, /ɑːˈiː/ — and are NOT in
  `acronymLetters`, because no source in this repo records either and `os` is an ordinary Swedish word. A
  validated refusal is a result; `usa` is listed because espeak attests it.
- **`en`/`ett` agreement on the numeral 1 is untouched and has 0 corpus instances.** `1 km` reads *ett
  kilometer* where Swedish wants *en kilometer* — but the numeral comes from `numberToWords` in the
  TOKENIZER, downstream of every rule here (trap 14), and the correct form depends on the noun's gender
  (*en kilometer*, *ett kilogram*), which is per-noun lexical data the manifest does not carry. Measured, not
  assumed: `grep -oP '(?<![\d,.])1\s*(?:%|km|cm|mm|kg|procent|kilometer|meter|timme|år)\b'` → **0**.

## Run 12 — 2026-08-03, review before merge

Rebased onto `main`. Every gate as submitted reproduces: checklist clean, scan clean, referee
797/5286 raw · 2946/5286 folded (55.7%) · symbol 88.1%. The review worked the 13-item
"deliberately not done" list. **Three items became fixes; ten stayed, and four of those are now
confirmed by an independent measurement rather than accepted on the note's word.**

### `OS` / `AI` / `USOC` (11) — the reason inverted when the alternative was read

The note argued: *"a wrong letter-reading is confidently wrong where the OOV word-reading is merely bland,
so they are left to the OOV g2p."* Reading what the OOV g2p actually produces:

```
röstades ur OS 2005      → … ʉːr uːs tvɔtˈʉːsɛn feːm
det luktar os i köket    → … lˈɵ̀ktar uːs iː ɕˈøːkɛt
```

**Byte-identical.** The Olympics is read as *os*, the ordinary Swedish noun for fumes — not a bland reading
but a DIFFERENT REAL WORD, which is precisely the failure the argument was guarding against. `USOC` reads as
the nonce word [ˈʉ̀ːsɔk]. And a case-keyed collision between an acronym and a common noun is the exact case
`acronymLetters` exists for: `core/initialisms.ts` names `US` the country versus `us` the pronoun as the
thing a pronunciation dictionary cannot express.

Nothing was invented to fix it. espeak's `usa  u-Es'A:` establishes that Swedish SPELLS this class; the
letter names were already in the branch, sourced from espeak's own mnemonic (26 of 29 matched); so listing
`os`/`ai`/`usoc` adds **no data at all**. Supporting evidence in the corpus: it writes `OS-programmet`,
`vinter-OS`, `sommar-OS` — hyphenated into compounds the way an abbreviation behaves and a noun does not.

`EU` is still NOT listed, deliberately: it already reads [ˈèːˌʉː], which is the letter reading, so an entry
would change nothing. Nothing else among the corpus's 92 acronyms collides with a Swedish word.

### `GHz` (2) and `Mbit/s` (1) — a systematic g2p gap, not a reason to leave letters raw

The note recorded these as tried-and-reverted: declaring `ghz` gives *gigahertz* → [jˈiːɡahɛʈs], "a
different wrong answer, not a fix". The comparison that settles it:

| | undeclared | declared |
|---|---|---|
| `2,4 GHz` | `ɡhs` | `jˈìːɡahɛʈs` |
| `600 Mbit/s` | `mbiːt s` | `mˈèːɡabɪt peːr sɛkˈɵnd` |

One is not a word in any language; the other is the right word with one wrong segment. And the softening is
**systematic in loanwords, independent of this change**:

```
gitarr → jɪtˈarː       (for /ɡɪˈtar/, no symbol tier involved)
```

So the declaration is CORRECT and only the g2p is wrong — which also means a later g2p fix repairs both for
free, where leaving the letters raw stays wrong forever. Declared, with `gitarr` pinned in a test so the gap
is visible rather than folklore, and `Il-76:or` pinned so the new keys cannot eat it (the Dutch hazard, and
this corpus has the shape).

`gigahertz` and `megabit` are UNIT BORROWINGS — the class §5e excludes from the sourcing check by
measurement, as kilogram and millimetre are in some thirty languages. The corpus writes `Mbit` ×3 and never
the expansion.

### Four deferrals verified independently, and all four hold

- **`en`/`ett` on the numeral 1 — count 0.** Re-run: `grep -ohP '(?<![\d,.:])1\s+\p{L}+'` returns
  `1 och` ×2, `1 skickade`, `1 sju`, `1 juli`, `1 i` — not one counted noun or unit among them. Deferral
  correct, and it is trap-14 territory besides (the numeral is produced downstream, and en/ett is per-noun
  lexical data the manifest does not carry).
- **The fraction `1/5` (1).** The claim was that the `D/M` date convention makes the discriminator
  unmeasurable. Verified: the ONLY `\d{1,2}/\d{1,2}` in 1,863 utterances is `1/5` itself. So there is no
  attested date to calibrate against, and a rule would be a guess against a genuinely common competing
  orthography. Same shape as Slovak's `1995/96`, and left for the same reason.
- **`etcetera` → [ɛtkˈeːtɛra].** Verified: `c` really is absent from `swedish.jsonc`'s `consonants` block,
  so this is a g2p/manifest gap on the referee's path, not a normalization one. Correctly out of scope.
- **`s.k.` agreement (2).** Swedish inflects *så kallad* for its noun (*så kallade flikstup*, *så kallat
  utmarkstillstånd*); the gender is per-noun lexical data, and the corpus writes no determiner or definite
  ending to read it off. It already emits the right two words with a citation-form ending, against
  `s . k .` — two bare consonants and two spurious breaks — before. Left.

The rest stand on their counts: the lone initial `N.` (1) and `Malcolm X` (1) are documented limits of
`core/initialisms.ts`, which this branch must not edit; `s.109` (1); `°N`/`°S`/`°Ö` (0); the nb/da
abbreviations (0 each); `17-hundratalet` (1), which already reads acceptably.

### Verification

Delta against the PR as submitted: **12 utterances — 6 `OS`, 2 `AI`, 2 `USOC` (including the genitive
`USOC:s` → `ʉː ɛsː uː seːs`), 2 `GHz` in one sentence, 1 `Mbit/s`** — and nothing else.

| | vs main | vs PR |
|---|---|---|
| utterance-final terminators LOST | **0** | **0** |
| utterance-final terminators GAINED | 1 | 0 |

| gate | result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npx vitest run` | 201 files, **2747 tests, 0 failed** (2 new) |
| `mine.ts scan --lang sv` | 125 lines, **no defects** |
| `review.ts --lang sv` | **checklist clean**, all 8 checks |
| `corpus-diff` sv_se | **287/1863 (15.4%)**, DIGIT 0 / SLOT-GAP 0 / RAWMARK 0 / DROP 0 / THROW 0 (DROP was 2) |
| `referee-eval sv` | **unchanged**: 797/5286 raw, 2946/5286 folded (55.7%), symbol 88.1% |
