# kmr (Kurmanji / Northern Kurdish) text normalization — investigation log

Corpus artifact: `tools/corpus/mined/kmr.jsonc` — kmr.wikipedia dump, **182,432 paragraphs**, 451 mined
segments (251 hard + 200 sample), `covered 33/35`, cell inventory current. No FLEURS corpus; espeak does
not ship Kurmanji. Referee: wikipron `kmr_latn` broad (human, 2,151 words) + epitran, 97.4%.

---

## Run 1 — 2026-08-11 — baseline

`mine.ts scan` over the artifact:

```
DROP exponent ×22 · percent ×20 · minus ×15 · math-sign ×15 · currency ×15 · degree ×14 · ampersand ×10
```

Engine probe, the defect list this layer exists to fix:

| input | reading | what is wrong |
|---|---|---|
| `15.354 km²` | `pɑːnzdˈɛh . sˈeː sˈɛd ˈuː peːnd͡ʒˈiː ˈuː t͡ʃˈɑːr km` | "15. 354" — the thousands period is a CLAUSE PAUSE, and `km` is raw |
| `37,0%` | `sˈiː ˈuː hˈɛft , sɪfˈɪr` | "37, zero" — the decimal comma is a clause comma |
| `sala 2015an` | `sɑːlˈɑː dˈʊ hɛzˈɑːr ˈuː pɑːnzdˈɛh **ˈɑːn**` | the bound suffix is its own word with its own stress |
| `20 °C` | `bˈiːst d͡ʒ` | degree dropped, and ⟨C⟩ read as Kurmanji /d͡ʒ/ |
| `$16 million` | `ʃɑːnzdˈɛh mɪllɪˈoːn` | sign dropped |
| `A & B` | `ˈɑː b` | `&` dropped |

**Implication.** All of it is in this layer.

⚠ **First obstacle, and it is trap 43's shape:** `attest.ts --lang kmr` answers *"kmr.wikipedia.org does
not respond as a wiki — a negative from here is NOT evidence"*. The wiki exists with 60k+ articles, filed
under **`ku`**. Every probe below uses `--wiki ku`; without it the whole sourcing pass would have returned
confident negatives for a language that has a wiki.

---

## Run 2 — 2026-08-11 — the defining rule: 287 bound suffixes in 451 segments

Question: `units` shows `an` ×179 as the commonest "unit-shaped" token after a number. Is that a unit?

It is not. It is the **oblique/ezafe suffix**, and a census of digit+letters over the mined segments gives
**287 instances**:

```
an ×177   ê ×70   î ×14   yê ×5   a ×3   em ×3   yan ×1   emîn ×1
```

plus junk the first draft's open `[a-z]{1,4}` shape also matched and that a closed list excludes: a
URL-encoded library-catalogue string (`$002f$002fSD_ILS…$0026rw$003d0$0026ic$003dtrue`), the version
numbers `2.6e` and `Ubuntu 6.10`, and the complement proteins `C3a`/`C3b`.

This is **trap 14 in a language its own note predicted it for** ("Expect the same of the other Turkic
corpora, of Irish, and of anything whose preposition governs a case"), and the fix is trap 14's fix shape:
convert the operand to WORDS inside the rule and attach the suffix there.

**⚠ The finding the plan did not contain: the written glide is not trustworthy.** Kurmanji inserts ⟨y⟩
between a vowel-final word and a vowel-initial suffix — but the writer chooses it by looking at the DIGITS,
and the digits do not show the vowel the cardinal ends in:

| written | cardinal | correct | what the text does |
|---|---|---|---|
| `2ê sibata` | du (vowel-final) | du**y**ê | omits the glide — the digit `2` does not look vowel-final |
| `1980yî` | …heştê (vowel-final) | heştê**y**î | supplies it, correctly |
| `2003yan` | …sê (vowel-final) | sê**y**an | supplies it, correctly |
| `roja 25ê` | …pênc (consonant) | pêncê | correctly takes none |

So the rule **strips any written `y` and re-derives it from the cardinal's own last letter**, which gets all
four cases right from one test. Copying the text verbatim would have shipped *duê*.

The same rule covers the ORDINAL, because Kurmanji's ordinal IS a suffix: `5em` → *pêncem*, `1emîn` →
*yekemîn*, `2yemîn` → *duyemîn*. `ordinal-latin` is 1,484 in the dump.

---

## Run 3 — 2026-08-11 — the corpus carries BOTH separator conventions

Question: `15.354 km²` is fifteen thousand; `%65.5` is a decimal. Same mark. How are they told apart?

By GROUP SIZE, and nothing else. Measured over the mined segments:

```
period + 3 digits   ×75   THOUSANDS   15.354 km² · 300.000 · 1.000.000.000
period + 1 digit    ×12   decimal     %65.5 · 1.5 Mbit/s · Magnitude 7.6 · 7.1ê erdhejek
period + 2 digits    ×6   NEITHER     27.10-6.11.2003 (date) · Ubuntu 6.10 / 6.06 · saet 11.00an (clock) · 36.25–29 (pages)
comma  + 1 digit    ×55   decimal     37,0% · 30,6% · 3,5 km²
comma  + 2 digits    ×3   decimal     18,85 · 1,64 m
comma  + 3 digits    ×8   THOUSANDS   10,000 · 500,000 · 71,553
```

**The two marks therefore take different widths**, and using one width for both read `Ubuntu 6.10` as "six
one zero". Three digits is a thousands group whichever mark carries it; a comma takes 1–2 fractional digits
and a period takes exactly 1.

---

## Run 4 — 2026-08-11 — sourcing: three of six candidates died on sense

Every probe run with `--wiki ku`. **Read the examples, not the counts** — this run is the strongest
illustration of that rule in the sweep so far:

| candidate | count | verdict |
|---|---:|---|
| `sedî` | 113 | ✗ **the Persian poet Sa'di Shirazi** in every top hit |
| **`ji sedî`** | **93 / 17 arts** | ✓ the collocation, in the frame `(ji sedî 19 DV)` ×6 in one nutrition table — plus ×2 in the corpus (`ji sedî 30 ji şervanên jin`). PREFIX in all of them |
| `kare` | 41 | ✗ **the verb "can/is able"** (*kare bişewte*, *kare bibe*). The one `23 km kare ye` that looks right is that verb |
| **`çargoşe`** | **45** | ✓ *"Kîlometre çargoşe ya bi kurtî **km²** dibêjin"* — glossed against the SYMBOL |
| `çarçik` | 21 | ~ the geometric SHAPE, but also the area unit in three Norway articles. Recorded as the competitor |
| **`kûp`** | **28** | ✓ *"Milîmetre kûp ya **mm³** dibêjin"*, plus `20,9 kîlomêtre kûp` ×5. (`kup` without the circumflex ×1 is the cube SHAPE) |
| `xal` | 34 | ✗ the geometric point — and, in its first hit, **the maternal uncle** (*"Xal, ji birayê dê re tê gotin"*) |
| `vîrgul` | 1 | ✗ a **magazine title** (*"Weşanên mîna, Vîrgul, Varlik…"*) |
| `mînûs` | 0 | ✗ absent |
| `neyînî` | 35 | ✗ the abstract sense — *paşragihandina neyînî*, negative FEEDBACK, glossed against English |
| `kêm` | 31 | ✗ the comparative "less", taking a whole clause (*"273.15 pileyan ji sifira Selsiyusî kêm"*) — the Fula `hakkunde` shape |
| **`negatîf`** | **35** | ✓ from the INTEGERS article, applied to the sign's own operand: *"Mezintirîn tamjimara negatîf **-1** e"* |
| **`pile`** | **29** | ✓ degree — corpus (*"di navbera 25 û 30 pile de"*) and wiki (*"Hoke bi yekeyên wekî radyan, pile an jî grad tê pîvandin"*) |
| **`berî zayînê`** | **79 / 20 arts** | ✓ the era phrase; the corpus spells it out once itself (*"8.000 salên berê zayînê"*) |

**A DEFINITIVE NEGATIVE, and it is the one that decided a rule.** No Kurmanji **decimal-separator** word is
attested anywhere this repo can reach: `vîrgul` ×1 (magazine), `virgul` ×0, `xal` (point/uncle), `nuqte` ×1
(that same definition's synonym), `dehî` ×6 (a hamlet, and "to dedicate"), `dehik` / `xala dehiyî` /
`hejmarên dehiyî` ×0, `kesr` ×2 (an Arabic book title). So the separator is REMOVED and not replaced, which
is exactly the fallback `sources.ts` prescribes for this state — *"no _dpt, no _., no manifest word — read
the fraction digit-by-digit"*. What it buys is the removal of a FALSE CLAUSE BREAK: `1,64 m` read
*jˈɛk **,** ʃˈɛʃ ˈuː ʃˈeːst* — a pause inside a number, and the fraction spoken as "sixty-four".

---

## Run 5 — 2026-08-11 — the minus is unambiguous in exactly one place

Question: `ranges` is 6,893 and the corpus writes real negative temperatures with the same ASCII hyphen.
Can they be told apart?

Yes, and by the RIGHT context rather than the left. A dash before a digit that is not itself preceded by a
digit occurs ~22 times in the mined segments, and:

- **all ten genuine negatives are temperatures** — `-52,6℃`, `-24,2 °C`, `-17,5 °C`, `-24,0 °C`,
  `-12,4 °C`, `-10 °C`, `-22,2 °C`, `-24 û -30 pileyan`;
- every other one is a range (`558 b.z.- 530 b.z.`, `2700 – 2300ê`), a coordinate span (`42°-20´`), an
  ordinal range (`7.-8. Piştî sedsalan`), a book title (`Komkujiya Ermenîyan -1915`) or **EasyTimeline chart
  markup** (`start:-1500`, `shift:(-10,5)`).

So the sign is claimed inside the DEGREE rule and nowhere else — Hindi's trap-24 shape with the degree arm.
One extra arm is string-start only, deliberately narrower than Hindi's: the bracket arm is unavailable here
because this corpus's `(`-opening dashes are label offsets in chart markup.

⚠ **It had to reach both operands of a coordinated pair.** `heta -24 û -30 pileyan` writes the degree word
ONCE, at the end, so a lookahead tight enough to be safe reached only the second number — the first `-24`
read as a bare positive, i.e. **the sign silently inverted on half the phrase**. Caught by probing the
corpus's own sentence rather than a constructed one.

---

## Run 6 — 2026-08-11 — the gates, and the ordering bug they found

```
npx vitest run           233 files / 3,372 tests
npx tsc --noEmit         OK
mine.ts scan             no defects   (was 7 classes, 111 hits)
review.ts --lang kmr     checklist clean
corpus-diff compare      changed 201/450 (44.7%), DROP 92 → 24
referee-eval kmr         97.4% unchanged (word path; this layer is text-path only)
```

**The scan found an ordering bug reasoning had not.** With the suffix rule in its first position — above the
shared tier — `%72yê` became `% heftê û duyê` and the percent sign was then orphaned with no numeral beside
it: reported as `DROP percent ×1`. **A guard's evidence has a lifetime** (trap 39): every rule above needs
DIGITS and this one destroys them, so it moved to last among the number rules.

**What the diff shows**, read rather than counted:

```
1.791.373 kes   yek . heft sed û nod û yek . sê sed û heftê û sê   →  yek milyon û heft sed û nod û yek hezar û sê sed û heftê û sê
12.000 salên    donzdeh . sifir salên                              →  donzdeh hezar salên
37° 54´ bakûr   sî û heft pêncî û çar bakûr                        →  sî û heft PILE pêncî û çar bakûr
40° germ dibe   çil germ dibe                                      →  çil PILE germ dibe
sala 1952an     pêncî û du ˈAN de                                  →  pêncî û duyAN de     (one word, glide re-derived)
1000&nbsp;mm    hezar MM e                                         →  hezar mîlîmetre e
```

**Refusals, each with its count:** ranges (Kurmanji writes `ji … heta` itself; the bare dashes are dates,
page spans, coordinate spans and season labels), the clock (`saet 11.00an` is character-identical to a
decimal, a version and a date — four readings, one shape), `=`/`+`/`×` (every mined instance is a gloss, an
etymology, EasyTimeline markup or scientific notation), `±`/`<`/`>`/`÷` (×0 apiece — and `<`'s one upstream
instance arrives as the mangled pseudo-entity `&kêm;`, which is a corpus-repair question, not a reading
one), and `bareExponent` (`E=mc²` is the only mined superscript with no unit under it).
