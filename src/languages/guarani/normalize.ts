/**
 * Paraguayan Guaraní (gn) text normalization — the pre-tokenizer pass that rewrites everything which is not
 * already a pronounceable word into words the pipeline speaks. Pure text→text; no IPA.
 *
 * Corpus: `tools/corpus/mined/gn.jsonc` — a gn.wikipedia dump, 35,143 paragraphs, 433 retained (233 hard +
 * 200 sample). Whole-corpus figures below come from the artifact's `counts`; a figure marked "retained" is a
 * count over those 433 segments and is a lower bound.
 *
 * ⚠⚠ THE BIGGEST DEFECT IN THIS LANGUAGE IS NOT A NUMBER RULE — IT IS A CHARACTER. gn.wikipedia writes the
 * PUSO (the glottal stop /ʔ/, a phoneme of Guaraní) three ways, and the engine read only two of them:
 *
 *     '  U+0027 APOSTROPHE           ✓ in `graphemes`
 *     ’  U+2019 RIGHT SINGLE QUOTE   ✓ folded by `phonemizeWord`
 *     ꞌ  U+A78C LATIN SMALL SALTILLO ✗ ×301 in 433 segments — SILENTLY DELETED
 *
 * The saltillo is `\p{Script=Latin}`, so `hostWordRun` matches it as a LETTER and `makeNativiser` leaves it
 * alone (it has no decomposition and is not in `UNDECOMPOSABLE`); then `graphemes` has no key for it and the
 * scan drops it on the floor. `mbaꞌe` read *ᵐbaˈe* where `mba'e` reads *ᵐbaˈʔe* — a phoneme gone, invisible to
 * every leak class, because nothing survives and nothing is a digit or a mark. Whole articles use it
 * consistently (`heꞌõporã`, `Mboꞌehára`, `ñeꞌẽ`, `haꞌe`), so this is one of the wiki's two house styles and
 * not a typo. gn.wikipedia's own article on the puso says so in as many words:
 *     "Ambue tape ojehai hag̃ua puso haꞌe saltillo ⟨Ꞌ ꞌ⟩ (majúhkula ha minúhkula)"
 *     — "Another way to write the puso is the saltillo ⟨Ꞌ ꞌ⟩ (upper and lower case)."
 *
 * ⚠ AND `ʼ` U+02BC IS THE SHARPER BUG AT ×2, BECAUSE THE FOLD FOR IT ALREADY EXISTS AND CAN NEVER RUN.
 * `phonemizeWord` opens with `.replace(/[’ʼ]/gu, "'")` — but U+02BC is script COMMON, so it is outside the
 * TOKEN class, so the tokenizer SPLIT THE WORD IN TWO before `phonemizeWord` ever saw it: `ñeʼẽ` → *ˈɲe ˈẽ*,
 * two words where Guaraní has one. Playbook trap 39 in its general form — a guard's evidence has a lifetime,
 * and this one was written one layer below where it was needed. Folding here, above the tokenizer, is the
 * only position that works for all three glyphs.
 *
 * ⚠ THE JOPARA MEASUREMENT, because it decides which evidence below is usable. Paraguay is officially
 * bilingual and written Guaraní is Jopara — Guaraní grammar with dense Spanish lexical borrowing — so
 * contamination was measured before any rule was written (`filter-by-language.py`, which had no `gn` row and
 * now has one, with SPANISH as the contrast set rather than English). Over the retained text: 84.5% Guaraní-
 * dominant, 8.8% undecidable, **6.7% Spanish-dominant** — materially cleaner than bal's 37.4% or bar's 24%.
 * But it is not spread evenly, and the per-cell numbers are what shaped three refusals below:
 *     clock 12.5% · arithmetic 50% · dotted 50% · latin-in-native 62.5% · ordinal-latin 62.5% · rest 87.5–100%
 *
 * ⚠ THE `ha` TRAP, AND IT IS THE ONE THAT WOULD HAVE COST MOST. `sources.ts` reports that this corpus writes
 * `ha` after a number ×30, which reads as an invitation to declare the HECTARE. Every one of those thirty is
 * something else, and they split into two kinds:
 *     · `N ha M` (spaced) ×17 retained — the COORDINATOR "and", the corpus's commonest token at ×932:
 *       `70 ha 80% rupi`, `600 ha 900`, `1523 ha 1534`, `1.400 ha 1.600 milímetro`. Not one hectare.
 *     · `Nha` (glued) ×15 retained — the ORDINAL SUFFIX: `12ha` is *twelfth*, not twelve hectares
 *       (`Méhiko niko tetã mba'ehetavéva 12ha producto interno bruto rupive`).
 * The word `hectárea` IS attested and abundant (×37/20 articles on the wiki, digit-adjacent: `64.405
 * hectárea`, `9 hectárea rupi`, `30.000 hectárea`) — but the ABBREVIATION is unusable in this language, so
 * `ha` is not in `units` and never will be. This is the `pwen` failure shape caught before it landed.
 *
 * SOURCING. espeak does not ship Guaraní at all, so `sources.ts` is nearly empty for it and every word below
 * comes from gn.wikipedia via `attest.ts` (cache: `tools/corpus/attest/gn.jsonc`), corroborated by an
 * independent web pass. Where the two disagreed or found only one article, the symbol is left unread and the
 * count is recorded so the question can be re-opened in one command (trap 24).
 *
 * ⚠ THE RESIDUAL `LEAK RAW-LATIN km ×5`, RESOLVED ONE AT A TIME — because trap 54 says a declared unit that
 * still reports has a cause the unit table cannot show, and none of these five is a missing key (`435 km²`,
 * `2.294 km²`, `246.925 km²` and `1.483 mm` all read correctly):
 *   · `9,9 ava/km2` and `75,72 ava/km²`, `3,41 ava/km²`, `2,57 hab/km²` — a COMMON-NOUN NUMERATOR, `ava`
 *     "person", i.e. population density. This is bar's `Eihwohna/km²` row exactly: there is no digit adjacent
 *     to the unit, so the tier's digit-adjacent path declines the whole match. ⚠ And the ASCII form is the
 *     worse half — with no digit before it, `km2` reads `km` raw PLUS *mokõi*, the NUMBER two (ig's
 *     `790 km2` shape, trap 53). Nothing the unit table can name; it needs a population-density rule.
 *   · `95 amo 115 km/h` — the RATE, declined whole for want of a connective. `aravo` is sourced as the hour
 *     but no Guaraní "per" is, so `unitPer` is undeclared and the tier reads the numerator and leaves `/h`,
 *     which the g2p then voices as a bare [h]. That stray consonant is the price of the refusal and it is
 *     honestly one token SMALLER than the raw `km` it replaced — recorded rather than papered over, because
 *     the fix is a sourced word and not a rule.
 *   · `400 mm/año` — the same shape with a SPANISH denominator, which no Guaraní unit table would carry.
 *   · `200m.s.n.m.` is NOT in this class and is worth saying so: it reads *mokõisa metro*, "200 metres",
 *     which is what `m.s.n.m.` (metres above sea level) means. The one-letter `m` key is right there.
 */
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { numberToWords } from "./numbers.ts";

/**
 * The shared symbol tier. Guaraní marks number on the noun only optionally (`-kuéra`) and never after a
 * numeral — the corpus writes `2586 kilómetro cuadrado`, `1.540 milímetro`, `30.000 hectárea`, all bare — so
 * every `CountForms` here is the single citation form.
 *
 * ⚠ WHY THE TIER AND NOT A LOCAL TABLE (trap 47's four reasons, checked one by one): the idiom IS "A per B"
 * shaped and the measure word POSTPOSES (`kilómetro cuadrado`), which the tier does natively; nothing here
 * needs to run before a rule that spends a character it inspects, PROVIDED the tier is invoked above the
 * decimal step, which it is (step 8); and gn is its own engine, so there is no override wall. Local would be
 * pure duplication.
 *
 * UNITS — every one has a gn.wikipedia ARTICLE that names its own abbreviation, which is the strongest shape
 * an attestation takes (`attest.ts --lang gn`, token/article counts):
 *   kilómetro ×35/19 — "Kilómetro ha'e hína pe pukukue ra'ãha ohechaukáva su metro (1000 m), ojehechauka tai
 *                       km rupive" — *shown by the symbol km*, in the language's own words
 *   metro     ×31/19 — "oñemoha'anga pe tai «m» rupive"; also `218 m`, `500 m` in running prose
 *   milímetro ×4/4   — digit-adjacent every time, in the rainfall slot: `1.540 milímetro rupi`,
 *                       `1.400 ha 1.600 milímetro rupi ary jave`
 *   kilogramo ×13/8  — "ojeporu «kg» (ndaha'éi «Kg») ohechauka hag̃ua pe oha'ãva"
 *   centímetro       — `1 centímetro cúbico`, in the gramo article
 * The Wikidata label for "metre" is the native calque `temira'ãha` and for kilogram `kilogarámo`; the
 * ARTICLE TITLES are `Metro` and `Kilogramo` and the running text uses those, so the loans are taken (trap 35
 * — a label is a candidate, the running text is the reading). ⚠ `temira'ãha` does occur, as a parenthetical
 * GLOSS beside the loan (`orekóva 100 metro (temira'ãha)`), which is corroboration for the loan, not a rival.
 *
 * ⚠ BARE `m` IS DECLARED, AND TRAP 46 SAYS WHAT THAT COSTS. It buys 4 retained readings (`200m`, `218 m`,
 * `500 m`, `75m` — all genuine metres, all elevations or distances) and it is also what lets the exponent
 * branch attach a measure word to `m²` at all (gu's dead `ક્યુબિક` is the warning). The hazard is a dotted
 * designation read as metres; the retained text has two (`13.75m`, `1994.199p`, both inside an arithmetic
 * string in a land-survey article) and the tier's `NOT_VERSION` guard rejects them by seeing the DOT — which
 * it can do ONLY because this file calls the tier at step 8, ABOVE the decimal fold at step 9. Move the
 * decimal above the tier and this key silently starts reading survey arithmetic as metres.
 *
 * EXPONENT — `cuadrado` ×10/10, and the COLLOCATION is the evidence (trap 37): `kilómetro cuadrado` ×5/5,
 * `21 km cuadrado`, `2586 kilómetro cuadrado`, `18 274 kilómetro cuadrado`. ⚠ One of the ten bare hits is a
 * Colombian footballer's surname (`Juan Cuadrado`) — trap 37 in miniature, and the reason the phrase was
 * probed rather than the word. `cúbico` ×3/3, postposed in every one: `1 centímetro cúbico`, `1 decímetro
 * cúbico (dm³)`, `1000 centímetros cúbicos (cm³)`. ⚠ The NATIVE calque `Supukukue irundykejojáva` exists and
 * is NOT taken: it appears only as a piped WIKILINK TARGET whose displayed text is still `kilómetro
 * cuadrado`, i.e. it is never in the running text a reader would voice.
 *
 * CURRENCY — `dólar` ×32/20, and the sense is closed by the wiki's own definition: "Dólar Tetãvore Joapykuéra
 * pegua ha'e hína VIRU TEE Tetãvore Joapykuéra pegua" (*the official CURRENCY of the United States*), with
 * `viru` and `pirapire` the native words for money beside it. `US$` gets its own key because a bare `$` is
 * letter-bounded on the left and cannot match inside it, and the corpus writes both (`$65.000`, `$350.000.000`,
 * `US$ 121.412`, `US $ 63 300 sua dólar`).
 * ⚠ `₲` IS NOT DECLARED. Paraguay's own currency is the guaraní and the wiki has an article for it
 * (`Guarani (viru)`) — but the SIGN occurs ×0 in this corpus, which is the tier's own rule for when to skip a
 * currency name, and probing the word directly is a trap: `guaraníes` reports "attested ×19/17" and every
 * single hit is the PEOPLE or a Spanish book title (*Los Guaraníes* the football side, *Estudios Guaraníes*,
 * *Cuentos Guaraníes*). That is the ilo `dollar`/*Million Dollar Baby* shape exactly.
 *
 * MAGNITUDES — `sua` (10⁶) is the engine's own scale word and the corpus hops it between a number and its
 * unit ×16 retained: `44 sua km²`, `2,3 sua hectárea`, `US$ 5.188.250 sua`, `63 300 sua dólar`. Without it
 * declared, `44 sua km²` cannot reach the unit path at all (the closing note of the playbook: `magnitudes`
 * gates the UNIT path's connective hop as well as the currency path's). ⚠ `su` (10³) is deliberately NOT
 * declared — it is a two-letter word with no digit-adjacent instance in the retained text, so it is exposure
 * with nothing to buy. `millón` is ×1 on the wiki (`22,8 millón kilómetro cuadrado`), recorded as a lead.
 *
 * PERCENT — `por ciento`, and this is the weakest word in the file, so the evidence is stated in full. The
 * sign occurs 318 times whole-corpus (×35 retained) and the corpus spells it out EXACTLY ONCE:
 *     "umíva apytégui 10 por ciento kuimba'e" — *of those, 10 percent men*
 * One token, one article. `porciento` ×0, `porsiento` ×0, `porsiénto` ×0; Wikidata has no gn label for
 * "percent" and gn.wikipedia has no article for it; a `sa`-based native construction (`sa gui`, `sa rehe`,
 * `peteĩ sa gui`) is ×0 in every form probed, and MUST NOT be composed, because nothing attests it. An
 * independent web pass reached the same single hit and the same negatives.
 * ⚠ Taken anyway, for the reason the playbook gives for exactly this shape: a written corpus is the weakest
 * evidence there is about how a SYMBOL is spoken — writers type `%`, they do not spell out how they would say
 * it — so a ratio of 1:318 is what a correct word looks like here, not a disqualification. The hit is IN THE
 * SLOT, it is the phrase the co-official language uses, and `hil` shipped `porsiyento` on the same ×1 corpus
 * evidence. ⚠ The register is a stated limit: this is the Spanish phrase in a Jopara sentence, not a native
 * Guaraní term, and no native Guaraní term was found to exist.
 *
 * ⚠ NOT DECLARED, each for a measured reason:
 *   · `ha` (hectare) — see the header. ×0 hectares against ×32 conjunction/ordinal.
 *   · `unitPer` / rate — `rate` is ×15 whole-corpus and the retained text's `km/h` ×2 are inside Spanish
 *     spans. `aravo` is the hour word (below) but nothing attests a Guaraní rate CONNECTIVE, and trap 54's
 *     `si`/`mg` rows show a rate declined whole is safer than one declined by halves.
 *   · `ampersand` — the `ampersand` cell counts 765 whole-corpus and EVERY instance in the retained text is
 *     an HTML entity, `&nbsp;` or `&thinsp;`, not a conjunction: `11&nbsp;000&nbsp;000`, `176&thinsp;215`,
 *     `30&nbsp;°C`. `stripMarkup` already decodes `&nbsp;` at the registry's dispatch point, so there is no
 *     ampersand in this language to read. (`&thinsp;` was the one entity that table lacked — ×1 retained,
 *     reading as *tˈhinsp* — reported rather than fixed here because `src/core/markup.ts` is shared; it has
 *     since been added there, to an ASCII space for the reason step 6 below documents from the other side.)
 *   · `multiply` — the `arithmetic` cell is ×69 whole-corpus and 0% arithmetic: all eight hard instances are
 *     a grammar article's conjugation tables (`karu = rekaru, okaru, jakaru…`) and pronoun lists, where `=`
 *     means "conjugates as". Reading it as "equals" would say *"karu equals rekaru"* about a paradigm.
 *   · `bareExponent` — no reading is attested for a bare power in this language.
 */
const SYMBOLS = makeSymbolNormalizer({
    percent: ["por ciento"],
    currency: { "US$": ["dólar"], $: ["dólar"] },
    magnitudes: ["sua"],
    units: {
        km: ["kilómetro"], m: ["metro"], cm: ["centímetro"], mm: ["milímetro"], kg: ["kilogramo"],
    },
    exponentWords: { squared: ["cuadrado"], cubed: ["cúbico"], position: "after" },
});

/**
 * THE PUSO'S THREE GLYPHS, folded to the one `graphemes` reads.
 *
 * `ꞌ` U+A78C (saltillo) ×301 and `ʼ` U+02BC (modifier apostrophe) ×2 in the retained text; `’` U+2019 ×395 is
 * already handled downstream and is folded here too so all three take one path. ⚠ `´` U+00B4 is NOT in this
 * class — the corpus uses it as an ARC-MINUTE mark after digits (`22°00´`, `54°38´00,1´´`), never as a puso,
 * and step 4 deals with it.
 */
const PUSO = /[ʼ’ꞌꞋ]/gu;

/** Guaraní's ordinal is the cardinal plus `-ha`, attaching with no orthographic change. */
const ORDINAL_SUFFIX = "ha";

/** Every rule emits DIGITS where a number is involved and lets the engine's own number path speak them. */
export function normalizeGuarani(input: string): string {
    let s = input;

    // ── 1. THE PUSO — FIRST, ABOVE EVERYTHING, because it is a LETTER fix and not a symbol one ──────────
    // See the header. ×303 retained. This must precede every rule below that inspects word boundaries, and
    // it must live here rather than in `phonemizeWord`, because for U+02BC the tokenizer has already split
    // the word by the time `phonemizeWord` is called (trap 39: a guard's evidence has a lifetime).
    s = s.replace(PUSO, "'");

    // ── 2. ZERO-WIDTH SPACE — the other character that splits a word ────────────────────────────────────
    // U+200B ×11 retained, `zero-width` ×84 whole-corpus, all inside words (`Chíle​pe`, `Rio de Janeiro​pe`,
    // `ñe'ẽ​me`) where it is a line-break hint the dump preserved. It is script COMMON, so the TOKEN class
    // rejects it and the word reads as two: `a​b` → *ˈa b*. Deleted, not spaced — the two halves are one
    // Guaraní word plus its bound postposition.
    s = s.replace(/[​‌‍﻿]/gu, "");

    // ── 3. `º`/`ª` STANDING IN FOR THE DEGREE SIGN — before step 4 deletes the leftovers ────────────────
    // The masculine/feminine ordinal indicators are used for `°` throughout this corpus: `21º C`, `0º C`,
    // `39º C`, `1 ºC`, `22 ºC` and even the feminine `40ª C`. The playbook has met this exact substitution
    // twice (trap 25's `२८°२१´` / `º`, the Italian `dell'11º`). Folded to `°` so step 5 sees ONE shape.
    s = s.replace(/(\d\s*)[ºª](\s*[CF](?![\p{L}\p{M}]))/gu, "$1°$2");

    // ── 4. THE MARKS THAT READ AS PHONEMES OR AS NOTHING — a declared refusal, not a reading ────────────
    // ⚠ THE EMPTY-STRING DEFECT. `º` U+00BA is `\p{Script=Latin}`, so the tokenizer matches it as a whole
    // WORD, and `graphemes` has no key for it: `1º` emitted the digit's words and then THE EMPTY STRING.
    // Eleven such tokens in the retained text (`1º` ×2, `21º`, `0º`, `39º`, `36º`, `70º`, `26º`, `54º`,
    // `15.º`). It is the SPANISH ordinal indicator; Guaraní's own ordinal is `-ha` (step 7) and Guaraní
    // dates take a bare cardinal (`20 jasyrundy ary 1907`), so `1° jasypápe` is already right without it.
    // Deleted — an unreadable mark, not an ordinal to invent.
    // ⚠ THE INVENTED-PHONEME DEFECT. A coordinate's arc-minute/second mark after digits is `'` U+0027 or
    // `´` U+00B4 (`25° 15'`, `22°00´`, `25°33´40,6´´`), and after step 1 the ASCII one is indistinguishable
    // from the puso — so `25° 15'` read *…paˈpo ʔ*, a glottal stop emitted as a whole word. This is worse
    // than a drop: it is a phoneme the text never contained. Guarded on a DIGIT to its left and no letter to
    // its right, so no intra-word puso can be reached (the puso lives between letters, always).
    // ⚠ THE COORDINATE READING ITSELF IS REFUSED, and the refusal is priced (trap 53): `degrees` is ×48
    // whole-corpus and the arc-minute is a minority of that. No Guaraní word for a degree, minute or second
    // of ARC is attested anywhere — `kokatu` is the grammatical degree (see step 5) — so the marks are
    // dropped rather than read, which leaves `25° 15'` as two bare numbers. Silent, never wrong.
    // ⚠ UNCONDITIONAL, and deliberately so. `º`/`ª` are not letters of the achegety, have no `graphemes`
    // key and no reading in this language at all — so once step 3 has taken the temperature ones, ANY
    // survivor can only read as the empty string, whatever precedes it. A digit lookbehind looked tighter
    // and silently missed the corpus's own `15.º` (a dot between) and `Nº`.
    s = s.replace(/[ºª]/gu, "");
    s = s.replace(/(?<=\d)\s*['´′″“”]+(?![\p{L}\p{M}\d])/gu, "");

    // ── 5. TEMPERATURE — the SCALE name only, and the degree word is deliberately withheld ──────────────
    // ×22 retained, ×48 whole-corpus for the `degrees` cell. `39°C` read as *ᵐbohapɨˈpa poɾuˈⁿdɨ K* — the
    // sign dropped AND the letter ⟨C⟩ read through `graphemes` as a bare [k], a stray consonant emitted as
    // a word. That is trap 56: a defect that produces a READING, which no leak class can see.
    // ⚠ `Celsius` IS SOURCED AND THE DEGREE WORD IS NOT, and the asymmetry is the whole design of this rule.
    //   · `Celsius` ×6/5 articles, three of them Guaraní prose: `ohasa rire 0° Celsius` (the water article),
    //     `-273.15 kokatu Celsius`, and `Grádo Celsius = (5/9)*( Grádo Fahrenheit - 32)`. `Fahrenheit` ×2/2.
    //   · the DEGREE word has two candidates and each is one article deep. `grado` reports "attested ×46/19"
    //     and every readable hit is SPANISH — an external link labelled "(en español)" and a run of book
    //     titles about school YEARS (`Segundo grado`, `Lectura para cuarto grado escolar`) — the ilo
    //     `dollar`/*Million Dollar Baby* shape. `kokatu` reports ×62/11 and sixty-one of those are the
    //     GRAMMATICAL degree, from one grammar article's comparison paradigm (`3.3. Kokatu (grado)`,
    //     `Kokatu Mbojojáva` comparative, `Kokatu Tuicháva` superlative) — trap 37, with a healthy count on
    //     the wrong sense. What is left is `Grádo` ×2 in ONE article and `kokatu` ×1 in the temperature
    //     sense. One hit in one article is a lead, not a finding.
    // ⚠ SO THIS EMITS "39 Celsius", NOT "39 degrees Celsius", AND THAT IS THE POINT. It is an under-reading,
    // never a wrong one: it invents no word, and it closes BOTH real defects — the dropped sign and the
    // stray [k]. Half-declaring here cannot invent a quantity the way ig's `790 km2` did (trap 53), because
    // there is no numeral left over to misread. If a later run sources the degree word, this rule takes it
    // in one edit; the counts above are the re-check.
    s = s.replace(/(\d)\s*°\s*C(?![\p{L}\p{M}])/gu, "$1 Celsius");
    s = s.replace(/(\d)\s*°\s*F(?![\p{L}\p{M}])/gu, "$1 Fahrenheit");

    // ── 6. DE-GROUP THOUSANDS — the single biggest defect this layer repairs ────────────────────────────
    // `grouped` ×1,350 whole-corpus, and this corpus writes the separator THREE ways at once, which is the
    // rn hazard (trap 55: the guards travel worse than the vocabulary):
    //     period  `1.098.581 km²` · `65.000` · `2.780.400` · `1.324 mm` · `30.000 hectárea`
    //     space   `12 169 501 tapicha` · `4 140 000 000` · `63 300` · `1 559 159 km²`
    //     nbsp    `21&nbsp;696 ava` · `11&nbsp;000&nbsp;000` · `916&nbsp;445`  (a plain space by now —
    //             `stripMarkup` decodes the entity at the registry's dispatch point, above this file)
    // Every one was clause punctuation or a token break, so `1.098.581` read as THREE SENTENCES —
    // *peteĩ . porundypa poapy . posa poapypa peteĩ*, the value destroyed.
    // ⚠ THE INTEGER PART MAY NOT BEGIN WITH `0`, and that one guard is what separates grouping from a
    // three-digit DECIMAL. `0.572` is the corpus's Human Development Index figure; without the `[1-9]` head
    // it de-groups to `0572`. Measured over the retained text, that is the ONLY period-plus-three-digits
    // form that is not a thousands group.
    // ⚠ THE TRAILING GUARD REJECTS ONLY A DIGIT, so a grouped number followed by its own decimal comma still
    // de-groups — which this corpus needs: `755.838,7 km²`, `8 514 876,6 km²`.
    // ⚠ IT RUNS BEFORE EVERYTHING NUMERIC (the playbook's first ordering coupling) and, critically, before
    // the tier at step 8 — otherwise `1.098.581 km²` reaches the unit path as `581 km²`.
    s = s.replace(/(?<![\d.,])([1-9]\d{0,2}(?:\.\d{3})+)(?!\d)/gu, (m) => m.replaceAll(".", ""));
    // ⚠ U+00A0 IS IN THE CLASS BESIDE THE ASCII SPACE, AND IT IS NOT REDUNDANT. `stripMarkup` decodes
    // the `&nbsp;` ENTITY to a plain space, so this corpus's own `21&nbsp;696` arrives here already spaced
    // — but a dump carrying the raw character reaches this rule as U+00A0, and a class written from the
    // decoded form alone would silently miss exactly the shape this corpus writes most. Caught by a test.
    s = s.replace(/(?<![\d.,])([1-9]\d{0,2}(?:[    ]\d{3})+)(?!\d)/gu,
        (m) => m.replace(/[\s   ]/gu, ""));

    // ── 7. THE ORDINAL SUFFIX `-ha` GLUED TO DIGITS — trap 14, and Guaraní's own ordinal ────────────────
    // `Nha` ×15 retained, `ordinal-latin` ×639 whole-corpus. Guaraní forms the ordinal by suffixing `-ha` to
    // the cardinal with no orthographic change (peteĩ→peteĩha, mokõi→mokõiha, mbohapy→mbohapyha), and the
    // corpus spells that out ×58 in the retained text alone (`peteĩha` ×17, `mokõiha` ×16, `mbohapyha` ×10,
    // `irundyha` ×7, `paha` ×4, `poha` ×2, `pokõiha` ×2) beside the digit form (`12ha`, `13ha`, `35ha`,
    // `127ha`, `215ha`, `11ha umi 100 Opurahéiva Porãvéva`).
    // ⚠ THIS IS TRAP 14 AND IT CANNOT BE DONE BY GLUING. A digit becomes words in the TOKENIZER, downstream
    // of every rule here, so `12ha` left alone reads *paˈkõi ˈha* — "twelve AND", the coordinator, which is
    // the one reading that must not survive in this language. The operand is converted to WORDS inside the
    // rule and the suffix attached to the last of them: 12 → `pakõi` → `pakõiha`; 21 → `mokõipa peteĩ` →
    // `mokõipa peteĩha`, which is where the suffix belongs.
    // ⚠ THE RIGHT CONTEXT IS THE DISCRIMINATOR (trap 24). One of the fifteen is NOT an ordinal: `Ijapytépe
    // 1932ha 1934` is "between 1932 AND 1934" with the coordinator written tight against the year. An
    // ordinal is never immediately followed by a bare number, and none of the fourteen true ones is; so a
    // following digit-run refuses the match. 14 fixed, 1 correctly declined, 0 broken.
    // ⚠ CAPPED AT SIX DIGITS so a long identifier cannot be worded, and anchored on BOTH edges of the digit
    // run rather than only before the key — trap 52: a lookbehind rejects a POSITION, and the engine simply
    // starts one digit later (`1932ha` would otherwise match as `932ha`).
    s = s.replace(
        /(?<![\d.,])(\d{1,6})ha(?![\p{L}\p{M}]|\s*\d)/gu,
        (_m, n: string) => `${numberToWords(Number(n))}${ORDINAL_SUFFIX}`,
    );

    // ── 8. THE SHARED TIER — %, $, units, the squared/cubed words ───────────────────────────────────────
    // ⚠ AFTER DE-GROUPING (step 6), or every grouped figure reaches it as its last three digits.
    // ⚠ BEFORE THE DECIMAL FOLD (step 9) — the playbook's "units before decimals" coupling: the tier matches
    // a unit only when a NUMBER is adjacent. It is ALSO what keeps `NOT_VERSION` armed for the one-letter
    // `m` key, since that guard works by seeing a dot step 9 would otherwise have spent (traps 39 and 46).
    s = SYMBOLS(s);

    // ── 9. THE DECIMAL SEPARATOR — READ AS A PAUSE, NOT AS A WORD, and the refusal is the finding ───────
    // `decimals` ×1,777 whole-corpus, and this corpus writes BOTH conventions: comma (`8,70 %`, `4,4 sua`,
    // `22,8 millón`, `26,73`, `39,73`, `$1,25`, `8 514 876,6`) and period (`430.9 km2`, `3.61%`, `0.572`,
    // `-273.15`, `3.98`).
    // ⚠ NO DECIMAL WORD IS DECLARED, AND THIS IS THE FILE'S MOST DELIBERATE OMISSION. Two independent
    // sourcing passes — `attest.ts` against gn.wikipedia and a separate web pass — reached the same place:
    // written Guaraní never spells a decimal separator out. What both found instead is the name of the
    // PUNCTUATION MARK, from gn.wikipedia's own punctuation article and a Guaraní glossary that agree
    // form-for-form: `Kyta` (punto) ×33/12, `Kyguái` (coma) ×4/2, `Kytaguái` (punto y coma), `Kytakõi`
    // (dos puntos). `kyguái` even has one numeric-context use — "pe kyguái rire hembýva upéa héra
    // centivaras", *what remains after the comma is called centivaras*, about `39,73`.
    // ⚠ THAT IS A GOOD CITATION FOR THE WRONG REGISTER, which is the hardest kind to catch because the
    // citation looks right (the playbook's own summary of the hi `धन` failure). It is what the mark is
    // CALLED. Whether a Guaraní reader voices it between two operands is a question no text can answer, and
    // the cost is asymmetric: the refusal costs a PAUSE where a word might go, in 1,777 places; a wrong
    // decimal word is confidently wrong in the same 1,777 places, and it is the highest-traffic rule a layer
    // has — which is exactly the slot the Fula `tere` failure occupied. `kyguái` and `kyta` are recorded
    // here with their counts so a later run with an audio or dictionary tier can close this in one edit.
    // ⚠ WHAT THIS RULE DOES DO is make the two conventions read alike. A decimal COMMA already fell out as a
    // comma-grade pause; a decimal PERIOD fell out as a SENTENCE END, so `430.9 km2` was read as two
    // sentences and `3.61%` split a percentage in half. Folding the period to a comma inside a decimal
    // introduces no word and removes a false sentence boundary from every period-decimal in the corpus.
    // ⚠ ONE OR TWO FRACTIONAL DIGITS, which is what is left after step 6 has claimed every three-digit group;
    // the `0.` head that step 6 refuses is admitted here, which is where `0.572` belongs.
    s = s.replace(/(?<![\d.,])(0)\.(\d{3})(?![\d.,])/gu, "$1,$2");
    s = s.replace(/(?<=\d)\.(?=\d{1,2}(?![\d.]))/gu, ",");

    // ── 10. YEAR SPANS — `guive … peve`, the corpus's own frame ─────────────────────────────────────────
    // `ranges` ×525 whole-corpus. The dash was simply dropped, leaving two numbers abutting with no
    // connective: `1816-1828` read *su poapysa papoteĩ su poapysa mokõipa poapy*, two dates run together.
    // ⚠ THE JOINER IS WRITTEN OUT BY THE CORPUS ITSELF, which is the strongest attestation available:
    // `1932 guive 1935 peve oiko Cháko Ñorairõ` · `1948 guive 1952` · `1959 guive 1965` · `1865 guive 1870`
    // · `1970 guive 1995`, ×5 retained; and on the wiki in a non-year frame too, `mokõipa aravo'i guive
    // mokõi aravo peve`. Both are POSTPOSITIONS taking one operand each, so `N guive M peve` is grammatical
    // as written — unlike Fula's `hakkunde`, which was attested as a PREPOSITION governing both and was
    // ungrammatical as an infix (the standing part-of-speech check).
    // ⚠ BOTH OPERANDS MUST BE EXACTLY FOUR DIGITS, and that cap is measured rather than cautious. The
    // retained text has 28 hyphen-joined digit pairs and only some of them are spans:
    //     9 genuine year ranges  (1947-1949, 1961-1962, 1954-1989, 1954-1957, 1929-2004, 1864–1870,
    //                             1839-1867, 1821-1867, 1816-1828)  → all matched
    //     7 ISBN fragments       (99925-68-04-06, 978-84-…)                        → refused
    //     2 telephone numbers    (206-2566, 206-2567)                              → refused
    //     3 page ranges in SPANISH citations (109-115, 169-180, 25–33)             → refused, and rightly:
    //       the `ordinal-latin` cell is only 62.5% Guaraní and these are its Spanish half
    //     1 two-date lifespan    (`20 jasyrundy ary 1907-24 jasypateĩ ary 1980`)   → refused
    // 9 fixed, 0 broken. ⚠ The edge guard rejects an adjacent HYPHEN as well as an adjacent digit, so a
    // hyphen CHAIN is an identifier and never a span; and it is on both edges of the whole match, not one
    // edge of the separator (trap 52).
    // ⚠ THE TRAILING SEPARATOR TEST IS `[.,]\d`, NOT A BARE `[.,]`, and this half is a BRANCH REPAIR WITH NO
    // CORPUS INSTANCE — said so rather than counted as a win (trap 22). A dot or comma with no digit after it
    // is a clause end, not a number's interior, so the bare class refused every span that ends a sentence
    // (playbook trap 58, the class `review.ts`'s `clause-final` check reports). This corpus has no
    // clause-final FOUR-DIGIT pair — its three clause-final `N-N` shapes are the Spanish page ranges
    // `109-115.` / `169-180.` and the ISBN tail `…-04-06.`, which the four-digit cap refuses on its own
    // grounds and still refuses — so the corpus diff is 0 and the branch is pinned as a test instead.
    // The `[.,]\d` half is what keeps `12-14.000` refused, which is the one shape here that needs it: the
    // decimal comma of step 9 is native to Guaraní and a right operand continuing into one is not a span.
    s = s.replace(/(?<![\d.,–—-])(\d{4})\s?[-–—]\s?(\d{4})(?![\d–—-]|[.,]\d)/gu, "$1 guive $2 peve");

    // ── 11. THE CLOCK — ON THE HOUR ONLY, and the narrowness is the measurement ─────────────────────────
    // ⚠ THE CELL COUNT IS A TRAP AND THIS IS TRAP 55'S `ilo` CASE. The `clock` cell reports ×158
    // whole-corpus, and its regex is `\d{1,2}[:.]\d{2}` — which in THIS corpus matches, far more often than
    // a time: a grammar article's SECTION NUMBERS (`3.4.10.`, `3.4.11.`, `3.4.12.` — seven of the eight hard
    // instances, and the reason that cell measures only 12.5% Guaraní) and any two-digit decimal (`3.61`).
    // A dot-form clock rule in Guaraní would claim decimals wholesale. The colon form is ×3 in the retained
    // text and all three are on the hour: `umi 11:00 ha 12:00 pyharekuepytépe`, `16:00`.
    // ⚠ `aravo` IS RICHLY SOURCED AND THE MINUTE FRAME IS NOT. gn.wikipedia has an article for it —
    // "Peteĩ aravo ha'e 60 aravo'i térã 3600 aravo'ive" (*one hour is 60 minutes or 3600 seconds*) — ×49/20,
    // and the frame is the number BEFORE the noun in running prose: `8 aravo rupi`, `pakõi aravo guive
    // paporundy aravo peve`, and — the shape that settles it — the wiki writes a DIGITAL time followed by
    // the noun itself, `15:30 aravo jave` and `14.30 aravo`. What is NOT sourced is how the minutes join:
    // the only frame found for that (`Peteĩ aravo ha irundypa po aravo'i`) is from a language-teaching page,
    // i.e. pedagogical rather than naturally-occurring, so a non-zero time is REFUSED WHOLE rather than half
    // (trap 53's `ak` model) and reads exactly as it did before.
    // ⚠ AND IT MUST NOT DOUBLE A NOUN THE TEXT ALREADY WROTE (trap 12): `15:30 aravo` already carries it.
    s = s.replace(
        /(?<![\d.,:])([01]?\d|2[0-3]):00(?![\d.,:])(?!\s*aravo(?![\p{L}\p{M}]))/gu,
        (_m, h: string) => `${Number(h)} aravo`,
    );

    return s;
}
