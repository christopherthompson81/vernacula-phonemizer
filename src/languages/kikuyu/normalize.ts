/**
 * Kikuyu / Gĩkũyũ (ki) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not
 * already a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * ⚠ NO SHARED SYMBOL TIER IS WIRED, AND THAT IS A MEASUREMENT, NOT AN OMISSION. Playbook trap 47's second
 * case — "the tier can only POSTPOSE" — is Kikuyu's ordinary word order for every quantity noun it has. The
 * corpus writes the MEASURE NOUN FIRST, without exception: `mita 200` ×10, `mita 100` ×7, `kilomita 871`,
 * `kilomita 41,200`, `sekondi 9.58`, `mathaa 24`, `ndagĩka 48`, `ciringi mĩrongo ĩrĩ`, `dolari mirioni 4.35`.
 * There is no instance of the postposed order anywhere in this corpus. So every unit and currency rule below
 * is local, in the language's own order, and this file is one pass rather than the two Shona and Kinyarwanda
 * need. Only the PERCENT reading is postposed, and one rule is not worth a second seam.
 *
 * ⚠ THE REFEREE SITUATION, STATED PLAINLY BECAUSE MOST GATES HERE ARE TRIPWIRES. `referee-eval.ts ki` is a
 * REAL 1062-word meter — the en.wiktionary Kikuyu IPA category — but it measures the G2P, which this layer
 * does not touch; its job here is to prove nothing moved. There is no kaikki per-language dump, no wikipron
 * `kik`, no epitran `kik-Latn`, and espeak does not ship Kikuyu at all, so `sources.ts` reports `[NONE]` or
 * `[chk?]` for every class it checks and its haystack is the corpus plus this artifact. ⚠ AND `attest.ts`
 * PROBES ki.wikipedia, WHICH IS THE WIKI THIS CORPUS WAS MINED FROM — it is a bigger sample of the same
 * source, never an independent one. Every word below therefore carries its token/article count AND the sense
 * that was read, and where no sense could be read the reading is declined. This is the `ak`/`bal`/`mos`
 * position, and saying so is part of the deliverable.
 *
 * ⚠ CONTAMINATION IS MEASURED, NOT ASSUMED. ki.wikipedia carries English and SWAHILI — Kenya's lingua franca,
 * a Bantu language with the same word shapes, which is trap 34 at its sharpest. `filter-by-language.py --lang
 * ki` (a row added for this run) over the artifact's 372 segments: 74.5% Kikuyu, 9.7% contrast-dominant,
 * 15.9% undecidable. Per cell it is NOT evenly spread, and the worst one is the reason there is no clock rule
 * below: `clock` is 3 Kikuyu / 5 foreign, `letter-name` 3/3, `ordinal-latin` 3/2, `ranges` 3/2. The numeric
 * cells the rules below rest on are clean — `grouped` 8/0, `year` 8/0, `decimals` 6/1, `percent` 6/0,
 * `currency` 4/0, `units` 4/0.
 *
 * ── WHAT WAS BROKEN, with the corpus count from tools/corpus/mined/ki.jsonc's own `counts` block ──────────
 *
 *     934.6 m         → *kɛⁿda … . …*   a SENTENCE BREAK inside a number     decimals ×158
 *     1,312           → *ĩmwe , …*      one number read as two, with a pause grouped  ×86
 *     29.2%           → the sign silent                                     percent  ×17
 *     $2.7 million    → the sign silent                                     currency ×4
 *     1661 m          → raw `m`, and `95 lb` → *lβ*, `61 cm` → *ɕm*         units    ×4 (m×15 in the artifact)
 *     1891-1978       → two cardinals juxtaposed, no connective             ranges   ×49
 *     21st Century    → a raw `st` in the phoneme stream                    ordinal-latin ×194
 *     nyamű · mūndū   → THE VOWEL IS DELETED: *ɲam*, *mⁿd*                  see the fold note below
 *
 * ⚠ THE LAST ROW IS THE LARGEST DEFECT IN THIS LANGUAGE AND IT IS NOT A SYMBOL AT ALL. This is the `bal`
 * finding — a letter outside the engine's classes deleted, splitting its word — reached by a different road.
 * ki.wikipedia writes the two tilde vowels ⟨ĩ ũ⟩ with whatever the contributor's keyboard offered, and the
 * substitutes have NO grapheme rule, so `latinPhone` returns undefined and `kikuyu.ts` appends the empty
 * string. Counted over the artifact's 372 segments: `ű` ×69, `ī` ×37, `ū` ×23, `û` ×10, `î` ×6, `Î` ×2,
 * `ŭ` ×1 — 148 vowels, in 26 paragraphs (7.0%). What that produces is not a mispronunciation but a hole:
 * `nyamű` → *ɲam*, `mūndū` → *mⁿd*, `kūrī` → *kɾ*, `Îri` → *ɾi*, `íría` → *ɾa*. Step 1 folds them.
 *
 * ── WHAT IS DELIBERATELY NOT DONE, each with the count and the check that refused it ─────────────────────
 *
 * ⚠ NO ACUTE-ACCENT FOLD, and this is the honest half of step 1. `í` ×25 and `ú` ×14 are ALSO tilde stand-ins
 *   in this corpus (`ígúrú`, `búrúrí`, `andú`, `nthí`, `íría`, `ítherero`) — but unlike the macron and
 *   double-acute set they are ALSO ordinary in the foreign names a Kikuyu wiki quotes (`Fágúnwà`, `Márquez`,
 *   `Lucía`, `Ramírez`, `Yorùbá`, `exílio`). The obvious guard — "fold only in a word carrying no accent
 *   Kikuyu never uses" — was measured: it folds 35 and about 8 of those are foreign. Roughly 75% is not a
 *   signature, so the acutes are left alone and the residual ~23 deleted Kikuyu vowels are recorded here
 *   rather than repaired by a rule that would corrupt eight proper names. The folded set has ZERO foreign
 *   instances, which is what makes it a fold rather than a guess (playbook trap 49's discipline).
 * ⚠ A FOREIGN ACCENTED LETTER IS STILL DELETED, and that is a `src/core` question, not this layer's.
 *   `é á ó à è ò â ê ô ç ñ` and the rest reach `latinPhone`, which has no mapping, and vanish the same way.
 *   That affects every Latin-script language with no rule for them and must not land as a side effect of one
 *   language's normalization commit. Recorded, not fixed.
 *
 *   · NO CLOCK (38 whole-corpus). The cell is 5/8 FOREIGN and reading it settles the question: three are
 *     Korean news citations (`yonhapnews 2013.07.27 (English)`), two an Italian radio schedule
 *     (`Soundtracks - il cinema alla radio, at 8:40, 15:10 and 23:00`). The genuinely Kikuyu `N:NN` shapes
 *     are SPORTS TIMES — `1:40.91`, `2:18:57`, `2:18:47` — in the marathon and sprint articles, and this
 *     language spells a duration with the noun first (`sekondi 9.58`, `mathaa 24`, `ndagĩka 48`), which is
 *     not a colon idiom at all. `thaa` ×18/14 and `mathaa` ×11/10 are attested, but attesting the NOUN is
 *     not attesting a clock reading. The `:` keeps the comma pause it already was — Shona's finding, on a
 *     corpus that is dirtier in exactly this cell.
 *   · NO FRACTIONS (9 whole-corpus). ⚠ The reading IS written down — ki.wikipedia's own `Gĩcunjĩ` article
 *     glosses 3/4 as *"gĩcunjĩ gĩa ithatũ gĩa gĩcunjĩ gĩa inya gĩa keki"* and names the parts (*njerome* the
 *     numerator, *cangure* the denominator). That is a DEFINITION, not a spoken form, and the corpus's `N/N`
 *     instances are overwhelmingly not fractions: `Manja 7/3` and `Manja 27/3` are journal volume/issue,
 *     `1960/1961` and `1/2 (2013)` are year and issue pairs, `rev/min` and `r/min` are rates. Genuine ones
 *     are `1/3` ×2, `1/10`, `1/60`. Claiming the shape breaks more than it fixes — Shona's conclusion, and
 *     the slashed DATES are the same hazard here.
 *   · NO CENTIMETRE (`cm` ×2). `thendimita` and `thentimita` are BOTH ×0 on ki.wikipedia and the word is in
 *     no other source. One of the two instances is an English parenthetical glossing `inchi 24` anyway.
 *     Trap 51's floor: a small wiki does not discuss the unit. `61 cm` keeps reading as *ɕm*, which is
 *     visible and wrong rather than invented and wrong.
 *   · NO `ft` / `lb` / `mph` / `ft3`, and NOT for want of looking. Every instance is an ENGLISH parenthetical
 *     glossing a metric figure the sentence has already given — `1661 m (5450 ft)`, `934.6 m (3,066.3 ft)`,
 *     `kilo 30.9-72 (68-159 lb)`, `kg 20.5-43 (45-95 lb)`, `79 km/h kana 49 mph`. Shona declined the same
 *     four for the same reason. ⚠ THIS KEEPS `LEAK RAW-LATIN ft ×7` RED IN `mine.ts scan`, deliberately:
 *     playbook trap 24, a red gate that is a correct refusal beats a green gate that invented a word.
 *   · NO SQUARED OR CUBED WORD (`kilomita 700²`, `10¹⁰⁰`, `241 m3/s` — 3 instances). `cukwea` is ×0;
 *     `thikwea` ×1 is a transliteration of the PROPER NAME "Square Kilometre Array" (*iritagűo thikwea
 *     Kiromita Arraĩ*), which is trap 37's shape — a real token, the wrong register. Nothing else follows a
 *     measure noun on this wiki. The `²` stays silent.
 *   · NO DEGREE OR SCALE WORD (`193 °C (379 °F)` — ONE sentence, and the `°F` half is a redundant gloss of
 *     the `°C`). `digirii` is attested ×4 across 3 articles and EVERY hit is an ACADEMIC degree — *digirii
 *     ya mbere*, *digirii cia igũrũ*, *digirii ya Bachelor*, *digirii ya B.A*. That is `zu amaphuzu` and
 *     Shona's `dhigirii` exactly; what rescued Shona was a definitional sentence naming the SIGN, on its
 *     `Gonyo` article, and ki.wikipedia has no such sentence. `Celsius` and `Fahrenheit` are both ×0.
 *     ⚠ RECORDED AS A KNOWN-WRONG RESIDUAL, not as an acceptable one: the scale letter currently reaches the
 *     g2p and `C` reads as ⟨c⟩ → *ɕ*, a plausible-looking Kikuyu phoneme with no basis. One sentence.
 *   · NO MINUS WORD, and there is nothing to read. Every `signed-number` instance in this corpus is a RANGE
 *     (`1891-1978`, `1985-1995`, `1940 - 10 Mweri`), a list bullet (`fĩthiki - 47, űthagia - 63`), a CHESS
 *     RESULT (`(+1 -3 =0)`, `(+2 -5 =2)`) or an EXPONENT (`r⋅min −1`). There is no negative number in the
 *     corpus at all — Hindi's position, re-measured here. ⚠ The playbook's warning is attached anyway:
 *     omitting a plus is lossless and omitting a minus INVERTS, so this refusal is void the moment a
 *     negative quantity appears.
 *   · NO `+`, `=` OR `×` WORD (2 arithmetic instances, and the signs). `(+1 -3 =0)` and `(+2 -5 =2)` are
 *     chess tournament records; `9 × 9` and `3×3` are a sudoku grid, where the reading is "by" and not
 *     "times". Nothing attests any of the three.
 *   · NO AMPERSAND WORD (52 whole-corpus). Folding the ENTITIES is the whole defect: `&nbsp;` ×16 and
 *     `&quot;` ×2 in the artifact, and the bare sign appears only inside English names this wiki carries
 *     (`Niia & Lil Wayne`, `Trinidad & Tobago`, `SM & Bar`). Step 2 folds them and no conjunction is spent.
 *     Shona reached the identical conclusion.
 *   · NO DOTTED-ABBREVIATION RULE (8 runs: `U.S.`, `U.K.`, `O.S.`, `L. L.`, `G.L.`, `D. O.`, `D. H.`,
 *     `B.I.G`). Every one is initials inside an English bibliographic name, and with no `letterName` table —
 *     espeak does not ship Kikuyu — collapsing `D. H.` to `DH` replaces two spurious pauses with a
 *     vowel-less cluster. A lateral move on 8 instances is not worth the trap-10 space-swallowing hazard
 *     that bit the sibling layer; counted, then declined.
 *   · NO LETTER NAMES, so no initialisms (310 whole-corpus, `letter-name` 232). `core/initialisms.ts` needs
 *     a `letterName` table and no in-repo source carries one for Kikuyu. A sourcing gap, not a seam gap.
 *   · NO `KSh` READING (×1, and the corpus writes it typo'd as `KSh.,902,472`). `ciringi` IS well sourced —
 *     ×10 tokens / 5 articles, with a DEFINITIONAL hit, *"ciringi beca cĩa Kenya na mabũrũrĩ mangĩ ma
 *     Afrĩca"* ("shilling, money of Kenya and other African countries"), plus `ciringi ĩmwe`, `ciringi
 *     igĩrĩ`, `ciringi mĩrongo ĩrĩ`. It is the count that refuses this, not the word: one instance, and it
 *     is letters rather than a `\p{Sc}` sign, so no gate reports it either way. Recorded so the next reader
 *     does not re-source it.
 *   · `.mw-parser-output{…}` CSS BLOCKS ARE A MINING RESIDUE, not language. They are the whole of
 *     `LEAK RAW-LATIN mw ×3` and of 4 of the artifact's `%` instances (`font-size:90%`). `filter-markup.py`
 *     owns that; a normalizer that strips CSS would be fixing the wrong file.
 */

/**
 * The RANGE joiner, and the best-attested word in this layer. `nginya` ("until, up to") is written as a bare
 * infix between two operands and the corpus glosses it against the digit form directly: *"ngavana kuma 2013
 * NGINYA 2017"*, *"Mīaka-inī ya 1978 NGINYA 1988"* (two bare numerals, nothing else between them),
 * *"ũraihu wa mita 6 NGINYA 12"*, *"kuuma mwaka wa 1997 NGINYA mwaka wa 2006"*. `attest.ts` → 32 tokens
 * across 20 articles. ⚠ The PART-OF-SPEECH check that sank Fula's `hakkunde` passes: every attestation is
 * the INFIX between the two operands, never a preposition governing both.
 */
const RANGE = "nginya";

/**
 * The PERCENT reading, and it is COMPOSED FROM ATTESTED PIECES rather than asserted — the Fula `e teemedere`
 * move, which the playbook prefers to inventing a term. `harĩ igana` is "at/per a hundred": `igana` is this
 * engine's own number word for 100 (see `kikuyu.jsonc`) and `harĩ` is the ordinary Kikuyu locative.
 *
 * ⚠ IT IS ALSO ATTESTED AS A COLLOCATION, IN EXACTLY THIS SLOT, TWICE, IN TWO DIFFERENT ARTICLES, and both
 * are percentages of a population — the sense is read, not assumed:
 *   · *"Makĩria ma gĩcunjĩ gĩa 51 HARĨ IGANA kĩa andũ nĩ andũ-a-nja"* — "more than 51 per hundred of the
 *     people are women" (Addis Ababa).
 *   · *"rwĩna andũ mirioni 8.1 kana gĩcunjĩ kĩa 17 HARĨ IGANA kĩa akenya othe"* — "8.1 million people, or 17
 *     per hundred of all Kenyans".
 * ⚠ AND THE FRAME IS THE CORPUS'S OWN. Its `%` instances are written `gĩcunjĩ kĩa 29.2%`, `gĩcunjĩ kĩa 33%`,
 * `gĩcunjĩ kĩa 49%` — the same `gĩcunjĩ kĩa N …` opening as the two spelled-out readings above. So emitting
 * only the sign's own words reproduces the attested sentence rather than doubling anything, and no
 * redundancy guard is needed: ZERO instances write both the sign and `harĩ igana`.
 */
const PERCENT = "harĩ igana";

/**
 * The DOLLAR noun, postposed by this language's order to the LEFT of its amount. `dolari` → 2 tokens in 1
 * article, and the sense is read and monetary: *"mũcaara wa makĩria wa DOLARI milioni 4.35 kũgerera wa
 * DOLARI mirioni 4.33 cia Keane"* — a footballer's salary, twice, in the slot. The corpus corroborates the
 * same reading with the English spelling in a Kikuyu sentence (*"mirioni 3.75 cia dollar"*).
 * ⚠ TWO TOKENS IS THIN AND IS SAID SO HERE. What supports it is that the count is not the only evidence:
 * the slot, the order and the sense all agree, and `$` appears 4 times in this corpus against no competing
 * candidate at all.
 */
const DOLLAR = "dolari";

/** The METRE and KILOMETRE nouns. `mita` ×43 tokens / 19 articles, sense read and unambiguous — *"mahenya ma
 *  MITA 100, MITA 200"* (sprint events), *"ũraihu wa MITA 6 nginya 12"* (a length). `kilomita` ×26 / 18 —
 *  *"nĩ irĩ KILOMITA 871 kuuma Cape Town"*, *"ũraihu wa KILOMITA 10"*. Both are written BEFORE the number in
 *  every one of those, which is the order step 8 emits. */
const METRE = "mita";
const KILOMETRE = "kilomita";

/** Words this layer must not double when the sentence already carries them — playbook trap 12. Checked on
 *  BOTH sides of the figure, because a Kikuyu measure noun normally PRECEDES its number and a before-only
 *  guard would miss the case that actually occurs (`kilomita 41,200km`, the corpus's only `km`). */
function saidNear(full: string, offset: number, end: number, word: string): boolean {
    return full.slice(Math.max(0, offset - 45), end + 45).includes(word);
}

/**
 * ⚠ THE ORTHOGRAPHIC SUBSTITUTES, and every one of these was counted in the artifact before it was listed.
 * These are the characters ki.wikipedia writes where the orthography has ⟨ĩ⟩ or ⟨ũ⟩; each is a letter with no
 * grapheme rule, so the engine deletes it. The lowercase forms carry all 148 instances; the uppercase twins
 * of the macron set are ×0 and are included as robustness for plausible input, which is what trap 22 asks be
 * SAID rather than implied. ⚠ `í`/`ú` are deliberately absent — see the header.
 */
const SUBSTITUTE: Readonly<Record<string, string>> = {
    "ű": "ũ", "Ű": "Ũ",   // U+0171 ×69 — nyamű · műno · andű · gĩkűyű · űhoro
    "ū": "ũ", "Ū": "Ũ",   // U+016B ×23 — mūndū · mūtambo · mabūrūri-inī
    "û": "ũ", "Û": "Ũ",   // U+00FB ×10 — mûno · igûrû · ûthamaki
    "ŭ": "ũ", "Ŭ": "Ũ",   // U+016D ×1  — ŭrĩa
    "ī": "ĩ", "Ī": "Ĩ",   // U+012B ×37 — mīaka-inī · kūrī · ūrīa · ndūmīrīri
    "î": "ĩ", "Î": "Ĩ",   // U+00EE ×6, U+00CE ×2 — kîa · rîa · nîkûo · Îri
};
const SUBSTITUTE_RX = new RegExp(`[${Object.keys(SUBSTITUTE).join("")}]`, "gu");

/**
 * Kikuyu text normalization. A numbered, ORDER-DEPENDENT sequence; each step states its coupling.
 */
export function normalizeKikuyu(input: string): string {
    let s = input;

    // 1) THE ORTHOGRAPHIC-SUBSTITUTE FOLD, FIRST — before any rule and before the g2p, because everything
    //    downstream (this file's guards, the grapheme table, `attest`-sourced literals) matches on the
    //    Kikuyu letters ⟨ĩ ũ⟩ and none of it can see a word spelled with a stand-in. 148 vowels in 26 of the
    //    artifact's 372 paragraphs (7.0%); see the header for the counts per character and for why the acute
    //    accents are NOT in the table.
    //    ⚠ NFC FIRST, so a decomposed `u` + U+0303 is one code point before the table is consulted; the
    //    engine NFCs again downstream and the fold is idempotent, so this costs nothing.
    //    ⚠ FORMAT CHARACTERS ARE STRIPPED IN THE SAME STEP, not because they are common — U+2060 WORD JOINER
    //    and U+FFFC are ×1 each here — but because a zero-width inside a word SPLITS it into two tokens, and
    //    that is the same class of silent damage the fold exists to undo. Robustness, stated as such.
    s = s.normalize("NFC").replace(SUBSTITUTE_RX, (c) => SUBSTITUTE[c]!).replace(/[\p{Cf}￼]/gu, "");

    // 2) HTML ENTITIES, before anything looks for a number beside a sign or a unit. `&nbsp;` ×16 sits exactly
    //    in the gap a number-unit or number-sign adjacency needs (`kilomita 700². &nbsp;&nbsp;`), and
    //    `&quot;` ×2 would otherwise reach the g2p as the word "quot".
    //    ⚠ NO AMPERSAND WORD IS SPENT — see the header; the bare sign occurs only in English names.
    //    `&amp;` is unfolded first so a doubly-escaped entity does not survive as "amp" plus a semicolon.
    s = s.replace(/&amp;/giu, "&").replace(/&nbsp;/giu, " ").replace(/&quot;/giu, '"');

    // 3) THOUSANDS DE-GROUPING, before every remaining numeric rule: a grouping comma reads as a CLAUSE
    //    PAUSE, so `1,312` came out *ĩmwe , magana matatũ ikũmi na igĩrĩ* — two numbers and a pause where the
    //    text has one number. 86 whole-corpus; the artifact writes `70,560,000`, `902,472`, `41,200`,
    //    `164,500`, `1,312`, `486,840`.
    //    ⚠ EXACTLY THREE DIGITS PER BLOCK. That is also what declines the corpus's DIGIT LIST — the maths
    //    article's *"ndari 1,2,3,4,5,6,7,8,9"* — and its interval pair *(0,1)*, neither of which is a number.
    //    ⚠ THE HEAD MUST START 1–9, so a leading-zero run is never treated as a grouped thousand.
    //    ⚠ THE TRAILING GUARD IS BARE `(?!\d)`, AND THAT IS A MEASURED DIVERGENCE FROM THE SIBLING LAYERS.
    //    Shona and Kirundi write `(?!\d|[.,]\d)`, because their corpora carry BOTH conventions and a grouped
    //    figure followed by `.3` might be a period-grouped thousand whose leftover separator step 9 would
    //    then misread. Kikuyu's corpus is not ambiguous: the comma is a grouping mark 86 times and a decimal
    //    ZERO times (see step 9), and there is no period-grouped thousand at all. Inheriting the sibling
    //    guard here left `3,066.3 ft` — a real elevation gloss in this corpus — UNDE-GROUPED, so it read as
    //    *ithatũ , mĩrongo ĩtandatũ na ithathatũ . ithatũ*: one number, one pause and one sentence break.
    //    Caught by this file's own test rather than by a probe, which is the point of pinning the branch.
    s = s.replace(/(?<![\d.,])([1-9]\d{0,2})(?:,\d{3})+(?!\d)/gu, (w) => w.replace(/,/gu, ""));
    //    The space-grouped form, same shape. ×0 in this corpus; the arm is here because a wiki that writes
    //    `41,200` also writes `41 200`, and it cannot fire on anything else (three digits, no letters).
    s = s.replace(/(?<![\d.,])([1-9]\d{0,2})(?:[ \u00a0\u202f\u2009]\d{3})+(?!\d)/gu, (w) => w.replace(/[ \u00a0\u202f\u2009]/gu, ""));  // space, NBSP, NNBSP, thin space

    // 4) THE ENGLISH ORDINAL SUFFIX (`21st`, `20th`, `70th`, `4th`, `2nd`; 194 whole-corpus). Kikuyu writes
    //    its own ordinals as WORDS with a class-agreeing prefix — this corpus has *wa mbere*, *wa kerĩ*,
    //    *gĩa kathatu*, *rĩa mbere*, *ya gatandatũ* — so a Latin suffix glued to a digit is always foreign
    //    orthography, and it was reaching the phoneme stream as a bare `st`/`th`. Stripping it is the whole
    //    fix; no ordinal morphology is invented, because Kikuyu's is already spelled out wherever the
    //    language means it. Case-insensitive (trap 7: `21St` and `11De` are ordinary in titles).
    //    ⚠ AFTER de-grouping, so a grouped ordinal is already one digit run; BEFORE the range rule, whose
    //    right guard excludes a trailing letter and would otherwise decline `1990th-2000th`.
    s = s.replace(/(\d+)(?:st|nd|rd|th)(?![\p{L}\p{M}])/giu, "$1");

    // 5) RANGES → `nginya`. AFTER step 3 (a grouped endpoint must already be one digit run) and BEFORE the
    //    unit and percent rules, so neither operand has been rewritten into words by the time this pairs
    //    them. 49 whole-corpus.
    //    ⚠ ASCENDING ONLY, and it is doing real work in THIS corpus rather than being borrowed: the
    //    descending pairs are all birth–death lines whose second operand is a DAY, not a year —
    //    `1859 - 14 April 1917`, `1849 – 27 February 1936`, `1885 – 18 November 1962`, `1903 – 7 December
    //    1963`, `1911 - 20`, `1940 - 10 Mweri wa Gicumi 2019`. Claiming any of those reads a date as a span.
    //    The ascending ones are genuine and are claimed: `1891-1978`, `1985-1995`, `2003-2006`, `1991- 2009`,
    //    `1724 -1804`, `1871 -1943`, `1887–1961`, `1950–1975`, `1938 - 2025`, `1915 - 1977`, `13-14`, and the
    //    animal-measurement parentheticals `24-28`, `26-40`, `36-72`, `45-95`, `66-102`, `68-159`, `92-183`.
    //    ⚠ `+` AND `−` ARE IN THE LEFT GUARD, and that is not defensive habit — this corpus contains two
    //    CHESS RESULT lines, `(+1 -3 =0)` and `(+2 -5 =2)`, in which `1 -3` and `2 -5` are digit–dash–digit
    //    and ASCENDING. Without the sign in the lookbehind both read as ranges ("1 nginya 3"), which is
    //    confidently wrong about a tournament score. The sibling layer's guard does not carry them.
    //    ⚠ A DOT OR COMMA ON EITHER SIDE IS EXCLUDED, so a DECIMAL range is declined: `30.9-72` and
    //    `20.5-43` keep reading as two juxtaposed quantities. Admitting them means re-implementing step 9
    //    inside this rule to keep the operands intact, and the same limit is accepted in the sibling layers.
    //    ⚠ BUT ON THE RIGHT THAT MUST BE `[.,]\d` AND NOT A BARE `[.,]`, because a separator with NO digit
    //    after it is not a decimal — it is the END OF THE CLAUSE. `p 237–240.` and `mwaka wa 1991- 2009.`
    //    were declined for their sentence period and read as two juxtaposed cardinals with nothing between
    //    them, the span joiner silent at exactly a sentence end (playbook trap 58, reported by `review.ts`'s
    //    `clause-final` check). What the decimal exclusion needs is a CONTINUATION of the number, which is
    //    what a following digit tests; `30.9-72.5` is still declined and so is a grouped `1-1,000`.
    //    ⚠ AND A TRAILING LETTER IS EXCLUDED, which is what leaves `1960/1961` and `13-14million` alone.
    s = s.replace(/(?<![-+−–—\d.,\p{L}\p{M}])(\d+)[ \u00a0]?[-–—][ \u00a0]?(\d+)(?![-+−\d\p{L}\p{M}]|[.,]\d)/gu,  // space, NBSP
        (whole, a: string, b: string) => (Number(a) < Number(b) ? `${a} ${RANGE} ${b}` : whole));

    // 6) PERCENT → `N harĩ igana`, the one POSTPOSED reading in this layer (see the declaration for the two
    //    attestations and for why no redundancy guard is needed). 17 whole-corpus.
    //    ⚠ BEFORE step 9, because the reading's operand is the whole number including its decimal tail:
    //    `29.2%` must become `29.2 harĩ igana` and only then be spelled out, or the sign attaches to `2`.
    //    ⚠ THE LEFT GUARD IS `(?<![\p{L}\p{M}])` ON THE DIGIT so this cannot bite into a word ending in a
    //    digit, and the number takes its own dot so `%` after a grouped figure still finds one operand.
    //    ⚠ FOUR OF THE ARTIFACT'S `%` ARE CSS (`font-size:90%`), a mining residue named in the header. They
    //    are indistinguishable from a percentage without a markup rule and are left to read as one.
    s = s.replace(/(?<![\p{L}\p{M}])(\d+(?:\.\d+)?)[ \u00a0]?%/gu, `$1 ${PERCENT}`);  // space, NBSP

    // 7) THE DOLLAR SIGN → `dolari N`, the noun BEFORE its amount (this language's order — see the header).
    //    `$2.7 million`, `$ 5.6 million`, `US$486,840`, and the GDP-per-capita legend `>$60,000 $50,000 -
    //    $60,000 …`. 4 whole-corpus.
    //    ⚠ `US$` IS CLAIMED BY ITS OWN ARM FIRST, so the two letters do not reach the g2p as a separate
    //    token; the tier's compound-key reasoning (trap 44) applied locally.
    //    ⚠ THE TRAP-12 GUARD IS ON BOTH SIDES. The corpus writes `dolari milioni 4.35` and `mirioni 3.75 cia
    //    dollar` in monetary sentences, so a `$` beside an already-named currency must not say it twice.
    const NAMED = /dolari|dolar|dollars?|ciringi/iu;
    s = s.replace(/(?<![\p{L}\p{M}])US[ \u00a0]?\$[ \u00a0]?(?=\d)/giu, `${DOLLAR} `);  // space, NBSP
    s = s.replace(/\$[ \u00a0]?(?=\d)/gu, (w, off: number, all: string) =>  // space, NBSP
        saidNear(all, off, off + w.length, "dolari") || NAMED.test(all.slice(Math.max(0, off - 45), off))
            ? "" : `${DOLLAR} `);

    // 8) UNITS — `m` → `mita N` and `km` → `kilomita N`, in the noun-first order the corpus writes without
    //    exception. `m` ×15 in the artifact, every one a genuine elevation figure in a city article
    //    (*"City ya Nairobi irĩ igũrũ mũno ta 1661 m (5450 ft)"*, `934.6 m`, `12.0 m`, `1,566 m`); it was
    //    reaching the IPA raw, and the sibling abbreviations `cm`/`lb` were worse — `61 cm` reads *ɕm* and
    //    `95 lb` reads *lβ*, ASCII letters silently phonemized as Kikuyu graphemes.
    //    ⚠ THIS IS TRAP 46 IN A LANGUAGE THAT HAS TO OWN IT. `m` is a ONE-LETTER unit key, and the guard the
    //    shared tier has for it (`NOT_VERSION`, which stopped `802.11g` reading as grams in ten languages)
    //    works by seeing the DOT — which this layer would have spent by step 9 anyway, and which the tier
    //    could not apply here because it cannot put the noun in front. So the guard is written locally and
    //    explicitly, and it takes BOTH halves the trap prescribes:
    //      · the lookbehind stops a match BEGINNING INSIDE a number — that is the retry that defeats a bare
    //        lookahead, because an engine rejected at `802` simply restarts at `11m`;
    //      · and the metre arm is SPLIT so a DECIMAL operand must be SPACED from the key. Written as one arm
    //        with `(\d+(?:\.\d+)?)[ \u00a0]?m` it read `802.11m` as *mita 802 11* — measured, not predicted, on
    //        the first probe run of this file. The split costs nothing: in this corpus a decimal metre is
    //        spaced 2/2 (`934.6 m`, `12.0 m`) and a glued decimal-plus-`m` is ×0, as is a glued integer one.
    //    ki's `version-dot` cell is ×5 whole-corpus and ×0 in the retained text, so this is exposure
    //    management rather than an observed repair — said plainly rather than implied. `km` keeps the single
    //    arm: it is a TWO-letter key, which is the case trap 28 explicitly requires to keep reading
    //    (`12.5km`), and `802.11km` is not a designation anyone writes.
    //    ⚠ A TRAILING DIGIT IS EXCLUDED, which is what leaves `241 m3/s` alone: `m3` is cubic metres per
    //    second and this language has no cube word (header). Reading it as bare metres would be a wrong
    //    quantity replacing a raw one.
    //    ⚠ `km` CARRIES THE TRAP-12 GUARD AND `m` DOES NOT, because the corpus's only `km` is redundant —
    //    `kilomita 41,200km`, the noun already written — while none of the 15 `m` figures has `mita` beside
    //    it. Declaring `km` at all is robustness for plausible input on ×1 evidence (trap 22's discipline);
    //    what it buys today is exactly that one instance NOT being doubled.
    //    ⚠ `km/h` IS EXCLUDED BY THE SLASH and stays raw: ×1 (`79 km/h kana 49 mph`), and no rate idiom is
    //    attested for Kikuyu — `unitPer` is one invariant string and this language has no candidate for it.
    //    AFTER the ranges (step 5) and BEFORE the decimals (step 9), which is what leaves `934.6` intact to
    //    be this rule's operand.
    s = s.replace(/(?<![\d.,\p{L}\p{M}])(\d+(?:\.\d+)?)[ \u00a0\u202f\u2009]?km(?![\p{L}\p{M}\d²³/])/gu,  // space, NBSP, NNBSP, thin space
        (w, n: string, off: number, all: string) =>
            saidNear(all, off, off + w.length, KILOMETRE) ? n : `${KILOMETRE} ${n}`);
    const metre = (w: string, n: string, off: number, all: string): string =>
        saidNear(all, off, off + w.length, METRE) ? n : `${METRE} ${n}`;
    s = s.replace(/(?<![\d.,\p{L}\p{M}])(\d+\.\d+)[ \u00a0]m(?![\p{L}\p{M}\d²³/])/gu, metre);  // space, NBSP
    s = s.replace(/(?<![\d.,\p{L}\p{M}])(\d+)[ \u00a0]?m(?![\p{L}\p{M}\d²³/])/gu, metre);  // space, NBSP

    // 9) DECIMALS, LAST of the numeric rules — steps 5 to 8 all need their number intact. The separator was
    //    reaching `clausePunctuation` and becoming a SENTENCE BREAK inside a number: `934.6 m` read
    //    *… magana kenda mĩrongo ĩtatũ na inya . ithathatũ*. 158 whole-corpus, this layer's largest cell.
    //    ⚠ NO SEPARATOR WORD IS EMITTED, AND NONE IS SOURCEABLE. `sources.ts` reports `[NONE]
    //    decimal-point`; espeak does not ship Kikuyu; `ndonge`, `kabungo`, `tuti`, `mũhũthĩrĩri` are all ×0
    //    on ki.wikipedia; `koma` ×7 is the verb "to sleep" (*koma koma gwĩtandaiya handũ*), which is the
    //    `bar Komma` trap exactly; `ngingo` ×65 is the NECK. A web search of the Gĩkũyũ dictionary and
    //    numeral sources returned nothing either, which is the check the Igbo lesson demands before a
    //    silence-based refusal. So the fractional digits are read ONE AT A TIME with no separator — Lingala's
    //    resolution, and what `sources.ts` itself prescribes for this case. What is being fixed is the
    //    spurious PAUSE and the mis-read tail, not the missing word: reading `6` in `934.6` as a NUMBER is
    //    right, but reading `25` in `1.25` as one would say *mĩrongo ĩrĩ na ithano*, a different quantity.
    //    ⚠ THERE IS NO COMMA ARM, and that is measured rather than inherited. The sibling Bantu layers have
    //    one because their corpora carry the SI decimal comma; ki's does not. Every `\d+,\d{1,2}` in this
    //    corpus is from ONE maths article and neither instance is a decimal — `ndari(0,1)` is an interval
    //    pair and `ndari 1,2,3,4,5,6,7,8,9` is a digit list — against 86 comma-GROUPED thousands. A comma
    //    arm here would claim the list and nothing else. The comma keeps the pause it already was.
    //    ⚠ THE GUARDS EXCLUDE A MULTI-DOT RUN on both sides, which is what leaves the corpus's numbered
    //    dictionary clauses alone: `11.3.42`, `3.3.26`, `17.5.14`, `16.5.10` (×4 in the retained text) are
    //    entry numbers, not quantities, and a decimal rule that claimed their first dot would spell half of
    //    one out. It also leaves the Korean news datelines `2013.07.27` alone, which are not Kikuyu at all.
    //    ⚠ AND A TRAILING LETTER IS EXCLUDED, keeping a dotted designation (`802.11a`) out — ×0 here, the
    //    same robustness argument as step 8's version guard.
    s = s.replace(/(?<![\d.,])(\d+)\.(\d+)(?![\d.,\p{L}\p{M}])/gu,
        (_m, int: string, frac: string) => `${int} ${[...frac].join(" ")}`);

    return tidy(s);
}

/** ⚠ A padded replacement doubles a space that was already there and can leave one at an edge. SLOT-GAP is a
 *  corpus-diff defect class; this pass may not feed it. */
function tidy(s: string): string {
    return s.replace(/[^\S\n]{2,}/gu, " ").replace(/^[^\S\n]+|[^\S\n]+$/gu, "");
}
