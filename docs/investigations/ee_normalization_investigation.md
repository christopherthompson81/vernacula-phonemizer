# ee (Ewe) — text normalization investigation

Chronological log. Each run: the command, the question it answers, the raw finding, the implication.
Language: Ewe / Eʋegbe (`ee`), engine `src/languages/ewe/ewe.ts`, artifact `tools/corpus/mined/ee.jsonc`
(ee.wikipedia dump, 5,921 paragraph segments, 398 retained).

## Run 1 — 2026-08-13 — baselines before touching anything

**Commands.**

    npx tsx tools/referee-eval/eval.ts ee
    npx tsx tools/normalization/corpus-diff.ts emit --lang ee --corpus mined:ee --out <before>
    npx tsx tools/normalization/mine.ts scan --in tools/corpus/mined/ee.jsonc --lang ee
    npx tsx tools/normalization/review.ts --lang ee
    npx tsx tools/normalization/sources.ts --lang ee

**Question.** Which gates can move, and which are already saturated?

**Raw finding.**

    referee-eval  kaikki Ewe (249 words): raw exact 18/249 (7.2%), folded backbone 249/249 (100.0%),
                  symbol accuracy 100.0%.  wikipron ewe_latn is listed as small/proper-noun-heavy and is
                  NOT run as a scored referee; the eval prints it only as the secondary-source note.
    corpus-diff   emitted 396 utterances (baseline).
    review.ts     1 FAILING — normalize.ts missing (the only check that can fail before the layer exists).
    sources.ts    letter-names NONE (espeak does not ship ee at all) · decimal-point NONE ·
                  scale-names NONE · fraction-series NONE · percent/currency/unit/minus/equals/times/
                  ampersand all `chk?` (sign occurs, nothing declared).

**Implication.** `referee-eval` is a **tripwire, not a meter**: it is at 100.0% folded on a 249-word list
that `eval.ts` binds as `phonemizeWord`, so no normalization rule can raise it and only a regression in the
letter tables (which the homoglyph fold DOES touch) can lower it. `corpus-diff` and `mine.ts scan` are the
meters. `sources.ts` says the sourcing floor is low: no espeak, no letter names, so initialisms and era
markers are structurally blocked before any judgement is made.

## Run 2 — 2026-08-13 — the homoglyph census

**Command.** A python census of every non-ASCII code point in the artifact's retained text
(198 `text` fields, 59,150 characters), sorted by count, with `unicodedata` names; then every
context printed for each candidate.

**Question.** The brief's core one: Ewe's alphabet is ⟨Ɖ ɖ Ɛ ɛ Ƒ ƒ Ɣ ɣ Ŋ ŋ Ɔ ɔ Ʋ ʋ⟩. Which non-ASCII
characters in this corpus are HOMOGLYPHS of those letters typed by a contributor without the right
keyboard — the Bambara ε/ԑ/ᴐ/ɳ shape (`304f41d`) and the Kikuyu ű/ī/ū shape?

**Raw finding — the census (artifact text; the whole-corpus figure is given where a prior run measured it).**

Ewe's own letters, for scale: ɔ 1781 · ƒ 915 · ɖ 783 · ŋ 302 · ʋ 111 · ɣ 59 · ɛ 51 ·
Ŋ 21 · Ʋ 8 · Ɣ 5 · Ƒ 4 · **Ɖ 3** · Ɔ 1.

| code point | glyph | count | it stands for | verdict |
|---|---|---:|---|---|
| U+00D0 LATIN CAPITAL LETTER ETH | Ð | 11 (×19 corpus-wide, `f269a4b`) | **Ɖ** U+0189 | FOLD |
| U+0110 LATIN CAPITAL LETTER D WITH STROKE | Đ | 2 | **Ɖ** U+0189 | FOLD |
| U+0220 LATIN CAPITAL LETTER N WITH LONG RIGHT LEG | Ƞ | 1 | **Ŋ** U+014A | FOLD |
| U+0342 COMBINING GREEK PERISPOMENI | ◌͂ | 6 | **U+0303** COMBINING TILDE (nasalization) | FOLD |
| U+028A LATIN SMALL LETTER UPSILON | ʊ | 4 | nothing — inside English IPA in parentheses | LEAVE |
| U+0251 ɑ, U+0259 ə, U+02C8 ˈ, U+02D0 ː, U+02CC ˌ | | 2/2/3/2/1 | same English IPA parentheticals | LEAVE |
| U+0395 GREEK CAPITAL EPSILON | Ε | 1 | Greek — `Ελλάδα`, beside λ α δ ά | LEAVE |
| U+02DC SMALL TILDE | ˜ | 1 | the tilde MENTIONED, not used | LEAVE |
| Cyrillic ×~40, Hebrew ×~60 | | | quoted foreign script | LEAVE |

The three letter homoglyphs are all CAPITALS and all word-initial, which is exactly the keyboard story:
a contributor has ⟨ɖ ŋ⟩ on the lowercase layer and reaches for a Latin-1 lookalike for the capital.

    Ðasefowo, Ðeɖefia, Ðokuisiʋa, Ðeka   (Ɖasefowo "Witnesses", Ɖeɖefia, Ɖokuisiʋa, Ɖeka)
    Đoɖo, Đɔkita                          (Ɖoɖo "arrangement", Ɖɔkita "doctor")
    Ƞkɔ nyanyɛ si woyɔna na fofoa         (Ŋkɔ "name")
    ha͂, kata͂, ŋɔ͂tsɛ, nusrɔ͂la           (hã, katã, ŋɔ̃tsɛ — the nasalization tilde)

⚠ **No lowercase homoglyph is present**: ð, đ, ε U+03B5, ԑ U+0511, ᴐ, ɳ, ɸ-for-ƒ — all ×0. Ewe's
lowercase specials are on every African-Latin keyboard layout; Bambara's ε/ᴐ story does not repeat here.
⚠ **ʊ is NOT a ʋ homoglyph in this corpus**, despite looking like one — all four are inside
`/boʊnˈfoʊ ɑːbˈæs/` and `/ˈɑːkəʊˌwəʊ/`, English pronunciation glosses. Folding it would corrupt them.

**Implication.** Four folds, three letters and one combining mark, and they go in `normalize.ts` (or, for
the ones the TOKEN class must see, at the entry of the pass) — **not `core/unicode.ts`**: Ð→D is what a
generic fold would do and Ewe needs Ð→Ɖ, and U+0342→U+0303 is meaningless outside a language that writes
nasalization with a tilde.

## Run 3 — 2026-08-13 — what the engine does with them, and with everything else

**Command.** `phonemize(form, "ee")` over 45 corpus-attested forms.

**Question.** Step 2 of the playbook: the defect list is what the engine PRODUCES.

**Raw finding.**

    Ðasefowo   → dˈiː asefowo     the ⟨Ð⟩ is outside TOKEN, so the word ENDS; the fragment goes to the
                                  English fallback and is read as the LETTER NAME "dee"
    Đoɖo       → dˈiː oɖo         identical shape
    Ƞkɔ nyanyɛ → ƞ kɔ ɲaɲɛ        WORSE — the raw ⟨ƞ⟩ reaches the IPA and the word still breaks
    ha͂ / kata͂ → ha / kata        the nasalization is SILENTLY DELETED — /hã/ and /ha/ are two words
    90%        → blaasieke        the sign is silent
    $400       → alafa ene        silent; GH₵5 → ɡh atɔ̃ (the ISO prefix read as a word)
    51,446,201 → …, alafa ene… ,  grouping commas become CLAUSE PAUSES and three separate numbers
    0.5        → naneke o . atɔ̃  the decimal point is a SENTENCE BREAK
    1648-1654  → two bare cardinals, no connective
    5 km / 5 kg / 400mm → atɔ̃ km / atɔ̃ kɡ / alafa ene mm   raw ASCII in the IPA
    1 °C       → ɖeka t͡s          the sign drops and ⟨C⟩ is read with EWE's own ⟨c⟩ = /t͡s/
    A & B      → a b              silent
    3rd        → etɔ̃ rd           the English ordinal suffix reaches the IPA
    U.S.       → u . s .          spurious clause breaks
    7.30pm     → adle . blaetɔ̃ pm

**Implication.** The homoglyph defects are of two DIFFERENT kinds and only one of them is the one the brief
named: Ð/Đ **fragment** (a letter-name reading spliced into an Ewe word), Ƞ fragments **and** leaks, and the
perispomeni **deletes a phoneme contrast** while leaving a perfectly ordinary-looking word — the trap-56
class, invisible to every counter. The rest is the ordinary normalization list.

## Run 4 — 2026-08-13 — sourcing, and the words that are one letter from the wrong one

**Commands.** `corpus-words.ts --lang ee --words …` over the artifact, then four `attest.ts --lang ee`
batches against ee.wikipedia (default `--limit`, cached to `tools/corpus/attest/ee.jsonc`), then
`attest.ts --lang ee --after kilometa,meta,milimeta`, then two web searches.

**Question.** Which of the defect classes has a word in this language, and does the word fit the slot?

**Raw finding.**

    le alafa me   PERCENT, POSTPOSED.  Both ee.wikipedia hits are the slot and were read:
                  "xexlẽme … to vovo tso 25 va ɖo 33 le alafa me" and "Exɔ ame 50.11 le alafa me".
                  Corroborated off-wiki by a published Ewe word list; `alafa`=100 is the engine's own data.
    dɔlar ×48/11  DOLLAR, PREPOSED (`dɔlar 500`, `dɔlar 20,000`, `dɔlar miliɔn 1`, `dɔlar triliɔn 100`).
    dɔla  ×3      ⚠ NOT THE DOLLAR — "nye ɖasefowo kple nye dɔla" (my witnesses and my SERVANT),
                  "kluvi kple dɔla" (slaves and servants). Trap 37 with the loser one letter from the winner.
    cedi  ×4/3    the Ghana cedi, PREPOSED (`cedi 1,000`, `cedi biliɔn 7`). `sedi`/`sedzi`/`sidi` ×0.
    euro / pound  attested in money slots (`euro miliɔn 45`, `euro 50`; `pound miliɔn 20`, `pound biliɔn 72.5`).
    kilometa ×29/20 · meta ×33/20 · milimeta ×6/3 · sentimeta ×3/3 — every instance NOUN-FIRST.
    mita  ×1      the metre spelling an outsider would copy from Akan — and its one hit is inside an
                  ENGLISH athletics line ("400 mita junior record"). `kilomita` (ak's word) ×0. Trap 55.
    kilogram / kilogaram / kilo   ×0.  Selsius / selsius ×0.  point ×1 = *Darling Point*, a Sydney suburb.
    va ɖo ×63/20 · vaseɖe ×34/20  both are "from X to Y" frames; only `va ɖo` has the BARE numeric infix
                  ("0.5 va ɖo 2 °C" in the corpus, "anɔ ƒe 6000 va ɖo ƒe 2690 D.M.Ŋ." on the wiki).
    --after kilometa,meta,milimeta → ɖeka ×1, miliɔn ×1.  NO square or cube modifier exists.

**Implication.** Percent, currency, units and the range joiner are sourced; the decimal point, the degree
words, `kg`, the minus and the arithmetic signs are not and stay unauthored (the Fula `tere` rule). Two
sibling-borrowings were refuted by re-measurement before they were written — `mita` and `kilomita` — which
is trap 55 firing exactly where the brief warned it would. The unit noun goes BEFORE the figure, so the
shared postposing tier cannot express Ewe's order and the rule is local (trap 47 reason 2 / trap 54's `ha`).

## Run 5 — 2026-08-13 — classifying the cells before writing a rule for any of them

**Command.** A python pass over the artifact's retained text printing the context of every
`\d+[-–—]\d+`, `\d{1,2}:\d{2}`, `\d+[.,]\d+`, currency sign, `%`, `&`, digit-adjacent unit key and
leading minus.

**Question.** trap 25 / trap 55: a filled cell is a lead. What are these instances actually?

**Raw finding.**

    clock ×62 in the cell, 8 in the retained text, and EVERY ONE IS SCRIPTURE — Mateo 21:1-11,
      Marko 11:1-11, Luka 19:28-44, Yohanes 12:12-19, Psalmo 83:19, Dɔwɔwɔwo 17:11, Mose I ta 20:12.
      ZERO clocks. (A large Jehovah's Witnesses stratum in this wiki.)
    ranges ×54 retained: year spans ×11, page ranges (207-213, 480-483), `25–33%`/`10–15%`, ages 15-49,
      `sentimeta 48-55`, BCE spans that run DOWNWARDS (7000–3300 D.M.Ŋ.), truncated second endpoints
      (1951-53, 2006-07, 1957-61), ISBN chains, football scores (1–0, 2–1) and a TENNIS set list
      "Federer ɖu Nadal dzi 7–6, 4–6, 7–6, 2–6, 6–2" — which contains two ASCENDING single-digit pairs.
    decimals: the DOT is the decimal point and the COMMA the thousands separator, cleanly split — no
      dot-grouped number occurs at all, so ee needs none of Akan's two-group asymmetry. One comma-decimal
      (`719,1 km2`) and it is probably a mangled figure.
    units digit-adjacent ×19: `km2` ×8, all AREA; `m` ×8, all hammer-throw distances (56.52m …);
      `mm` ×1 = `$400mm`, an English MAGNITUDE after a currency sign; `kg` ×1 = `−63 kg`, a judo class.
    ⚠ `m` before a digit ×6 and every one is `56.52m 8 Siamlɔm 1995` — the DATE, not an operand.
    ampersands ×16, of which 9 are `&nbsp;` entities and TWO ARE UNTERMINATED (`meter 3&nbsp (afɔ 10&nbsp)`).
    leading minuses ×7: a lifespan dash, the judo class, `Nigeria -7` and four `[ -1]` reference markers.
    era ×10: `D.M.Ŋ.` (BC) and `M.Ŋ.` (AD) — attested in the slot, expansion attested nowhere.
    ordinal: Ewe's own is `N lia`, already words (`ƒe alafa 19 lia`, ×25). English `3rd` ×1.

**Implication.** No clock rule (a ceb-shaped bare-colon rule would have rewritten 62 scripture references —
the ilo finding reproduced). Ranges need three guards, and the third is Ewe's own: **both operands single
digit is refused**, because the ascending test alone claims two of the tennis scores. `m` gets no key-first
arm. The `&nbsp;` regex must make the `;` optional.

## Run 6 — 2026-08-13 — the legacy digit orthography, and why it gets no rule

**Command.** Reading the paragraph behind `LEAK RAW-LATIN kpl ×1` / `gb ×1` in the scan.

**Raw finding.** One paragraph of the 398 is written in the pre-Unicode typing convention where DIGITS
stand in for the special letters:

    "Ampetulawo tia kpo zi 2eka sia akpe he2ea wo5e af4 2eka 2e `g4. … kpl4la la tua ampe la hez4na …"
     (= ɖeka, heɖea, woƒe, afɔ, ɖe ŋgɔ, kplɔla, hezɔna: 2=ɖ, 4=ɔ, 5=ƒ, 1=ɛ, `g=ŋ)

**Implication.** Same FAMILY as the homoglyphs of Run 2 and it gets no rule, recorded as a negative: the
substitution characters are digits, so any fold would destroy the real numerals in the same text, and
nothing separates the two without a paragraph-level detector built on a single instance. It is what the two
residual RAW-LATIN classes `kpl` and `gb` are.

## Run 7 — 2026-08-13 — the layer, and every gate before/after

**Commands.** `tsc --noEmit`; `vitest run`; `corpus-diff emit`+`compare`; `mine.ts scan`; `review.ts`;
`referee-eval.ts ee`; `derive-normalization.py`; `build.py`.

| gate | before | after | meter or tripwire |
|---|---|---|---|
| `referee-eval ee` (kaikki 249) | 249/249 folded, 100.0% symbol | **249/249, unchanged** | ⚠ TRIPWIRE. `eval.ts` binds ee as `phonemizeWord`, so no rule in this layer can raise it — but the homoglyph fold changes LETTERS, so it could have lowered it. It did not. |
| `corpus-diff compare` | — | **123/396 changed (31.1%)**, DROP **51 → 14** | METER |
| `mine.ts scan` DROP | percent 19, currency 11, ampersand 8, minus 6, math-sign 5, degree 3 | **percent 0, currency 0, ampersand 0**, minus 6, math-sign 4, degree 3 | METER |
| `mine.ts scan` LEAK RAW-LATIN | km 8, rd 1, mm 1, kg 1, nbsp 1, pp 1, pm 1, ft 1, kpl 1, gb 1 (17 hits / 10 classes) | **mm 1, kg 1, pp 1, pm 1, ft 1, kpl 1, gb 1 (7 hits / 7 classes)** | METER |
| `review.ts --lang ee` | 1 FAILING (no normalizer) | **2 FAILING**, both sourced refusals — trap 24 keeps them RED | TRIPWIRE for the checklist half, prompt for the rest |
| `vitest run` | 241 passed / 1 failed (stale catalogue) | **242 passed, 4,022 tests** | TRIPWIRE |
| `tsc --noEmit` | clean | clean | TRIPWIRE |
| `sources.ts --lang ee` | unchanged by this work | unchanged | inventory, not a gate |

**The 15 RAW-LATIN hits classified**, which the brief asked for by name — and **none is a missing key**
(trap 54 holds here too):

    km ×8    CLOSED — all 8 are `km2`, the ASCII exponent; step 4 reads them as `kilometa`
    rd ×1    CLOSED — the English ordinal suffix, stripped at step 10
    nbsp ×1  CLOSED — an HTML entity, decoded at step 2
    mm ×1    NOT A UNIT — `$400mm` is an English MAGNITUDE after a currency sign, guarded off on purpose
    kg ×1    REAL and unsourceable — `−63 kg`, a judo weight class; kilogram/kilogaram/kilo are ×0
    pp ×1    English citation furniture ("pp. 480-483")
    pm ×1    English clock inside an English sentence ("7.30pm Radio Nigeria")
    ft ×1    English residue in a sports paragraph
    kpl, gb  the LEGACY DIGIT ORTHOGRAPHY of Run 6 — `kpl4la` splits at the digit

So of 15, ten were English or markup residue and were never Ewe defects, three closed, one is the legacy
paragraph, and exactly one (`kg`) is a genuine gap with no word to fill it.

**Reading the changed lines** (the half no counter does). 336 edit sites across the 123 changed
utterances, tabulated by before ⇒ after: `⇒ le alafa me` ×24, `, ⇒ k͡ple` ×23 (de-grouping), `⇒ miliɔn` ×21,
`⇒ va ɖo` ×20, `. ⇒ ` ×29 (decimal points that were sentence breaks), `km eve ⇒ ` ×8,
`dˈiː asefowo ⇒ ɖasefowo` ×4, `ha ⇒ hã` ×4, `d . m . ŋ ⇒ dmŋ` ×11, `⇒ dɔlar` ×4, `ɡh ⇒ t͡sedi` ×1,
`ƞ kɔ ⇒ ŋkɔ` ×1. Every site was accounted for; no unexplained edit. **Zero empty readings** in the 396
(the `ug`/`bal` probe the brief asked for — `awk 'length<3'` over the emit).

## Run 8 — 2026-08-13 — two decisions worth recording separately

**The ⟨ç⟩ question the accented-Latin run left open** ("ee ⟨ç⟩ reads /t͡s/ via Ewe's own ⟨c⟩ rather than
French /s/, on n=1 evidence — recorded, not decided"). **Re-measured and LEFT AS IS, deliberately.** ⟨ç⟩ is
×1 in the retained text (`La Française`) and this layer is text→text — changing it would mean a LETTER
TABLE change in `ewe.jsonc`, i.e. changing ⟨c⟩ itself, which the referee (249/249) and every existing
golden ride on. The same one-instance evidence that could not decide it in `f269a4b` cannot decide it here,
and the honest position is that ⟨c⟩ is not an Ewe letter at all: every reading of it is a convention for
loanwords, and this corpus's ⟨c⟩ tokens are French (`Française`), English (`Chelsea`, `cockatoo`) and the
Ghanaian currency. Which brings the cost into view from the other side —

**The cedi, which is the same question with money on it.** The currency's only attested Ewe spelling is
`cedi` (×4 / 3 articles; `sedi`, `sedzi`, `sidi` are ×0 in both the corpus and the wiki), and the engine
reads it **[t͡sedi]** where the currency is [sedi]. Akan faced this exactly and chose `sidi` over `cedi`
because its ⟨c⟩ gave [kedi] — but Akan HAD an attested s-spelling and Ewe does not. So the choice is
between emitting the corpus's own word with the engine's own reading of it (one segment off), and leaving
every cedi amount with no currency at all. Declared, with the trade stated in the file. If an s-spelling is
ever attested in Ewe text, that is the day to swap it — not before, because writing `sedi` today would be
authoring a spelling for the language.

**What would move this next.** A tone lexicon (the orthography does not write tone and the engine does not
emit it); an Ewe decimal-point word from a printed source; and a corpus-wide (rather than artifact-wide)
character census, which needs the dump rather than the committed artifact — the counts in Run 2 are over
the 398 retained segments, and only ⟨Ð⟩ has a whole-corpus figure (×19, from `f269a4b`).
