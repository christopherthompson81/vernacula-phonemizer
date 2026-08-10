# jv (Javanese) — text normalization

Giving `jv` the normalization treatment per `docs/normalization_playbook.md`. Javanese is Latin-script
(plus an Aksara Jawa front end that scans into the same `Seg[]`), maturity 🟡, referee 86.2%.

**Evidence base.** No FLEURS corpus. `tools/corpus/mined/jv.jsonc` is dump-sourced (jv.wikipedia
pages-articles, paragraphs), so its whole-corpus `counts` block is a real rate; 250 excerpts / 72,827
characters of text are retained for reading. Second tier: `tools/normalization/attest.ts` against
jv.wikipedia — and unlike the Sinitic runs, jv is spaced, so its TOKEN counts are real attestations rather
than substring hits.

---

## Run 1 — 2026-08-09 21:05 — the defects, and what the big cell counts actually mean

`mine.ts scan` reports DROP math-sign ×32 · percent ×22 · exponent ×21 · currency ×17 · minus ×14 ·
degree ×10 · ampersand ×10.

Probing the attested surface forms:

| form | current reading | defect |
|---|---|---|
| `1.500` / `200.000` | sˈid͡ʒi **.** lˈimaŋ ˈat̪ʊs | the DOT-grouped thousands separator is read as a clause pause — **the value is destroyed** |
| `32,548.20` | …lˈoro **,** … **.** rˈɔŋ pˈulʊh | comma-grouped + dot decimal, both broken |
| `1,4 triliun` | sˈid͡ʒi **,** pˈapat̪ t̪rilˈiʊn | the native decimal comma, read as a pause |
| `50%` | sˈəkət̪ | sign dropped |
| `73–94 persèn` | …pˈulʊh pˈapat̪ pˈərsɛn | range dash dropped — two numbers abut |
| `20°C` | rˈɔŋ pˈulʊh **t͡ʃ** | ° dropped and ⟨C⟩ read as a bare consonant |
| `km²` | **km** | unit AND exponent dropped entirely |
| `5 km/jam` | lˈimɔ **km** d͡ʒˈam | the rate slash and the unit gone |
| `½ kilogram` | **sˈid͡ʒi lˈoro** kilˈɔɡram | the vulgar fraction folds to `1 2` and reads as two cardinals |
| `Rp 5.000` | **rp** lˈimɔ . nˈɔl | currency read as bare letters, value destroyed |
| `A&B` | ˈɔ b | ampersand dropped |
| `PBB` | **pbb** | a VOWEL-LESS CLUSTER in the phoneme stream — what `core/initialisms.ts` exists to prevent |
| `jam 00:02:32` | d͡ʒˈam nˈɔl **,** lˈoro **,** … | colons → pauses |

**⚠ A YEAR NEEDS NO RULE HERE, and that is worth stating because it is the largest cell.** `year: 77647`,
and `taun 2009` already reads *t̪ˈaʊn rˈɔŋ ˈəwu sˈɔŋɔ* — the CARDINAL, which is what Javanese says, unlike
the digit-by-digit reading Chinese gives a year. The biggest count in the artifact is already correct.

**⚠ TWO MORE BIG CELLS ARE MOSTLY NOISE, and reading the regex is what shows it:**

- `abbrev: 41200` is `\p{L}{1,4}\.(?=\s+\p{L})` — which matches **every short sentence-final word**. In the
  retained text the top "abbreviations" are *Jawa.* ×9, *jiwa.* ×6, *donya.* ×5, *taun.* ×4. The real ones
  are a short list: `No.`, `R.`, `J.`, `A.`, `pp.`, `lsp.`, `WIB.`
- `ordinal-latin: 15802` is largely `\d+\.(?=\s+\p{Lu})`, i.e. NUMBERED LIST ITEMS, not ordinals. Javanese
  forms its ordinal with **kaping** (`abad kaping 15`, ×22 in the excerpts) and that already reads
  correctly.

So the actionable mass is: **grouped numbers, decimals, ranges, percent, degrees, units, currency,
ampersand** — plus the initialism class, which is real.

### ⚠ The number format is genuinely BOTH, and it gates every other rule

Javanese follows the Indonesian/Dutch convention — **dot groups thousands, comma is the decimal** — and
jv.wikipedia also carries imported English-format numbers. Counted in the retained text:

```
dot-grouped   \d{1,3}(\.\d{3})+   47   200.000 · 31.820.000 · 1.500 · 433.998
comma-grouped \d{1,3}(,\d{3})+    20   32,548 · 132,000 · 287,655
decimal comma \d+,\d{1,2}              43,34 SA · 3,5 yuta · 665,56 km2 · 1,4 triliun
decimal dot   \d+\.\d{1,2}             32,548.20 km² · 16.46 km
```

Both groupings use exactly 3-digit groups and both decimals use 1–2 digits, so the two can be separated on
group size — which is what makes a rule possible at all. **But the dot also writes the clock** (`jam
09.00`, `00.00-03.00`), and that is the ordering hazard this layer is built around.

### Sourcing — jv is spaced, so these are real token attestations

| slot | word | evidence | verdict |
|---|---|---|---|
| and | **lan** | ×266 in the excerpts | ✓ |
| range | **nganti** | `antara taun 750 nganti 925`, `nganti umur 3 wulan` — ×27 | ✓ |
| percent | **persèn** | `antara 73–94 persèn`, `Watara 10 persèn` — POSTPOSED | ✓ |
| ordinal | **kaping** | `abad kaping 15`, `kaping 4 saben dina` — ×22 | ✓ (already reads) |
| °C | **drajat celsius** | `antara 18–28 drajat celsius`, `nganti 33 drajat Celcius` ×4 — POSTPOSED | ✓ |
| cubed | **kubik** | `kilomèter kubik`, `mèter kubik per detik` — POSTPOSED | ✓ |
| squared | **persegi** | wiki: `43.500 mèter persegi`, `10.235 mèter persegi`, `8.185 mèter persegi` — the exact unit slot, repeatedly | ✓ |
| rate | **per** | `mèter kubik per detik`, `per kapita` | ✓ |
| km / kg / m | kilomèter · kilogram · mèter | ×2 / ×4 / ×3 | ✓ |
| currency | **rupiah**, **dolar** | `milyar rupiah`, `$64 juta dolar AS`, `1$ = Rp.` | ✓ |
| ¼ , ⅓ | **saprapat**, **sapratelon** | ⚠ THE CORPUS GLOSSES ITS OWN FRACTIONS: `1/3 (sapratelon)`, `saprapat saka gunggung` | ✓ |
| ½ | **setengah** | wiki: `setengah daging babi lan setengah daging sapi` | ✓ sense checked |
| decimal | **koma** | ⚠ **REFUSED ON SENSE — see below** | ✗ |

**⚠ `koma` is the one word I cannot source, and the reason is instructive.** It scores 38 token hits in 20
articles on jv.wikipedia — a strong-looking number — and **every single recorded example is "Teater
Koma"**, a Jakarta theatre company. Not one is a decimal. That is the Fula/zu lesson exactly: attestation
is necessary and never sufficient. `nol koma` / `siji koma` / `loro koma` all return **zero**, and espeak
ships no Javanese at all.

But corpus silence about a SYMBOL's spoken form is expected, not a refusal (the Igbo lesson — writers type
`1,4`, they never spell out how they say it), and the alternative here is bad: the comma is
`clausePunctuation`, so **15,961 corpus decimals have their separator read as a clause pause**, which
destroys the value rather than merely leaving it unread. Decided in Run 2.

### Shapes a naive rule would wreck — counted before writing anything

The jv wiki carries a lot of bibliographic debris, and three classes of it collide with the rules above:

- **DOIs** — `doi:10.1016/0301-0104(89)80166-1`. A slash rule reads it as a fraction; a dash rule reads
  `0301-0104` as a range; a dot rule sees decimals throughout.
- **Citation page ranges** — `157-167 doi`, `2400-2410 doi`, `1545-1557 doi`.
- **A slashed YEAR pair** — `taun 1985/1986`, which is not a fraction.
- **Colons that are not clocks** — `QS 3:83` (a Qur'an verse reference), sports times `(1:54.58)`,
  `waktu 2:07:35`, and 3-field timestamps `jam 00:02:32 WIB`.

**Next:** decide `koma`, then write the layer clock-first (the dot is contested by three rules at once).

---

## Run 2 — 2026-08-09 21:30 — the layer, and what measurement changed

`src/languages/javanese/normalize.ts`, wired at the top of `text()`. Ordered clock-first, because the dot
is contested by three rules at once.

### `koma` — shipped, and flagged as the layer's one unsourced word

Decided as stated in Run 1: the symbol's spoken form is systematically absent from written corpora (writers
type `1,4`), jv's whole numeric-technical stratum is Indonesian/Dutch and **every other member of it is
attested here** (persèn, persegi, kubik, milyar, triliun, juta), Indonesian — whose corpus does attest the
reading — ships `koma`, and the alternative is 15,961 decimals whose separator is read as a clause pause.
⚠ **The weakness is stated in the file header rather than buried**: jv is a different language from id, not
a sister standard, so this is an inference and wants a native speaker's eye.

The fractional part is read **digit by digit** after it (`43,34` → *43 koma 3 4*), which is what
`indonesian.ts` already does.

### Five classes the residue turned up that Run 1 had not sized

Reading the scan's remaining drops — not the line previews, the actual matched substrings — found four more
readings that ARE sourceable and one bug:

- **⚠ `1.485,36` was not de-grouped at all.** The native format writes a number that is BOTH grouped and
  decimal, and my dot arm's lookahead `(?![\d,])` refused to match when a comma followed — so both
  separators stayed clause pauses. It now allows a comma and still refuses a dot, which is what keeps the
  two conventions apart.
- **`±` and `+/-` are "about", not a tolerance.** All four instances are rounded populations or areas
  (`± 1.485,36 km²`, `+/- 327.866 (2003)`), and Javanese writes that sense as **kurang luwih** — which the
  corpus uses 17 times in exactly this slot (`kurang luwih 1/3`, `kurang luwih saprapat saka gunggung`).
- **`US$` as well as `AS$`.** The corpus writes both, and a bare `$` key reaches neither: the sign is
  preceded by a letter and the tier's word-guard refuses it. The tier's multi-character keys take both.
- **`jiwa/km²` (population density)** — the tier cannot compose it because the numerator is a Javanese
  NOUN rather than a unit symbol, so the whole `/km²` was dropped. Local rule, using the corpus's own rate
  word **per** (`mèter kubik per detik`).
- **`cm` and `g` are declared; `m` was declined and that was wrong.** I wrote a comment claiming the corpus
  "writes the metre as a WORD and never as a bare `m` after a digit" and declined the key on trap-9
  grounds. The corpus refutes it: `dipunukur nganggé mèter kubik per detik (1 m³/s = 35.51 ft³/s)`. The
  comment is corrected in place rather than deleted — a refusal the evidence overturns is worth seeing once.

### ⚠ A defect my own test found that no gate could

```
jam 08.45  →  jam 08 koma 4 5
```

Step 1 claims only whole hours (`.00`), because no minute word is attested — `menit` scores zero in the
corpus and `jam siji liwat` zero on jv.wikipedia. But the DECIMAL rule then claimed what step 1 had left,
reading a time as a decimal. **The corpus could not report this**: every clock it contains happens to be a
whole hour, so the diff and the scan were both silent. Only writing the adversarial case down found it.
The decimal rule now excludes a `jam` context outright.

### Refusals, each with its count

- **The colon**, entirely: 3-field timestamps (`jam 00:02:32 WIB`), sports times (`(1:54.58)`,
  `waktu 2:07:35`) and a Qur'an verse reference (`QS 3:83`). A rule would claim only what it must not.
- **The general fraction `a/b`**: Javanese is suppletive and the corpus glosses two forms itself
  (`1/3 (sapratelon)`, `saprapat`), but no general reading is attested — and the slash here is mostly a DOI
  (`10.1016/0301-0104`) or a year pair (`taun 1985/1986`). Three literals claimed, nothing else.
- **`=` and `+`**: of 34 `=`, **not one is arithmetic** — they are definitional glosses (`Rumus: x + y = z.
  X = pengalaman`), register equivalences (`dèwèkè=dhékné (ngoko)`) and cross-language glosses
  (`jw = kowé, ind = kamu`). The `+` instances are MUSICAL NOTATION, the slendro/pelog scale degrees
  `[C+ D E-F# G# A B]`. `<`, `>`, `÷`: zero.
- **The minus**: the corpus's one true negative is `at –45 °C` inside an ENGLISH citation title, and no
  Javanese negative-number word is attested. Every other digit-adjacent dash is a range, a coordinate
  range, a citation page range, a DOI's internals, or a botanical parenthetical extreme.
- **Initialisms** — `PBB` reads [pbb], a vowel-less cluster, and this is the one REAL gap left.
  `initialism: 42061` and `letter-name: 24384` corpus-wide. `core/initialisms.ts` is the seam, but it needs
  a Javanese letter-name table that neither the corpus, nor espeak (which ships no jv at all), nor
  jv.wikipedia supplies. Recorded with its count rather than guessed at.

### Gates

```
corpus diff (mined:jv)   DROP 101 → 30 · DIGIT 0 · RAWMARK 0 · THROW 0 · 154/448 utterances changed
referee                  86.2% folded / 96.5% symbol (Latin) · 84.5% / 96.3% (Aksara)  — UNCHANGED
suite                    3,261 tests · tsc clean · review.ts --lang jv checklist clean
```

⚠ `SLOT-GAP: 1` appears in the diff **on both sides** — a pre-existing double space on an Aksara Jawa line,
not introduced here. The measurement, not the review output, is what establishes that: `review.ts` in a
worktree at the parent commit bails at "normalizer missing" before it reaches the scan.

**Reading the changed lines**: `sekèt persèn` · `setengah kilogram` · `sèwu limang atus` (1.500) ·
`telung puluh nganti patang puluh persèn` · `kilomèter persegi` · `lan` for the ampersand ·
`lima koma nol nol nganti nem koma loro lima` (a coordinate pair) · `$825 per taun` → dolar.

---

## Run 3 — 2026-08-09 21:42 — the initialism gap, chased

Run 2 left this as the one real gap: `PBB` read **[pbb]**, a vowel-less cluster and no possible Javanese
utterance, with `initialism: 42061` and `letter-name: 24384` corpus-wide.

### Every sourcing route was tried, and every one refuted itself

| route | result |
|---|---|
| the mined corpus | acronyms appear with their **EXPANSION**, never their pronunciation — `PDB (paritas daya tuku)`, `KB (Program Keluarga Berencana)`, `PIP (Politeknik Ilmu Pelayaran Semarang)` |
| espeak | ships **no Javanese at all** |
| jv.wikipedia, `èks` | 7 hits — all the prefix *ex-*: `èks Karésidhènan Kedu`, `èks Srimulat` |
| jv.wikipedia, `èl` | 32 hits — all **El Salvador** |
| jv.wikipedia, `zèt` / `èf` | absent; `èm` substring-only |
| spelled-out initialisms (`tévé`, `pébébé`, `dévédé`) | **zero** |
| `tivi` | 71 hits — but it is the LEXICALISED loan for TV, from the English letter names, not a Javanese spelling |

So there is no attestation, and this is the same wall `koma` hit. What makes it shippable anyway is a split
that `koma` does not have.

### ⚠ The inventory is inferred; the phonology is not

The names are the Indonesian ones — which is how Latin letters are named in Java — but they are emitted as
**orthography**, not as IPA, so this language's own g2p supplies the sound. It audibly does:

```
a → ˈɔ      ka → kˈɔ        the a→ɔ open-final rule, a Javanese signature
té → t̪ˈe   dé → d̪ˈe       the dental series
èl → ˈɛl    zèt → zˈɛt̪
```

Indonesian's own `letterNames` map straight to IPA; copying it would have imported Indonesian phonology
along with the inventory. Spelled with explicit ⟨é⟩/⟨è⟩, because Javanese ⟨e⟩ is pepet/taling ambiguous —
the homograph ceiling this language is 🟡 for — so a bare ⟨e⟩ would have been a coin flip.

**And the blast radius is small by design.** `core/initialisms.ts` spells only what its OOV test says cannot
be read as a word, so the inference is load-bearing for `PBB`, `PDB`, `UGM`, `LS`, `BT` — and does nothing
to `UNESCO` [unˈəst͡ʃo] or `WIB`, which keep their word readings.

### Two things it had to be told, and two ordering constraints it already satisfied

- **`isUnreadable`** — Javanese phonotactics: vowels `aeiouéèê`, the liquid/glide and prenasalised onsets,
  and codas limited to single consonants plus ⟨ng⟩/⟨ny⟩. That last is what makes `UNS`, `UGM` and `PDB`
  spell out while `WIB` stays a word.
- **`acronymLetters`** — the lexical half, which no phonotactic test can reach: `AS` (Amérika Sarékat),
  `US`, `SA`, `RI`, `LU`, `PC`, all attested in the corpus and all perfectly readable as words.
- **Roman numerals** are all-caps runs too, and would have been spelled EX-EYE-VEE — but `core/roman.ts`
  runs in the REGISTRY *wrapping* `text()`, so they are digits before this pass sees them. Verified:
  `Perang Donya II` → *loro*, `Louis XIV` → *patbelas*.
- **`AS$`/`US$`** are consumed by the currency tier in step 6, so their letters are gone before step 8.

### A win Run 2 had not counted

The corpus is full of **personal initials in citations**, and they were reading as bare consonants plus
spurious phrase breaks:

```
R. J. Speedy and C. A. Angell   →  r . d͡ʒ . spˈəəd̪j ˈand̪ t͡ʃ . ˈɔ .
                                →  ˈɛr d͡ʒˈe spˈəəd̪j ˈand̪ t͡ʃˈe ˈɔ
```

`core/initialisms.ts` handles those in the same pass. Also read correctly now: `ISBN` → *i ès bé èn*,
`HMSO` → *ha èm ès o*, `DPC` → *dé pé cé*, and `RW` → *èr wé* — which the corpus itself glosses as an
abbreviation (`daging asu diarani "RW" (singkatan saka "rintek wuuk")`).

### Gates

```
corpus diff   102/448 utterances changed by this pass alone; leak classes UNMOVED (DROP 30 both sides)
referee       86.2% folded / 96.5% symbol (Latin) · 84.5% / 96.3% (Aksara)  — UNCHANGED
suite         3,265 tests · tsc clean · review.ts --lang jv clean but for the pre-existing Aksara SLOT-GAP
```

**What remains**: nothing in this class that the evidence can settle. The honest residue is that the letter
NAMES are an inference — recorded here and at the table, and the one thing a Javanese speaker should check
first if any of this is ever reviewed by one.
