/**
 * Sesotho / Southern Sotho (st) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which
 * is not already a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * ⚠ SOUTH AFRICAN ORTHOGRAPHY, AND THAT IS A DECISION WITH EVIDENCE ON BOTH SIDES. Sesotho has two standard
 * orthographies — South African (⟨di-⟩, ⟨kg⟩, ⟨w⟩) and Lesotho (⟨li-⟩, ⟨kh⟩, ⟨oa⟩) — and st.wikipedia writes
 * BOTH, sometimes in one paragraph. Counted over the mined artifact (435 segments): `wa` 327 / `oa` 136,
 * `ya` 715 / `ea` 397, `di-` 18 / `li-` 20, and in the words this layer needs the Lesotho form is usually the
 * commoner one (`limithara` ×6 vs `dimithara` ×1, `lik'hilomithara` ×2 vs `dikilomitara` ×1).
 *
 * The layer targets SOUTH AFRICAN anyway, because the choice is not this corpus's to make — THE ENGINE HAS
 * ALREADY MADE IT, in two places that cannot be reconciled with the other convention:
 *   · the grapheme table reads ⟨kg⟩ as /kχ/ and ⟨kh⟩ as /kʰ/, which is the SA convention. Lesotho spells the
 *     same affricate ⟨kh⟩, so a Lesotho word handed to this g2p is read with the WRONG consonant.
 *   · every word `numbers.ts` emits is SA — `dikete`, `mashome a mabedi`, `makgolo`, `lekgolo`.
 * A layer emitting `lik'hilomithara` would put a Lesotho noun and an SA numeral in one noun phrase, and hand
 * ⟨kh⟩ to a table that reads it as the aspirate. So every form below is required to be attested IN SOUTH
 * AFRICAN ORTHOGRAPHY — not transposed from a Lesotho attestation by the regular li-/di- rule, which is why
 * `cm` is declined (see below) even though `lisenthimithara` is in the corpus.
 *
 * ⚠ Read in Lesotho orthography this file would differ in exactly the noun prefixes and the ⟨kh⟩/⟨kg⟩
 * spellings: `likhilomithara / limithara / liperesente / liranta / lidolara`. The RULES — noun-first order,
 * the obligatory cl.8/10 concord `tse`, `ka` for the rate, `ho isa ho` for a span — are the same in both.
 *
 * ⚠ THIS FILE OWNS THE SHARED-TIER CALL, because st needs rules on BOTH sides of it and no fixed order works:
 *   · RANGES must run BEFORE the tier. `unitPrefix` MOVES the noun in front of its number, so `10-20 km`
 *     would become `10-dikhilomithara tse 20` and the span would be unrecoverable. Run first, `0-100 km/h`
 *     is `0 ho isa ho 100 km/h` when the tier sees it, and the unit still has its number adjacent.
 *   · THE CURRENCY-GLUED MAGNITUDE must run before the tier, or the metre key eats it — see step 5.
 *   · THE DECIMAL SPELL-OUT must run AFTER the tier, or the tier sees `37 99 km²` and there is no number
 *     beside the sign.
 * Neither the Xhosa order (`SYMBOLS(normalize(x))`) nor the Chichewa one (`normalize(SYMBOLS(x))`) satisfies
 * all three, so the sequence is written out here — the shape Kirundi and ~34 others use.
 *
 * WHAT THE ENGINE PRODUCED BEFORE THIS FILE (probed through `phonemize(…, "st")`, not assumed):
 *
 *     50%            → mɑʃɔmɛ ɑ mɑɬɑnɔ                the sign DROPPED                     105 percent
 *     $675 / R470    → …  /  r mɑkχɔlɔ ɑ mɑnɛ …       sign dropped; ⟨R⟩ a bare [r]          28 currency
 *     50 kg          → mɑʃɔmɛ ɑ mɑɬɑnɔ kχ             ⟨kg⟩ IS A GRAPHEME — one affricate    49 units
 *     5 ha           → ɬɑnɔ ɦɑ                        ⟨ha⟩ IS A SESOTHO WORD
 *     632,702 km2    → … kʼm pʼɛdi                    the ASCII 2 read as the NUMBER TWO     33 exponent
 *     603 628 km²    → … kʼm                          the ² dropped, the unit raw
 *     1,395 m        → nŋwɛ , mɑkχɔlɔ ɑ mɑrɑrɔ … m    grouping comma = a clause PAUSE       336 grouped
 *     32.9°C         → … . rɔbɔŋ k                    decimal point = a SENTENCE BREAK      405 decimals
 *     10-20          → lɛʃɔmɛ mɑʃɔmɛ ɑ mɑbɛdi         bare juxtaposition                    377 ranges
 *     Arts & Sciences→ ɑrt͡sʼ skiɛnkɛs                  the `&` DROPPED
 *
 * Three of those are trap 56 — a defect that produces a READING, which DIGIT/SLOT-GAP/RAWMARK/DROP are all
 * blind to: `kg` as a single Sesotho affricate, `ha` as a Sesotho conjunction, and an ASCII exponent as a
 * quantity (trap 53's shape, `790 km2` → "790 kilometres two").
 *
 * ⚠ TRAP 14/15 DOES NOT ARISE, measured rather than assumed. Sesotho numerals 1–5 are adjectival and carry
 * noun-class concord, so a Xhosa-style concord glued to the digits was the thing to look for. The artifact
 * has `digit-hyphen-letter` only in designations (`2016-17` seasons, `COVID-19`), and every `digit + short
 * word` pair is an ordinary Sesotho particle standing as a WORD (`tse 15 le 64 ha`, `ba 8 ho isa ho`). What
 * the language DOES require is a concord on the NOUN side — `dikhilomithara TSE 76` — and that is not
 * agreement with a digit at all: every measure noun this layer emits is class 8/10, whose relative concord
 * is invariably `tse`. So the concord travels inside the declared noun form (index 1 of each CountForms) and
 * no rule has to inspect a numeral. Step 10 is the one place it must be re-inserted by hand.
 *
 * Deliberately not done, each with the measurement behind it:
 *   · NO CLOCK RULE. There are no clocks. Every `N:NN` in the artifact is a BIBLE VERSE (`1:10`, `1:11`,
 *     `1:14` — Genesis in Sesotho), a RACE TIME (`2:04.23`, `1:56.72`, `4:08.01`, `3:31.49`, `5:58:53`,
 *     `3:31:28`, `2:27:48`, `2:25:28`), a percentage (`50.19%`) or a date (`30.01.1912`). A ceb-shaped bare
 *     colon rule would have claimed 11 non-clocks and 0 clocks — the ilo finding, reproduced (trap 55).
 *   · NO `=` RULE, AND `=` IS WHERE `DROP math-sign ×15` COMES FROM. All eight `arithmetic` instances are
 *     EasyTimeline chart directives (`ScaleMajor = unit:year increment:11000 start:0 gridcolor:linegrey`).
 *     `<` `>` `×` `÷` `±` are ×0 in the artifact; `+` is ×1. Nothing to read.
 *   · NO DEGREE OR SCALE WORD, AND `review.ts` STAYS RED ON `degree` ON PURPOSE (trap 24's discipline).
 *     `sources.ts` reports `[NONE] scale-names`; `digiri`, `didigiri`, `digerii`, `didikirii`, `dikgato`,
 *     `dikhutlo`, `Celsius`, `dikhelsiase` are ALL 0 tokens / 0 articles on st.wikipedia, and `mocheso`
 *     (12/7) is HEAT or the animal oestrus, not a unit. 17 `°` in the artifact, mostly coordinates. Claiming
 *     the sign silently would hide a defect this language genuinely has; a red gate that is correct beats a
 *     green gate that is wrong.
 *   · NO HECTARE, and this is the refusal a count overturned in the OTHER direction. `dihekthere` IS
 *     attested (1/1, "sebakeng se kwahelang dihekthere tse 324"), and `sources.ts` reports `ha×11` after a
 *     number — which looks like a clear case to declare. All six digit-adjacent `ha` in the artifact are the
 *     Sesotho WORD *ha* ("when", and the negative): `ka selemo sa 1994 ha mmuso o kopanya`, `tse 15 le 64 ha
 *     ba na mosebetsi`. **6 false, 0 true.** Trap 9: a guard alternative with no attested instance is a
 *     misfire generator.
 *   · NO `cm` / `mm` / `l`. `disenthimithara`, `disentimithara`, `disenthimitara` and `dimilimithara` are
 *     each 0/0 on st.wikipedia, and digit-adjacent `cm`/`mm` is ×0 in the artifact — nothing is being lost.
 *     (`lisenthimithara` ×1 exists in the corpus, in LESOTHO orthography; transposing it would be coining a
 *     spelling, which is exactly what this file's header refuses.) `dilithara` is 1/1 but `l` is a one-letter
 *     key and the standing rule forbids one.
 *   · NO `€`. `dieuro` and `diyuro` are both 0/0. One `€` in the artifact, left visible.
 *   · NO DECIMAL-SEPARATOR WORD. `sources.ts`: `[NONE] decimal-point` — no espeak (Sesotho is not shipped at
 *     all), no `_dpt`, no manifest word. The separator is removed and the fractional digits are read one at a
 *     time. The point is not spoken — and it was not spoken before either, it was a full stop mid-number.
 *   · NO LETTER NAMES, so no initialisms (2412 in the corpus). `core/initialisms.ts` needs a `letterName`
 *     table; espeak ships no Sesotho and no in-repo source carries one, so wiring it is a NO-OP (trap 16
 *     checked; the answer here really is "no data").
 *   · NO FRACTION RULE. `sources.ts`: `[NONE] fraction-series`.
 *   · NO BARE-EXPONENT READING (`20²`, `10⁻³¹`). `bareExponent` needs a PREDICATE phrase ("twenty squared"),
 *     which is a different word from the unit modifier in most languages; nothing attests one for Sesotho.
 *     `disekwere` is the modifier and reusing it here would read "twenty square".
 */
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { rewrite } from "../../core/provenance.ts";

/** The manifest's own conjunction — the number joiner (*leshome LE metso e mmedi*), reused for `&`. Read
 *  from the manifest so the two can never drift apart. */
const AND = loadManifest<{ numbers: { and: string } }>(import.meta.url, "sesotho.jsonc").numbers.and;

/**
 * MAGNITUDE WORDS, as they appear in RUNNING TEXT — this list is a MATCHER, not an author. Every entry is
 * re-emitted verbatim by the shared tier, so the Lesotho spellings belong here beside the SA ones: the
 * artifact writes `R470 bilione`, `US$100 milione`, `R332 milione`, `di-milione tse pedi` (SA) and
 * `tse limilione tse 59,4`, `R28.9 limilione` (Lesotho), and a magnitude the tier cannot see breaks the
 * number↔sign adjacency and drops the sign outright.
 * `milione` / `bilione` are also `numbers.ts`'s own `millionOne` / `billionOne`, so the two can never
 * disagree about the SA spelling.
 */
const MAGNITUDES = [
    "dimilione", "dimiliyone", "limilione", "milione", "miliyone",
    "dibilione", "dibiliyone", "libilione", "bilione", "biliyone",
];
/** …and the same list as an alternation, for step 10's concord repair. */
const MAG_ALT = MAGNITUDES.slice().sort((a, b) => b.length - a.length).join("|");

/**
 * THE SPAN JOINER — *ho isa ho*, "up to". 49 tokens over 19 st.wikipedia articles and it is the language's
 * ordinary numeric span: `dikhilomithara tse 16 ho isa ho tse 8`, `dilemong tsa 8 ho isa ho tse 14`,
 * `diphesente tse 35 ho isa ho tse 45`. The artifact writes it bare between two figures too —
 * `mahareng 3% ho isa ho12%` — which is the form emitted here.
 *
 * ⚠ THE SECOND OPERAND'S CONCORD IS DELIBERATELY NOT EMITTED. Every attestation above repeats a concord on
 * the far side (`ho isa ho TSE 8`, `ho isa ho SA 2017`) and WHICH concord depends on the head noun's class —
 * `tse` for class 8/10, `sa` for class 7, `la` for class 5. This layer does not know the head noun (it is
 * whatever the writer put before the figure), and guessing one would be a concord error in every sentence
 * whose noun is not class 10. The bare form is attested and is the only one that cannot be wrong.
 */
const SPAN = "ho isa ho";

/**
 * The digits of a fractional part, spaced so the number path speaks them one at a time. ⚠ Reading `25` in
 * `1.25` as a NUMBER would say *mashome a mabedi le metso e mehlano* — "twenty-five" — a different quantity.
 */
const spell = (int: string, frac: string): string => `${int} ${[...frac].join(" ")}`;

/**
 * THE SHARED SYMBOL TIER. Every word is attested on st.wikipedia in SOUTH AFRICAN orthography, in the slot
 * it is declared for, with the example read (trap 37: the bare token count measures the wrong thing).
 *
 * ⚠ EVERY FORM IS DECLARED TWICE, AND THE SECOND ENTRY CARRIES THE CONCORD. Index 0 is the CITATION form —
 * used for a bare symbol standing alone (`makeBareUnitNormalizer` asks for the count-1 form) and for a
 * literal count of one. Index 1 is what 100% of the digit-bearing attestations write: the noun plus the
 * class 8/10 relative concord `tse`, which is invariant for every measure noun here.
 *
 *     dikhilomithara tse 76 · dimithara tse 792 · diperesente tse 80 · diranta tse dimilione tse 70.1
 *     diponto tse 33 · didolara tse 4bn · dikhilograma tse 50 · disekwere-kilometara tse 19
 *
 * The concord is NOT agreement with the numeral (trap 14) — it agrees with the NOUN, which this file
 * chooses, so it can be carried as data instead of computed. `1 km` therefore reads *dikhilomithara nngwe*,
 * a plural noun with "one"; the singular `kilomitara` is 0/0 on st.wikipedia and is not invented, and
 * digit-adjacent `1 km` is ×0 in the artifact.
 */
const SYMBOLS = makeSymbolNormalizer({
    /**
     * PERCENT — `diperesente` 8 tokens / 5 articles, sense read: *"diperesente tse 80 tsa baahi naheng"*
     * ("80 percent of the country's inhabitants"), *"Botswana e akaretswe ke diperesente tse fetang tse 70
     * ke lehwatata Kalahari"*. The artifact writes the sign and the word together — *"e ikarabella ho
     * diperesente tse 1.5%"* — which the tier's own `saidBefore` guard suppresses.
     * `diphesente` (5/3, *"diphesente tse 35 ho isa ho tse 45 tsa batho"*) is a real competitor and is not
     * declared: one emitted spelling per slot, and `diperesente` has the wider article spread. Step 6 makes
     * sure a text that already wrote EITHER of them (or a Lesotho spelling) is not doubled.
     */
    percent: ["diperesente", "diperesente tse"],
    percentPrefix: true, // the measure noun heads its phrase in Bantu — every attestation above
    currency: {
        // ⚠ LONGEST FIRST is the tier's own job, but the compound key must exist or `US$100` matches the
        // bare `$` and the code is stranded. *"Didolara tsa Amerika tse 44 le 78 bakeng sa kalafo"* and
        // *"Didolara tsa Amerika tse 750"* — 2 of `didolara`'s 5 hits spell the country in.
        "US$": ["didolara tsa Amerika", "didolara tsa Amerika tse"],
        // `didolara` 5/4, money sense in every hit: *"letlotlo la hae le tla ba didolara tse dimilione tse
        // dikete tse 788"*, *"ka theko ya didolara tse 4bn"*.
        $: ["didolara", "didolara tse"],
        // THE RAND, and a bare capital `R` key is measured safe here: 12 `R`+digit instances in the
        // artifact and ALL TWELVE are money — `R470 bilione`, `R332 milione`, `R30,000,000`, `R22.7
        // milione`, `R3,2 milione`, `R8 million`, `R2.3m`, `R22.8m`. `diranta` is 14/12 on the wiki:
        // *"e kentse diranta tse dimilione tse 70.1"*, *"ka diranta tse dimilione tse 8 (e ka bang
        // US$800,000)"* — the gloss beside it settles the sense.
        R: ["diranta", "diranta tse"],
        // `diponto` 5/5, and the sense is unambiguous because the sentence prices land in shillings too:
        // *"ka theko ya diponto tse 4 le disheleng tse 5 ka acre"*.
        "£": ["diponto", "diponto tse"],
    },
    currencyPrefix: true,
    magnitudes: MAGNITUDES,
    units: {
        // `dikhilomithara` 21/19 — the widest-spread SA spelling, and the one whose ⟨kh⟩/⟨th⟩ match
        // `dimithara`: *"E fumaneha dikhilomithara tse ka bang 76 ka borwa ho motse-moholo wa naha,
        // Maseru"*. (`dikilomitara` 10/10 is the same word with the plain stops — *"Motse ona o
        // dikilomitara tse mashome a mararo ho tloha ho moeedi wa naha ya Lesotho"*, the sentence that
        // settled the noun-first order and the concord. One spelling is emitted; both are the language's.)
        km: ["dikhilomithara", "dikhilomithara tse"],
        // ⚠ A ONE-LETTER KEY, DECLARED ON A MEASUREMENT (traps 28/46/52). digit-adjacent `m` in the
        // artifact is ×10: SEVEN genuine metres (`5,267 m`, `1,395 m`, `800 m`, `1500 m`, `2.00m`,
        // `270 m`) and THREE millions glued to a currency sign (`R2.3m`, `£1.2m`, `R22.8m`). Step 5 spends
        // those three before the tier ever sees them, which is what makes the key safe — without it
        // `R2.3m` would read *diranta tse 2.3 dimithara tse*, a confidently wrong unit replacing a merely
        // silent one. `dimithara` is 28/16: *"bophahamo ba dimithara tse 792 (2,600 ft) ka holima
        // bophahamo ba lewatle"*.
        m: ["dimithara", "dimithara tse"],
        // ⚠ ONE TOKEN IN ONE ARTICLE, AND DECLARED ANYWAY — priced against what the refusal costs (trap 53
        // + the trap 25 amendment). `dikhilograma` 1/1, correct sense in exactly this slot: *"basadi ba
        // boima ba dikhilograma tse 50 ho Ditlhodisano tsa Lefatshe tsa ho phahamisa Boima"* (the women's
        // 50 kg weightlifting class). Every other spelling probed — `dikilograma`, `dikilogeramo`,
        // `kilograma`, `khilograma`, `dikhilogramo` — is 0/0. What the silence costs is NOT a visible leak:
        // ⟨kg⟩ is a declared Sesotho GRAPHEME, so `50 kg` was reading as *mɑʃɔmɛ ɑ mɑɬɑnɔ kχ* — one velar
        // affricate, a phoneme no leak class can see (trap 56). A lead, stated as a lead.
        kg: ["dikhilograma", "dikhilograma tse"],
    },
    unitPrefix: true, // *dikhilomithara tse 76*, *dimithara tse 792* — the measure noun heads its phrase
    /**
     * THE RATE, COMPOSED FROM `ka` — and the obvious candidate was the wrong one. `ka hora` is 11 tokens /
     * 7 articles on st.wikipedia and EVERY example is a clock time, not a rate: *"ka hora ea bohlano
     * hoseng"* ("at the fifth hour of the morning"), *"ka hora ya leshome le motso o mong"*, *"ka hora ya 1
     * thapama"*. Declaring the phrase would have been the Fula `hakkunde` mistake — a real expression that
     * does not fit the slot. What IS attested digit-adjacent, twice and glossed, is the bare preposition:
     *     "li-kilos tse fetang 2 000 ka hektare (1,800 lb / acre)"     — kilos per hectare
     *     "diponto tse nne le disheleng tse hlano ka acre"             — £4 5s per acre
     * So `ka` + the denominator noun. `km/h` is ×4 in the artifact and read *kʼm ɦ* before this.
     * `h` is a DENOMINATOR ONLY: a standalone `h` is a Sesotho letter, and the one-letter/plural-s hazard
     * `rateDenominators` exists for applies exactly.
     */
    unitPer: "ka",
    rateDenominators: { h: "hora" },
    /**
     * SQUARED — `disekwere` 2 tokens / 2 articles, and BOTH are glossed against the English in their own
     * sentence, which is what closes the sense:
     *     "sehlekehleke sa disekwere-kilometara tse 19 (7.3 sq mi)"
     *     "Mexico e kwahela disekwere-khilomithara tse 1,972,550 (761,610 sq mi)"
     * Position `before`: the word precedes its unit noun, joined by a hyphen. The hyphen is not emitted —
     * it is not a Sesotho grapheme and the tokenizer breaks on it, so `disekwere dikhilomithara` and
     * `disekwere-dikhilomithara` are the same reading; the spaced form is what the tier can express, and
     * `disekwere-dikilomitara` is 0/0 as a written string anyway.
     * ⚠ NO `cubed`. Nothing attests one, `m³`/`km³` are ×0 in the artifact, and the tier's missing-word
     * branch re-emits the exponent where the leak gate can see it rather than inventing a reading.
     */
    exponentWords: { squared: ["disekwere"], position: "before" },
    // ⚠ `ampersand` IS DELIBERATELY NOT DECLARED HERE — see step 2. 8 of the artifact's 19 `&` are `&nbsp;`.
});

/** Normalize one Sesotho input string. Steps are ORDER-DEPENDENT; each states its coupling. */
export function normalizeSesotho(input: string): string {
    let s = input;

    // 1) HTML ENTITIES, before anything reads a `&` or a `#`. The artifact carries `&nbsp;` ×8, `&#39;` in
    //    `Ntat&#39;a` and `&#39;Matsaba`, and `&#x5B;`/`&#x5D;` around a citation-needed marker.
    //    ⚠ `&#39;` IS AN ORTHOGRAPHIC CHARACTER IN SESOTHO, not decoration: the apostrophe writes the
    //    syllabic nasal (*'m'a*, *'Matsaba*), so it is restored rather than dropped.
    s = s
        .replace(/&nbsp;/giu, " ")
        .replace(/&#0*39;|&#x0*27;|&apos;/giu, "’")
        .replace(/&#x0*5B;/giu, "[")
        .replace(/&#x0*5D;/giu, "]")
        .replace(/&amp;/giu, "&");

    // 2) THE BARE AMPERSAND → `le`, the manifest's own conjunction, which the number path already uses for
    //    *leshome le metso e mmedi*.
    //    ⚠ THIS IS WHY `ampersand` IS NOT DECLARED ON THE SHARED TIER. The tier folds `&amp;` and then
    //    substitutes, which is right for a corpus of prose — but 8 of this corpus's 19 ampersands are
    //    `&nbsp;`, and the tier would emit "le nbsp" for every one. The entity table has to be consulted
    //    BEFORE the sign is read, and only a local step can sequence that (the Chichewa finding).
    //    ⚠ SPACED ON BOTH SIDES, always: `M&G` is two initialisms and gluing the word in fuses them into
    //    one token — the merge defect of trap 18.
    s = rewrite(s, /[ \t]*&[ \t]*/gu, ` ${AND} `);

    // 3) DOTTED CAPITAL RUNS → the bare letters, BEFORE anything reads an interior dot as a phrase break
    //    (multi-dot abbreviations before single-dot). The artifact's `abbrev` cell is 1581 and the runs it
    //    carries are `U.S.`, `B.C.`, `J.G.`, `M&G` — each currently emitting one sentence pause per dot in
    //    the middle of a Sesotho sentence.
    //    ⚠ THE FINAL DOT IS KEPT ONLY AT END OF INPUT, and the trade is measured rather than assumed. The
    //    interior `[ \u00a0]?` also eats the space after the last dot, so a run followed by a capitalised word
    //    loses its period. All three such instances in the artifact:
    //        `B.C. Li ne li entsoe`   a genuine sentence end  — ONE lost pause
    //        `J.G. Fraser`            name initials           — a pause here would be SPURIOUS
    //        `U.D. Oliveirense`       a club name             — likewise
    //    1 against 2, so the dot goes. Reinstating it (`(?:[ \u00a0](?=\p{Lu}\.))?`, so the space is consumed only
    //    between two capital-dot pairs) flips the score to 2 wrong / 1 right; it was tried and reverted.
    s = rewrite(s, /(?<![\p{L}\p{M}])(?:\p{Lu}\.[ \u00a0]?){2,}(?:\p{Lu}(?![\p{L}\p{M}]))?/gu, (run, off: number, full: string) => {  // space, NBSP
        const letters = run.replace(/[. \u00a0]/gu, "");  // NBSP
        const rest = full.slice(off + run.length);
        if (/^[\p{L}\p{M}]/u.test(rest)) return `${letters} `;
        return rest === "" || /^[ \u00a0]+\p{Lu}/u.test(rest) ? `${letters}.` : letters;  // space, NBSP
    });

    // 3b) THE DOTTED DATE — spend the dots, and nothing else. `*30.01.1912 ka Hannover †27.12.1999 ka
    //     Tijuana`, `*28.11.1820`, `†05.08.1895`: the artifact's biography stubs write D.M.Y, and every dot
    //     was `clausePunctuation` — THREE SENTENCE BREAKS inside one date.
    //     ⚠ NO MONTH TABLE. Sesotho writes dates with a month NAME (`ka la 8 Motsheanong 2019`, `ka la 25
    //     Pulungoana 1880`), so this could in principle become one; authoring a twelve-month table off
    //     infobox text is the bulk data invention the playbook forbids, and the corpus's own numeric dates
    //     already read as a sequence of numbers. This makes the dotted form read the same way.
    //     ⚠ BEFORE step 4 AND step 11, both of which would otherwise claim `28.11` — the decimal arm's
    //     trailing guard is written to reject it too, belt and braces.
    s = rewrite(s, /(?<![\d.,])(\d{1,2})\.(\d{1,2})\.(\d{4})(?![\d.,])/gu, "$1 $2 $3");

    // 4) THOUSANDS DE-GROUPING, before every remaining numeric rule: a grouping COMMA reads as a clause
    //    pause and a grouping PERIOD as a full stop, so `1,395 m` came out *nngwe , makgolo a mararo …*
    //    ("one, three hundred ninety-five") — one number read as two clauses. 336 grouped instances.
    //    ⚠ EXACTLY THREE DIGITS PER BLOCK, which is also what keeps the decimals out: the artifact writes
    //    `37,99 km²` and `50.19%` with a 1–2 digit tail and `632,702` / `603 628` / `21 500` with three.
    //    ⚠ THE HEAD MUST START 1–9 — a grouped number never opens with a leading zero, and without it the
    //    space arm fuses `2 000` inside a reference or an ISBN-shaped run.
    //    ⚠ THE TRAILING GUARD IS `(?![\d]|[.,]\d)`, NOT `(?![\d.,])`: with the wider form a grouped number
    //    followed by a CLAUSE comma or a sentence period declines to de-group, and the leftover separator
    //    is then read as a decimal by step 11.
    s = rewrite(s, /(?<![\d.,])([1-9]\d{0,2})(?:,\d{3})+(?![\d]|[.,]\d)/gu, (w) => w.replace(/,/gu, ""));
    s = rewrite(s, /(?<![\d.,])([1-9]\d{0,2})(?:\.\d{3})+(?![\d]|[.,]\d)/gu, (w) => w.replace(/\./gu, ""));
    s = rewrite(s, /(?<![\d.,])([1-9]\d{0,2})(?:[ \u00a0\u202f\u2009]\d{3})+(?![\d])/gu, (w) => w.replace(/[ \u00a0\u202f\u2009]/gu, ""));  // space, NBSP, NNBSP, thin space

    // 5) A MAGNITUDE LETTER GLUED TO A CURRENCY AMOUNT → the magnitude WORD, and this step is what makes
    //    the one-letter metre key safe. The artifact writes `R2.3m`, `£1.2m`, `R22.8m`, `$2.5bn`,
    //    `US $ 8bn` — three of the ten digit-adjacent `m` in the whole corpus, and all three are MILLIONS.
    //    Left alone, the tier's currency rule consumes the number and `unitPrefix` puts it back on the
    //    RIGHT of the noun, so `R2.3m` becomes `diranta tse 2.3m` and the metre key then reads the `m`.
    //    ⚠ THE WORD IS NOT INVENTED — the corpus glosses the abbreviation in its own sentence:
    //        "R2.3m(di-milione tse pedi feelwane tharo)"      "R8 million(di-milione tse …)"
    //        "$2.5-billion (£1.98-bilione)"
    //    so `m` → *dimilione* and `bn` → *dibilione*, in the SA spelling `numbers.ts` already emits.
    //    MUST run after step 4 (a grouped amount is one digit run by now) and before the tier.
    s = rewrite(s,
        /((?:US[ \u00a0]?)?[$£€R])([ \u00a0]?\d[\d.,]*)(m|bn)(?![\p{L}\p{M}\d])/gu,  // space, NBSP
        (_w, sym: string, num: string, mag: string) => `${sym}${num} ${mag === "m" ? "dimilione" : "dibilione"}`,
    );

    // 6) A PERCENT SIGN WHOSE WORD IS ALREADY WRITTEN → drop the sign (trap 12: say it ONCE, in the
    //    position the language puts it). The tier does this for its OWN declared spelling; this covers the
    //    three the tier cannot know about — the Lesotho `liperesente`/`liporesente` and the SA variant
    //    `diphesente`. The artifact writes both shapes:
    //        "li ka balloa ho liporesente tse 25% libakeng tsa litoropong"      (Lesotho)
    //        "e ikarabella ho diperesente tse 1.5% ka hara naha"                (SA — tier handles this one)
    //    Without this, the Lesotho sentence would read *liporesente tse diperesente tse 25*.
    s = rewrite(s,
        /((?<![\p{L}\p{M}])[dl]i(?:peresente|poresente|phesente)[ \u00a0]+(?:tse[ \u00a0]+)?)(\d[\d.,]*)[ \u00a0]?%/giu,  // space, NBSP
        "$1$2",
    );

    // 6b) A DIGIT RUN GLUED TO THE END OF A WORD, immediately before a `%` → set it off with a space.
    //     ⚠ THIS EXISTS BECAUSE THE FIX CREATED IT, which is the point of reading the readings. The artifact
    //     writes `mahareng 3% ho isa ho12%` — a missing space in the source. Before this layer the tokenizer
    //     split `ho12` at the script change and read *ho* and *twelve*; with `percentPrefix` the tier
    //     substitutes a WORD where the digits were and the result fuses: `hodiperesente tse 12`, one token
    //     the g2p has never seen. 1 instance, and the shape is general enough to recur.
    //     ⚠ NARROWED TO THE `%` CASE ON PURPOSE. Letter+digit in this corpus is otherwise a DESIGNATION —
    //     `U20`, `T20`, `y2`, `x5`, and reference glue `h50`, `g48` — and splitting those would break the
    //     one shape (`km2`) whose adjacency the exponent branch depends on.
    s = rewrite(s, /(?<=[\p{L}\p{M}])(?=\d[\d.,]*[ \u00a0]?%)/gu, " ");  // space, NBSP

    // 7) RANGES → `ho isa ho`, BEFORE the shared tier and that ordering is load-bearing: `unitPrefix` moves
    //    the measure noun in FRONT of its number, so a range claimed after the tier would read
    //    `10-dikhilomithara tse 20` with the span unrecoverable. Run first, `0-100 km/h` reaches the tier as
    //    `0 ho isa ho 100 km/h` and the unit still has a number adjacent to it. (Hiligaynon's coupling, from
    //    the other side.)
    //    ⚠ ASCENDING ONLY, measured: of the 50 `N-N` shapes in the artifact the modal one is a SEASON —
    //    `2016-17` ×8, `2018-19` ×2, `2017-18` ×2, `2010-11` ×2 — every one of which is non-ascending and
    //    declines itself. Claiming them would read a season as a nine-century span.
    //    ⚠ THE GUARD EXCLUDES A HYPHEN ON EITHER SIDE, which declines a hyphen CHAIN, and a LETTER on
    //    either side, which declines `COVID-19` and `802.11n`-shaped designations.
    //    AFTER step 4, so a grouped endpoint is already one run of digits.
    //    ⚠ THE TRAILING GUARD EXCLUDES A DOT THAT CONTINUES THE NUMBER, NOT A CLAUSE MARK — `(?![\d]|[.,]\d)`
    //    is the form step 4 above already argues for, and this arm did not follow it. A plain `.` in the
    //    class declines the whole match at exactly a sentence end, so `73–94.` came back untouched and read
    //    as two cardinals with nothing between them (trap 58, `review.ts`'s `clause-final` check). `\.\d`
    //    keeps every reason the dot was there, and the counter-example is IN THIS CORPUS: the citation
    //    `73–94. etsa:10.1111/1469-8219.00039` carries the DOI pair `1469-8219`, ascending and
    //    digit-dash-digit, preceded by `/` — which is not in the lookbehind, so the trailing dot is the ONLY
    //    guard that declines it. `\.\d` still does; a bare removal would have read the DOI as a span.
    //    ⚠ THE COMMA STAYS IN THE CLASS: this corpus writes the DECIMAL COMMA as well as the comma group,
    //    so `5–13,7` must not be claimed with its fraction left behind.
    s = rewrite(s, /(?<![-\d.,\p{L}\p{M}])(\d+)[ \u00a0]?[-–—][ \u00a0]?(\d+)(?![-\d\p{L}\p{M}]|[.,]\d)/gu,  // space, NBSP
        (whole, a: string, b: string) => (Number(a) < Number(b) ? `${a} ${SPAN} ${b}` : whole));

    // 8) THE ENGLISH ORDINAL SUFFIX (`60th`, `1st`, `18th`). Sesotho writes its own ordinals as WORDS with a
    //    class prefix — *wa bo 44*, *ya bobedi*, *sebakeng sa bo 35* — so a Latin suffix on a digit is
    //    always foreign orthography, and it was reaching the phoneme stream as a bare [tʰ]. Stripping it is
    //    the whole fix; no ordinal morphology is invented, because Sesotho's is already written out wherever
    //    the language means it. Case-insensitive (trap 7).
    s = rewrite(s, /(\d+)(?:st|nd|rd|th)(?![\p{L}\p{M}])/giu, "$1");

    // 9) THE SHARED SYMBOL TIER — percent, currency, units, the rate and the squared exponent. See SYMBOLS.
    s = SYMBOLS(s);

    // 10) THE CONCORD BETWEEN A MAGNITUDE AND ITS FIGURE, which the tier cannot emit. With `currencyPrefix`
    //     the tier writes `noun+concord` then the magnitude then the number — `diranta tse dimilione 8` —
    //     and Sesotho repeats the concord on the magnitude's own numeral:
    //         "e kentse diranta tse dimilione tse 70.1"      "ka diranta tse dimilione tse 8"
    //         "letlotlo la hae le tla ba didolara tse dimilione tse dikete tse 788"
    //     Three independent st.wikipedia sentences, all with the second `tse`. This is not agreement with a
    //     digit (trap 14) — `tse` is the invariant class 8/10 concord of the magnitude noun, which is
    //     `dimilione`/`dibilione` whatever number follows.
    //     ⚠ ONLY AFTER A CONCORD THIS FILE JUST EMITTED, so a magnitude in ordinary prose is untouched.
    s = rewrite(s, new RegExp(`(tse[ \u00a0]+(?:${MAG_ALT}))[ \u00a0]+(?=\\d)`, "gu"), "$1 tse ");  // space, NBSP

    // 11) DECIMALS, LAST of the numeric rules — steps 5 to 10 all need their number intact, and the tier
    //     needs the digit adjacent to its sign (`37,99 km²` must still be one operand when the unit is
    //     read). The separator was reaching `clausePunctuation` and becoming a SENTENCE BREAK inside a
    //     number: `32.9°C` read *… mararo le metso e mmedi . robong*. 405 decimals in the corpus.
    //     NO separator word is emitted; see the header.
    //     ⚠ BOTH SEPARATORS — the corpus writes `0.0`/`2.5`/`50.19` and `0,0`/`5,0`/`37,99` at almost equal
    //     rates (98 dot / 93 comma) — and both restricted to a 1–2 digit tail, the same discipline step 4
    //     uses from the other side, so neither can swallow a grouping step 4 declined.
    //     ⚠ THE DOT ARM REJECTS A FOLLOWING `.digit`, and that guard is a REGRESSION THIS RUN CAUSED and
    //     the corpus diff caught: with the plainer `(?![\d])` the D.M.Y date `28.11.1820` matched at
    //     `28.11` and read *…robedi NNGWE NNGWE . sekete…* — the day and month spelled out as a decimal.
    //     Step 3b already spends those dots; this makes the two independent (trap 39's lesson inverted).
    //     ⚠ AND BOTH ARMS REJECT A LEADING COLON, which is what keeps this rule out of the sports times the
    //     header declines. `ka nako ya 1:56.72` has a `:` before the `56`, which is not a digit or a
    //     separator, so the plain lookbehind admitted it and the layer read *1:56 7 2* — claiming HALF of a
    //     shape it had just declined to claim at all. Refuse the whole match, never half of it (trap 53).
    s = rewrite(s, /(?<![\d.,:])(\d+)\.(\d{1,2})(?![\d]|\.\d)/gu, (_m, i: string, f: string) => spell(i, f));
    s = rewrite(s, /(?<![\d.,:])(\d+),(\d{1,2})(?![\d,])/gu, (_m, i: string, f: string) => spell(i, f));

    // ⚠ A padded replacement (` le `, ` tse `) doubles a space that was already there and can leave one at
    // an edge. SLOT-GAP is a corpus-diff defect class; this pass must not feed it.
    return rewrite(rewrite(s, /[^\S\n]{2,}/gu, " "), /^[^\S\n]+|[^\S\n]+$/gu, "");
}
