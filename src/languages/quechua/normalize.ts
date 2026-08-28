/**
 * Quechua / Runasimi (qu) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not
 * already a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * ⚠ WHICH QUECHUA, AND WHY THAT QUESTION CAME FIRST. Quechua is a MACROLANGUAGE (Cusco-Collao,
 * Ayacucho-Chanka, Ancash, Ecuadorian Kichwa, …) with real orthographic divergence — three-vowel vs
 * five-vowel spelling, and the ⟨q/k⟩ and ⟨sh⟩ conventions. `quechua.jsonc` declares SOUTHERN QUECHUA in the
 * standardised trilingual orthography, and the corpus was counted before a single word was sourced:
 *
 *     locative      -pi ×505           vs  Ancash -chaw ×8            63 : 1
 *     "Quechua"     qhichwa ×33        vs  qichwa ×3 · kichwa ×4
 *     Cusco         Qusqu ×28 (3-vowel) vs Qosqo ×3 (5-vowel)
 *     2 / 3 / 5     iskay ×14 · kimsa ×6 · pichqa ×5  vs  ishkay ×0 · kinsa ×0 · pisqa ×1
 *     ejectives + aspirates ⟨k' q' p' t' ch' qh chh ph th⟩ = 319 tokens (Ancash and Kichwa have neither)
 *
 * So qu.wikipedia IS this engine's variety, and the engine and the corpus agree — unlike `bal`, which had
 * to declare a Southern/Western split. But the minority varieties are PRESENT (the artifact's own `degrees`
 * hard-set opens with *Anqas simipi, Ankash shimichu*), so the standing rule for this file is that **every
 * word below is sourced from a SOUTHERN Quechua instance and the citation says so**. A hit in an Ancash or
 * Kichwa paragraph is a hit in a different variety — see the DEGREE rule, where exactly that choice arose.
 *
 * ⚠ CONTAMINATION IS MEASURED, NOT ASSUMED, and it is SPANISH. `filter-by-language.py --lang qu` (a row
 * added for this run, whose CONTRAST set had to be calibrated: `de` ×25 and `la` ×6 occur INSIDE strongly
 * Quechua paragraphs and are every time a Spanish PROPER NAME the sentence is glossing — *kastilla simipi:
 * Provincia de Espinar* — so both are left out, exactly as `mos` leaves out `de`). Over the artifact's 446
 * retained paragraphs: 58.5% Quechua, 19.7% contrast-dominant, 21.7% undecidable. Per hard-set cell it is
 * NOT evenly spread, and that is what decides which cells may be reasoned from:
 *
 *     era-marker 12.5% · ordinal-caps 12.5% · fractions 25% · ordinal-latin 25% · sports-time 25% · dotted 37.5%
 *     units 87.5% · degrees 87.5% · grouped 87.5% · year 87.5% · decimals 100% · percent 100%
 *
 * The dirty cells are Peruvian/Bolivian BIBLIOGRAPHY blocks and Ministry-of-Education catalogue records
 * (`3a. ed.`, `S.A.`, `N.Y.`, `p. 108`, `97 p.; il., 28 cm`). Every rule below rests on a clean cell; every
 * refusal below names the dirty one it declined to reason from.
 *
 * ⚠ THE GATE SITUATION, STATED PLAINLY, BECAUSE ONLY ONE OF THEM IS A METER.
 *   · `referee-eval.ts qu` is a TRIPWIRE. It binds `phonemizeWord` over the 171-word kaikki human set
 *     (93.0% folded backbone, 97.6% symbol accuracy) and there is NO wikipron Quechua at all. Nothing in
 *     this file can move it; its job is to prove nothing moved.
 *   · `mine.ts scan`'s RAW-LATIN count IS a meter, and it is the one this layer was written against.
 *   · espeak DOES NOT SHIP QUECHUA, so `sources.ts` reports `[NONE]`/`[chk?]` for every class and the
 *     haystack is the corpus, this artifact, and qu.wikipedia via `attest.ts` — which is a BIGGER SAMPLE OF
 *     THE SAME SOURCE the artifact was mined from, never an independent one. Every word below therefore
 *     carries its token/article count AND the sense that was read.
 *
 * ── WHAT WAS BROKEN, with the whole-corpus count from tools/corpus/mined/qu.jsonc's own `counts` block ───
 *
 *     3.426.000 runakuna → *kimsa **.** tawa pachak … **.** ch'usaq*   TWO SENTENCE BREAKS inside one
 *                          number, and `000` read as a single "zero"        grouped ×2178 · digit-run ×26479
 *     28 549 745 runa    → three unrelated cardinals                        (the space-grouped form)
 *     44.5 km²           → *tawa chunka tawayuq **.** pichqa km*            decimals ×2895
 *     250 km             → a raw `km` in the phoneme stream                 units ×644
 *     28 cm              → ***km*** — CENTIMETRES READ AS KILOMETRES        see below; trap 56
 *     56 km²             → *… km*, the exponent gone as well                exponent ×206
 *     2.766.890 km&sup2; → the entity survives as text                      (HTML entities)
 *     90°                → the sign silent                                  degrees ×32
 *     $350.000.000       → the sign silent                                  currency ×15
 *     Ames & C.Schweinf. → the sign silent                                  ampersand ×1546
 *
 * ⚠ THE `cm` ROW IS THE ONE NO COUNTER SEES, and it is playbook trap 56 in a language that had not been
 * checked for it. `quechua.jsonc` maps ⟨c⟩→/k/ (correct — Quechua writes ⟨k⟩ and ⟨c⟩ only in loans), so an
 * undeclared `cm` reaches the g2p and comes out as **[km]** — byte-identical to the kilometre reading. `28 cm`
 * and `250 km` produced the SAME phoneme string. That is the `nya`/`tl` defect exactly: DIGIT, SLOT-GAP,
 * RAWMARK, DROP and THROW are all blind to it, because the token was converted and the result is
 * pronounceable. It is only visible in the `LEAK RAW-LATIN km ×32` line because the leak class prints the
 * SOURCE token — reading the count would have said "32 kilometres"; reading the instances says 7 of them
 * are centimetres. Declaring `cm` is the whole fix.
 *
 * ── SOURCING, one line per word, with the sense that was read ───────────────────────────────────────────
 *
 * ⚠ THE UNIT NOUNS COME FROM A PAGE CLASS THAT IS FORCED TO SAY THE THING (trap 40's lesson): qu.wikipedia's
 * own SI-units article names each ABBREVIATION beside its word, which is stronger than any bare token count:
 *
 *     "Sikundu s: Mit'awi (Pacha)  Mitru m: Karu kay  Litru l: P'ulin  Kilugramu kg: Wisnu"
 *     "Sintimitru (cm): 10-2 mitru.  Milimitru (mm): 10-3 mitru.  Nanumitru (nm): 10-9 mitru.
 *      Angstrom (Å): 10-10 mitru."
 *     "Ångström icha angstrom (sanancha: Å) nisqaqa mana-SI tupuy…"
 *     "A - T'asra mitru m2   P'ulin V - Machina mitru m3 = 1000 Litru l"
 *     "Utqa kay v - Mitru sikunduman m/s"        ← and this one settles the RATE idiom, see `units` below
 *
 * `attest.ts --lang qu` token/article counts, each sense read in its own quoted prose:
 *   mitru ×49/20 — *"3824 mitrukuna kachkan"*, *"5.018 mitrum aswan hanaq"*, elevations throughout
 *   kilumitru ×16/13 — *"tawa chunka kilumitru Hanan Chinchamanta karu"*, *"chunkalla kilumitru karum"*
 *   sintimitru ×8/8 — *"kimsa chunka sintimitru sunim"* (a fish's length), *"qanchis sintimitru sunikamam"*
 *   milimitru ×2/2 · nanumitru ×2/2 · mikrumitru ×1/1 — all in the SI table above
 *   kilugramu ×10/8 — *"Waranqa k'isura, kilugramu icha kilu [kg]"*, the sign named beside the word
 *   angstrom ×4/3 — the sign named beside the word, and *"34 angstrom (3.4nm)"* in running text
 *   t'asra ×18/16 — the SQUARE modifier, BEFORE its noun: *"Hawanqa 2.260,19 t'asra kilumitrum"* (a
 *     province's area), *"3.500 t'asra mitru hatun"*, *"yaqa 261 t'asra kilumitru (101 sq mi)"* — glossed
 *     against `sq mi` in its own sentence. ⚠ Its geometry article defines it as the SHAPE (*"T'asra,
 *     Tawak'a icha Millka (kastilla simipi: cuadrado)"*), which is trap 37's hazard; the collocation
 *     `t'asra mitru` ×3/3 and `t'asra kilumitru` ×1/1 are what attest the UNIT sense, not the bare word.
 *   machina ×12/11 — the CUBE. ⚠ THIN AND SAID SO: the bare word is a DICE (*"Wayru icha Machina"*) and an
 *     ADOBE BRICK (*"t'urumanta rurasqa machina hina"*) far more often, and `machina mitru` is ×1 in ONE
 *     article — the SI table above. What supports it is a second, independent expression in the geometry
 *     article, *"Machina (cubo, suqta t'asra kaq uyayuq pachanka)"* — "a cube, the solid with six square
 *     faces" — which agrees with the SI table's slot. See the trap-53 note on `exponentWords` for why the
 *     alternative was NOT neutral.
 *   thular / dular — the DOLLAR, both spellings, both in the money slot beside the sign: *"$4.3 thular
 *     qullqita"*, *"$10.8 hunu thular"*, *"$20 hunu dular qullqita"*, and the currency's own article is
 *     titled *"Amirikanu dollar icha Amirikamanta thular"*. See `countForm` for how the pair is declared.
 *   k'atma ×8/3 — the ANGULAR DEGREE, and this is where the variety rule bit. See the DEGREE step.
 *   wan — the conjunction, and the corpus writes it as a FREE word joining two names five times over:
 *     *"Bryan McCann wan Richard Socher"*, *"Motorola Mobility wan Motorola Solutions"*, *"Julio Jaramillo
 *     Arroyo wan Arnau Gazquez"*, *"Pennsylvania wan Massachusetts"*. (Quechua's `-wan` is normally an
 *     ENCLITIC, which is the one shape `ampersand` warns against — the corpus's own free use settles it.)
 *
 * ── WHAT IS DELIBERATELY NOT DONE, each with the count and the check that refused it ────────────────────
 *
 * · NO PERCENT WORD (`%` ×170 whole-corpus, `DROP percent ×11`). This is Tashelhit's position and it is the
 *   reason `SymbolData.percent` is optional. Two candidates were probed and BOTH FAIL ON SENSE, which is
 *   the strong kind of refusal (`zu amaphuzu`), not the weak kind (`ig` corpus silence):
 *     `pachakmanta` ×13/13 — and TWELVE of the thirteen are "N HUNDRED" with an ablative, not a
 *       percentage: *"qanchis pachakmanta aswan rikch'aqkunam"* (more than seven hundred species),
 *       *"iskay pachakmanta aswan rikch'aqmi"*, *"tawa pachakmanta aswan papa rikch'aqkunata"*. The one
 *       remaining hit is *"sapa pachakmanta 14.6% rantikuyniyuq"* — where the SIGN IS STILL THERE, so it
 *       is an adjacent gloss and not the sign's spoken reading.
 *     `pursintu` / `pursyintu` / `porsyentu` / `pachakchasqa` — ×0 each on qu.wikipedia.
 *   A wrong percent word is worse than a dropped sign. The arm is omitted, so the sign stays exactly where
 *   the RAWMARK/DROP gates can see it, and `review.ts --lang qu` stays RED on it (trap 24).
 * · NO DECIMAL-POINT WORD, and the separator is instead made SILENT rather than left as a pause — see step
 *   5, which is where the reasoning lives, because this is a trap-53 decision and not a refusal.
 * · NO CELSIUS OR FAHRENHEIT, and there is nothing to read: `°C`, `°F`, `℃` and `℉` are ALL ×0 in this
 *   corpus. The degree rule refuses a scale letter anyway (trap 8 — probe the adversarial neighbour), so
 *   `20 °C` cannot become *iskay chunka k'atma* plus a ⟨C⟩ that this engine would read as /k/.
 * · NO RANGE JOINER (`ranges` ×3323, and the artifact writes `1945-1949`, `1824 – 1895`, `843-1806`,
 *   `0-500 msnm`, `167-184 mm`). ⚠ THE REFUSAL IS MORPHOLOGICAL, NOT LEXICAL, AND IT IS TRAP 14. Quechua
 *   says "from X to Y" with BOUND SUFFIXES on the two numerals — `-manta … -kama` — and this corpus writes
 *   exactly that in prose: *"3000 ñp watamanta 2500ñp watakama"*, *"100 qp-niqmanta - 700 qp-niqkama"*,
 *   *"3 800 mitru hanaqmanta 5.000 mitru hanaqkama"*, *"380-manta 780-kama nanumitru"*, *"25-manta
 *   60-kama kilugramu"*. A suffix cannot be applied to DIGITS, because the digits become words in the
 *   tokenizer downstream of every rule here; and there is no free infix joiner to reach for, which is the
 *   Fula `hakkunde` part-of-speech lesson arriving from the other side. Converting both operands to words
 *   inside the rule is the documented fix shape (Welsh, Azerbaijani) and it is a bigger change than one
 *   language's normalization commit should carry unmeasured. Counted and declined, not overlooked.
 * · NO CLOCK (`clock` ×602 whole-corpus, and this is trap 55 — the sibling's rule was NOT copied). The
 *   cell is 4 Quechua / 4 foreign, and the FOREIGN half is the shape a bare-colon rule would claim: five of
 *   the eight hard-set instances are the SAME Ministry-of-Education catalogue record (*"…, 2005. 97 p.;
 *   il., 28 cm."*). Of the genuinely Quechua `N:NN` instances, the artifact's are `23:40:56 UTC` and
 *   `21:53:10 UTC` (earthquake timestamps, three fields — not a clock, playbook `sports-time`), the
 *   swimming times `1:52.78` / `2:00.70` / `3:26.43` inside a SPANISH results table, and `Tiempo: 1:26:35`
 *   (a film runtime, in Spanish). There is no Quechua hour-reading in this corpus at all, and no attested
 *   Quechua idiom for one — the language's own time expressions here are *samay ura*, *pacha* and the
 *   `-ta` accusative, never a colon. `ceb` accepts a bare `\d{1,2}:\d{2}`; here that would fix nothing and
 *   claim eight foreign strings. The `:` keeps the comma pause it already was.
 * · NO MULTIPLICATION WORD (`×` ×2 in the retained corpus, `arithmetic` ×356 whole-corpus). The two senses
 *   DISAGREE and only one has a candidate: `2.9–4.8 × 109 inti masayuq` is a PRODUCT (scientific notation)
 *   and `1874, 80 × 100 cm` is a painting's DIMENSIONS, which wants "by". `kuti` is attested in the product
 *   slot exactly once — *"huk Newton N nisqaqa huk kilugramu kuti mitru t'asra sikunduman"* (kg·m/s²) — and
 *   `multiply.by` defaults to `multiply.times`, so declaring the one word would read the canvas as
 *   "eighty TIMES one hundred centimetres". One article, one slot, and the wrong answer for half the
 *   instances; declined.
 * · NO EQUALS WORD (`DROP math-sign ×31`, `arithmetic` ×356). ⚠ READ THE INSTANCES BEFORE BELIEVING THE
 *   COUNT — the dominant sense here is not arithmetic at all but TAXONOMIC SYNONYMY: *"Anas specularoides =
 *   Lophonetta specularioides"*, *"Pseudalopex culpaeus = Dusicyon culpaeus"*, *"Centropelma microptera =
 *   Rollandia microptera"* — six of the eight `arithmetic` hard-set instances, and every one a pair of
 *   Latin binomials in which the sign means "is the same species as". The remainder are a GLOSS
 *   (*"km² = t'asra waranqa thatki"*, *"Muyuk'uchu = 360 patakuna"*) and LaTeX residue
 *   (*"\mathbb{R} = \{x / x\}"*). No Quechua word is attested for any of the three readings.
 * · NO MINUS OR PLUS WORD (`signed-number` ×185, `DROP minus ×2`). Every leading sign in the retained
 *   corpus is a MEASUREMENT PLUS on an elevation — `+4.200 mitrum`, `+4.600 m`, `+4.800 m`, `+4.000 m`,
 *   `+4.400 m` — where the playbook's own conclusion applies: a plus is redundant with the "aswan hanaq"
 *   ("higher than") the sentence already carries, and omitting a plus is LOSSLESS. ⚠ The minus is a
 *   different matter and the refusal is recorded as WRONG-IF-A-NEGATIVE-APPEARS rather than as safe:
 *   omitting a minus INVERTS. The corpus's two `DROP minus` instances are a complex-number worked example
 *   (*"(2 + 5i) + (-8 +17i)"*) and a Gantt-chart offset (`shift:(25,-10)`); there is no negative QUANTITY
 *   in this corpus and no Quechua sign word in any source, so nothing is read. That is why `minus` is NOT
 *   entered as an accepted silence — the ak / ln / bm / ilo stance.
 * · NO LETTER NAMES, SO NO INITIALISMS (`initialism` ×6130, `letter-name` ×5512 whole-corpus). ⚠ AND THE
 *   SOURCE EXISTS BUT IS NOT A LETTER-NAME TABLE, which is worth recording so nobody re-derives it:
 *   qu.wikipedia has one article PER LETTER (*"A, a nisqaqa latin siq'i llumpapi huk kaq sanampam"*,
 *   *"H, h nisqaqa … pusaq kaq sanampam"*), and they give each letter's ORDINAL POSITION in the alphabet,
 *   never its spoken NAME. espeak does not ship Quechua, so `core/initialisms.ts` has nothing to key on.
 *   A sourcing gap, not a seam gap.
 * · NO ERA MARKER (`era-marker` ×58). The cell is 12.5% Quechua — its hard-set is `3a. ed.`, `S.A.`,
 *   `N.Y.`, `p. 108`, Spanish and English bibliography. The genuinely Quechua era forms in this corpus are
 *   `qp` and `ñp` (`800 qp wataniqpi`, `3000 ñp watamanta`, `100 qp-niqmanta`) — abbreviations of
 *   *qhipa pacha* / *ñawpa pacha*, and they carry `LEAK RAW-LATIN qp ×1`. ⚠ Left unread deliberately: the
 *   paragraph they live in is the corpus's most variety-mixed (it writes `shinallataq`, `shukllachisqa`,
 *   `aywasqakunapi` — Ancash/Kichwa forms), so it is the ONE place a sourced expansion would be sourced
 *   from the wrong variety. Run 2's rule applies to my own convenience too.
 * · NO ORDINALS. Quechua's ordinal is the SUFFIX `-ñiqin` / `-niq`, which the corpus already writes as
 *   words (*"15 ñiqin chakra yapuy killapi"*, *"30 ñiqin inti raymi killapi"*, *"chunka isqunñiqin"*) —
 *   the seam already works and needs nothing (trap 16, from the other direction). `ordinal-latin` ×1210 is
 *   a 25%-Quechua cell and its hits are Spanish (`1.`, `2.Bajar`, `Tercera Edición`).
 * · NO ROMAN-NUMERAL RULE, and none is needed: `qu` is not in `ROMAN_NATIVE`, so `registry.ts` converts
 *   them to digits before `text()` runs. Verified end-to-end on `XV` (a vowel-less operand — trap 16's
 *   instruction), which already reads *chunka pichqayuq*.
 * · NO `g` OR `l` UNIT KEY, even though both words are attested (`gramu` ×3/3, `litru` ×3/3) and both are
 *   named beside their abbreviation in the SI article. Measured: digit-adjacent `g` is ×0 and digit-adjacent
 *   `l` is ×0 in this corpus, so a one-letter key here buys NOTHING and is pure exposure — trap 46's
 *   "withdraw the key where it buys nothing", which is why `is` and `sd` gave theirs back.
 * · NO `mi`, `p`, `msnm`, `vlms` or `pdf` READING, which is the rest of the `LEAK RAW-LATIN` tail and is
 *   deliberately left red. `mi` ×1 is an ENGLISH parenthetical glossing a metric figure the sentence has
 *   already given (`261 t'asra kilumitru (101 sq mi)`, `0.5 hunu mi2`) — Kikuyu and Shona declined the same
 *   class for the same reason. `p` ×10 and `vlms` ×1 are Spanish bibliography (`97 p.`, `5 vlms`), `pdf`
 *   ×1 a filename, `msnm` ×2 the Spanish *metros sobre el nivel del mar* — none of them Quechua.
 */
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { MANIFEST } from "./manifest.ts";
import { tr } from "../../core/provenance.ts";

/**
 * The shared symbol tier. Quechua marks plurality with `-kuna` on the noun and NOT after a numeral (the
 * corpus writes `250 km`, `3824 mitrukuna`, `chunka sintimitru` — the bare stem after a count), so every
 * `CountForms` here is a one-element citation form, except the dollar pair described below.
 *
 * ⚠ `percent` IS ABSENT ON PURPOSE — see the header. The field is optional precisely so a language with no
 * sourceable word can still take the tier for everything else, and the sign is left where the gates see it.
 *
 * ⚠ THE RATE IS A COMPOUND KEY, NOT `unitPer`, AND THAT IS TRAP 44. Quechua does not say "A per B" — it
 * puts the DENOMINATOR in the DATIVE, as a bound `-man` suffix on the unit noun, which is exactly what
 * qu.wikipedia's SI article writes: *"Utqa kay v - Mitru sikunduman m/s"* ("speed: metre to-the-second").
 * `unitPer` is one invariant string joining two independently-declared nouns and cannot express a case
 * suffix, so each rate is declared whole — the same move Māori made for `m/h`, and for the same reason.
 * `s` is therefore never a standalone key either, which is the `Il-76s` hazard avoided for free.
 *
 * ⚠ `m³/s` IS DECLARED WHOLE for the same reason and one more: the tier's exponent branch and its rate
 * branch are alternatives, so `m³/s` matches neither composed form. ×2 in this corpus (`14 m³/s`,
 * `88 m³/s`, river discharges) and it would otherwise read as *mitru* plus a raw `/s`.
 */
const SYMBOLS = makeSymbolNormalizer({
    countForm: () => 0,
    currency: MANIFEST.symbolTier.currency,
    units: MANIFEST.symbolTier.units,
    magnitudes: MANIFEST.symbolTier.magnitudes,
    exponentWords: MANIFEST.symbolTier.exponentWords,
    ampersand: MANIFEST.symbolTier.ampersand,
});

/**
 * HTML entities this corpus actually contains, counted: `&nbsp;` ×26, `&sup2;` ×1, `&bull;` ×1. Nothing
 * else occurs. `&sup2;` matters out of proportion to its count because it sits in the exponent slot —
 * `2.766.890 km&sup2;` is an AREA whose square marker is spelled as an entity, so without this fold the
 * unit step sees a bare `km` and the square is lost twice over (the sign AND the word).
 *
 * ⚠ ALL FOUR ROWS ARE NOW REDUNDANT WITH `core/markup.ts`, which runs first (registry.ts) and decodes every
 * one of them — `&bull;` was added there on the strength of THIS corpus line, and to a space for the reason
 * this table already chose one: U+2022 is read by no engine, and a bullet's reading is the break a space
 * gives. Kept rather than deleted because the table is this file's stated record of what the corpus
 * contains, and a corpus-diff over qu is inert either way (measured: 0/445 utterances move).
 */
const ENTITY: Readonly<Record<string, string>> = {
    "&nbsp;": " ", "&bull;": " ", "&sup2;": "²", "&sup3;": "³",
};
/** ⚠ THE LOOKUP FALLS BACK TO THE MATCH, AND THE MISS BRANCH IS REACHABLE (#1122) — the pattern's `iu`
 *  flags fold U+017F LONG S onto `s`, so `&ſup2;` matches while its key does not exist and the `!` that
 *  used to be here made `String.replace` stringify `undefined`: `km&ſup2;` read *kmundeˈfined*. */

/**
 * Quechua text normalization. A numbered, ORDER-DEPENDENT sequence; each step states its coupling, because
 * a future reader cannot recover the ordering from the code.
 */
export function normalizeQuechua(input: string): string {
    let s = input;

    // ── 1. NFC, HTML ENTITIES, AND FORMAT CHARACTERS — before anything looks for a number ───────────────
    // `&nbsp;` ×26 sits exactly in the gap a number-unit adjacency needs (`6880&nbsp;m`, `107&nbsp;km`),
    // so the unit step below cannot fire at all until it is a real space. `&amp;` is unfolded FIRST or a
    // doubly-escaped entity survives as the word "amp" plus a semicolon.
    // ⚠ THE FORMAT-CHARACTER STRIP IS NOT COSMETIC: the artifact's `zero-width` cell is ×25 (U+200B inside
    // `Churinkuna:​`, `wan​ Francisco`), and a zero-width INSIDE a word splits it into two tokens, which is
    // silent damage of the same class as a dropped letter.
    // ⚠ NFC first, so a decomposed letter is one code point before any literal below is matched; the g2p
    // NFCs again downstream and the fold is idempotent, so this costs nothing.
    s = s.normalize("NFC").replace(/&amp;/giu, "&")
        .replace(/&(?:nbsp|bull|sup2|sup3);/giu, (e) => ENTITY[e.toLowerCase()] ?? e)
        .replace(/\p{Cf}/gu, "");

    // ── 2. DE-GROUP THOUSANDS — FIRST among the numeric rules, and the largest defect this layer repairs ─
    // `.` and `,` are both clause punctuation in quechua.jsonc and the TOKEN splits on `\d+`, so
    // `3.426.000 runakuna` read as *kimsa **.** tawa pachak iskay chunka suqtayuq **.** ch'usaq* — one
    // number delivered as three, with two SENTENCE BREAKS inside it, and the final `000` collapsed to a
    // single "zero". `grouped` ×2178 whole-corpus.
    // ⚠ QUECHUA WIKIPEDIA WRITES ALL THREE CONVENTIONS AT ONCE, which is why there are three arms and why
    // the sibling layers' single-arm shape does not transfer (trap 55). Counted over the retained corpus:
    //     `.` grouping ×88   (`3.426.000`, `184.101.109`, `2.766.890`, `1.007 km`, `4.294 m`)
    //     ` ` grouping ×14   (`28 549 745 runa`, `4 000 000`, `818 289 tiyaqkuna`, `3 800 mitru`)
    //     `,` grouping ×12   (`1,077,900,000`, `49,600`, `144,300 wata`, `186,282 mi/s`)
    // and the SAME two marks are the decimal separator: `.` ×30 (`44.5 km²`, `1.28 hunu`, `8.0 graduyuq`)
    // and `,` ×16 (`88,1%`, `27,59 km²`, `8,76 runa/km²`, `0,59`). So the block length is the ONLY
    // discriminator available, and it is applied strictly.
    // ⚠ EXACTLY THREE DIGITS PER BLOCK, and the head must start 1–9. That is what leaves every decimal
    // above intact, and what declines a leading-zero run (`0.500` is never a grouped thousand).
    // ⚠ THE TRAILING GUARD IS A BARE `(?!\d)`, deliberately, so a grouped figure followed by a DECIMAL tail
    // still de-groups: the corpus's `5 311.09 km²` needs `5 311` → `5311` while `.09` survives to step 5.
    // ⚠ AND `802.11` IS SAFE BY CONSTRUCTION — two digits after the dot, so no arm can claim it. That is
    // load-bearing: the unit step's `NOT_VERSION` guard runs after this one and still needs its dot.
    const degroup = (sep: RegExp) => (w: string) => w.replace(sep, "");
    s = tr(s, /(?<![\d.,])([1-9]\d{0,2})(?:\.\d{3})+(?!\d)/gu, degroup(/\./gu));
    s = tr(s, /(?<![\d.,])([1-9]\d{0,2})(?:,\d{3})+(?!\d)/gu, degroup(/,/gu));
    s = tr(s, /(?<![\d.,])([1-9]\d{0,2})(?:[ \u00a0\u202f\u2009]\d{3})+(?!\d)/gu, degroup(/[ \u00a0\u202f\u2009]/gu));  // space, NBSP, NNBSP, thin space

    // ── 3. THE SHARED TIER — units, exponents, rates, currency, `&` ─────────────────────────────────────
    // ⚠ AFTER de-grouping, or `1.007 km` is seen as `007 km` and the kilometre attaches to the wrong
    // operand. ⚠ AND BEFORE the decimal step, which is the playbook's "units before decimals" coupling in
    // its strongest form here: the tier matches a unit only when a NUMBER is adjacent, AND its
    // `NOT_VERSION` guard works by SEEING THE DOT (traps 39 and 46). Step 5 spends that dot, so a tier
    // placed after it would have `802.11m` read as eleven metres. Exactly one position in this sequence is
    // correct and this is it.
    s = SYMBOLS(s);

    // ── 4. THE DEGREE SIGN → `k'atma`, postposed ────────────────────────────────────────────────────────
    // `degrees` ×32 whole-corpus, `DROP degree ×8` in the scan. Every instance is an ANGLE or a COORDINATE
    // — `90°`, `0°`, `180°`, `52°31′ N`, `15°35′50″S`, `13° 43′ 55″ S` — and there is not one `°C`, `°F`,
    // `℃` or `℉` in the corpus.
    // ⚠ THIS IS WHERE THE VARIETY RULE BIT, AND IT CHANGED THE WORD. Two candidates are attested and they
    // are from DIFFERENT VARIETIES. `k'atma` ×8 tokens / 3 articles is the Southern Quechua latitude and
    // longitude articles, in exactly this slot: *"chinchay hanaq isqun chunka k'atma (90° Ch / 90° N)"*,
    // *"ch'usaq k'atma (0°)"*, *"anti pachak pusaq chunka k'atma (180° An / 180° E)"*. `pata`/`patakuna`
    // is the competitor and it reads well — *"Tupunin 90°, rimay isqun chunka patakuna"* — but that
    // sentence is ANCASH, and says so in its own words: *"(Anqas simipi, Ankash shimichu)"*. Picking by
    // fit alone would have taken the wrong variety's word into a Southern Quechua engine.
    // ⚠ THE SCALE-LETTER REFUSAL IS A GUARD, NOT A COMMENT (trap 8 — probe the adversarial neighbour).
    // With no Celsius word, `20 °C` must NOT become *iskay chunka k'atma* plus a bare ⟨C⟩, because this
    // engine maps ⟨c⟩→/k/ and the leftover letter would surface as a plausible Quechua phoneme attached to
    // nothing. Refusing the WHOLE match leaves `°C` reading exactly as it did before, which is the `ak`
    // shape of a genuinely neutral refusal.
    // ⚠ AND A REDUNDANCY GUARD, because this corpus's own sentences write BOTH the word and the sign
    // (playbook trap 12): five of the eight `°` instances sit inside `… isqun chunka k'atma (90° N)`.
    // Where the word is already there the sign is dropped and nothing is doubled.
    s = tr(s, /(?<![\p{L}\p{M}])(\d+)\s?°(?![CF])/gui, (whole, n: string, at: number) => {
        const near = s.slice(Math.max(0, at - 40), at + whole.length + 40);
        return near.includes("k'atma") ? n : `${n} k'atma`;
    });

    // ── 5. THE DECIMAL SEPARATOR IS MADE SILENT — the one rule here that reads no word ───────────────────
    // `decimals` ×2895 whole-corpus. ⚠ THIS IS NOT A REFUSAL, IT IS A TRAP-53 PRICING, and the distinction
    // is the whole reason the step exists. There is NO sourceable Quechua decimal-point word: `sources.ts`
    // reports `decimal-point [NONE]` (no espeak, no manifest word), and the two candidates a wiki probe
    // offers both fail ON SENSE, which is the strong kind of negative rather than the `ig` kind —
    //     `puntu` ×8/4 — a DISTRICT (*"Puntu distritu … distrito de Pontó"*), a place (*"Uma llaqtanqa
    //         Puntu llaqtam"*) and a FERN (*"puntu-puntu (Campyloneurum angustifolium)"*).
    //     `kuma` ×5/5 — the ARCHITECT Kengo Kuma ×2, a Turkish film title, and *"Q'uma, kichwapi Kuma"*
    //         (something bad or leftover). Not one is a separator.
    // So no word is authored. But LEAVING the mark is not neutral either: `.` and `,` are declared clause
    // punctuation, so doing nothing keeps emitting a SENTENCE BREAK in the middle of every measurement
    // (`44.5 km²` → *tawa chunka tawayuq **.** pichqa t'asra kilumitru*). Replacing the separator with a
    // space converts a confidently-wrong PROSODY into an honest omission: the value's digits are still all
    // spoken, in order, and only the unsourceable word is missing — which is what "leave the symbol
    // unread" means mechanically. It is recorded here as a known-lossy reading, not as a fix.
    // ⚠ DIGIT ON BOTH SIDES AND NO SPACE, so a sentence period followed by a numeral (`… kan. 100 runa`)
    // and a clause comma (`…kachkan, 3824 mitru`) are untouched — both are spaced in every instance.
    // ⚠ AFTER the tier (step 3), so the number-unit adjacency and the version dot both still existed when
    // they were needed.
    s = tr(s, /(\d)[.,](\d)/gu, "$1 $2");

    return s;
}
