# Signed numbers and the multiplication sign — what the `math-sign` / `signed-number` cells actually measure

Scope: #586, the two cells `arithmetic` (`[+±×÷=<>]`) and `signed-number` (`[-−–]` before a digit). Opened
because #627 closed both "by negative" — *no corpus spells a plus, so no rule is authorable* — and that
conclusion was reached from a class-level count without ever resolving **which symbol** in **which shape**.

## Run 1 — 2026-08-03 — resolve the two cells per SYMBOL instead of per class

The class-level gate (`coverage.ts`) reports `arithmetic DROP` / `signed-number DROP` for 29 languages. That
number is a count of *probe hits, not causes* (playbook trap: a gate's count is not a defect count), so the
first question is which symbol each hit is.

Command — over all 66 committed artifacts, per symbol, the differential drop test (substitute, never delete):

```
per-symbol: [+ − × ÷ ± = < >] plus [-–] restricted to the digit-initial (minus) shape
for each: does phonemize(line) === phonemize(line with symbol → space) ?
```

### Raw finding

`+` drops in **17** languages: am fa gu kn mi ml my nb ne sr sw ta te vi xh yue zu.
`×` drops in **4**: ar hu ja th.
`-`/`–` (minus shape) drops in **12**: de el gu hi kn ml mr my ta th xh zu.

### What the `+` hits actually are — two universal sentences, and nothing else

Every single `+` instance in every artifact is one of two FLEURS sentences (the universal-sentence
technique — FLEURS is a translation of one English set, so a shape recurs fleet-wide):

- `+30 °C` — the Montevideo sentence, "in the summer months temperatures above +30 °C are common"
  → am gu mi ne sw ta te vi xh zu
- `UTC+1` — the Downing Street protest sentence, "began around 11:00 local time (UTC+1) on Whitehall"
  → fa kn ml sr yue

**These are two different phenomena and want two different readings.** A signed temperature is arithmetic-ish
("plus thirty degrees"); a UTC offset is an offset ("UTC plus one"). Neither is *arithmetic* — the cell is
misnamed for what it is catching.

### What the `×` hits actually are — two more universal sentences

- the manuscript: "(measuring 29¾ inches × 24½ inches)" → ar, th
- the film camera: "6 × 6 cm, more precisely 56 × 56 mm" → ja, hu (also cs, nb, en, which already read it)

Both are **dimensions** ("six by six centimetres"), not multiplication. Two things fall out:

- ⚠ **`hu` writes BOTH spellings in one sentence** — `6 x 6 cm` (ASCII x) *and* `56 × 56 mm` (U+00D7). That is
  an internal control, not a typo: the ASCII variant is real orthography and must be handled. A rule matching
  only U+00D7 reads half of hu's own sentence.
- ⚠ **THE DIMENSION `×` IS NOT RELIABLY DIGIT-FLANKED.** In ar's `29¾ بوصة × 24½ بوصة` the left neighbour is a
  unit WORD and the numbers carry vulgar fractions. `(\d)\s*×\s*(\d)` — the shape cs uses — misses it
  entirely. Any guard written from the film-camera sentence alone is wrong for the manuscript sentence.

### What the minus hits actually are — almost all FALSE POSITIVES, with named causes

This is the part #627 got wrong, and the part I previously dismissed "by eye" without naming the causes.
Resolved individually, the 12 languages' minus hits are:

| language | text | what it really is |
|---|---|---|
| de, gu | `dem 10.-11.`, `10મી -11મી` | an ordinal **range** |
| el | `–12 χιλιόμετρα … Σιέμ Ριπ–` | a **parenthetical dash pair**, an aside |
| hi, mr, ta | `चंद्रयान -1`, `சந்திரயான் -1` | a product **designation** (Chandrayaan-1) |
| kn, zu | `26 -00`, `1995 -96`, `ngo-26 -00` | a **score** / a year range |
| xh, zu | `ezingama-3000`, `wama-10 -11` | Bantu **hyphen-bound numeric prefix** |

So the `signed-number` cell is measuring a negative number in **approximately none** of its hits. Its guard
`(?<![\p{L}\p{M}\p{Nd}])[-−–](?=\p{Nd})` is defeated by a space after a word (`चंद्रयान -1` — the guard sees
a space, not a letter), and by the Bantu prefix, where a hyphen is ordinary orthography.

**Implication for the plan.** Building hybrid corpora to give this cell more material would add text to a cell
that cannot tell a minus from a Zulu noun prefix. The guard is the prerequisite, not the corpus.

### What this retires, and what it confirms

- ✗ Retired: #627's "no rule is authorable because no corpus spells a plus". The corpora contain **17
  languages' worth of dropped `+`** in two well-defined shapes. The sign is unspelled, but the *shape* is
  abundant — what was missing was a sourced WORD, which is a sourcing problem, not a corpus-content one.
- ✓ Confirmed, and this is the real reason a hybrid/wiki route is needed: the word for "plus" / "minus" /
  "by" is a **written sign in every corpus**, so no amount of FLEURS reading yields it. It has to come from
  prose that spells it out — the wiki route, exactly as `ff`'s `kaaree` and `ga`'s `cearnach` did.
- The design follows from the split: the SHAPES are cross-linguistically identical (`+30 °C`, `UTC+1`,
  `6×6 cm`), only the WORD differs → a shared-tier cell with declared words, not 17 local rules. Languages
  with an idiomatic split keep their local rule — `cmn` says 零下 ("below zero") before a degree word and 负
  otherwise, which is precisely the "truly language-idiomatic" case that belongs local.

### Next step

1. Tighten the `minus` guard so the cell measures minuses (prerequisite for trusting any later count).
2. Source `plus` / `minus` / `by` per language, corpus → referee → wiki, and declare them in the tier.
3. Re-measure. Only then is an empty cell evidence of anything.

## Run 2 — 2026-08-03 — the guard, and then the sourcing wall

### The guard (shipped, c517e4b)

Added a second lookbehind excluding the range shape. 15 dropped-minus hits → **9**; de, kn, ml, th, zu go
clean. hi's one real negative survives, which is the constraint that set the window width. Tooling-only, so no
runtime effect. Remaining 9: 4 designations, 2 apposition dashes, hi's `पू.-1200` (a range the tight window
cannot reach — accepted), hi's true negative, xh's `kangange -40 mph` (a Bantu prefix with an intruding space).

### The sourcing wall — this is the real blocker, and it is NOT corpus volume

`concept.ts --items Q6265342,Q10764194,Q1900125` (plus sign / minus sign / ×) over all 19 affected languages:

```
       plus sign      minus sign     ×
  am   +              -              ×          ← the LABEL IS THE BARE CHARACTER
  gu   +              -              ×             …and so for fa kn mi ml ne sr sw ta te th xh zu
  ar   علامة زائد     علامة ناقص     علامة الضرب
  hu   pluszjel       mínuszjel      ×
  ja   プラス記号        マイナス記号       ×
  vi   +              -              dấu nhân
  yue  加號            減號            乘號
```

**14 of 19 languages return the bare character as their own label for it.** That is the same laundering the
tool's header warns about — a label that is the symbol says nothing about what a reader says. Only ar, hu, ja,
vi, yue yield a word at all, and those are SIGN NAMES (`pluszjel` = "plus-sign", 加號 = "plus-sign"), which
still need the operand-position sense checked separately.

`attest.ts` on the candidates, senses checked (trap 37 — the bare modifier is never the attestation):

| candidate | verdict | what the hits actually are |
|---|---|---|
| hu `mínusz` | ✓ **attested, right sense** | `egy sárga lap: mínusz 1 pont` — directly before a number |
| ja `マイナス` | ✓ attested by a **reading gloss** | the album title `-（マイナス）`: the character, then its reading |
| ja `プラス` | ✗ sense unproven | only the TV title `99プラス` |
| ja `掛ける` | ✗ wrong sense | pouring broth over noodles |
| ar `في` | ✗ wrong sense | the locative preposition "in", thousands of hits |
| ar `ضرب` | ✗ wrong sense | "struck" — a hurricane struck the city |
| th `ลบ` | ✗ wrong sense | the ADJECTIVE "negative", `การป้อนกลับทางลบ` = negative feedback |
| th `คูณ`, `บวก` | ✗ | zero hits |
| hu `-szor` | ~ real, wrong sense | `13-szor` = "13 times over" (frequency), and vowel-harmonic → local if ever |

### Why more corpus would not fix this, and what would

The dimension `×` and the signed `+` are **written as signs in running prose, in every language, including in
the wiki**. So the word is not rare in the corpus — it is *systematically absent from written text*, because
writing uses the glyph. Adding text cannot surface a word that writing never spells. That is a different
failure from `ff`'s `kaaree` and `ga`'s `cearnach`, which were ordinary words merely missing from FLEURS and
sitting in wiki prose; those the wiki route found immediately.

The two things that DID work are worth naming, because they are the only routes that can work here:

- a **reading gloss** — text that writes the character and then its pronunciation (`-（マイナス）`). Rare, but
  decisive when present, and findable by searching for a character next to a parenthesis.
- a **word-only context where the sign cannot be used** — `mínusz 1 pont` in a rules list. Prose that must
  read as speech (sports rules, recipes, spoken-register text) spells what formal prose signs.

⚠ So NOTHING is shipped for ar/th here, and hu/ja's sourced words do not match their measured defects: hu's
and ja's actual drop is `×`, not the minus. Declaring `mínusz` for hu would be speculative robustness for a
symbol hu's corpus already reads. Recorded as unsourced rather than filled with a plausible guess.

### What this run establishes

- #627's conclusion is retired but its *instinct about the corpus* was half right: the SHAPE is abundant (17
  languages' dropped `+`), the WORD is unobtainable from written text by construction. "No rule is authorable"
  was wrong; "no rule is authorable **from prose alone, for most of the fleet**" is right, and is a much
  narrower claim than the one closed on.
- The remaining route for the other 14 languages is a **speech-register source**, not a bigger corpus: a
  reading gloss, a spoken-register wiki (Wikipedia's "spoken articles"), or a language's own maths-teaching
  text. Untried here.
- ⚠ `hu` writes `6 x 6` and `56 × 56` in ONE sentence, so whatever eventually ships must accept the ASCII `x`.
