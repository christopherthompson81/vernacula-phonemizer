/**
 * THE DEFECT CLASSES, in one place — what counts as a leak, what counts as a drop, and the
 * REDUNDANT-vs-DROP discrimination that separates a permissible drop from a real one.
 *
 * ⚠ EVERY TABLE HERE IS A FLEET FACT, NOT A PER-TOOL SETTING. These tables were once copied into each tool
 * that needed them and drifted apart, leaving the strongest gate in the repo blind to two whole sign classes
 * while the others could see them. Add a class here, never in a caller.
 */

/** A LEAK is a character that SURVIVED into the IPA and should not have. */
export const LEAK_CLASSES: readonly (readonly [string, RegExp])[] = [
    // ⚠ `\p{Nd}`, NOT `\d`: under the `u` flag `\d` is ASCII 0-9 and nothing else, so `\d` is blind to a digit
    // leak in every language that writes its own numerals — Burmese ၀-၉, Thai ๐-๙, Bengali ০-৯, Khmer, Lao.
    ["DIGIT", /\p{Nd}/u],
    ["SLOT-GAP", /\s{2,}|^\s|\s$/u],
    // ⚠ NOT `.,;:!?` — those are the CANONICAL inline pause marks every engine emits via clauseSink, so
    // including them flags every utterance and the check tells you nothing. What belongs here is a mark that
    // should have BECOME one of those and did not: a native terminator, a symbol, or a non-ASCII digit.
    // U+00BA º and U+00AA ª are here because a class holding only `°` (U+00B0) lets `dell'11º` →
    // `undˈit͡ʃi º` pass the scan clean.
    ["RAWMARK", /[…。、，％℃°ºª〜～・！？²³\p{Sc}।॥۔؟،؛]/u],
    ["ZERO-WIDTH", /[​-‍⁠﻿]/u],
];

/**
 * A DROP is a symbol that VANISHED — detected differentially: phonemize the sentence, then phonemize it again
 * with the symbol REPLACED BY A SPACE (see `withoutSymbol`; deleting it perturbs how its neighbours tokenize
 * and the test then credits the symbol for that), and compare. Identical readings prove it said nothing.
 *
 * Keep each pattern at its WIDEST form — `minus` has to include the EN DASH, because a corpus writes `–5` as
 * readily as `-5`.
 */
export const DROPPABLE: readonly (readonly [string, RegExp])[] = [
    // U+066A ٪ is the Arabic-script sign and U+FF05 ％ the fullwidth one — both are ordinary typography in
    // their scripts, and the tier already accepts them.
    ["percent", /[%‰٪％]/gu],
    ["currency", /\p{Sc}/gu],
    ["degree", /[°℃℉]/gu],
    // Only where a digit FOLLOWS and no letter/digit precedes, so a compound hyphen (`Il-76`, `COVID-19`) and
    // a range (`5-3`) are not mistaken for a negative. Probe forms never merge two digits, so `-`/`+` are
    // judged on `5-`/`-5` and not on `5-5` → `55`.
    //
    // ⚠ `\p{M}` IS IN THE GUARD, and leaving it out makes this class blind across every abugida in the fleet.
    // A Devanagari word usually ends in a MATRA, not a bare consonant: the character before the hyphen in
    // `फ़ॉर्मूला-1` is ा (U+093E, `Mn`), so `(?<!\p{L})` passes and the scan reports a DROP on Formula-1 — a
    // designation whose hyphen is correctly silent.
    //
    // ⚠ THE SECOND LOOKBEHIND EXCLUDES A RANGE, and without it this class measures almost nothing it claims
    // to: resolved per hit, the overwhelming majority of "dropped minus" reports are ranges (`(1418 -1450)`,
    // `1995 -96`), designations (`चंद्रयान -1`) and apposition dashes, against a bare handful of true
    // negatives across the whole fleet.
    // ⚠ THE WINDOW IS DELIBERATELY TIGHT — a digit, then at most an ordinal suffix or an abbreviating dot,
    // then at most one space — rather than "a digit somewhere behind". Widen it far enough to reach past two
    // abbreviations and it swallows `०.३७२७१९ ख॰इ॰), -२.८८ परिमाण`, an astronomical magnitude and a genuine
    // negative. Under-excluding a range is a stray report; over-excluding deletes a true positive.
    //
    // ⚠ A DESIGNATION AFTER A SPACE IS NOT DECIDABLE HERE and is deliberately still reported. `चंद्रयान -1`
    // and a real `-5 stupňů` are the same shape — word, space, dash, digit — so separating them needs a
    // lexicon, not a guard. Those hits want a per-language judgement; a quiet gate would be worse. They are
    // accepted BY IDENTITY instead, in `ACCEPTED_SILENT` below.
    ["minus", /(?<![\p{L}\p{M}\p{Nd}])(?<!\p{Nd}[\p{L}\p{M}]{0,2}[.,]?[ \t]?)[-−–](?=\p{Nd})/gu],
    ["math-sign", /[+±×÷=<>]/gu],
    /**
     * ⚠ A SUPERSCRIPT WITH NOTHING BEFORE IT IS NOT AN EXPONENT. `⁸C` is an ISOTOPE MASS NUMBER — the
     * superscript precedes the element symbol — and `³He` the same; no language reads either as a power, and
     * `normalizeSymbols.ts` is right not to (its own `BARE_EXPONENT` requires a base BEFORE the run). A bare
     * `/[²³⁰¹⁴-⁹]/gu` reports a dropped exponent for text the reader is correct to leave alone.
     *
     * A LOOKBEHIND, not a captured base, because the scan needs the SIGN's own extent to test its removal.
     *
     * ⚠ IT MATCHES THE WHOLE RUN AND ALLOWS A SPACE. A superscript digit is `\p{No}`, not `\p{Nd}`, so a
     * per-character pattern anchored on a base matches only the FIRST superscript of `10¹⁵` and silently
     * shortens the sign's extent; and corpora write the sign spaced (`0,5 ² км`, `16000km ² `), which
     * `normalizeSymbols.ts` reads via its own `\s?`.
     *
     * ⚠ AND THE RUN INCLUDES THE SUPERSCRIPT MINUS, because `kg⁻²` is a real exponent whose run begins with
     * it. Leaving it out truncates every negative exponent to the digits after the sign.
     *
     * ⚠ A TRAILING LETTER IS WHAT ACTUALLY IDENTIFIES ISOTOPE NOTATION, and the base test alone does not
     * catch it: allowing the space that real spaced exponents need also lets `is ⁸C` through, since a letter
     * and a space do precede that superscript. What no exponent does is run straight into a letter. A power
     * is terminal or followed by punctuation, a space, or an operator.
     *
     * ⚠ THE LOOKAHEAD MUST ALSO EXCLUDE A FOLLOWING SUPERSCRIPT, or BACKTRACKING defeats it. On `¹⁴C` the
     * engine matches the run `¹⁴`, fails the letter test on `C`, then backtracks to `¹` — where the next
     * character is `⁴`, not a letter, so the trimmed match succeeds and the isotope is flagged after all.
     * Forbidding a superscript after the run leaves nothing to backtrack into.
     */
    ["exponent", /(?<=[\p{L}\p{M}\p{Nd}][ \t]?)[²³⁰¹⁴-⁹⁻]+(?![\p{L}\p{M}²³⁰¹⁴-⁹⁻])/gu],
    ["ampersand", /[&＆]/gu],
    ["iteration", /[ๆ々〃ヽヾゝゞៗ]/gu],
];

/**
 * WORDS SOURCED FROM OUTSIDE THE CORPUS, each with its citation — the `sourcing` gate's escape hatch, and the
 * narrowest one in this file.
 *
 * ⚠ WHY THIS IS NEEDED AT ALL: A CORPUS CANNOT ATTEST HOW A SYMBOL IS SPOKEN. Writers type `2.5`; they do not
 * spell out how they say it. So a language's decimal word can score exactly zero against a half-million-line
 * wiki dump and still be in universal spoken use, and a gate satisfiable only by corpus hits pushes the layer
 * toward dropping the symbol — the worse outcome.
 *
 * ⚠ AND WHY IT IS NOT SIMPLY THE MANIFEST. A haystack that includes the language's own `.jsonc` is the file
 * the gate EXTRACTS its needles from, so every declared word attests itself and a substituted nonsense word
 * passes. A declaration cannot be its own evidence; a citation naming a source outside this repository can.
 *
 * ⚠ THE CITATION IS THE POINT, NOT THE EXEMPTION. Anything vague enough that a reader could not go and check
 * it ("a dictionary", "standard usage") is a TODO wearing a citation's clothes and must keep failing the
 * gate. Name the work, the headword and the sense.
 */
export const CITED_WORDS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
    cjy: {
        "百分之": "⚠ THERE IS NO JIN CORPUS TO ATTEST ANYTHING IN — no cjy.wikipedia exists, and the "
            + "Wikimedia Incubator's Wp/cjy holds 3,060 Han characters whose artifact covers 7 of 35 cells "
            + "with `percent` among the EMPTY ones. So this rests on two other legs. (1) IT SPEAKS, which is "
            + "the gate that matters for this engine: 百 分 之 are all in the shipped Wiktionary/kaikki "
            + "Taiyuan dict, so 百分之 reads pai˥˧ fəŋ˩˩ t͡sz̩˩˩ — where ⟨度⟩ and ⟨摄氏⟩ are SILENT and were "
            + "refused for exactly that reason. (2) IT IS THE PAN-SINITIC WRITTEN FORM, not a dialect "
            + "vocabulary choice: 百分之 is corpus-verified in the cmn, yue and wuu layers already shipped, "
            + "each against its own corpus, and Jin is written in the same Han orthography. The genuinely "
            + "dialectal choices in this layer — the ampersand and the range word — were NOT inferred this "
            + "way; they come from the incubator text (和 ×16 coordinating, 到 ×5).",
    },
    hak: {
        "百分之": "⚠ THE GATE CANNOT SEE THIS WORD BECAUSE THE CORPUS IS IN THE OTHER ORTHOGRAPHY — the same "
            + "shape as nan, and for a stronger reason here: hak.wikipedia is written in Pha̍k-fa-sṳ and "
            + "**93.5% of its characters are Latin**, so a HAN spelling scores zero there by construction. "
            + "The romanization attests it directly. (1) THE WHOLE WORD, ONCE: `Sîn Nò-vî-ngî pûn sṳ́-yung "
            + "yî chhû-kiê sû-siá tha̍t-tó pak-fûn-chṳ̂-sṳ̍p-ńg` — 百分之十五, 15%, the percent word in a "
            + "percentage. (2) ITS SECOND HALF, ×39, IN EXACTLY THE CONSTRUCTION THE FRACTION RULE NEEDS: "
            + "`sâm-fûn-chṳ̂-ngi` (三分之二 = 2/3), `si-fûn-chṳ̂-yit` (四分之一), `ńg-fûn-chṳ̂-yit` (五分之一) "
            + "— denominator first, which is what makes 百分之 'of a hundred parts' rather than a borrowing. "
            + "(3) IT SPEAKS, which is this engine's hard gate: 百 分 之 are each dict keys, so 百分之 reads "
            + "pak̚¹ pun⁴⁴ t͡sz̩⁴⁴ — where ⟨度⟩ did NOT speak and had to be sourced as a derived entry before "
            + "the degree rule could exist at all.",
    },
    nan: {
        "百分之": "⚠ THE GATE CANNOT SEE THIS WORD BECAUSE THE CORPUS IS IN THE OTHER ORTHOGRAPHY. "
            + "nan.wikipedia is written in POJ, so a HAN spelling scores zero there by construction — and "
            + "this layer sources its words from POJ prose but EMITS them in Han, because the POJ forms leak "
            + "ASCII through the converter (`hun chi` → *hun chi˥*, the 之 syllable unmapped) while the Han "
            + "forms read cleanly. Two independent legs hold it up. (1) THE CONSTRUCTION IS CORPUS-ATTESTED: "
            + "百分之 is 百 + 分之, and the corpus writes `Tē-kiû ê gō͘ hun chi it` (1/5), `7 hun chi 1`, and "
            + "`1-pah-bān-hun chi it` — the same construction with a magnitude prefix, which is exactly what "
            + "百分之 is. (2) THE HAN SPELLING IS VALIDATED BY THE SHIPPED MOE DICTIONARY (Taiwan Ministry of "
            + "Education Taiwanese dictionary, via dict.tsv): 分之 reads hun-t͡ɕi and 百分之 reads paʔ-hun-t͡ɕi, "
            + "the POJ word's own reading. The same two-step is confirmed outright elsewhere — nan.wikipedia "
            + "glosses `Kong-lí ta̍k tiám-cheng (公里逐點鐘)`, pairing the POJ and Han spellings in one line.",
    },
    ig: {
        // Igbo has NO independent referee (wikipron ibo_latn, epitran ibo-Latn, kaikki: all 404), so a
        // non-corpus tier is the only tier it has beyond the corpus itself.
        "ntụkpọ": "Nkọwa okwu (nkowaokwu.com), an Igbo dictionary published by a 501(c)(3) nonprofit: "
            + "`ǹtụ̀kpọ`, n. 'decimal point; decimal number', with the definitional example "
            + "\"E ji ntụkpọ ekewapụ nọmba nnuzuroke na nọmba ọgwa\" — 'ntụkpọ is used to separate whole "
            + "numbers from fractions'. Corpus evidence is ZERO and that is expected: 0 hits for the word and "
            + "every variant, 0 digit-point-digit instances, and the 89 whole-word `point` hits are all English "
            + "text inside the Igbo wiki. Shipped untoned, matching the dictionary's own running-text examples "
            + "and the register of every other word the layer emits (pasent, naira, dollar)",
    },
};

/**
 * SIGN CLASSES A LANGUAGE IS INTENTIONALLY SILENT ON — the synthetic-probe counterpart of `ACCEPTED_SILENT`
 * below, and the difference between the two matters.
 *
 * `ACCEPTED_SILENT` names CORPUS LINES: this exact sentence's hyphen is a designation, so the drop is
 * correct. This names a whole CLASS for a language: no reading of this sign is shippable here at all, so a
 * synthetic probe (`-5`, `+5`) will always report DROPPED and always be right to.
 *
 * ⚠ WHY IT EXISTS RATHER THAN JUST LETTING THE GATE FAIL. A hard fail that can never be fixed is noise, and a
 * permanently red line says nothing about whether anything has REGRESSED.
 *
 * ⚠ AND IT IS DELIBERATELY SHORT. Only a class whose refusal is ARGUED IN THE LANGUAGE'S OWN FILE belongs
 * here; "no rule yet" is a TODO and must keep failing. Adding a real gap here to quiet the gate is exactly
 * the wrong use of it — and a long block is a smell, since the two highest-frequency entries this file ever
 * carried both turned out to be wrong refusals.
 *
 * The reason string is printed by both tools, so the justification travels with the exemption.
 */
export const ACCEPTED_SIGN_SILENCE: Readonly<Record<string, Readonly<Record<string, string>>>> = {
    ak: {
        // ⚠ ak.wikipedia IS LOCKED — its entire extract is the notice pointing at the Twi and Fante wikis —
        // so every measurement below is over tw.wikipedia (27,415 paragraphs) + fat.wikipedia (9,029), and
        // `sources.ts` reports espeak does not ship this language at all. The refusals are argued at length
        // in src/languages/akan/normalize.ts's header.
        degrees: "measured: `°C`/`°F` ×103 tw + 24 fat and NO Akan degree word or scale name exists. "
            + "`Celsius` ×1 and `Fahrenheit` ×2 are leads, not findings. The 354 tw + 353 fat hits for "
            + "*degree* are the ACADEMIC degree — `Master's degree`, `bakyela degree wɔ Law` — which is the "
            + "trap-37 shape with a count healthy enough to convince. `sources.ts` agrees: `[NONE] "
            + "scale-names`. The `C` still reads as a bare [k], which is the visible half of the same gap",
        plus: "measured: 18 tw + 3 fat, and not one is arithmetic — `Senegal + Liberia` (a range of "
            + "countries), the etymological gloss `pseudo + epistaxis`, `Mixed (Cultural + Natural)` (a "
            + "UNESCO category) and `UTC +14:00`. No Akan word for the operator is attested digit-adjacent",
        "plus-minus": "measured: zero ± across both wikis",
        equals: "measured: 108 tw + 5 fat, and the bulk is WIKI SECTION HEADING residue that survived "
            + "extraction (`== Ankorankoro asetra ==`, `== Amanyɔsɛm ==`) — reading the sign would say an "
            + "equals word twice on every heading. The handful that are real are a vote tally (`no mu = "
            + "78.6%`) and one linguistic gloss. No Akan equals word is attested in the slot",
        times: "measured: 19 tw + 11 fat, and every one read is either a BOTANICAL HYBRID (`Citrus × "
            + "latifolia`) or a RELAY/DIMENSION cross (`mita 4 × 100`, `4x100m`), which is \"by\" and not "
            + "\"times\" — the bm finding, reproduced here",
        divide: "measured: zero ÷ across both wikis",
        "less-than": "measured: zero < across both wikis (the `<` in the artifact is markup residue)",
        "greater-than": "measured: zero > across both wikis",
        // ⚠ `minus` IS DELIBERATELY ABSENT. All 39 tw leading minuses read back as EN-DASH RANGES, which
        // normalize.ts step 8 claims — but the coordinate `6.28ɛ; -1.850` is a GENUINE negative and no Akan
        // word for one is attested anywhere. Omitting a plus is lossless; omitting a minus INVERTS, so this
        // one stays red. Same stance as ln, bm and rw.
    },
    ceb: {
        // ⚠ NO CEBUANO DEGREE WORD IS ATTESTED ANYWHERE IN THE CORPUS. `grado` ×0, `digri` ×0, `celsius` ×0 —
        // and the corpus is FLEURS rather than the wiki (see cebuano/normalize.ts for why), so there is no
        // larger haystack to fall back on for this language: ceb.wikipedia is ~99% Lsjbot boilerplate and an
        // attestation there would be a fact about a template. The sign occurs ×2. Naming a reading would be
        // invention of exactly the kind the Fula `tere` lesson forbids, so `°` stays unread and stays VISIBLE
        // as a RAWMARK the scan can see, which is the better failure.
        degrees: "no Cebuano degree word in FLEURS (grado/digri/celsius all ×0) and the wiki is bot-generated",
        // ⚠ THE SAME REFUSAL, FIVE MORE TIMES, AND FOR THE SAME REASON: this corpus contains none of these
        // signs (`=` `<` `>` `±` `÷` are ×0 apiece) AND no Cebuano word for any of them — `katumbas`
        // (equals) ×0, `minus` ×0. The two arithmetic words it DOES carry are spent: `dugang` ×32 reads `+`
        // and `pilo` ×14 reads `×`. Writing five more readings out of a 1,932-sentence corpus that attests
        // neither the sign nor the word is exactly the Fula `tere` failure, so they stay unread.
        // ⚠ AND ceb HAS NO SECOND HAYSTACK. For most languages an unattested word can be probed against
        // Wikipedia; ceb.wikipedia is ~99% Lsjbot-generated, so a hit there is a fact about a template.
        // That is why this list is longer here than anywhere else — the refusal is better evidenced, not
        // lazier.
        minus: "sign ×0 and no Cebuano word (minus ×0, kulang is 'lacking'); FLEURS is the only usable corpus",
        "plus-minus": "sign ×0; the ± reading would compose two words, neither of which is attested",
        equals: "sign ×0 and katumbas ×0 (parehas ×31 means 'the same', not the relation)",
        "less-than": "sign ×0 and no comparative-magnitude phrase attested",
        "greater-than": "sign ×0 and no comparative-magnitude phrase attested",
        divide: "sign ×0; gibahin ×2 is 'divided' in the partition sense, not the operator",
    },
    gan: {
        // ⚠ THE HARD GATE FOR THIS LANGUAGE IS THE DICT, NOT THE CORPUS — gan HAS a real corpus (a
        // gan.wikipedia dump, 3,020 segments, 29/35 cells), which cjy and hsn did not. But
        // `sinitic/hanDictIpa.ts` skips an uncovered character SILENTLY, so an unsourced word does not
        // mispronounce — it VANISHES, which is worse than leaving the symbol unread. Every refusal below
        // names which of the two evidences decided it.
        plus: "measured: the corpus's 20-odd `+` contain NO arithmetic. They are a GRAMMAR NOTATION "
            + "(`“動詞+得+補語+賓語”`, the Gan verb-complement schema, ×10 in one paragraph), the language "
            + "name `C++` ×4, balanced CHEMICAL EQUATIONS (`2H₂O+2e⁻=H₂↑+2OH⁻`, `MnO₂+4HCl=MnCl₂+…`), a "
            + "LaTeX body (`e\\,^{i \\pi} + 1 = 0\\;`), a naming schema (`「名 + 爺名 + 姓」`) and an "
            + "asteroid designation (`沃虎+585`). And the word is unavailable anyway: ⟨加⟩ is SILENT in this "
            + "dict, so emitting it would delete the operator rather than read it",
        equals: "measured: every `=` is set theory (`0=0/1`, `2'=0' ' '={0,1,2}={0,{0}}`), a chemical "
            + "equation, an abbreviation gloss (`American English = AE`) or EasyTimeline markup "
            + "(`PlotArea = left:10`). ⟨等於⟩/⟨等于⟩ is HALF — the engine emits tɛn˨˩˧, one syllable of "
            + "two, dropping 於 — so the reading would be a truncated word",
        times: "measured: all 3 `×` are SCIENTIFIC NOTATION (`1.6 × 10⁻¹⁹ 庫侖`, `1.6726231 × 10⁻²⁷ kg`, "
            + "`半衰期有1.9×10¹⁹年`), which this layer reads for no language. ⟨乘⟩ is SILENT in this dict",
        divide: "measured: zero ÷ in the corpus. ⟨除⟩ does speak, unlike ⟨乘⟩, but there is nothing to read",
        "plus-minus": "measured: both ± are a MEASUREMENT UNCERTAINTY in one sentence on luminescence "
            + "dating (`36.1±2.6ka同到 64.2±4.9ka`). ⟨正負⟩ is HALF (emits fu˩˩, dropping 正), so the "
            + "reading would be the minus word alone — which INVERTS the sense of a tolerance",
        "less-than": "measured: zero digit-adjacent `<` in the corpus. ⟨小於⟩ is HALF (drops 於)",
        "greater-than": "measured: the only `>` is a mathematical definition of π quoted in prose "
            + "(`最細嗰 x > 0 讓 sin(x) = 0`) and two fullwidth `＞` inside a LaTeX chemistry condition "
            + "(`（條件：＞900&nbsp;°C）`). ⟨大於⟩ is HALF (drops 於)",
        degrees: "measured: the corpus's `°` are COORDINATES (`東經116°57′--117°42′`, `北纬27°33′-28°05′`), "
            + "COMPASS BEARINGS (`係N90°E或者S90°E`, `符號090°`) and an article ABOUT the sign itself "
            + "(`一份就係1度（1°）`) — plus exactly ONE real temperature (`熔點380℃`). And the word is "
            + "unavailable: ⟨度⟩ is SILENT in this dict, ⟨攝氏⟩ is HALF (sz̩˩˩ — it would say 'shì' and drop "
            + "'shè') and ⟨攝氏度⟩ emits 1 syllable of 3, so `20°C` would lose the WORD as well as the sign "
            + "— strictly worse than the raw sign, which at least survives as a RAWMARK the scan can see. "
            + "⚠ Note the corpus writes `係090度，符號090°`: the word is there and it is silent too, which is "
            + "a DICT gap and not a normalization one",
        currency: "n/a — the `$` IS read (美元, through the shared tier). ⚠ IT WAS DECLINED ON THE CORPUS "
            + "FIRST and the reversal is worth recording: the corpus's 4 `$` are all in ONE article, a film's "
            + "box office labelled as UK takings, and the only money word it attests is 美金 ×1 in a fine — "
            + "so on corpus evidence a currency word would have been a guess of the Fula `tere` kind. "
            + "`attest.ts` supplied the sense: gan.wikipedia writes 美元 ×5/4 articles in monetary amounts "
            + "AND glosses the sign itself (`美金（United States dollar），又叫美圓、美元，符號USD或者US$`). "
            + "Only `$` is declared; €, £ and ¥ are ×0 here and stay unread",
        ampersand: "n/a — the ampersand IS read (同到, the corpus's own coordinator ×59, every instance "
            + "coordinating; normalize.ts declares it through the shared tier)",
    },
    hsn: {
        // ⚠ THERE IS NO hsn.wikipedia AND NO REFEREE. Every reason below is read off the Wikimedia Incubator's
        // `Wp/hsn` — 153 pages, 30,640 characters, the only Xiang text that exists — plus a DICT CHECK through
        // the shipped engine, which is the harder gate: `sinitic/hanDictIpa.ts` skips an uncovered character
        // SILENTLY, so an unsourced word does not mispronounce, it VANISHES.
        times: "measured: `×` occurs ONCE in the whole corpus and it is SCIENTIFIC NOTATION — `質量5.9742×"
            + "10²⁴公斤`, the mass of the Earth — which this layer reads for no language. And the word is not "
            + "available anyway: ⟨乘⟩ is SILENT in this dict, so emitting it would delete the operator rather "
            + "than read it",
        equals: "measured: `=` is digit-adjacent 0 times; the corpus's `===` runs are wiki heading markup. "
            + "⟨等於⟩/⟨等于⟩ is HALF — the engine emits tən˦˩, one syllable of two, dropping 於 — so the "
            + "reading would be a truncated word",
        plus: "measured: zero digit-adjacent `+` in 30,640 characters",
        minus: "measured: the only digit-flanked dashes are the 3 ranges the layer READS (到, normalize.ts "
            + "step 6) and the coordinate span `東經111°53'－114°5'`. No negative number occurs",
        "plus-minus": "measured: zero ± in the corpus",
        "less-than": "measured: zero < in the corpus",
        "greater-than": "measured: zero > in the corpus",
        divide: "measured: zero ÷ in the corpus. ⟨除⟩ does speak, unlike ⟨乘⟩, but there is nothing to read",
        exponent: "⚠ THE SQUARED/CUBED UNIT IS READ (平方/立方 compose onto the unit noun, normalize.ts step "
            + "4); a BARE superscript is not, and that is this corpus's sharpest finding. Of its 24 "
            + "superscript runs **23 are ROMANIZATION TONE NUMBERS** from the 湘語羅馬字 tables the incubator "
            + "carries — /ʃɘ̃⁴⁵/, /ye²⁴/, /mɔ⁴²/, /tɕiɑʌ⁴⁵/, /n̩⁴²/ — and exactly ONE is an exponent "
            + "(5.9742×10²⁴). Reading superscripts as powers would turn a pronunciation table into "
            + "arithmetic. hsn is the FIFTH Sinitic corpus to produce this hazard from a fifth source, after "
            + "wuu, nan, cjy and hak; test/accepted-silent.test.ts predicted it here by name",
        // ⚠ THE KEY IS `degrees`, PLURAL — it must match the PROBE name in review.ts's signCases, not the
        // DROPPABLE class name. Spelled `degree` here it silently exempts nothing and the gate still fails.
        degrees: "measured: the corpus's only 2 `°` are COORDINATES (`東經111°53'－114°5'`, `北緯27°51'－"
            + "28°40'`), where neither the degree nor the primes has a reading. And the word is unavailable: "
            + "⟨度⟩ is SILENT in this dict and ⟨攝氏⟩ is HALF (sz̩˦˥ — it would say 'shì' and drop 'shè'), so "
            + "`20°C` would lose the WORD as well as the sign — strictly worse than the raw sign, which at "
            + "least survives as a RAWMARK the scan can see",
        currency: "measured: NO currency sign occurs in the 30,640-character corpus at all — not ¥, not $, "
            + "not €. ⟨元⟩ speaks and appears ×33, but every instance is an already-spelled amount "
            + "(`可支配收入12434元`) — the WORD, never a sign to rewrite. Declaring a currency would be "
            + "robustness for input this language has never been observed to write, and the sign probe would "
            + "then be reporting on a rule with no evidence behind it",
        ampersand: "n/a — the ampersand IS read (跟, the corpus's own coordinator ×136 against 和 ×63; "
            + "normalize.ts declares it through the shared tier)",
    },
    mg: {
        // ⚠ THE MINUS IS A BCE YEAR, NOT ARITHMETIC — and it is the bot template that writes it. Every one
        // of the 22 mined instances is either an ancient-biography stub (`Croesus … dia teraka ny
        // 1 Janoary -596 ary maty ny 1 Janoary -546`, "born 1 January -596, died 1 January -546") or a
        // negative COORDINATE from the commune stubs (`-97.0602777778`). Neither wants "minus": the first
        // means 596 BC and the second is a longitude. `signed-number` is 15,177 in the dump and that count
        // IS the template.
        // ⚠ And the only candidate word fails on PART OF SPEECH, which is the Fula `hakkunde` shape:
        // `latsaka` ×24 is a comparative verb taking a whole clause — `tsy latsaka ny 8,5 %` ("not less
        // than 8.5%"), `latsaka 40 kilometatra atsimon'ny` ("40 km south of") — never an infix before a
        // numeral. No era phrase is attested either (`sources.ts`: "no era marker in the corpus").
        minus: "measured: all 22 mined `-` are a bot-template BCE year (`1 Janoary -596`) or a negative "
            + "coordinate; neither reading is 'minus', and latsaka is a clause-taking comparative",
        // The mined `=` are ORTHOGRAPHY GLOSSES in the article on Malagasy spelling (`ny n̂ ilazana ny feo
        // n`) and dimension crosses; no Malagasy reading of either sign is attested in corpus or wiki.
        equals: "measured: the mined `=` are spelling-article glosses, not relations between numbers",
        times: "measured: the mined `×` are dimension crosses; no Malagasy reading is attested",
        plus: "measured: digit-flanked `+` is ×0 in the artifact",
        "plus-minus": "measured: ± is ×0 in the artifact",
        "less-than": "measured: `<` is ×0 in the artifact",
        "greater-than": "measured: `>` is ×0 in the artifact",
        divide: "measured: `÷` is ×0; the corpus's `/` instances are rates and dates",
    },
    lo: {
        // ⚠ EVERY MINED `=` AND `+` IS INSIDE A FORMULA OR A WORKED EXAMPLE, and in the clearest of them the
        // corpus writes the reading ITSELF in the very next bracket: `1,000 Hz = 1 KHz (1 ພັນແຮັກ ເທົ່າກັບ
        // 1 …)` — "1,000 Hz = 1 KHz (1 kilohertz EQUALS 1 …)". Voicing the sign there would say it twice.
        // The rest are an economics illustration (`ລົດຈັກ x1/100 ຄັນ + ເຂົ້າ x2/50 ໂຕນ`), a coordinate
        // conversion (`(D + M/60 + S/3600)`), matrix notation (`C_{2,1}=8`) and `3/4 = 0.75`.
        equals: "measured: all 38 mined math-signs are formulas, matrix notation or unit equivalences — and "
            + "the equivalences already write ເທົ່າກັບ beside the sign, so reading it would double the word",
        plus: "measured: every mined `+` is an operand in a worked example or a DMS conversion "
            + "(`(D + M/60 + S/3600)`); digit-flanked arithmetic `+` in running prose is ×0",
        // ⚠ AND `×` IS THE OPPOSITE SHAPE — the WORD is sourced and the SIGN is not. lo.wikipedia's
        // multiplication article glosses it directly: *"ການຄູນ (ມັກຈະສະແດງດ້ວຍ ສັນຍາລັກຂ້າມ ×, …)"*,
        // "multiplication (often shown with the cross symbol ×, …)". But `×` is ×0 in the mined segments:
        // there is nothing to read. Recorded here rather than declared, so the word is on file if a later
        // corpus produces the sign.
        times: "measured: `×` is ×0 in the artifact. The word IS sourced — ຄູນ, glossed against the symbol "
            + "in lo.wikipedia's own multiplication article — and is left undeclared only for want of a sign",
        // ⚠ `>` OCCURS EXACTLY ONCE AND IT IS INSIDE A UTILITY FUNCTION — `ຖ້າ u(x) > ຫຼື = u(y) (x R y)`,
        // "if u(x) > or = u(y)" — where the Lao text around it already reads the relation aloud
        // (`ຫຼາຍກ່ວາ ຫຼື ເທົ່າກັນ`, "greater than or equal to"). Reading the sign would double the phrase,
        // which is the same argument as `equals` above. `<`, `±` and `÷` do not occur at all.
        "greater-than": "measured: `>` occurs ONCE, in a utility function whose Lao gloss already says "
            + "ຫຼາຍກ່ວາ ຫຼື ເທົ່າກັນ beside it — reading the sign would say the relation twice",
        "less-than": "measured: `<` is ×0 in the artifact",
        "plus-minus": "measured: ± is ×0 in the artifact",
        divide: "measured: `÷` is ×0; ຫານ is attested as the word but there is no sign to attach it to",
    },
    kmr: {
        // ⚠ NOT ONE OF THE 15 MINED `=` `+` `×` IS ARITHMETIC, and they are not even mostly prose. Three
        // classes, none of which wants an operator reading:
        //   · a GLOSS or an etymology — `çiya = lêr`, `Deutsches Wörterbuch = Ferhenga Kurdî-Alman`,
        //     `Mesîn = me/mekan + sî/av + in/tê`, `"GNU/Linux" (GNU + Linux)`, `C++`
        //   · EasyTimeline / wiki MARKUP that survived into the artifact — `ImageSize = width:800`,
        //     `PlotArea = top:10`, `ScaleMajor = unit:year`, and URL-encoded catalogue parameters (`$003d`)
        //   · a FORMULA and scientific notation — `E=mc²`, `7.2×109 m3`, `UTC+7`
        // No Kurmanji reading of any of the three signs is attested in either haystack (the corpus and
        // ku.wikipedia — espeak does not ship this language), so all three stay unread.
        equals: "measured: all mined `=` are a gloss (`çiya = lêr`), EasyTimeline markup (`ImageSize = "
            + "width:800`) or a formula (`E=mc²`); none is a relation between two numbers, and no Kurmanji "
            + "reading is attested",
        plus: "measured: every mined `+` joins WORDS in an etymology (`me/mekan + sî/av`), a software name "
            + "(`GNU + Linux`, `C++`) or a UTC offset; digit-flanked arithmetic `+` is ×0",
        times: "measured: the only mined `×` is scientific notation (`7.2×109 m3`), which this layer reads "
            + "for no language; no Kurmanji word for the operator or the dimension cross is attested",
        // ⚠ THREE SIGNS THAT DO NOT OCCUR AT ALL, and one that arrives BROKEN. `±` and `÷` are ×0 in the
        // artifact and `>` is ×0; `<` is ×0 as a character but the corpus shows it was there upstream and
        // was mangled into a pseudo-entity — `heya &kêm; 16&nbsp;diguhere` is `&lt;` with its name
        // translated, so the one instance this language has of a less-than is unreachable by any rule and
        // is a corpus-repair question, not a reading one. None of the four has an attested Kurmanji
        // reading either: `kêm` ("less") takes a whole clause (`273.15 pileyan ji sifira Selsiyusî kêm`),
        // which is the Fula `hakkunde` shape — a real word that does not fit the slot.
        "plus-minus": "measured: ± is ×0 in the artifact and no Kurmanji reading is attested",
        "less-than": "measured: `<` is ×0 as a character — its one upstream instance arrives as the mangled "
            + "pseudo-entity `&kêm;` — and `kêm` is a clause-taking comparative, not the relation",
        "greater-than": "measured: `>` is ×0 and no comparative phrase is attested digit-flanked",
        divide: "measured: `÷` is ×0; the corpus's `/` instances are rates, dates and URLs",
    },
    si: {
        // ⚠ EVERY `=`, `+` AND `×` IN THIS CORPUS IS SOMETHING OTHER THAN ARITHMETIC, which is the whole
        // reason all three are refused rather than read. Measured over the 448 mined si.jsonc segments —
        // there is no FLEURS corpus for Sinhala and espeak does not ship the language, so the artifact and
        // si.wikipedia are the only haystacks there are.
        //
        // `=` is a GLOSSARY or table separator, never a relation: `අබ්බඩා=.....................`,
        // `මාමා = මාමා`, `Detective Comics(ඩිටෙක්ටිව් කොමික්ස්) = රහස් පරික්ෂක චිත්‍ර කථා`,
        // `ක්‍රියාකාරී අනුපාතිකය = නිශ්චිත වසරක…` (a definition heading), and the wiki markup `|alt=`.
        // The two that LOOK like equations are a variable assignment in an astronomy worked example
        // (`Y = 0.25`, `RAMC=36.0437268⁰`), where the operand is a letter and the reading would be a
        // formula rather than prose.
        equals: "measured: all 20+ mined `=` are a glossary/table separator, a definition heading or wiki "
            + "markup (`මාමා = මාමා`, `|alt=`); the only two flanking a number are variable assignments in "
            + "one astronomy worked example. No Sinhala reading is attested for the relation either",
        // `+` is an ETYMOLOGY GLOSS every time: `කොළ + අඹ යන්න කොළඹ ලෙස`, `αστρονομία = άστρον + νόμος`,
        // `astron + nomos`, and — in the article on Sinhala orthography itself — `ක් + ර = ක්‍ර : ග් + ය =
        // ග්‍ය`, which is a statement about CONJUNCT FORMATION. Reading any of them as "plus" would turn
        // word-formation into a sum. Digit-adjacent `+` is ×0.
        plus: "measured: every mined `+` joins two WORDS in an etymology or conjunct-formation gloss "
            + "(`කොළ + අඹ`, `ක් + ර = ක්‍ර`); digit-adjacent `+` is ×0",
        // `×` is a DIMENSION CROSS in all six instances, every one after `මිලිමීටර්`: `8.2×6.3×0.6`,
        // `13.7×15.3×1.5`, `8.7×7.7×1.5`, `10.0×0.6`, `40×26`, `2.5m X 2.5m`. That reading is "by", not
        // "times", and no Sinhala rendering of the dimension cross is attested in either haystack —
        // `ගුණිත` is ×0 in the corpus. th reached the same conclusion for the same shape.
        times: "measured: all 6 mined `×` are a DIMENSION CROSS after මිලිමීටර් (`8.2×6.3×0.6`), which is "
            + "'by' and not 'times'; no Sinhala reading of either sense is attested (ගුණිත ×0)",
        // ⚠ THE REMAINING THREE ARE ×0 SIGNS WITH ×0 WORDS, and both halves matter. `±`, `<` and `÷` do
        // not occur in the artifact at all, and no Sinhala rendering of any of them is attested in the two
        // haystacks this language has. `අඩු`/`වැඩි` ("less"/"more") exist as ordinary adjectives but the
        // COMPARATIVE RELATION needs a phrase around them (`…ට වඩා අඩු`), which nothing attests in the
        // slot; that is the Fula `hakkunde` failure — a real word that does not fit the position.
        "plus-minus": "measured: ± is ×0 in the artifact, and its reading would compose two words neither "
            + "of which is attested in the slot",
        "less-than": "measured: `<` is ×0; අඩු is an adjective and the relation needs a phrase (`…ට වඩා "
            + "අඩු`) that nothing attests digit-flanked",
        "greater-than": "measured: `>` is ×0; same as less-than — වැඩි is the adjective, not the relation",
        divide: "measured: `÷` is ×0; බෙදීම is the noun 'division' (and the corpus's only arithmetic `/` "
            + "instances are rates and dates), never the operator between two numbers",
    },
    ps: {
        // ⚠ NO ESPEAK PASHTO AT ALL, so every reason below is a corpus measurement over a fresh
        // ps.wikipedia dump (242,649 lines after markup and category-residue filtering) and nothing else can
        // check it. Argued at length in src/languages/pashto/normalize.ts's header.
        equals: "measured: `=` counts 7,734 and essentially NONE of it is arithmetic. The bulk is WIKI "
            + "SECTION HEADING markup that wikidump-to-text.py leaves in (`==خوي او عادتونه==`, "
            + "`==په طبيعت کښي د يورانيم موجوديت==`) and the rest is chemistry and physics copy "
            + "(`P1=750mmHg V1=290cc`). Reading the sign would say an equals word twice on every heading. "
            + "`مساوي` ×935 is the ordinary copula-adjective, never a digit-adjacent operator",
        plus: "measured: `+` counts 2,001 and is almost entirely CHEMICAL EQUATIONS — `2KMnO4+10FeSO4+"
            + "8H2SO4`, `Cl2+2NaOH → NaClO + NaCl + H2O`, `Al2O3.2H2O + 6NaOh`. `جمع` ×1,729 is the ordinary "
            + "noun 'sum/total' and the corpus never places it between two operands",
        times: "measured: `×` counts 196 and is FOUR different things in one glyph — a cartridge dimension "
            + "(`۳۹×۷،۶۲ ماډل ۴۳ گولی`), scientific notation (`1.60218 × 10 −13 J`), an equipment count "
            + "(`۲ × Lyulka AL-37FU`) and genuine arithmetic in one maths article (`1×8 + 90×8`). `ضرب` "
            + "×574 is attested but no single reading is right for all four senses",
        "less-than": "measured: `<` is digit-adjacent 1 time in the artifact, inside a temperature range "
            + "copied from an English source (`>950 °C; >1,740 °F`) — a comparative, not an operator",
        "greater-than": "measured: same instance as `less-than`, the same imported English fragment",
        "plus-minus": "measured: zero ± in 242,649 lines",
        divide: "measured: zero ÷ in 242,649 lines",
        ampersand: "measured: all 297 `&` sit inside LATIN text — `AT&T`, `P&T/Telecom Éireann`, "
            + "`Sight & Sound`, the Bangladeshi highway pair `N4 & N405`, and URL query strings "
            + "(`…&oldid=421080475`). The Pashto conjunction is `او`, and emitting it here would put a "
            + "Pashto word inside an English proper name",
    },
    ln: {
        // ⚠ NO ESPEAK LINGALA AT ALL and a 36-line referee, so every reason below is a corpus measurement
        // over a fresh ln.wikipedia dump (23,678 paragraphs) and nothing else can check it. The refusals are
        // argued at length in src/languages/lingala/normalize.ts's header.
        minus: "measured: the digit-flanked dash in Lingala is a RANGE, not a minus — 1,424 hyphens and 162 "
            + "en dashes sit between digits, and reading them gives year spans (`1965 - 1997 Mobutu Sese "
            + "Seko`, a governor list), ISBNs and the ISO code `639-3`. Of 228 LEADING dashes, two are true "
            + "negatives (`-273,15 °C`, `-1,602 189 × 10⁻¹⁹`); the rest are coordinates (`-4.2667`), a "
            + "postcode (`B-3840`), a compound (`TB-8,000`) and open-ended spans (`19.. - 1960`). And no "
            + "negative word exists: `molongola` ×1 is an ADJECTIVE in a physics gloss ('mokúmba ya "
            + "molongola (negative \"-\")'), i.e. the wrong register. Ranges ARE read (kino, normalize.ts "
            + "step 7). ⚠ OMITTING A MINUS INVERTS — this is a known-wrong silence, not an acceptable one",
        plus: "measured: 16 digit-flanked `+`, and not one is arithmetic — TELEPHONE COUNTRY CODES (`+255`, "
            + "`+872 – unassigned`, a dialling-plan article), two album titles (`Libala 1+1`, `1+1=1 (Remix "
            + "Total)`) and a French book title (`Devenir Président en 50 + 20 jours`). Of 360 leading `+`, "
            + "the bulk is that same dialling table plus infobox residue (`bato1= +30 000 000`). `kobakisa` "
            + "×141 is the verb 'to add/increase' and is never digit-adjacent as an operator",
        "plus-minus": "measured: zero ± in 23,678 paragraphs",
        equals: "measured: 6 digit-flanked `=` — an album title (`1+1=1`), a population table (`2004 = "
            + "13197`) and spectroscopy (`v1 = 3650 cm−1`). The bare total of 870 is dominated by WIKI "
            + "SECTION HEADINGS (`== Bomoyi ==`), so reading the sign would say the equals word twice on "
            + "every heading. `ezalí` is the ordinary copula, not an arithmetic reading — the corpus writes "
            + "its own equalities with it (`Falánga ya Swisi mókó ezalí 100 centimes`)",
        "less-than": "measured: `<` occurs once in the whole corpus and 0 times between digits",
        "greater-than": "measured: `>` occurs 27 times and 0 of them between digits — all markup residue",
        times: "measured: `×` occurs 5 times in total. Three are SCIENTIFIC NOTATION (`9,109 53 × 10⁻³¹ "
            + "kg`), which this layer reads for no language; one is a band name (Wenge Musica 4×4) and one "
            + "a French relay leg (`le relais du 4 × 100 m`). Zero arithmetic instances, and no multiply "
            + "word is attested",
        divide: "measured: zero ÷ in 23,678 paragraphs",
        exponent: "measured: the SQUARED UNIT is read (`km²`/`km2` → `kilomɛtrɛ-kare`, the word attested ×11 "
            + "hyphenated onto its noun), but a BARE exponent has no reading: all 24 superscripts are "
            + "scientific-notation exponents in two physics articles (`10⁻¹⁹`, `10⁻²⁷`, `10⁻³¹`) plus one "
            + "edition marker (`Kinsásá, 2007³`), and no power word occurs anywhere in the corpus",
    },
    tl: {
        // Every reason is a reading of the mined artifact's actual instances (259 utterances) — the classes
        // are physics/科 encyclopedia copy, not running Tagalog, and no reading word is attested anywhere.
        minus: "measured: the digit-flanked leading dashes are PREHISTORIC-YEAR notation (`taong -73 000 "
            + "hanggang -60 000`, `-4000`) — a BCE convention, not arithmetic, and no negative-value word "
            + "occurs in the corpus. Digit–digit dashes AND digit-hyphen-digit are RANGES and ARE read "
            + "(hanggang, normalize.ts — a hyphen between digits cannot be a compound)",
        plus: "measured: 5 instances — a quark charge (`bayad + 2/3`), Greek etymology glosses (`astron + "
            + "nomos` ×2), a pulsar designation (PSR B1257+12) and one timezone (UTC+8). No plus word is "
            + "attested; ⟨dagdag⟩ never occurs digit-adjacent",
        "plus-minus": "measured: zero digit-flanked ± in the artifact",
        equals: "measured: 5 instances, all physics/etymology copy (`c = 299,792,458m/s`, `E = mc²`, "
            + "`αστρονομία = άστρον + νόμος`). ⟨katumbas⟩ is never digit-adjacent",
        "less-than": "measured: zero digit-flanked < in the artifact",
        "greater-than": "measured: zero digit-flanked > in the artifact",
        times: "measured: all 9 × are SCIENTIFIC NOTATION (`6.022 × 10²³`) — and every instance is preceded "
            + "by a wiki value-template artifact (`7023602200000000000♠`), so the class is template dirt on "
            + "top of a notation this layer does not read for any language",
        divide: "measured: zero ÷ in the artifact",
        degrees: "measured: 16 digit-adjacent ° — nearly all geographic COORDINATES (`116°&nbsp;40′ E`), the "
            + "yo shape, and the two temperatures write the scale word out themselves (`26.5° sentigrado`), "
            + "so voicing ° would double it. \"digri Selsiyus\" has 0 tl.wikipedia phrase hits",
    },
    yo: {
        // Yoruba's referees (wikipron yor, kaikki yor) are word→IPA: they can check how a word is pronounced,
        // never whether it is the right word for a sign. So every reason below is a corpus measurement.
        minus: "measured: the digit-flanked dash in Yoruba is a RANGE, not a minus — 3,378 hyphens and 4,159 en "
            + "dashes sit between digits, and the corpus glosses the reading twice: `ọgọ́rùn-ún méjì sí mẹ́fà "
            + "(200-600 kg)` and, for a scoreline, `góòlù mẹ́rin sí òdo (4–0)`. `sí` IS read for the range, 1,427 "
            + "digit-flanked instances — see ig/nl/mr/ta/yue, which record the same shape",
        degrees: "measured: only the BARE ° with no scale letter — 128 occurrences, of which 55 are "
            + "digit-flanked geographic coordinates (`7°30′S 3°21′E`). °C and °F ARE read (`ìwọ̀n 38 Celsius`). "
            + "The angular `digiri` has 1 hit and three of its four total hits are ACADEMIC degrees "
            + "(`ẹ̀rí digiri (doctorate)`, `masita digiri (MBA)`)",
        plus: "measured: + is 9 digit-flanked in 21 MB. `àfikún` (564 whole-word) is the nominal 'addition' and "
            + "is digit-adjacent 3 times in running prose, not as an operator; `kún` is a verb 'to fill'",
        "plus-minus": "measured: ± is 18 digit-flanked and NO tolerance word occurs — the sign appears in "
            + "scientific ranges copied into the wiki, with nothing in the corpus that reads it",
        equals: "measured: = is 7 digit-flanked. `dọ́gba` (124 whole-word) means 'is equal to' and is "
            + "digit-adjacent 9 times, which is too thin to map a sign onto, and `jẹ́` (30,012) is the ordinary "
            + "copula rather than an arithmetic reading",
        "less-than": "measured: < occurs 13 times and NEVER between digits (0 digit-flanked); the sign is not "
            + "used as a comparator in this corpus",
        "greater-than": "measured: > occurs 39 times and 0 of them between digits",
        divide: "measured: ÷ occurs twice in 21 MB and never between digits. `pín` (709) is the ordinary verb "
            + "'to divide/share' and `ìpín` (349) a share or portion — neither is digit-adjacent as an operator",
        exponent: "measured: the SQUARED UNIT is read (`km²` → `kìlómítà onígun mẹ́rin`, 754 occurrences of the "
            + "sign, the reading attested 15 times after a unit noun), but a BARE exponent has no reading: ³ "
            + "occurs 23 times with no cube word anywhere in the corpus, and no predicate form — the `20 squared` "
            + "shape — is attested for a base with no unit noun",
    },
    ig: {
        // ⚠ IGBO HAS NO REFEREE (wikipron ibo_latn, epitran ibo-Latn and the kaikki extract are all 404), so
        // every reason below is a corpus measurement and nothing else can check it.
        minus: "measured: the digit-flanked dash in Igbo is a RANGE, not a minus — of 4,993 in a 26 MB sample, "
            + "1,734 are year-year (`1967-1970`, `1979-1983`) and 1,741 small-small (`peeji 90-120`). A minus rule "
            + "would read every date range as arithmetic. `ruo` ('to') IS read for the range, 1,687 digit-flanked "
            + "instances — see nl/mr/ta/yue, which record the same shape",
        degrees: "measured: ° occurs 41 times digit-flanked but NEITHER scale name occurs anywhere in the corpus — "
            + "`dịgrii` 0 hits, `selsiọs` 0 hits. `sources.ts` reports [NONE] scale-names for this language. Most "
            + "of the corpus's ° is geographic coordinates (`4°06′12′′S 141°39′54′′E`) rather than temperature",
        times: "measured: × occurs 123 times digit-flanked and every one is a relay distance (`4 × 100` metres). "
            + "The candidate `mụba` is the VERB 'to increase' (`na-amụba 6`), not the arithmetic operator; no "
            + "operator word is attested",
        plus: "measured: + is 23 digit-flanked in a 26 MB sample. `mgbakwunye` (4,685 hits) is the NOMINAL "
            + "'addition', not what a reader says between two operands — the distinction concept.ts warns about",
        equals: "measured: = is 1 digit-flanked and 24 leading in a 26 MB sample. `nhata` ('equal', 2,250 hits) is "
            + "available but the sign is too rare in this corpus to sense-check a digit-flanked reading against",
        "plus-minus": "measured: the sign does not occur digit-flanked in the corpus (1 instance in 26 MB)",
        "less-than": "measured: the sign does not occur in the corpus (0 digit-flanked, 0 leading)",
        "greater-than": "measured: 0 digit-flanked; the 6 leading instances are markup residue, not comparisons",
        divide: "measured: the sign does not occur in the corpus at all (0 digit-flanked, 0 leading)",
        exponent: "measured: `sources.ts` reports the sign does not occur in the evidence for this language",
    },
    bar: {
        // ⚠ THE SIGNS ARE PRESENT AND NONE OF THEM IS ARITHMETIC — which is a genuine divergence from
        // Standard German, whose layer reads `=`, `<`, `>` and `÷`. A dialect wiki's subject matter is
        // largely ITS OWN LANGUAGE, so these characters are doing morphology, not maths. All 22 enumerated
        // over the artifact, and measured over the BAVARIAN subset (24% of bar.wikipedia is Standard German
        // — see bavarian/normalize.ts):
        //   · the DERIVATION ARROW, the single largest group: `da- (< der-)`, `dabogga (< der+packen)`,
        //     `daduan (< der+tun)`, `si dabarma (< der+barmen)`, `(si) darenna (< der+rennen)`,
        //     `magy (< ugrisch *mańćε)` — and note the `+` inside them is a MORPHEME BOUNDARY;
        //   · the SOUND-CHANGE ARROW: `Lautwandlregl ei > oa`;
        //   · the GLOSSING EQUALS: `bei dem = beim`, `an dem = am`, `(= nach)`, `(= in)`, `ius = es Recht`,
        //     `ys = schnej`, `grad = Buag und ec = die Nochsübn`, `caribaria = Duacheinanda`,
        //     `on = „zehn“ + ogur = „Stamm“`;
        //   · a CAST LIST's "and": `mit Ludwig Prell + Josef Amann`, `Hörspiel von + mit Bally + Ludwig Prell`;
        //   · an AWARD TALLY's multiplier: `26 × Annie Award (… 2 × 1995, 4 × 1997 …)`, `26 × Emmy`;
        //   · x86 ASSEMBLY: `movl $4,%eax # Syscall-ID 4 (= __NR_write)`;
        //   · a Y-DNA HAPLOGROUP table: `P* (xR1a) 56%`.
        // Reading `<` as a comparison would be confidently wrong in every instance, and porting German's
        // words here is exactly the Standard-German-for-Bavarian substitution this language's layer exists to
        // avoid. `review.ts --lang bar` stays red on the class, correctly (trap 24).
        equals: "measured: all 22 math-sign instances in the artifact, zero arithmetic. `=` is a GLOSSING "
            + "equals in a dialect wiki writing about its own language (`bei dem = beim`, `(= nach)`, "
            + "`ius = es Recht`, `ys = schnej`) or x86 assembly (`movl $4,%eax # (= __NR_write)`)",
        "less-than": "measured: every `<` is the ETYMOLOGICAL DERIVATION ARROW, which is what a dialect wiki "
            + "uses it for — `da- (< der-)`, `dabogga (< der+packen)`, `si dabarma (< der+barmen)`, "
            + "`magy (< ugrisch *mańćε)`. Not one comparison in the corpus",
        "greater-than": "measured: the only `>` is a SOUND-CHANGE arrow in the phonology section "
            + "(`Ausnahma vo da Lautwandlregl ei > oa`), i.e. 'becomes', not 'is greater than'",
        plus: "measured: no `+` is addition. Inside a derivation it is a MORPHEME BOUNDARY (`der+packen`, "
            + "`der+tun`, `on = „zehn“ + ogur`), and in a radio-play credit it is 'and' (`mit Ludwig Prell + "
            + "Josef Amann`). ⚠ The signed-TEMPERATURE plus IS read — `+15 °C` — by a degree-guarded rule in "
            + "bavarian/normalize.ts; this refusal is the bare sign everywhere else",
        times: "measured: both `×` are an AWARD TALLY's occurrence count (`26 × Emmy (… 6 × 1992, 2 × 1997)`), "
            + "and no Bavarian operator word is attested — `moi` appears as 'moi so grouß wia' (times as "
            + "large) but never between two operands",
        divide: "measured: the sign does not occur in the artifact at all",
        "plus-minus": "measured: the sign does not occur in the artifact at all; the ± rule in "
            + "bavarian/normalize.ts is robustness, composed from the two words its own sign rules already use",
        ampersand: "measured: 83 of the 83 `&` in the Bavarian subset are the HTML entity `&nbsp;`, which "
            + "bavarian/normalize.ts folds to a space at step 1 because the engine was phonemizing `nbsp` as "
            + "a WORD. There is not one real ampersand in Bavarian text — the only four in the whole artifact "
            + "are Standard German publisher names in bibliographies (`Königshausen & Neumann`, `W W Norton & "
            + "Co`, `Quelle & Meyer`, `Rosa & Karl`). `und` is abundant, but declaring it would be a rule "
            + "about German bibliography filed under Bavarian",
    },
    km: {
        // ⚠ SPACING SPLITS THIS SHAPE, which is why only the unspaced form is refused. A refusal that
        // describes `=` as a whole ("glosses and code") throws away 1,649 spaced operand-flanked sites, the
        // great majority of them Khmer prose. The spaced form now reads ស្មើ; see khmer/normalize.ts rule 5.
        // The Khmer-free spaced sites are EasyTimeline markup, which `allOccurrencesInMarkup` keeps the scan
        // from reporting as a language defect.
        //
        // ⚠ NOTE what remains in the probe's reading: `x = y` gives *ˈɛks smaə wˈaᶦ* — the sign is right and
        // the LETTER NAMES are English inside a Khmer engine. That is the letter-name seam, and it is its own
        // work.
        equals: "measured: what is STILL silent is the UNSPACED equals only — 239 sites, and they are a "
            + "translation gloss (`ចក្រវាឡរណប=satellite`, Khmer joined to its English equivalent) or a solution "
            + "set (`x=-1/2`), plus 694 code operators `==`/`!=`/`>=`/`<=`. Reading `equal` in a translation gloss "
            + "would voice a sign that means 'renders as'. The SPACED form — 1,649 sites, 1,546 of them Khmer "
            + "prose — now reads ស្មើ, so this entry covers the unspaced shape and nothing else",
    },
    gu: {
        minus: "measured: gu_in has two `word -digit` instances (the bill `એચજેઆર -3` and the ordinal range "
            + "`10મી -11મી`), the shape no guard can reject — see ta's entry and ACCEPTED_SILENT",
    },
    kn: {
        minus: "measured: kn_in has the bill number `ಎಚ್‌ಜೆಆರ್ -3`, the `word -digit` shape no guard can reject "
            + "— see ta's entry and ACCEPTED_SILENT, which lists this instance as correctly silent",
    },
    yue: {
        // ⚠ HERE THE SHAPE IS AN ARTEFACT OF THE TRANSCRIPT, not of Chinese. FLEURS writes Han with a space
        // between EVERY character, so the aircraft designation `Il-76` is stored as `伊 爾 -76` — a letter, a
        // space, then the hyphen. The undecidable shape arrives through the corpus's own formatting.
        minus: "measured: the per-character spacing FLEURS uses for Han turns the designation `Il-76` into "
            + "`伊 爾 -76`, producing the `word -digit` shape no guard can reject",
    },
    ta: {
        // ⚠ TRIED, AND THE CORPUS DIFF REJECTED IT. A guarded minus rule correctly refuses every range, score
        // and closed designation — and then reads `சந்திரயான் -1` as "கழித்தல் ஒன்று", minus one. The rule
        // converts an accepted silence into an audible error, which is strictly worse than the gap.
        // ⚠ AND IT IS THE SAME SENTENCE IN FIVE LANGUAGES. FLEURS is parallel, so the Chandrayaan designation
        // appears in gu, hi, kn, mr and ta — exactly the five languages listed for `minus` here and in
        // `ACCEPTED_SILENT`. Whatever is decided applies to all of them.
        minus: "measured, then TESTED: a guarded rule read the spacecraft `சந்திரயான் -1` as minus one, the one "
            + "shape no guard can reject — see ACCEPTED_SILENT, which lists this instance as correctly silent",
    },
    mr: {
        // Devanagari compounds are written with a hyphen (आस-पास), and the corpus's one hyphen-before-digit
        // outside a range is `चंद्रयान -1`, a spacecraft name.
        minus: "measured: the corpus's only hyphen-before-digit outside a range is the spacecraft `चंद्रयान -1`, "
            + "so a minus rule would read a designation as arithmetic — see marathi/normalize.ts step 15",
    },
    nl: {
        minus: "measured: every `-\\d` in nl_nl is a score or a range, so the rule would have turned 14 scores "
            + "into negatives — see dutch/normalize.ts step 9",
    },
    cjy: {
        // ⚠ cjy HAS NO CORPUS — there is no cjy.wikipedia, and the Wikimedia Incubator's Wp/cjy is 3,060 Han
        // characters whose artifact covers 7 of 35 cells. So these reasons are NOT corpus measurements like
        // every other entry in this table. They are something rarer and, for once, stronger: a CHECK AGAINST
        // THE SHIPPED DICT, which decides whether a word can be spoken at all. The shared Han-dict engine
        // skips an uncovered character SILENTLY, so a rule using one of these would delete the word instead
        // of mispronouncing it — strictly worse than leaving the sign unread, which at least leaves a
        // RAWMARK the scan can see.
        degrees: "checked, not measured: ⟨度⟩ is SILENT in this dict, and so are ⟨摄氏⟩/⟨攝氏⟩. `20°C` would "
            + "lose the degree WORD as well as the sign. The corpus cannot help — its `degrees` cell is EMPTY",
        equals: "checked: ⟨等于⟩ emits ONE syllable — 于 is silent — so it would say the first half of the "
            + "word and drop the second. ⟨等於⟩ likewise",
        "less-than": "checked: the same half-word problem as ⟨等于⟩, on ⟨小于⟩",
        "greater-than": "checked: the same half-word problem, on ⟨大于⟩",
        divide: "checked: ⟨除以⟩ needs 以, and no reading is available for the pair; the artifact's "
            + "`arithmetic` cell is EMPTY so there is nothing to measure either",
        times: "checked: ⟨乘⟩ speaks but ⟨乘以⟩ does not, and a bare 乘 in the dimension slot is an inference "
            + "no Jin text available can support",
        plus: "checked: ⟨加⟩ speaks, but ⟨减⟩ is SILENT — so the layer could read a plus and not a minus, "
            + "which is a worse state than reading neither. Deferred as a pair",
        minus: "checked: ⟨负⟩ speaks and ⟨减⟩ is silent (see plus). And with an EMPTY `signed-number` cell "
            + "there is no evidence about which shapes a Jin corpus would even contain",
        "plus-minus": "checked: no reading available, and the cell is EMPTY",
        currency: "⚠ NOT a dict problem — ⟨元⟩ speaks. It is a SENSE problem: all four incubator instances "
            + "are 維基元 (Meta-Wiki) and the personal names 元好問 / 柳宗元, never money. No Jin currency word "
            + "is attested in any source available, so the sign stays unread",
    },
    hak: {
        // ⚠ THE MEASUREMENT BEHIND EVERY LINE HERE IS UNUSUAL AND IS STATED ONCE: hak.wikipedia is written in
        // Pha̍k-fa-sṳ, not Han — 93.5% of the sample tier's characters are Latin — so these counts are over a
        // ROMANIZED corpus, and the words they are about would be emitted in Han. That split is nan's shape
        // too. What it costs here is nothing, because each refusal below rests on reading the INSTANCES.
        equals: "measured: the `=` instances are not arithmetic. `Egnatia T=thai-kiê` is a mangled wikitable "
            + "cell, `UTC+8` a timezone, `Yit Kûng-khín = 10 000 Phìn-fông Kûng-tshak` a unit DEFINITION "
            + "whose two sides are already words, and the rest are LaTeX bodies (`&=\\lim_{h \\to 0}{9 + 6h "
            + "+ h^2 - 9\\over{h}}`). And ⟨於⟩/⟨于⟩ are SILENT in this dict, so ⟨等於⟩ could only say half of "
            + "itself — the same half-word refusal cjy made",
        plus: "measured: ⟨加⟩ speaks but ⟨減⟩ is SILENT, so the layer could read a plus and not a minus, "
            + "which is worse than reading neither. The 19 `arithmetic` instances do not argue otherwise: "
            + "`「3+1」的安排` is a train-scheduling label and `-2, 0, +4, +6` are chemical oxidation states",
        times: "measured: every digit-adjacent `×` is SCIENTIFIC NOTATION whose superscript the dump "
            + "stripped — `1.392×106`, `2×1030`, `5×1030` are 10⁶, 10³⁰, 10³⁰. Reading the sign there would "
            + "say \"times one hundred and six\". ⟨乘⟩ speaks; the sign has no attested operator instance",
        divide: "measured: the one ÷ is inside a formula gloss (`ńg sien chhòng-thu ÷180÷60`), and ⟨除以⟩ "
            + "needs ⟨以⟩, which this dict does not carry",
        "plus-minus": "measured: zero ± in the artifact",
        minus: "measured, and the refusal is NARROWER than it looks: a negative IS read — but only before a "
            + "degree sign, because the only negative-number word this corpus supplies is 零下 (`làng-hâ`, "
            + "'below zero'), which is temperature-specific. All 6 genuine negatives in the corpus ARE "
            + "temperatures (`-4.5℃`, `-218 °C`, `−224℃`, `-170°C` ×2, `-5 °C`) and all 6 are read. A BARE "
            + "`-5` is what stays silent, and it has no attested instance and no attested word: the other 28 "
            + "leading hyphens before digits are 3-digit year-range separators (`303-ngièn -349-ngièn`), "
            + "coordinate ranges (`112°50'-114°45'`, read as ranges by step 3) and chemical oxidation states "
            + "(`-2, 0, +4, +6`). ⚠ AND THE HYPHEN IS THE WORST CHARACTER IN THIS ORTHOGRAPHY TO GUESS WITH — "
            + "Pha̍k-fa-sṳ joins every polysyllable with one (`Hak-kâ-ngìn`, `2005-ngièn`), which is why nan "
            + "declined the ASCII hyphen outright for the same reason",
        "less-than": "measured: zero `<` in the artifact; and the ⟨小於⟩ half-word problem would apply",
        "greater-than": "measured: zero `>` in the artifact; same half-word problem on ⟨大於⟩",
    },
    nan: {
        // ⚠ EVERY REASON HERE IS A CORPUS MEASUREMENT. nan HAS a referee (wikipron Hokkien), but it is
        // word→IPA: it can check how a word is pronounced, never whether it is the right word for a SIGN.
        minus: "measured: THE HYPHEN IS A WORD-INTERNAL SYLLABLE JOINER IN POJ, which is what makes this "
            + "class unlike any other language's. The corpus's digit-adjacent dashes are POJ compounds "
            + "(`ko͘-1-ê`, `bó͘-1-ê`, `têng poaⁿ--1-piàn`), the `ISO 8859-1 … 8859-16` designation block, an "
            + "ISBN (`957-2053-07-8`) and citation pages (`313-332`). The two GENUINE negatives are both "
            + "inside formulas or glosses — `10°C kàu -2°C` and `(2000 kg) × (−10 m/s)` — and no Min Nan "
            + "negative-number word occurs anywhere in the corpus. The RANGES are read, via the en dash and "
            + "the tilde, which are 5/5 and 4/4 genuine (normalize.ts step 2)",
        equals: "measured: the `=` instances are WIKI SECTION HEADINGS (`== Chām-gōa liân-kiat ==`) and "
            + "EasyTimeline template code (`ScaleMajor = unit:year increment:20 start:01/01/1800`, "
            + "`ScaleMinor = unit:year`). Not one is arithmetic in running prose",
        plus: "measured: the digit-adjacent `+` joins RUNNING MATES in an election table — "
            + "`Chúi-píⁿ(chóng-thóng)+Lū Siù-liân(hù-chóng-thóng)` — which is a list separator, not an "
            + "operator, and no Min Nan addition word is attested digit-adjacent",
        "plus-minus": "measured: zero ± in the artifact",
        "less-than": "measured: zero `<` in the artifact",
        "greater-than": "measured: zero `>` in the artifact",
        divide: "measured: zero ÷ in the artifact",
        times: "measured: the one `×` is a PHYSICS FORMULA in a quoted gloss, `(2000 kg) × (−10 m/s)`, and "
            + "no multiplication word is attested; the corpus writes dimensions out in words instead",
        currency: "measured: `$` IS read (⟨箍⟩, which the corpus glosses — `Bí-kim 1 kho͘ (US$1)`). What "
            + "remains is ¥ ×2, € ×2, £ ×6 and ¢, for which NO Min Nan currency name occurs anywhere in the "
            + "corpus — ⟨箍⟩ is the unit word, not a currency name — plus `$now`, which is EasyTimeline "
            + "template code rather than money",
    },
    jv: {
        minus: "measured: the corpus's ONE true negative is `at –45 °C` inside an ENGLISH bibliographic "
            + "citation title, and no Javanese negative-number word is attested in the corpus or on "
            + "jv.wikipedia. Every other digit-adjacent dash is a RANGE (read as ⟨nganti⟩, normalize.ts "
            + "step 7), a COORDINATE range (step 4b), a citation PAGE range (`157-167 doi:`), a DOI's own "
            + "`0301-0104`, or a botanical parenthetical extreme (`10-15(-17) cm`)",
        // ⚠ jv HAS referees (kaikki jv + Aksara), but they are word→IPA: they can check how a word is
        // pronounced, never whether it is the right word for a SIGN. So every reason below is a corpus
        // measurement over the mined artifact (jv.wikipedia dump).
        equals: "measured: 34 `=`, and NOT ONE is arithmetic. They are DEFINITIONAL GLOSSES — a formula "
            + "being explained (`Rumus: x + y = z. X = pengalaman, y = renungan, z = hasilipun`), a "
            + "register equivalence (`dèwèkè=dhékné (ngoko)`, `piambeké=piyambekipun`) and a cross-language "
            + "gloss (`tembung rika (jw = kowé, ind = kamu)`). No equals word is attested, and reading one "
            + "would speak it aloud in every dictionary-style line the wiki has",
        plus: "measured: 7 `+`, and the digit-adjacent ones are not operators — `+/- 327.866` is an "
            + "APPROXIMATION (claimed as ⟨kurang luwih⟩ in normalize.ts step 5b, so the sign IS read there) "
            + "and the rest are MUSICAL NOTATION, the slendro/pelog scale degrees `[C-D E+ G A]` and "
            + "`[C+ D E-F# G# A B]`, where a `+` marks a raised pitch",
        "less-than": "measured: zero `<` in the artifact",
        "greater-than": "measured: zero `>` in the artifact",
        divide: "measured: zero `÷` in the artifact",
        // ⚠ NOT LISTED, deliberately: `±` and `×` ARE read — ± as ⟨kurang luwih⟩ (step 5b) and × as
        // ⟨kaping⟩ through the tier — so a drop of either is a real regression and must keep failing.
    },
    wuu: {
        // ⚠ wuu HAS NO REFEREE (the whole modern Wu ecosystem derives from the one Wugniu tradition, so any
        // automated referee is circular), and no FLEURS corpus. Every count below is over the mined
        // artifact's retained text; the words are separately checked against `src/languages/wu/dict.tsv`,
        // which is a hard gate here — a word the dict does not carry is SKIPPED by the front end, silently.
        minus: "measured: 169 hyphens, 56 digit-flanked, and ZERO of them a negative. They are RANGES with a "
            + "unit (`2-8°C`, `15-25公里`, `0-14 岁`), YEAR ranges (`1763-1774`), BUS ROUTE LISTS "
            + "(`公交车8 - 31 - 32 - 46 - 49D - 55`), MODEL NUMBERS (`747-400`, `Qwen2.5-72B`) and a TONE "
            + "NOTATION (`223-33`). The ranges ARE read (到, wu/normalize.ts step 6, right-context guarded); "
            + "the other three shapes are correctly silent. The only `−` U+2212 instances are 2, both inside "
            + "Japanese-language mathematics copy quoted in a wuu article (`m = −1 で调和平均`)",
        plus: "measured: 22 `+`, exactly ONE digit-flanked — a programming tutorial computing `3+2`. And the "
            + "word fails independently: all 47 corpus hits of 加 are BOUND (外加, 加勒比, 新加坡, 加工, 增加, "
            + "加拿大) and wuu.wikipedia adds only 汤加 and 毕加索, so no operator sense is attested anywhere",
        "plus-minus": "measured: zero ± in the artifact",
        equals: "measured: 20 `=`, ONE digit-flanked (`195 kg ÷ 3 = 65 kg`). The rest are WIKI SECTION "
            + "HEADINGS (`== 参考文献 ==`) and LaTeX formula bodies (`(x-x_m)^2 + (y-y_m)^2 = a^2`, "
            + "`y = y_m + a \\sin \\theta`). 等于 is in the dict AND corpus-attested in sense — the WORD is "
            + "fine and the SIGN is not what the count implied; reading it would say 等于等于 参考文献 等于等于 "
            + "aloud on every article",
        "less-than": "measured: zero `<` in the artifact",
        "greater-than": "measured: zero `>` in the artifact",
        times: "measured: one `×`, and it is SCIENTIFIC NOTATION (`地球质量约为5.97×10²⁴千克`), which this "
            + "layer reads for no language. 乘 is in the dict but both its corpus hits are 乘坐 'to ride'",
        divide: "measured: one `÷`, in the same `195 kg ÷ 3 = 65 kg` worked example as the `=` above; 除以 "
            + "occurs zero times in the corpus",
    },
    nya: {
        // ⚠ EVERY ONE OF THESE SIGNS IS EASYTIMELINE CHART MARKUP IN THIS CORPUS, NOT CHICHEWA PROSE — the
        // sharpest instance yet of the playbook's "a small wiki is not all in its own language" warning
        // arriving as MARKUP rather than as another language. `mine.ts` selects adversarially, so a handful
        // of ny.wikipedia population-graph articles supply almost the whole `arithmetic` and `signed-number`
        // evidence. Counted over the mined artifact and read one by one, not sampled.
        // ⚠ AND THERE IS NO SECOND HAYSTACK: espeak does not ship Chichewa AT ALL, so `sources.ts` reports
        // `[chk?]` for every one of these and the corpus plus ny.wikipedia is the entire evidence base.
        minus: "measured: 10 candidate instances, of which 9 are EasyTimeline PIXEL OFFSETS "
            + "(`shift:(-10,5)`, `shift:(-60,-5)`, `shift:(-14,5)`) — a chart directive, never a quantity — "
            + "and the 10th is a spaced RANGE dash (`2004 -2009`) which normalize.ts step 8 now reads as "
            + "`mpaka`. ZERO negative numbers occur in Chichewa prose, and no minus word is attested in the "
            + "corpus, in the referees or on ny.wikipedia. Omitting a minus INVERTS a value, so this is a "
            + "refusal that would have to be revisited the moment a real negative appears — see ln, which "
            + "deliberately has no entry here because its six drops ARE genuine negatives",
        // ⚠ THE SIX ARITHMETIC SIGNS ARE ONE REFUSAL, WRITTEN SIX TIMES because `SIGN_CASES` is per sign
        // while `DROPPABLE` is coarse. Every one rests on the same two measurements: the sign is absent from
        // Chichewa prose, and no Chichewa word for it is attested in the corpus, the referees or
        // ny.wikipedia — and espeak, the usual third tier, does not ship this language at all.
        equals: "measured: all 14 `=` in the artifact are MARKUP — 9 EasyTimeline directives "
            + "(`ScaleMajor = unit:year increment:11000`, `PlotArea = left:50 right:20`) and 5 CSS "
            + "declarations (`.reflist-columns-2{column-width:30em}`). Zero occur in Chichewa prose, and no "
            + "equals word is attested",
        "plus-minus": "measured: `±` ×0 in the artifact; the ± reading would compose two unattested words",
        "less-than": "measured: `<` ×0 in the artifact",
        "greater-than": "measured: `>` ×0 in the artifact",
        times: "measured: `×` ×0 in the artifact. The `x` between digits does not occur either",
        divide: "measured: `÷` ×0 in the artifact",
        plus: "measured: `+` occurs twice, both a UTC OFFSET (`(UTC + 7)`, `(GMT+1)`), which the playbook's "
            + "fleet sweep found is the one contentful plus and the one nothing attests. No Chichewa plus "
            + "word is in the corpus, the referees or ny.wikipedia, and naming one would be the Fula `tere` "
            + "failure. The other plus context — a leading `+` on a temperature — does not occur here",
    },
    za: {
        // ⚠ EVERY COUNT HERE IS OVER THE ZHUANG-ONLY SUBSET of a fresh za.wikipedia dump — 2,929 of 7,328
        // paragraphs — because that wiki carries whole imported GERMAN and ENGLISH articles and `mine.ts`
        // selects adversarially, so the artifact's hard-set is dominated by them (the su.wikipedia lesson).
        // The filter is validated on words that cannot cross the boundary: `nienz` 907 / `bi` 115 /
        // `nyied` 288 in the Zhuang subset and ALL ZERO in the other 814. See zhuang/normalize.ts.
        degrees: "no Zhuang degree or scale word exists in any source. `doh` (度) ×33 is 'throughout' "
            + "(`faenbouh doh daengx siqgyaiq`, `cienz doh lajbiengz`) or the country INDIA (`Yaenq Doh`); "
            + "`dohraeuj` ×1 is the noun 'temperature', not a unit; `Sesi`/`Sipsi` (摄氏) ×0; espeak does "
            + "not ship Zhuang at all. The four `°C` are one climate sentence, and normalize.ts step 6 "
            + "CONSUMES the sign rather than reading it — a deliberate downgrade from the scale letter "
            + "reaching the IPA as a bare [ɕ] to a silence, which is the better of the two available failures",
        currency: "measured: `$` occurs ZERO times in Zhuang text. All three instances in the artifact are "
            + "inside ENGLISH sentences imported into za.wikipedia (`a $500,000 award`, `grant of $179,113`, "
            + "`the $15,000 prize`) — a cell about English text that happens to sit in this wiki. `¥ € £` "
            + "are ×0 everywhere, and the corpus's 7 `元` are all Chinese dynastic and personal names "
            + "(元朝, 元世祖忽必烈, 蒙元耀), never money. No Zhuang currency word is attested in any source",
        plus: "measured: two `+`, neither arithmetic — `insectum «Non» + caedo` joins two Latin etymology "
            + "glosses, `laengconghndaeng+gwnz hoz` joins two anatomical sites in a clinical checklist",
        "plus-minus": "measured: zero ± in the Zhuang subset",
        equals: "measured: zero `=` in Zhuang prose. The artifact's instances are EasyTimeline TEMPLATE "
            + "DEBRIS that survived the dump extractor (`PlotArea = left:50 bottom:30`, `ScaleMajor = "
            + "gridcolor:darkgrey increment:200`) — chart markup, not text anyone reads aloud",
        "less-than": "measured: one `<`, and it is a stray glyph closing a sentence about a hand gesture "
            + "(`duiyenz dog haengj yungq fajfwngz <.`), not a relation between two quantities",
        "greater-than": "measured: zero `>` in the Zhuang subset",
        // ⚠ THE OPERATION NOUNS EXIST AND ARE THE WRONG REGISTER, which is trap 35's Hindi जोड़/धन split.
        times: "measured: two `×`. One is SCIENTIFIC NOTATION (`gij dijgiz dwg 10830 ik laebfueng "
            + "goengleix, 5.976×10(27) seuq`), which this layer reads for no language; the other is "
            + "METALINGUISTIC — the wiki's own stub article on multiplication naming the symbol in quotes "
            + "(`Swngzfap dwg cungj suenqsoq, fouzhauh dwg \"×\", gezgoj dwg \"giz\"`). That stub gives the "
            + "OPERATION noun `Swngzfap` and the RESULT noun `giz`, and neither is what a reader says "
            + "BETWEEN two operands",
        divide: "measured: one `÷`, in the parallel division stub (`Cawzfap dwg cungj suenqsoq, fouzhauh "
            + "dwg \"÷\", gezgoj dwg \"sieng\"`) — the symbol MENTIONED, not used. Same refusal as `times`",
        // ⚠ NO `minus` KEY, AND ITS ABSENCE IS THE POINT. The corpus has three TRUE negatives — one
        // article's Dead Sea elevations, `dwg -422m`, `dwg -418m`, `gemj daengz -420m` — and no Zhuang word
        // for a negative number is attested anywhere. Omitting a plus is lossless; omitting a minus
        // INVERTS, so a known-wrong reading does not get to be a green gate: `review.ts --lang za` stays
        // red on `minus` until a word is sourced. Same standing refusal as `ln`.
    },
    bm: {
        // ⚠ ESPEAK SHIPS NO BAMBARA AT ALL, so every reason below is a measurement over bm.wikipedia — the
        // WHOLE of it, 2,359 lines / 430,646 characters — and nothing else can check it.
        equals: "measured: `=` occurs 40 times and NONE is arithmetic. The majority is EasyTimeline markup "
            + "residue that survived extraction (`ImageSize = width:420`, `DateFormat = yyyy`, `Period = "
            + "from:0 till:2000000`); the rest are definitional glosses in the grammar and proverb articles "
            + "(`sabu ba = ma`, `Misali: ka ji Bɔn = jibɔn`), one economic identity written between WORDS "
            + "(`BSK = makoɲe + bakrunba nafolo + …`) and `E=mc^2`. Zero digit-flanked instances, and no "
            + "Bambara word for the relation is attested anywhere",
        plus: "measured: `+` occurs 6 times and not one is a sum between two numbers — a phone number's "
            + "dialling prefix (`n'numero fayi +22379311167`), a UTC offset (`(UTC+8)`), the word-level terms "
            + "of the BSK identity above, and a typographic dash run (`Empire français--+san 1809`). The "
            + "playbook's own finding applies: a UTC offset is the only contentful plus and nothing attests "
            + "how bm says it",
        times: "measured: `×` occurs 3 times and every one is a CARTRIDGE DIMENSION — `7,62 × 39 mm`, "
            + "`7.62 ×33 mm`, `7,62x41` — which is 'by' and not 'times'. No Bambara multiplication word is "
            + "attested in the corpus or on bm.wikipedia",
        "plus-minus": "measured: `±` is ×0 in the whole wiki",
        divide: "measured: `÷` is ×0 in the whole wiki; the corpus's `/` instances are date pairs "
            + "(`1994/1995`, `22/2009`) and rates",
        "less-than": "measured: `<` is ×0 in the whole wiki",
        "greater-than": "measured: `>` is ×0 in the whole wiki",
        degrees: "measured: `°` occurs exactly TWICE in the whole bm wiki and both are geographic "
            + "COORDINATES on one page (`Latitude: 44°27'56″`, `Longitude: 17°33'36″`) — no temperature, and "
            + "the primes have no reading either. NEITHER SCALE NAME EXISTS ANYWHERE: `selsiyu`, `degere`, "
            + "`digere` and `Celsius` are all ×0, and `sources.ts` reports `[  · ] scale-names — no ° in the "
            + "corpus`. espeak ships no Bambara, so there is no second haystack. Naming a reading here would "
            + "be the Fula `tere` invention exactly, and `20°C` losing the WORD as well as the sign is worse "
            + "than the raw letter it would replace",
    },
    mad: {
        // ⚠ ESPEAK SHIPS NO MADURESE AT ALL and there is no machine referee for it (no wikipron/epitran/
        // kaikki), so every reason below is a measurement over the mined mad.wikipedia artifact plus
        // `attest.ts` against that same wiki.
        // ⚠ A THIRD TIER DOES EXIST FOR THIS LANGUAGE, and an earlier version of this comment said it did
        // not. Off-repo Madurese lexicography is reachable and it settled two questions the corpus could
        // not: the Madurese–Indonesian dictionary at willnode.github.io/madura (9,789 entries) carries
        // `koma`, `jutah` and `milyad` as headwords, and ruangbudaya.com's "Numeral dalam Bahasa Madura"
        // supplies a whole composed numeral (1,508,070 = *sajuta lèmaratos bâllu' èbu pèttongpolo*) that
        // fixes the magnitude WORD ORDER. Both are cited at their point of use (madurese.jsonc,
        // numbers.ts, normalize.ts step 10). The classes below are still refused — none of these sources
        // offers a sign word — but "the corpus is silent" is not by itself the end of the enquiry here.
        // ⚠ AND `attest.ts`'s wiki probe SUBSTRING-MATCHES, which under-counted `koma` into invisibility:
        // `insource:/koma/` on mad.wikipedia is dominated by `komandan`/`hokoman`/`okoman`, and the one
        // snippet that names the punctuation mark (`tandhâ bâca koma`, in `Bhâsa Jeppang`) only surfaced
        // when all thirty were read by hand. Read the snippets, not the count — the same lesson `sampè'`
        // taught from the other direction (trap 41).
        // ⚠ AND `minus` IS DELIBERATELY ABSENT FROM THIS BLOCK, which is the point of the entry as a whole.
        // Madurese has TWO genuine negatives in the artifact (`-1 mèter dpl`, and the integers article's
        // `0, 1, -1, 2, - 2, ...`), omitting a minus INVERTS the value, and `korang` ×17 — the only
        // candidate word — is bound into a COMPARATIVE PHRASE in every instance (`korang lebbi` "more or
        // less" ×13, `korang ḍâri` "less than" ×4), never a prefixed sign. That is the Fula `hakkunde`
        // failure: a real word whose part of speech does not fit the slot. So `review.ts --lang mad` stays
        // RED on the minus, exactly as `ln` does, and the designation instances are named in
        // `ACCEPTED_SILENT` instead so the two true negatives remain visible.
        plus: "measured: FOUR `+` in the artifact and not one is a sum — two PHONE DIALLING PREFIXES "
            + "(`Kode telepon: +31 (Èropa), +599 (Amerika)`), one UTC OFFSET (`bâkto lokal (UTC+7)`) and a "
            + "SONG TITLE (`single sè andhi' judhul \"1+1\"`). The playbook's fleet sweep already settled "
            + "the UTC case: it is the one contentful plus and nothing in any corpus attests how it is "
            + "said. And the candidate word refutes itself on sense — `tamba` is attested in 9 articles on "
            + "mad.wikipedia and every hit is the verb/adverb 'to increase' (`pânḍuḍuk Katolik tamba "
            + "bânnya'`, `Karir mènangka panyanyi tamba kalonta`), not the operator",
        equals: "measured: FIVE `=` in the artifact and NONE is arithmetic. Four are BILINGUAL GLOSSES — "
            + "`Eatore, konye' gunong = Silahkan dimakan, seadanya`, `\"dahana\" = apoy, \"pura\" = kotta`, "
            + "`tangghâl 1 bulân Tisyri = Rosh Hashanah`, and a German/Indonesian book-title equation in a "
            + "citation — and the fifth is the physics formula `E = mc²`. A reading for the RELATION would "
            + "be wrong in every attested instance, and no Madurese equals word is attested in the corpus "
            + "or on the wiki (`sarowa` ×0, `padha` ×0)",
        "less-than": "measured: `<` is ×0 in the artifact. The comparative Madurese does write is the "
            + "PHRASE `korang ḍâri` ×4 (`korang ḍâri 50%`, `korang ḍâri sèttong milimeter`), which is a "
            + "quantity comparison in prose and not a reading for a notational relation — the same "
            + "distinction Indonesian's and Sundanese's layers record",
        "greater-than": "measured: `>` is ×0 in the artifact, and `lebbi ḍâri` ×9 is the prose 'more than' "
            + "rather than the magnitude relation the sign denotes",
        divide: "measured: `÷` is ×0 in the artifact. Every `/` in this corpus is a date (`10/01/2007`), a "
            + "year pair (`1998/1999-2008/2009`), a document number (`SK No. 17/1961`, `No 01/0/SKB/2004`), "
            + "a RATE (`jiwa/km²`, `mm/taon` — which normalize.ts step 7 reads with `per`) or the 'or' "
            + "slash Madurese writes constantly (`bân/otabâ`, `daging/ajam/tempe`, `atoran/kabiyasaan`). "
            + "`bagi` ×2 is 'for' (`Requiem bagi ROCKER`), not the operator",
    },
    ht: {
        // ⚠ ESPEAK SHIPS NO HAITIAN CREOLE, so every reason below is a measurement over an ht.wikipedia dump
        // (800,158 paragraphs), and — because this wiki is 15.1% FRENCH — over its Creole-only 154,110 as
        // well. Both numbers are given where they differ, because the gap IS the finding.
        //
        // ⚠ NO `minus` KEY, DELIBERATELY, AND THE GATE STAYS RED ON IT. Omitting a plus is lossless;
        // omitting a minus INVERTS. There are genuine negatives here — `−20°C`, `−4 °C`, `-17.2°C`, and the
        // maths article's `(-1)` — and the corpus's one candidate reading is a self-gloss that names the
        // word `mwen`: `2+ (-2) = 0 i.e de plis (mwen de) fè zewo … (-2) se mwen de ou byen zewo mwen de`.
        // `mwen` is Haitian for **"I / me"**, the commonest word in the language, and the actual comparative
        // `mwens` (×569) is never digit-adjacent. One sentence proposing a reading homographic with the 1SG
        // pronoun is not enough, so the sign stays unread AND unaccepted — a green gate here would claim a
        // known-wrong silence is correct. The same refusal is argued in src/languages/haitian/normalize.ts.
        plus: "measured: 55 leading `+` in Creole text and the largest class is the DEATH MARKER of this "
            + "wiki's anniversary lists — `(+ 1987)`, `(† 1867)`, partner of the `(° )` birth marker the "
            + "degree rule guards against. The rest are binary arithmetic tables quoted verbatim "
            + "(`0 + 0 = 0 0 + 1 = 1 1 + 0 = 1`), a percentage delta (`2 % (+38 %)`) and a UTC-style offset. "
            + "So the corpus DISQUALIFIES the reading rather than merely failing to supply it: `plis` is a "
            + "real Haitian word (×many, as the comparative `plis pase`) and reading a death marker with it "
            + "would be confidently wrong",
        equals: "measured: `=` counts 93,254 in the dump and 304 in Creole text, and NONE of the 304 is an "
            + "arithmetic equality a reader would voice. They are EasyTimeline markup that survived "
            + "extraction (`ScaleMajor = unit:year increment:500`, `PlotArea = left:50 right:20`), template "
            + "attributes (`|alt=Foto`, `langue=es`), a rhetorical pair in the creole-prestige article "
            + "(`nou ta di lang=bon, kreyòl=pa bon`), a Latin etymology gloss (`Radix = rasin`), school "
            + "algebra (`R = 4S`, `R = 4(20) = 80 goud`) and the binary table above. No Haitian word for the "
            + "relation is attested digit-adjacent anywhere",
        times: "measured: 185 `×` in the dump, 32 in Creole text, and they are DIMENSION CROSSES "
            + "(`Big book, 11 x 17`) and SCIENTIFIC NOTATION (`6.02 X 10²³ patikil`) — 'by' and a mantissa "
            + "power, neither of which is multiplication. `miltipliye` is attested as the VERB in prose "
            + "(`li miltipliye pa (1/2)`) and never as an infix between two operands",
        divide: "measured: `÷` is ×0 in the whole dump. The corpus writes division in words when it means "
            + "it — `Si senk divize pa de, li ap bay 2,50` — which is a verb phrase, not an operator",
        "plus-minus": "measured: 14 `±` in the dump and 3 in Creole text, all measurement tolerances in "
            + "physics prose. Its reading would compose the plus and the minus words, and neither is "
            + "available: see the plus entry above and the minus refusal in the header",
        "less-than": "measured: 156 `<`/`>` in the dump and 88 in Creole text, and the readable ones are "
            + "inside ENGLISH paper titles quoted in reference lists (`Improved Staging Criteria for Thin "
            + "(< 1.00mm) Invasive Cutaneous Melanoma`); the rest are stripped-markup residue (`anba Lisans "
            + "> .`). No Haitian comparative-magnitude phrase is attested in the slot",
        "greater-than": "measured: the same 88, same two families — an English abstract's `>` and markup "
            + "residue. Zero digit-flanked instances in Creole prose",
        // ⚠ NO `degrees` KEY: the degree sign IS read. `°C` → `degre Sèlsiyis` (the corpus glosses its own
        // symbol: `yon tanperati mwayèn 25 °C (25 degre Sèlsiyis)`) and a digit-preceded bare `°` → `degre`
        // (`kiltive ant 60 degre latitid nò`). What is NOT read is the numero sign — which is read as
        // `nimewo` instead — and the birth marker `(° )`, which has no digit before it.
    },
    rw: {
        // ⚠ EVERY REFUSAL BELOW IS MEASURED OVER `tools/corpus/mined/rw.jsonc` AND ARGUED IN
        // `src/languages/kinyarwanda/normalize.ts`'s header. rw has no FLEURS corpus and espeak ships no
        // Kinyarwanda at all, so the artifact, the referee word list and `attest.ts` against rw.wikipedia are
        // the whole haystack — which is why each entry names WHICH of those was asked.
        // ⚠ AND `minus` IS DELIBERATELY ABSENT FROM THIS TABLE, so `review.ts --lang rw` stays RED on it. The
        // corpus contains a genuine negative that is NOT a temperature — the latitude `−2.010556` in the
        // Kabarondo article — omitting a minus INVERTS the value, and no general Kinyarwanda sign word is
        // attested. The `ln` precedent exactly: a known-wrong reading does not get to be a green gate. What
        // rw DOES read is the negative TEMPERATURE (`−27.2 °C` → `dogere selisiyusi 27 2 munsi ya zeru`),
        // which is the one slot with an attested phrase; the class stays failing for the rest.
        plus: "measured over the artifact: all 7 `+` are CHEMICAL FORMULATIONS (`Cypermethrin 4%+profenofos "
            + "40%`, `Acetamiprid 20g/l + Lambda-Cyhalothrin 16g/l`), COLOUR MIXING in a children's teaching "
            + "text (`umutuku + umuhondo = ikijuju`, ×3), an English sentence (`jobs for 11+ people`) and an "
            + "album title (`Amatsiko Y'ibigeragezo + Abantu`). No arithmetic addition anywhere. And no word "
            + "is available: `concept.ts` returns NO rw label for addition or subtraction at all (Wikidata has "
            + "neither), which is the playbook's fleet-wide finding for the plus. Omitting a plus is lossless",
        equals: "measured: all 13 `=` are FOREIGN-LANGUAGE GLOSSES (`Yağ Camii = 'Umusigiti w'Amavuta'`, "
            + "`anesthésie = perte de la sensibilité au tact`, a Rwanda-French dictionary title), an INFOBOX "
            + "FIELD that survived stripping (`population_estimate = 2,944,459`), EasyTimeline chart markup "
            + "(`PlotArea = left:50 right:20`) and the colour-mixing text above. Kinyarwanda prose contains no "
            + "equation, and no equals word is attested in any source this repo has for rw",
        times: "measured: both `×` are LOST SUPERSCRIPTS, not multiplication — `gigawatt 100 (130 × 106 hp)` "
            + "and `toni 500 × 106` are `10⁶` with the power flattened by the dump pipeline, so ANY reading of "
            + "those two sentences is wrong. No rw multiplication word is attested either",
        divide: "measured: `÷` is ×0 in the artifact. The 432 `/` shapes are dd/mm/yyyy DATES "
            + "(`13/04/1994`) and decree numbers (`029/2005`), never division",
        "plus-minus": "measured: `±` is ×0 in the artifact, and the reading would compose two words neither "
            + "of which is attested",
        "less-than": "measured: `<` is ×0 in the artifact and no comparative-magnitude phrase is attested "
            + "digit-adjacent anywhere in the corpus or on rw.wikipedia",
        "greater-than": "measured: `>` is ×0 in the artifact, same evidence as `less-than`",
    },
    ug: {
        // ⚠ ESPEAK SHIPS NO UYGHUR AT ALL, so every reason below is a measurement over the mined
        // ug.wikipedia artifact (429 segments), `attest.ts` against that wiki, and the wikipron
        // `uig_arab_broad` HUMAN referee. The refusals are argued in `src/languages/uyghur/normalize.ts`.
        equals: "measured: `=` occurs 39 times and IS arithmetic, so this refusal is about the WORD. `تەڭ` "
            + "is the one candidate — ×5 whole-word in the corpus and a wikipron referee headword — and "
            + "every corpus instance is the ADJECTIVE 'equal' (`كۆلىمىگە تەڭ` 'equal to the area of', `تەڭ "
            + "ھوقۇقلۇق` 'equal rights', `تەڭ پايدا`). Not one is digit-adjacent. Trap 37 with the count on "
            + "the wrong side; `ff hakkunde` is what shipping it anyway would look like",
        plus: "measured: `+` occurs 8 times and NONE is arithmetic — `+86/27` dialling codes ×3, `451 + 389 "
            + "pp.` (a page count), `180=120t+16t2` (a formula), `24+3`, two lines of forum spam. And the "
            + "audio tier's standing finding applies: omitting a plus is lossless where omitting a minus "
            + "inverts, so this is the cheap half of the refusal",
        times: "measured: `×` occurs 3 times and none is multiplication — `68 ×105 مېتىرلىق مەيدان` is a "
            + "football pitch, i.e. a DIMENSION CROSS that reads 'by', and `1015× Hz30` is mangled "
            + "scientific notation. No single reading is right for both",
        "plus-minus": "the sign does not occur in the evidence (×0), and no Uyghur word for the tolerance "
            + "relation is attested in corpus, wiki or referee",
        "less-than": "the sign does not occur in the evidence (×0) and no comparative-magnitude phrase is "
            + "attested digit-adjacent",
        "greater-than": "the sign does not occur in the evidence (×0) and no comparative-magnitude phrase "
            + "is attested digit-adjacent",
        divide: "the sign does not occur in the evidence (×0); the corpus's only division is written with a "
            + "backslash in an IQ formula (`ئەقلى يېشى \\ ئەمەلىي يېشى`), which is not this sign",
        ampersand: "measured: all 9 `&` are markup or English — `&nbsp;` ×4 (removed as an HTML entity by "
            + "normalize.ts step 2), `&amp;quot;` ×1, two lines of forum spam, `Heath, EG & Chiara` (an "
            + "English citation) and `510 بەت & 1013 بەت`. Reading it as `ۋە` would put an Uyghur word "
            + "inside an English name",
        // ⚠ THE `minus` KEY IS HERE EVEN THOUGH THE SIGN *IS* READ, and that is this table's stated purpose
        // rather than an exception to it: the synthetic probe `-5` will always report DROPPED and will
        // always be right to. `مىنۇس` is sourced (a wikipron referee headword /m i n u s/ and ×7 tokens / 5
        // articles on ug.wikipedia, in-slot as `يىللىق خاتالىق مىنۇس 0.9 دەقىقە`) and normalize.ts step 9
        // emits it — but only with a TEMPERATURE to its right, because that is the only right context that
        // separates a negative from the other two things this corpus writes with a dash. Measured over all
        // 36 `[space or bracket] - digit` instances: 8 real negatives (every one followed by `℃`), 19 range
        // dashes, 9 stray clause-opening dashes glued to a year. A probe with no right context is
        // indistinguishable from the 28 that must stay silent.
        minus: "READ, but only with a right context the synthetic probe cannot carry — `مىنۇس` is emitted "
            + "for `- N°C` (8/8 of the corpus's real negatives) and withheld from the 19 range dashes and 9 "
            + "clause-opening dashes that share the shape. See uyghur/normalize.ts step 9 for the tabulation",
    },
    syl: {
        // ⚠ THE MINUS IS DELIBERATELY ABSENT FROM THIS BLOCK, and that is the whole shape of Sylheti's
        // sign situation. syl's corpus contains three GENUINE negatives (`ꠍꠦꠟꠍꠤꠀꠍ ꠁꠃꠘꠤꠐꠅ -২৭৩.১৫° ꠍꠦ.`,
        // `ꠚꠣꠞꠦꠘꠢꠣꠁꠐ ꠁꠃꠘꠤꠐꠅ -৪৫৯.৬৭° ꠚꠣ.` — absolute zero on both scales), no word for the sign is
        // attested anywhere (ꠝꠣꠁꠘꠣꠍ, ꠝꠣꠁꠘꠥꠍ, ꠞꠤꠘꠣꠔ꠆ꠝꠇ, ꠘꠦꠉꠦꠐꠤꠛ are all 0/0 on syl.wikipedia and
        // en.wiktionary carries no Sylheti entries at all), and omitting a minus INVERTS. So that class
        // stays RED — same stance as `ht` and `rw`. Everything below is a class where the SIGN ITSELF is
        // never used for its arithmetic meaning in this corpus, which is a different and answerable claim.
        //
        // ⚠ AND THE TAXONOMY BELOW WAS READ, NOT COUNTED. The first draft of this entry said "all citation
        // residue"; reading every instance found four kinds, only one of which is residue, and one of them
        // is a real equation. State what is there.
        equals: "37 instances, none of them a Sylheti relation. 31 are unstripped citation-template "
            + "residue (`|last1=Lawson`, `|s2cid=144496795`, `|ꠜꠧꠟꠤꠃꠝ=69`, `|doi=10.1016/…`); 3 are "
            + "ORTHOGRAPHIC composition in the script article (`ꠏꠦꠝꠘ ꠔ+ꠤ=ꠔꠤ`, \"for example ta + i = ti\"); "
            + "1 is a Latin gloss (`ꠟꠦꠐꠤꠘ: columba = ꠚꠣꠞꠧ`). The ONE real equation is a currency "
            + "conversion, `1 ꠒꠟꠣꠞ = 84 ꠐꠦꠇꠣ` — and no Sylheti equals word is attested (sources.ts reports "
            + "`chk?`, and the probe found none), so reading it would be invention",
        plus: "3 instances, all the same orthographic-composition formula as above (`ꠔ+ꠤ=ꠔꠤ`, `ꠕ+ꠥ=ꠕꠥ`, "
            + "`ꠝ+ꠦ=ꠝꠦ`) — a spelling rule, not an addition. No arithmetic `+` occurs and no word is sourced",
        times: "6 instances and NOT ONE is a multiplication. Four are an acronym written with the sign as "
            + "a separator (`ꠝꠦ×ꠅ×ꠍ`, `ꠀꠁ×ꠅ×ꠄꠍ`); one is inside a mojibake'd `ꠛꠤ×ꠄꠟ`; and the last is the "
            + "corpus GLOSSING the character in a punctuation list — `ꠅꠞ ꠝꠣꠏꠈꠣꠘꠧ ꠇꠝꠣ (꠨) ꠀꠞ ꠖꠥꠁ ꠒꠦꠘ꠆ꠒꠣꠞ "
            + "(॥) ꠎꠦꠉꠣꠔ (×)`, where ꠎꠦꠉꠣꠔ is 'junction', a NAME for the mark and not a reading of it",
        "greater-than": "3 instances, all in one sentence, and it is a LANGUAGE-DESCENT chain rather than a "
            + "comparison: `ꠡꠋꠍꠇ꠆ꠞꠤꠔ > ꠝꠣꠉꠗꠤ (ꠝꠂꠕꠤꠟꠤ) > ꠍꠤꠟꠐꠤ > ꠛꠣꠋꠟꠣ` — Sanskrit gives Magadhi gives "
            + "Sylheti gives Bangla. A 'greater than' reading would be actively wrong there",
        ampersand: "2 instances, BOTH inside a Latin-script run where a Sylheti word cannot go — a URL "
            + "query string (`lsi.php?volume=5-1&pages=463`) and an English proper name "
            + "(`Bangladesh B.M.H.M School & College`). Sylheti's `ꠀꠞ` is everywhere in this corpus and is "
            + "the right word for 'and'; the slot is the problem, not the vocabulary",
        "plus-minus": "the sign is ×0 in the corpus and no Sylheti reading is attested for either half",
        "less-than": "the sign is ×0 in the corpus (its twin `>` occurs and is a descent arrow, above)",
        divide: "the sign is ×0 in the corpus and no Sylheti division word is attested",
        currency: "the synthetic probe uses `$`, which is ×0 in this corpus. The currency Sylheti actually "
            + "writes is `৳` ×5, and that IS read — `৳৫` → `ɸas ʈexa`, from ꠐꠦꠈꠣ, defined by the article "
            + "that bears its name (`ꠐꠦꠈꠣ (ꠝꠥꠖ꠆ꠞꠣ ꠙ꠆ꠞꠔꠤꠇ ꠪ ৳ ॥ ꠛ꠆ꠎꠣꠋꠇ ꠇꠧꠒ ꠪ BDT)`). No dollar, euro, "
            + "pound or yen amount occurs, so no name for one is claimed",
    },
    rn: {
        // ⚠ EVERY REFUSAL BELOW IS MEASURED OVER `tools/corpus/mined/rn.jsonc` (4,125 paragraph segments from
        // an rn.wikipedia dump) AND ARGUED IN `src/languages/kirundi/normalize.ts`'s header. rn has no FLEURS
        // corpus and espeak ships no Kirundi at all, so the artifact, the referee word list and `attest.ts`
        // against rn.wikipedia are the whole haystack — which is why each entry names WHICH was asked.
        // ⚠ AND `minus` IS DELIBERATELY ABSENT FROM THIS TABLE, so `review.ts --lang rn` stays RED on it. rn's
        // one genuine negative is the temperature `(nko munsi ya -39°C)`, and Kirundi has no attested word for
        // the sign: the corpus, the referee list and rn.wikipedia are all silent, and Kinyarwanda's phrase
        // (`munsi ya zeru`) is a KINYARWANDA citation that this language does not get to borrow — the whole
        // premise of rn's layer. Omitting a minus INVERTS the value where omitting a plus is lossless, so the
        // class stays failing. Same stance as `ln` and `rw`, reached from rn's own evidence.
        plus: "measured over the artifact: both `+` are WIKIPEDIA PORTAL SIZE MARKERS, not arithmetic — "
            + "`+1 000 000 : English · Deutsch · Français · Español` and `+100 000 : Nederlands · Polski · "
            + "Svenska`, i.e. the interwiki lists of wikis above an article count. No addition appears in "
            + "Kirundi prose anywhere in the corpus, and no Kirundi word for the sign is attested in the "
            + "corpus, the referee list or on rn.wikipedia. Omitting a plus is lossless",
        equals: "measured: the single `=` is a LEXICAL GLOSS in a vocabulary explainer, not an equation — "
            + "`gushavura canke gutungurwa = gutangara` ('to be angry or surprised = to be astonished'), "
            + "where the sign means 'that is'. Kirundi prose in this corpus contains no equation at all, and "
            + "no equals word is attested in any source this repo has for rn",
        times: "measured: `×` is ×0 in the artifact. The corpus's multiplicative idiom is written out as a "
            + "word (`igitigiri c'abantu caraduze incuro kabiri`, 'doubled'), never as a sign, and no Kirundi "
            + "multiplication word is attested digit-adjacent anywhere",
        divide: "measured: `÷` is ×0 in the artifact. The 12 `fractions`-cell `/` shapes are dd/mm/yyyy DATES "
            + "(`01/07/1962`, `13/07/1982`, `27/01/2013`), rate denominators (`hab/km²`, `233/km²`) and five "
            + "measurement SPANS (`22/25`, `1.500 / 1.800`) that normalize.ts step 5 reads as spans — never "
            + "division",
        "plus-minus": "measured: `±` is ×0 in the artifact, and a reading would compose two words neither of "
            + "which is attested for Kirundi",
        "less-than": "measured: `<` is ×0 in the artifact and no comparative-magnitude phrase is attested "
            + "digit-adjacent in the corpus or on rn.wikipedia",
        "greater-than": "measured: `>` is ×0 in the artifact, same evidence as `less-than`",
    },
};

/**
 * SISTER STANDARDS — codes that are the same language under different standardisation, so one's artifact,
 * corpus and referee are evidence for another's.
 *
 * ⚠ ONE COPY ONLY. Two tools holding their own sister sets will answer the same question differently: a code
 * present in one and absent from the other is reported as artifact-covered by one tool and sent looking for a
 * file that does not exist by the other.
 */
export const SISTER_STANDARDS: readonly (readonly string[])[] = [
    ["hr", "sr", "bs"],      // Serbo-Croatian: three standards, one language
    ["id", "zsm", "ms"],     // Malay: Indonesian and Malaysian
    ["nb", "nn", "no"],      // Norwegian: Bokmål and Nynorsk
    ["es", "es-419"],        // Latin American Spanish shares the Spanish wiki, and so its artifact
];

/** The other codes in `code`'s sister set, or none. */
export function sistersOf(code: string): readonly string[] {
    return SISTER_STANDARDS.find((set) => set.includes(code))?.filter((c) => c !== code) ?? [];
}

/**
 * THE SIGN-CLASS PROBES — one synthetic input per droppable sign, and the pattern that removes it. A sign is
 * DROPPED when the reading of the probe equals the reading of the probe with the sign stripped out.
 *
 * ⚠ SHARED, BECAUSE A HAND-KEPT LIST IN ONE TOOL IS A LIST THAT DRIFTS. Held inside a CLI script this table
 * cannot be imported, so a fleet sweep cannot use the same probes a per-language review uses — and this very
 * list was once missing `÷ > ±`, the exponent and the currency sign, with nothing to say so.
 *
 * ⚠ IT CANNOT BE DERIVED FROM `DROPPABLE`. A defect regex is not a probe string, and one class needs several
 * probes — `math-sign` alone covers `+ ± = < > × ÷`. Callers should ASSERT the mapping between the two rather
 * than trusting it, which turns the next omission into a loud failure.
 */
export const SIGN_CASES: readonly (readonly [string, string, RegExp])[] = [
    ["minus", "-5", /[-−]/gu],
    ["plus", "+5", /\+/gu],
    ["plus-minus", "±5", /±/gu],
    ["ampersand", "A & B", /&/gu],
    ["equals", "x = y", /=/gu],
    ["less-than", "5 < 6", /</gu],
    ["greater-than", "6 > 5", />/gu],
    ["times", "6 × 6", /×/gu],
    ["divide", "6 ÷ 3", /÷/gu],
    ["exponent", "5 km²", /²/gu],
    ["currency", "$5", /\$/gu],
    ["percent", "25 %", /%/gu],
    ["degrees", "20 °C", /°/gu],
];

/**
 * DESIGNATIONS ACCEPTED AS CORRECTLY SILENT — the sweep's permanent residual, named per instance.
 *
 * ⚠ WHY A BASELINE AND NOT A GUARD: widening the `minus` regex to swallow these would blind the class to
 * every true negative of the same shape (see its note above).
 *
 * So these are accepted BY IDENTITY instead. Each entry is the literal string as it appears in the corpus,
 * and a hit is accepted only when EVERY occurrence of the symbol in that sentence falls inside one of them.
 * Two properties follow, and both are the point:
 *   · a NEW designation, or the same one in a new language, still reports — nothing is suppressed by shape
 *   · a sentence carrying a listed designation AND a real negative still reports, because the negative's
 *     match does not lie inside a named span
 *
 * ⚠ WHAT IS BEING ASSERTED is not that the drop is harmless — that the reading is already CORRECT. These are
 * product names and bill numbers whose hyphen is silent in speech, so a silent hyphen is the right output and
 * the differential test is reporting a true fact with a false label.
 *
 * ⚠ THIS LIST IS EVIDENCE, NOT A TODO. Do not "fix" an entry by making its hyphen audible.
 */
export const ACCEPTED_SILENT: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> = {
    ak: {
        // A REDUNDANT PERCENT SIGN, WHICH THIS CORPUS WRITES CONSTANTLY — and the six below are where the
        // scan's own REDUNDANT test cannot see it. Akan reads `%` as `ɔha mu nkyekyɛmu` (PREPOSED, ×1,387
        // tw + 215 fat) and akan/normalize.ts step 5 suppresses the word when the sentence has ALREADY
        // written it, which is 893 of the 5,154 percent signs across the two wikis: the writer spells the
        // figure out in words and then repeats it in digits — "ɔha mu nkyekyemu eduokron (90%)". Saying it
        // once is the correct reading (trap 12), and the correct reading is byte-identical with the sign
        // deleted, so the differential test reports a drop and is right to.
        // ⚠ WHY THESE SIX AND NOT THE OTHER FIVE. `isRedundant` looks for the symbol's own contribution
        // tokens in the reading, and it FINDS them for the five sentences that spell the word the way the
        // rule does. These six use the corpus's ⟨e⟩ variants — `nkyekyem`, `nkyekyemu` — which phonemize to
        // ŋt͡ɕɪt͡ɕem(u) rather than ŋt͡ɕɪt͡ɕɛmu, so the token test misses a word that is plainly there. That is a
        // limitation of the probe, not a defect in the reading.
        // ⚠ Listed with the WORD in the span rather than as a bare `90%`, so a genuinely dropped `2%`
        // somewhere else in this language still reports. A bare figure would launder it.
        percent: ["ɔha mu nkyekyemu mmienu (2%", "ɔha mu nkyekyemu eduonu (50%", "ɔha mu nkyekyemu eduokron (90%",
            "ɔha mu nkyekyem eduasa-mmienu (32%", "ɔha mu nkyekyem eduosia-nsia(66%", "ɔha mu nkyekyemu eduonum-nson(57%"],
    },
    ceb: {
        // THE YEN, and it is the ONE currency in this corpus with no Cebuano name. The dollar (`dolyar` ×4),
        // the euro (×1) and the pound (`pound` ×3, in `Falkland pound (FKP)`) are all declared and read; `yen`
        // scores ZERO, so the three ¥ amounts in this one sentence about Japanese event tickets stay unread.
        // ⚠ Listed BY INSTANCE rather than silencing the class, so the moment a ¥ appears beside a Cebuano
        // yen-word — or any other currency regresses — the scan reports it again.
        currency: ["¥2,500", "¥130,000", "¥7,000"],
    },
    mg: {
        // ⚠ PER MILLE, NOT PER CENT. `‰` is in the percent DROPPABLE class, and these two are infant- and
        // general-mortality rates (`42,50 ‰`, `64 ‰`) in one paragraph. Malagasy reads `%` as `isan-jato`
        // ("per hundred") and the parallel `isan-arivo` is attested in NEITHER haystack, so the thousand
        // sign stays unread rather than guessed — the per-hundred word would be actively wrong.
        // ⚠ The spans carry `&nbsp;` because the corpus does: `42,50&nbsp;‰`. A span written with an
        // ordinary space matches nothing, which is silent — the entry simply fails to accept.
        percent: ["42,50&nbsp;‰", "64&nbsp;‰"],
        // FOUR SHAPES THE UNIT PATH CANNOT REACH, none of them a missing word. Three are a square or cube
        // inside a RATE (`30 mp/km²`, `8,5 mp/ km²`, `3 mp/ km²` — population per km²; `1,429 kg/m³`),
        // where the numerator is an undeclared noun and no Malagasy "per" is attested in the slot; and two
        // are FORMULAE, where the base is a variable rather than a unit — `C 12 H 22 O¹¹` (sucrose) and
        // `χ²` (the chi-squared test). `bareExponent` is undeclared for this language for that reason.
        // ⚠ The ordinary unit exponents ARE read (`km²` → kilaometatra toradroa, `km³` → …toratelo), which
        // is what keeps this list honest.
        exponent: ["mp/km²", "mp/ km²", "kg/m³", "O¹¹", "χ²"],
        // TWO CURRENCIES THE TIER CORRECTLY DECLINES. `R$ 9.195.871,95` is the Brazilian real, which has no
        // Malagasy name in either haystack; `$30 tapitrisa dolara` writes the sign AND the word, so the
        // reading already says *dolara* and dropping the sign is trap 12's permissible drop — the same
        // sentence is reported as REDUNDANT for its other instance.
        currency: ["R$ 9.195.871,95", "$30 tapitrisa dolara"],
        // THE FRENCH NUMERO SIGN, not a degree — `"Loi-n°-2023-007-Code-minier"`, a statute cited in a
        // reference. The degree rule requires a DIGIT before the sign precisely so that `n°` cannot match.
        // TWO SIGNS THAT ARE NOT DEGREES. `"Loi-n°-2023-007-Code-minier"` is the French NUMERO sign in a
        // statute citation — the degree rule requires a DIGIT before the sign precisely so `n°` cannot
        // match. `taonjato faha 17°` is "the 17TH century": ⟨faha-⟩ is the Malagasy ordinal prefix and the
        // writer has used `°` as a raised ordinal marker. ⚠ It is U+00B0, the real degree sign — U+00BA,
        // the masculine ordinal indicator, is ×0 here — so no character test separates them and the
        // preceding `faha` is the guard.
        degree: ["Loi-n°-2023-007", "faha 17°"],
        // ⚠ THE MINUS INSTANCES, LISTED BESIDE THE CLASS REFUSAL rather than instead of it — because
        // `acceptedSignClass` cannot accept this class at all. Its test asks whether the DROPPABLE regex
        // matches a single character, and the minus regex is CONTEXTUAL (`[-−–](?=\p{Nd})` with two
        // lookbehinds), so it can never match one. `tl` carries the same pair for the same reason, and for
        // the same BCE-year shape.
        //
        // Three families, none of them arithmetic:
        //   · BCE YEARS from the ancient-biography stub — `-596 ary maty`, `-546`, `-258`, `-209`,
        //     `-3 000 taona`. "Born 1 January -596" means 596 BC.
        //   · NEGATIVE COORDINATES from the commune stubs — `-97.0602777778`, `-83.6138888889`, `-0.6408°`.
        //   · EasyTimeline CHART MARKUP that survived into the artifact — `from:-5000 till:-3000`,
        //     `-30 align:center`, `-3200 align:right`. Axis origins and label offsets, i.e. code.
        minus: ["-209", "-258", "-546", "-596", "-3 000", "-3 800",
            "-0.6408", "-1.1956", "-119.3425", "-122.09", "-76.71", "-78.70", "-83.61", "-86.17",
            "-97.06", "-97.785", "-99.47",
            "-2000", "-30 ", "-3000", "-3200", "-5000", "-2023"],
    },
    lo: {
        // THREE SUPERSCRIPTS WITH NOTHING THE TIER CAN ATTACH THEM TO. `i ² = −1` and `10¹⁰⁰` (a googol,
        // in the article that names it) are BARE exponents — the base is a variable or a mantissa — and
        // `bareExponent` is undeclared for this language because no Lao power phrase is attested.
        // `10.000ກມ²` is the UNIT exponent written with the LAO abbreviation ⟨ກມ⟩ rather than `km`, and
        // ⚠ that abbreviation is deliberately NOT a declared key: Lao is unspaced, and a digit-adjacent
        // Lao ⟨ມ⟩ is ×35 in the mined segments with **every single one a MONTH NAME** (`19 ມີນາ`,
        // `5 ມິຖຸນາ`, `1 ມັງກອນ`). A one-letter unit key in an unspaced script is trap 27 and trap 46 at
        // once, and the price of refusing it is this one instance.
        exponent: ["i ² = −1", "10¹⁰⁰", "10.000ກມ²"],
        // ⚠ A PERMISSIBLE DROP THE DIFFERENTIAL TEST CANNOT SEE — trap 12, and this layer CREATED it on
        // purpose. The sentence already writes the percent word before its figure (`ຈະໄດ້ເປີເຊັນ 10%`,
        // "the winner gets 10 percent"), so normalize.ts spends the sign rather than letting the tier add
        // `ຮ້ອຍລະ` on top and say percent twice. The reading is then byte-identical with and without the
        // `%`, which is exactly the shape the drop test cannot distinguish from a real loss — and the
        // second question it asks (is the symbol's own word in the reading?) does not help either, because
        // the word that is present is the LOAN `ເປີເຊັນ` and only the native `ຮ້ອຍລະ` is declared.
        percent: ["ເປີເຊັນ 10%"],
    },
    kmr: {
        // ⚠ kmr DOES read the minus — inside its DEGREE rule, which is where the sign is unambiguous.
        // Measured over the mined segments, a dash before a digit not itself preceded by a digit occurs ~22
        // times and **all ten genuine negatives are temperatures** (`-24,2 °C`, `-52,6℃`, `-24 û -30
        // pileyan`). These are the residue, and not one of them is a number's sign: a book TITLE
        // (`Komkujiya Ermenîyan -1915`), a COORDINATE span whose first operand the degree rule has already
        // spent (`42°-20´`), and EasyTimeline chart MARKUP — `start:-1500`/`start:-1250` are axis origins
        // and `shift:(-10,5)`/`shift:(-5,5)` are label offsets in pixels, i.e. code rather than prose.
        minus: ["Ermenîyan -1915", "42°-20´", "start:-1500", "start:-1250", "shift:(-10,5)", "shift:(-5,5)"],
        // THE TWO CURRENCIES WITH NO KURMANJI NAME, plus one sign the tier cannot reach. `¥` and `£` occur
        // in Chinese- and UK-education figures; neither has a Kurmanji word in the corpus or on
        // ku.wikipedia, and naming one would be the Fula `tere` failure. The dollar, by contrast, IS
        // declared and read (`dolar`, corpus-attested as `50 bilyon dolaran`). `1,5 mîlyar $` is the third:
        // a sign POSTPOSED after a magnitude word, where no digit is adjacent for the tier to match on —
        // and the same sentence's `Sequoia $ 50 mîlyon dolar` already says `dolar` in full.
        currency: ["20,023 ¥", "3.204 ¥", "230.000 £", "3.121 £", "mîlyar $", "Sequoia $ 50"],
        // TWO SUPERSCRIPTS WITH NOTHING TO ATTACH TO. `E=mc²` is Einstein's, where the base is a VARIABLE
        // and `bareExponent` is undeclared for this language (no Kurmanji power phrase is attested).
        // `qebareya kupê (m³)` is the corpus writing the CUBE WORD and the symbol side by side — the
        // reading already says *kupê*, so the symbol is a gloss and dropping it is trap 12's permissible
        // drop; the differential test cannot see that, because the correct reading is byte-identical.
        exponent: ["E=mc²", "kupê (m³)"],
    },
    si: {
        // RANGES AND DATE/DESIGNATION DASHES, none of them a negative — and si/normalize.ts reads the
        // negative sign as U+2212 ONLY, on the measurement that U+2212 is ×5 in this corpus and all five are
        // temperatures, while an ASCII hyphen before a digit is ×9 and none of the nine is. These are six of
        // that nine: three coordinate/temperature RANGES (the layer declines ranges outright — Sinhala
        // writes its own connective, `අතර`, and two of these carry it), an ordinal with a leading dash, and
        // two years. Listed per instance rather than widened into the guard, so a real negative written with
        // a hyphen would still report.
        minus: ["20°-30°", "29°-39°", "60°-75°", "සමරසේකර -12", "Nations -1967", "උපත -1918"],
        // TWO SUPERSCRIPTS WITH NO UNIT TO ATTACH TO. `mg• L⁻¹` is a reciprocal-litre exponent whose unit
        // (`mg`) this language deliberately does not declare — see si/normalize.ts, where all nine `mg` are
        // inside a rate with no sourced denominator — and `ටොන් 10¹⁵` is scientific notation, which no
        // language in this tree reads. `bareExponent` is undeclared for si for that reason; the UNIT
        // exponent (`km²` → වර්ග කිලෝමීටර්) is read and is what keeps this list honest.
        exponent: ["mg• L⁻¹", "10¹⁵"],
        // TWO CURRENCIES WITH NO SINHALA NAME AND ONE LETTER-PREFIXED CODE. `GH¢` (Ghanaian cedi) and `CN¥`
        // (yuan) sit in one sentence about African stock exchanges; neither `සෙඩි` nor `යුවාන්` is attested
        // in the corpus or on si.wikipedia, and naming one would be the Fula `tere` failure. `PPP$22,480`
        // is purchasing-power parity — the `$` there is part of a notation, not a price, and the tier's
        // letter-bounded key correctly refuses it. The dollar, euro, pound and rupee ARE all declared and
        // read, which is what makes these three visible rather than hidden.
        currency: ["GH¢", "CN¥180.4", "PPP$22,480"],
        // ⚠ A MANUFACTURED PERCENT SIGN — the corpus's own corruption, not a defect this layer can repair.
        // One article has lost its rakaransaya conjunct `්‍ර` and a `%` has been substituted for it, so
        // `ප්‍රතිපත්ති` is written `ප%තිපත්ති`, `සංග්‍රහයක` `සංග%හයක`, and `ක්‍රි.පූ` `කs%.පූ`. Every `%` in
        // the line is inside a WORD with no digit anywhere near it. Reading them would insert *සියයට* into
        // five Sinhala nouns; the percent rule requires a digit and correctly declines. Same class as the
        // mojibake that manufactures a degree sign in `Ä°zmir` (playbook: repair before you measure).
        percent: ["කs%.පූ", "ප%තිපත්ති", "ප%රාතාසා", "ප%කාශයට", "සංග%හයක"],
    },
    so: {
        // A `+` JOINING TWO GREEK ETYMOLOGY GLOSSES, not arithmetic — `"waan gubaa" + ōps "wejiga"`, inside the
        // article on the name Αἰθιοπία. so/normalize.ts reads `+` before a digit or a bracketed one; this one
        // has quoted words on both sides, and voicing it would read a word-formation gloss as a sum.
        "math-sign": ['"waan gubaa" + ōps'],
        // TWO SUPERSCRIPTS WITH NO NUMBER TO ATTACH TO. `cm³` follows the WORD `cubo` — the article writes the
        // Somali reading and the abbreviation side by side (`11.548 Sentimitir cubo cm³`), so the cube is
        // already spoken and the symbol is a gloss. `E = mc²` is Einstein's, where the base is a VARIABLE; the
        // `=` IS read (`u dhiganta`), and `bareExponent` is not declared for this language because its
        // superscripts are overwhelmingly units (km² ×93, m³ ×37) which the unit path already handles.
        exponent: ["cubo cm³", "E = mc²"],
    },
    su: {
        // ⚠ ALGEBRAIC SUBTRACTION WITH A VARIABLE OPERAND. su/normalize.ts reads the minus before a DIGIT
        // (`-1,00`, `antara -100`, `(−3)`); these are `1 - p` and `1 − p` inside a standard-deviation
        // formula, where the operand is a letter. Reading them would mean matching a dash between two
        // variables, which is the same shape as a compound hyphen in an ordinary Sundanese word — the
        // language hyphenates reduplication constantly (`kira-kira`, `béda-béda`, `rata-rata`, ×thousands).
        // The formula is niche; the hyphen is not. Left silent deliberately.
        // Three lines, none of them arithmetic: `(H^+)` is an ION CHARGE, `L(+)-asam` is an optical-isomer
        // label, and `aX + b ~ N(aμ + b, (aσ)²)` is algebra over VARIABLES — su/normalize.ts reads `+` only
        // before a digit or a bracketed one. Widening it to letters would match a dash between two variables,
        // the same shape as the reduplication hyphen Sundanese writes constantly (`kira-kira`, `béda-béda`).
        "math-sign": ["(H^+)", "L(+)-asam", "aX + b ~ N(aμ + b, (aσ)²)", "X+b", "σ = (n p (1 - p))",
            "σ = (p(1 − p)/n)", "1.5log((r+ra)/g)+.45", "((r+ra)/g)^.287", "A/(A+B)"],
        // THE SOURCE'S OWN TYPO, twice: `$28.ooUS` and `$60.ooUS` are `.00` mistyped with letter o's, so the
        // amount is `28.oo` and no rule can make a number of it. The `$` IS read (*dua puluh dalapan dolar*);
        // what the scan sees is the trailing `US` fragment. Not repairable from this side.
        // LaTeX MATH DELIMITERS, not money — `($10^7$ nepi ka $10^{12}$)`, `($10^{13}$–$10^{14}$ taun)`.
        // su/normalize.ts step 0 strips the pair so the exponent can be read; the scan then sees a `$` whose
        // removal changes nothing, which is exactly right and exactly what it cannot tell from a real drop.
        // ⚠ `$28.ooUS` / `$60.ooUS` are the SOURCE'S OWN TYPO (`.00` mistyped with letter o's). The `$` IS
        // read there (*dua puluh dalapan dolar*); the fragment the scan sees is the trailing `US`.
        currency: ["$10^7$", "$10^{12}$", "$10^{13}$", "$10^{14}$", "$28.ooUS", "$60.ooUS"],
        // AN IUPAC CHEMICAL NAME — `2-(Buta-1,3-diynyl)-5-(but-3-en-1-ynyl)`. Every dash is a locant
        // separator, none is a minus. The Burmese precedent exactly (playbook 5d): the flag needed the
        // instances read, not a rule.
        minus: ["2-(Buta-1,3-diynyl)-5-(but-3-en-1-ynyl)", "-5-(4-c", "-ynyl)-2,2'-b"],
        // ⚠ A JAPANESE ITERATION MARK QUOTED IN A SUNDANESE ARTICLE ABOUT JAPANESE WRITING — `Misuzu (みすゞ)`.
        // The article is ABOUT the mark, so the one instance is a mention rather than a use, and Sundanese has
        // no iteration mark of its own to read it with.
        iteration: ["みすゞ"],
    },
    tl: {
        // ⟨EU$8.86 bilyon⟩ — a NONSTANDARD currency marker: the sentence is about EU aid, so reading the $
        // as ⟨dolyar⟩ would assert dollars for what the context says are EU funds, and rewriting it as euro
        // would be inventing what the writer meant. The bare-$ rule cannot reach it anyway (letter-bounded
        // key), so the silence is the correct reading of an ambiguous token, not a gap.
        currency: ["EU$8.86"],
        // The Japanese ideographic iteration mark inside JAPANESE NAMES quoted in a sentence about katakana
        // (佐々木, 奈々子). The names are Japanese, read as names; the foreign-span filter cannot always see
        // it because the surrounding gloss is Latin.
        iteration: ["々", "ゝ", "ゞ"], // 々 in quoted Japanese names; ゝ/ゞ MENTIONED as signs in the same orthography article
        // PREHISTORIC-YEAR notation — the leading dash is a BCE convention, not arithmetic (the class refusal
        // with its measurement is in ACCEPTED_SIGN_SILENCE; these instance spans exist because the scan's
        // class-acceptance test cannot match a CONTEXTUAL sign regex against single characters).
        minus: ["-73 000", "-60 000", "-70 000", "-50 000", "-52 000", "-108 000", "-39 000", "-38 000",
            "-10 000", "-4000", "-8000", "-9000", "-1 BCE",
            // EasyTimeline MARKUP that survived into the artifact ("bar:1991 at:626 fontsize:XS text: 626
            // shift:(-8,5)") — code coordinates, not prose; the km %lf shape.
            "shift:(-8,5)"],
        // BARE POWERS OF TEN in physics copy — scientific notation (`6.022 × 10²³`, `9.11 × 10⁻³¹`) and an
        // electron configuration (`5s² 4d¹⁰`), the same encyclopedia-copy register as the accepted ×
        // refusal; this layer reads UNIT exponents (km² → kuwadrado) and no language reads mantissa
        // notation. Instance-listed rather than class-silenced so a km² regression stays visible.
        exponent: ["10⁵", "10²¹", "10²²", "10²³", "10⁵⁰", "10⁻⁴", "10⁻¹⁵", "10⁻²⁷", "10⁻³¹", "5s² 4d¹⁰", "mc²"],
    },
    km: {
        // A C FORMAT SPECIFIER, not a percentage — the km wiki carries a programming tutorial whose code
        // survives into the corpus (`scanf("%lf %lf",&a, &b); /*Khmer comment*/`), and the cell selector
        // reaches for it because `%` next to letters is exactly what the percent cell looks for. The `%` in
        // `%lf` is a conversion flag, so silence is the CORRECT reading and a rule that voiced it would be a
        // defect. The line survives the native-script filter legitimately: its trailing comment really is
        // Khmer.
        percent: ["%lf"],
        // ⚠ STRIPPED-MARKUP DEBRIS, not operators — the reading is correct BECAUSE these are not signs at
        // all. A `<` immediately after the Khmer full stop ៕, a `>` standing before a Greek gloss, and a lone
        // `÷` after ។ are all what a removed tag or a mis-rendered entity leaves behind.
        // ⚠ AND THE PROPER FIX IS UPSTREAM, NOT HERE. `wikidump-to-text.py`/`filter-markup.py` own the
        // residue guards, and a bare angle bracket adjacent to sentence punctuation is exactly the shape they
        // exist to catch. Listed here so the gate reads true today, with the cleaning gap recorded rather
        // than papered over — re-mining km after extending those guards should let these entries be deleted.
        "math-sign": ["៕<", "ឈោ្មះ >", "។ ÷"],
    },
    // DESIGNATIONS — a product name or bill number whose hyphen is silent in speech. FLEURS translates ONE
    // English set, so these recur across the fleet; the languages listed here are simply the ones that write
    // a SPACE before the hyphen. Every other language writes it closed and the
    // `(?<![\p{L}\p{M}\p{Nd}])` guard already handles it.
    cjy: {
        // ⚠ A SUPERSCRIPT IN A JIN ARTICLE IS A ROMANIZATION TONE NUMBER, NOT A POWER — the incubator writes
        // Jin romanized with them: `Hai²-di²-lau¹ si³ Zung¹-gueh⁴ dieh⁴ hue²-gue¹-tsi² ing²-seh⁵ gung¹-si¹`.
        // ⚠ THIS IS THE THIRD SINITIC CORPUS TO PRODUCE THAT HAZARD FROM A DIFFERENT SOURCE: wuu from Chao
        // tone letters in its own phonology sections, nan from jyutping quoted in a Hong Kong article, and
        // now cjy from its own romanization. Worth expecting in gan/hak/hsn when they are treated.
        exponent: ["Hai²", "di²", "lau¹", "si³", "Zung¹", "gueh⁴", "dieh⁴", "hue²", "gue¹", "tsi²",
            "ing²", "seh⁵", "gung¹", "si¹"],
    },
    nan: {
        // FOREIGN ITERATION MARKS inside QUOTED JAPANESE AND THAI, which Min Nan does not use: the Japanese
        // 々 in names (`千々岩 助太郎`, `佐々木舜一`, `天々座理世`, `東方妖々夢`), the hiragana ゝ in a book
        // title (`Kokoro (こゝろ)`), and Thai's ๆ in a passage ABOUT Thai text (`และอื่นๆ`). Reading them
        // would need the quoted language's rule, not this one's.
        iteration: ["々", "ゝ", "ๆ"],
        // EASYTIMELINE TEMPLATE CODE that survived into the corpus — a chart definition, not prose:
        // `ScaleMajor = unit:year increment:20 start:01/01/1800`, `from: 25/10/1945 till: $now text:"…"`.
        // The `$` there is a template variable and the `=` a parameter assignment.
        "math-sign": ["ScaleMajor =", "ScaleMinor =", "increment:20"],
        // `km²` after a POJ magnitude word joined by a HYPHEN — `5-ek 1000-ban km²`. The shared tier's
        // magnitude hop is declared and handles the SPACED form (`1.797 ek km²` reads), but its `magAlt` is
        // whitespace and POJ also hyphenates. Widening that is a fleet change with its own measurement.
        // ⚠ A SUPERSCRIPT IN A nan ARTICLE IS OFTEN A ROMANIZATION TONE NUMBER, NOT A POWER — the same
        // hazard the Wu layer records, here with JYUTPING quoted in a Hong Kong article:
        // `hoeng¹ gong² dak⁶ bit⁶ hang⁴ zing³ keoi¹`. Plus scientific notation (`1.6749 × 10⁻²⁷ kg`) and a
        // physics unit (`39.573 MeV/c²`), neither of which this layer reads for any language.
        exponent: ["1000-ban km²", "5-ek", "chhù-goân-", "hoeng¹", "gong²", "dak⁶", "bit⁶", "hang⁴",
            "zing³", "keoi¹", "10⁻²⁷", "MeV/c²"],
        // The genuine negatives and the POJ compounds, listed by span because `acceptedSignClass` tests a
        // sign regex against a SINGLE CHARACTER and the minus pattern is contextual — the same limitation
        // tl and wuu record. `-2°C` and `(−10 m/s)` are real negatives with no Min Nan word to read them;
        // the rest are POJ's word-internal hyphen and the ISO/ISBN designation blocks.
        minus: ["-2°C", "−10 m/s", "Ko·-1-kái", "--1-piàn", "ko͘-1-ê", "bó͘-1-ê", ", -1633", ", -1636",
            "8859-1", "8859-2", "8859-3", "8859-4", "8859-5", "8859-6", "8859-7", "8859-8", "8859-9",
            "8859-10", "8859-11", "8859-13", "8859-14", "8859-15", "8859-16", "957-2053-07-8", "313-332",
            "2^7-1", "1700-1400", "36-45", "1837-1898", "85%–90%",
            // POJ's `ko·-1-` compounds (the middle-dot spelling of ko͘), and EasyTimeline chart offsets.
            "ko·-1-", "shift:(-40,0)"],
        // ¢ and ¥/€/£ — no Min Nan currency NAME occurs in the corpus (⟨箍⟩ is the unit word), so they are
        // left unread rather than guessed. `$` IS read.
        // ⚠ THE POUND DENOMINATIONS ARE LISTED INDIVIDUALLY because `isAcceptedSilent` is all-or-nothing per
        // LINE, and one sentence lists six of them (`£1 kap £2 … £5, £10, £20, kap £50`). No Min Nan name
        // for the pound occurs in the corpus — ⟨箍⟩ is the unit word, not a currency — so they are left
        // unread rather than guessed, as ¥/€/¢/₫ are.
        currency: ["$now", "3¢", "¥147,778", "£1", "£2", "£5", "£10", "£20", "£50", "M$2", "€;", "€9500", "₫44"],
    },
    jv: {
        // BARE POWERS OF TEN in astronomy infoboxes — SCIENTIFIC NOTATION (`108,2 × 10⁶ km`,
        // `2,875 × 10⁹ km`, the planetary orbital radii), which this layer reads for NO language: it reads
        // UNIT exponents (km² → kilomèter persegi) and mantissa notation is a different thing. Listed by
        // instance rather than silencing the class, so a km²/cm³ regression stays visible — both ARE read.
        // …and `mil³`, cubic MILES in a parenthetical unit gloss (`1,4 triliun kilomèter kubik (330 juta
        // mil³)`). The metric units are declared and read; the imperial one is not, and one instance inside
        // a conversion aside does not justify adding a short, collision-prone `mil` key.
        // `--- jiwa/km²` is INFOBOX DEBRIS — a template whose value never filled in ("Kapadhetan: +/- ---
        // jiwa/km²"), so the density rule finds no number to key on. `m³/s` is a tier limitation rather than
        // a data gap: its unit pattern offers a numerator EXPONENT and a rate DENOMINATOR as alternatives,
        // not together, so `1 m³/s` composes the m³ and leaves the `/s`. One instance, in a unit-conversion
        // aside; widening the shared tier for it would want its own fleet measurement.
        exponent: ["10⁶", "10⁹", "sa-km²", "mil³", "ft³", "--- jiwa/km²", "m³/s"],
        // PARENTHETICAL EXTREMES in a botanical description, not negatives: `Godhong awangun jorong nganti
        // lansét, 10-15(-17) cm × 3-4,5(-12,5) cm` — the flora convention for "usually 10–15, rarely to 17".
        // A minus rule would read a leaf measurement as arithmetic.
        // …plus the corpus's ONE TRUE NEGATIVE, which is inside an ENGLISH bibliographic citation: "a
        // thermodynamic singularity at –45 °C, The Journal of Chemical Physics". No Javanese negative-number
        // word is attested anywhere in the corpus or on jv.wikipedia, and the sign here sits in foreign
        // text; inventing one to read a reference title would be the wrong trade.
        minus: ["(-17)", "(-12,5)", "(-1", "–45"],
        // A MIXED FRACTION before the degree sign — `2 garis balik (23 1/2°LU-23 1/2° LS)`, the tropics at
        // 23½°. Step 4 turns the `1/2` into ⟨setengah⟩, which leaves a WORD rather than a digit before the
        // sign, and the degree rule requires a digit. One instance, and the alternative — letting the degree
        // rule fire on a word — would misread every other shape.
        degree: ["setengah°", "1/2°"],
        // The ⟨×⟩ of a BOTANICAL DIMENSION whose left operand is a unit word, not a digit — `10-15(-17) cm
        // × 3-4,5(-12,5) cm`. The tier's multiply composes number×number, and the sign IS read in that
        // shape; this one instance sits after `cm`. Listed rather than widening the tier, since a
        // `word × number` rule has exactly one attested instance to justify it (trap 9).
        "math-sign": ["cm × 3"],
    },
    gan: {
        // ⚠ gan IS THE SIXTH SINITIC CORPUS TO PRODUCE THE ROMANIZATION-TONE HAZARD, and this file's own
        // cjy note predicted it here by name ("worth expecting in gan/hak/hsn"). gan.wikipedia opens its
        // articles with a NANCHANG PRONUNCIATION GLOSS — `亞細亞洲（南昌話：/ŋa²¹³ ɕi³⁵ ŋa²¹³ t͡siiu⁴²/）`,
        // `地球（南昌話：/tʰi¹¹ tɕʰiu²⁴/）`, `江澤民（南昌話：[kɔŋ⁴⁴ tsʰik⁵ min³⁵]）` — so a superscript in
        // this corpus is usually a TONE NUMBER on the very variety the engine speaks. Reading it as a power
        // would turn the dict's own source notation into arithmetic. That is why `bareExponent` is
        // undeclared; a squared UNIT is still read (`750萬 km²` → 750萬 平方公里, step 4), which is what
        // keeps this list honest.
        // The genuine exponents here are all things no layer reads: mantissa notation (`1.6 × 10⁻¹⁹`,
        // `1.6726231 × 10⁻²⁷ kg`), a physics unit on a rate denominator (`938 百萬電子伏特 /c²（MeV/c²）`)
        // and a cube on an undeclared one-character unit (`2.32g/cm³` — ⟨立方⟩ is undeclared because it is
        // ×0 in this corpus against ⟨平方⟩'s ×29, the same evidence hak used).
        exponent: ["10⁻¹⁹", "/c²", "MeV/c²", "10⁻²⁷", "cm³", "10¹⁹",
            "ŋa²¹³", "ɕi³⁵", "t͡siiu⁴²", "tʰi¹¹", "tɕʰiu²⁴", "tsʰɔŋ⁴²", "tɕin⁴⁵", "tɕiu²¹³",
            "u²¹³", "tɕʰi²¹³", "ȵi²¹", "nyy³", "kah⁶", "kɔŋ⁴⁴", "tsʰik⁵", "min³⁵"],
        // THE DEGREE, EVERY INSTANCE — coordinates, compass bearings, and an article ABOUT the sign. The
        // class-level refusal with its dict measurement is in ACCEPTED_SIGN_SILENCE; these spans exist
        // because the two tables answer different questions, and listing the instances means a real
        // temperature regression would still report. (The corpus's one real temperature, `熔點380℃`, is in
        // that same class refusal: ⟨度⟩ is SILENT, so no rule can read it.)
        degree: ["113°", "114°", "27°", "28°", "116°", "117°", "29°", "47.8°", "28.3°",
            "090°", "N90°", "S90°", "180°", "S0°", "270°", "000°", "N0°", "「°」", "（1°）"],
        // ⚠ NOT NEGATIVES — the minus rule (step 6) READS the corpus's real ones (`負4點六`, `負1、負2、負3`,
        // and the word ⟨負⟩ is attested in sense in gan's own integer article). What is left is four
        // COORDINATE SPANS, where the dash is a range between two bearings whose primes have no reading
        // either, and one PERCENT RANGE: `3%-4%` reads as `百分之 3-百分之 4`, because step 4 claims each `%`
        // and step 7 can then no longer see two digits across the dash. All five are correctly silent; the
        // percent range is counted and declined in gan/normalize.ts.
        // Listed by span because `acceptedSignClass` tests a sign regex against a SINGLE character and the
        // minus pattern is CONTEXTUAL — the same limitation nan, hak, tl and wuu record.
        minus: ["113°54′-114°", "27°33′-28°", "116°57′--117°", "28°44′--29°", "3%-4%"],
        // NOT ARITHMETIC, ANY OF IT. The class refusal and its evidence are in ACCEPTED_SIGN_SILENCE; these
        // spans exist for the same reason the minus ones do. The set is: the Gan verb-complement GRAMMAR
        // SCHEMA (`“動詞+得+補語+賓語”`), `C++`, set-theory definitions of the naturals, balanced chemical
        // equations, LaTeX bodies, a Cyrillic-name schema, an asteroid designation, a measurement tolerance
        // and EasyTimeline chart code.
        "math-sign": ["0=0/1", "3=3/1", "...=7/9", "0.1=0.10000", "0'={0}", "2'=0' ' '={0,1,2}={0,{0}",
            "動詞+得+補語+賓語", "動詞+不+補語+賓語", "動詞+得+賓語+補語", "動詞+賓語+不+補語",
            "C++", "1.6 × 10", "1.7×10", "1.6726231 × 10", "1.9×10",
            "2H 2 O+2e - =H 2 ↑+2OH -", "2Cl - =Cl 2 +2e -",
            "MnO 2 +4HCl=MnCl 2 +Cl 2 ↑+2H 2 O", "2KMnO 4 +16HCl=2MnCl 2 +2KCl+5Cl 2 ↑+8H 2 O",
            "{CO}_2 + {ZnO}", "{CO}_2 + {C}", "{ZnO} + {CO}", "{Zn} + {CO}_2",
            "x > 0", "sin(x) = 0", "π = 3.14159", "English = AE", "English = BE",
            "\\pi} + 1 = 0", "PlotArea = left:10", "名 + 爺名 + 姓", "沃虎+585", "Wolfe+585",
            "36.1±2.6ka", "64.2±4.9ka"],
        // ⚠ NO `currency` KEY, DELIBERATELY, AND THE ABSENCE IS THE RECORD OF A REVERSED REFUSAL. The four
        // `$` in this corpus WERE going to be listed here — one article, a film's box office, and no
        // corpus-attested word for the sign. `attest.ts` then found 美元 ×5 on gan.wikipedia in monetary
        // amounts and the wiki's own gloss of the symbol (`符號USD或者US$`), so the sign is now READ and an
        // entry here would cover nothing. Deleted rather than left as ballast, per this table's own rule.
        // A JAPANESE ITERATION MARK in a quoted list of Japanese surnames (`長谷川、佐々木、五十嵐…`), which
        // Gan does not use. Reading it would need Japanese's rule, not this one's — the nan precedent.
        iteration: ["佐々木"],
    },
    hak: {
        // ⚠ THE SAME SINITIC HAZARD wuu RECORDS: A SUPERSCRIPT IN THESE ARTICLES IS OFTEN A TONE NUMBER,
        // not a power — hak.wikipedia glosses other varieties' phonology inline (`Si-chhôn-fa piang-yîm:
        // Xu⁴nin²`). Silence is the CORRECT reading there; voicing it would read a pronunciation gloss as
        // arithmetic. The rest are real exponents this layer cannot reach, each for a stated reason:
        //   · `m/s²` and `m/s/s` — an acceleration in a quoted CHINESE rolling-stock article. The exponent
        //     sits on a RATE denominator, which the shared tier composes but cannot then square.
        //   · `万m³` (`2700万m³`, `11.85万m³`) — cubic metres, and BOTH halves are declined: ⟨立方⟩ is
        //     undeclared because `li̍p-fông` has ZERO corpus instances against `phiàng-fông`'s 1,850, and
        //     `m` is undeclared because a one-character unit in an unspaced script is inseparable from any
        //     name containing it. The two gaps are the same gap, as they were in wuu.
        //   · `ngìn/km²` (population density) — the exponent IS read; what the reading lacks is the rate,
        //     and wuu's density rule was local precisely because the per-phrase order is per-language and
        //     this corpus never writes the fact in words for it to be sourced from.
        // Instance-listed rather than class-silenced so a km² regression stays visible — km² IS read
        // (`8,494 km²` → 8494 平方公里).
        //   · `R² sa to R³` — a MATHEMATICAL space (ℝ²→ℝ³) in the calculus article. Not a unit at all, so
        //     no `exponentWords` slot can reach it; reading it as "square" would be wrong for a dimension.
        exponent: ["Xu⁴nin²", "No²san¹", "ȵi²bin¹", "Mi²san¹", "R² sa", "to R³", "m/s²", "1.3m/s²",
            "1.35m/s²", "2700万m³", "11.85万m³", "ngìn/km²", "ngìn /km²", "sṳ̀-kiên²", "x^2", "y^2", "h^2"],
        // ⚠ NOT ARITHMETIC, which is why the class refusal in ACCEPTED_SIGN_SILENCE cannot carry them (that
        // table is consulted per SIGN and the minus pattern is CONTEXTUAL, so it never matches one char):
        //   · `-2, 0, +4, +6` — CHEMICAL OXIDATION STATES in the sulfur article, a list not a subtraction.
        //   · `112°50'-114°45'` and `23°5'-25°31'` — COORDINATE RANGES, which normalize.ts step 3 reads as
        //     ranges (`112度50分至114度45分`); the leading `-` the pattern sees is that connective.
        //   · THE 3-DIGIT YEAR RANGES — `562-ngièn -560-ngièn`, `303-ngièn -349-ngièn`, `319-ngièn -351`,
        //     `384-ngièn -407-ngièn`. Step 2 folds the morpheme so both endpoints read as cardinals with 年,
        //     but `spellYears` claims FOUR digits only, so the dash between them stays unread. That is the
        //     fleet's standing refusal working as intended, not an oversight: a short `N年` is a DURATION as
        //     often as a year and nothing in the surface separates them. ⚠ THEIR 4-DIGIT COUSINS ARE READ —
        //     `1847-ngièn -1899-ngièn` → 一八四七年至一八九九年 — which is what makes this a boundary rather
        //     than a gap. `(1906 -1979)` has no year word on either side and is declined for that reason.
        // The GENUINE negatives are read, and their word is the corpus's own: `-4.5℃`, `-218 °C`, `−224℃`,
        // `-170°C`, `-5 °C` all take 零下 (`làng-hâ`, corpus-attested) — normalize.ts step 4.
        minus: ["-2, 0, +4", "+4, +6", "50'-114", "5'-25", "562-ngièn -560", "1906 -1979",
            "303-ngièn -349", "319-ngièn -351", "384-ngièn -407",
            "chṳ́ -yû", "chṳ́ -yu", "sṳ́ -yung", "Chhṳ́ -ngoi"],
    },
    hsn: {
        // THE COORDINATE DEGREE, and it is the whole of this class: the corpus's only two `°` are one
        // sentence's bounding box — `地圖座標為東經111°53'－114°5'，北緯27°51'－28°40'`. The TEMPERATURE
        // degree is not read either, but for a different and harder reason recorded in ACCEPTED_SIGN_SILENCE:
        // ⟨度⟩ is SILENT in this dict, so a `°C` rule would delete the word as well as the sign. Listed by
        // instance rather than silencing the class, so if a Xiang temperature ever appears it still reports.
        degree: ["111°", "114°", "27°", "28°"],
    },
    ps: {
        // THE BARE DEGREE SIGN, every instance a GEOGRAPHIC COORDINATE. ps/normalize.ts step 6 reads the
        // temperature one (`۲۴ °C` → `۲۴ سانتيګراد`, the word attested ×100 and ×56 directly after a
        // numeral); the degree OF ARC has no attested Pashto reading and neither do the prime/double-prime
        // marks beside it, so `۳۳°۳۹'۱۱"N` would be half-read at best. Listed by instance so a `°C`
        // regression stays visible.
        degree: ["5 °", "29 °", "22 °", "37 °", "45 °", "38 °", "48 °", "31°", "64 °", "۳۳°", "۷۳°",
            "۱۳°", "۵۹°"],
        // CURRENCIES THIS LAYER DOES NOT DECLARE, and deliberately: only the dollar is (`ډالر` ×2,520,
        // ×374 directly after a numeral). The rupee, the pound and the won have NO Pashto name anywhere in
        // 242,649 lines, and all four instances are foreign-context asides — Indian cinema ticket prices
        // (`۱۲۰ ₹`, `₹ 50`), a British statutory fine (`د £ ۵۰۰۰ جریمې`) and a Korean prize
        // (`₩۱۰۰ میلیونه`). Naming them would be invention; `؋`, the AFGHANI, occurs ONCE in the whole
        // corpus, which is why the country's own currency is not declared either.
        // ⚠ AND THE `$` SPANS ARE THE OPPOSITE CASE — PERMISSIBLE DROPS the probe cannot see (trap 12).
        // The sentence NAMES the dollar on the other side of the figure, so ps/normalize.ts step 10 drops
        // the sign on purpose: `$ 250 ډالرو`, `$۱۷۴۰۰ ډالره`, `100 $ میلیارده امریکایي ډالرو`. The word IS
        // in the reading — but in an OBLIQUE/plural form (ډالرو، ډالره) where the probe looks for the
        // citation form ډالر, so the redundancy test scores it as a drop. Emitting the word anyway would
        // say the currency twice, which is the reading this layer exists to avoid.
        currency: ["₹", "£", "₩", "$ 250", "$١٧٤٠٠", "100 $"],
        // AN EN DASH INSIDE A SCIENTIFIC-NOTATION RANGE — `نژدې 10¹¹–10¹² د وينې نوي سلولونه`, i.e.
        // 10¹¹ to 10¹². It is a span, not a negative, and the range rule (step 8) cannot claim it because
        // its operands end in SUPERSCRIPTS rather than digits. Reading it as a minus would turn a blood-cell
        // count into arithmetic. The corpus's true negatives ARE read — `منفي`, step 11.
        minus: ["10¹¹–10¹²"],
        // SCIENTIFIC NOTATION, which this layer reads for no language: `4.1×10¹⁰ m³`, `3 x 10²⁶`,
        // `2×10³⁰`, `4×10¹³`, `7.2 x 10¹³ jouls/kg`, `2.4 x 10⁷`. A mantissa power is a different thing
        // from a squared unit, and the squared unit IS read (`km²` → `کیلو متر مربع`, step 5).
        // Three that are not scientific notation and are worth naming separately:
        //   · `هر km²` — a unit with NO NUMERAL in front of it ("per every km²"). The rule keys on
        //     number+unit adjacency, which is right; a numberless unit is a tier limitation, not a gap in
        //     the data, and it is one instance.
        //   · `۱۳۷ ک.م²` — the exponent on the PASHTO abbreviation of kilometre (ک.م) rather than the Latin
        //     one. Undeclared because ک.م is two letters plus a dot and would collide with ordinary prose.
        //   · `يادېږي²` — a FOOTNOTE MARKER on a word, not a power at all.
        exponent: ["10¹⁰", "10²⁶", "10³⁰", "10¹³", "10⁷", "km²", "ک.م²", "يادېږي²", "m³"],
    },
    ln: {
        // THE BARE DEGREE SIGN, which is not the temperature one. ln/normalize.ts step 6 reads `25 °C` as
        // `Celsius 25` — the SCALE NAME, since `Celsius`/`kelvin` are attested and no Lingala word for
        // *degree* is (`degré` ×1 is French). Every instance below is the sign WITHOUT a scale letter, and
        // there are exactly three kinds, none of them a temperature:
        //   · GEOGRAPHIC COORDINATES — `4°16′S`, `15°17′E`, `04°48′S`, `11°51′E`, `77° 02’ 12’’ W`, and the
        //     decimal-degree pair a geohack template emits (`4.800°S 11.850°E`).
        //   · GEOMETRY ANGLES in the maths articles — the sum of a triangle's angles (`180°`) and the right
        //     angle (`90°`, ×3 across the perpendicularity and right-triangle definitions).
        //   · THE FRENCH NUMERO SIGN, which is a different character's job done by this one: `Mobéko
        //     n°011/2002` (a statute number) and `n° 33-34` / `n° 68-70` (journal issues, two citations in
        //     the same reference list).
        //     Reading it as a degree would be worse than silence.
        // Listed by instance rather than silencing the class so a `°C` regression stays visible — that IS read.
        degree: ["4°16", "4°22", "15°17", "77°", "04°48", "11°51", "4.800°S", "11.850°E",
            "180°", "90°", "n°011", "n° 33", "n° 68"],
        // SCIENTIFIC NOTATION and BIBLIOGRAPHIC EDITION NUMBERS — neither is a unit exponent, and unit
        // exponents are what this layer reads (`km²` → kilomɛtrɛ-kare, ln/normalize.ts step 5, sourced from
        // the corpus's own `kilomɛtrɛ-kare` ×11).
        //   · `10⁻¹⁹`, `10⁻³¹`, `10⁻²⁷` — the electron charge, the electron mass and the neutron mass, in the
        //     physics articles. A mantissa power is a different thing from a squared unit and no language in
        //     the fleet reads it.
        //   · `2007³` and `2007²` — the CONTINENTAL EDITION CONVENTION in a reference list ("3rd ed., 2007"),
        //     where the superscript numbers the edition, not a power of the year.
        //   · `m³/s` — a river's discharge. The shared unit tier offers a numerator exponent OR a rate
        //     denominator, not both, so `m³` composes and the `/s` is left; the same one-instance tier
        //     limitation jv records. Widening it wants its own fleet measurement.
        exponent: ["10⁻¹⁹", "10⁻³¹", "10⁻²⁷", "2007³", "2007²", "m³/s"],
        // THE SIGN IS NAMED IN ITS OWN SENTENCE in every case — the drop is redundant, not lossy, and the
        // contribution test cannot see it because the name the corpus writes is not the word this layer says.
        //   · `Bozitó Sterling (lingɛlɛ́sa: Pound Sterling, £) ezalí mbóngo ya Ingɛlɛ́tɛlɛ` and
        //     `Euro (€) ezalí mbɔ́ngɔ ya Erópa` — DEFINITIONAL GLOSSES, the sign parenthesised beside the
        //     currency's spelled-out name. Only `dolare` is declared (×16, sense-checked); the pound and the
        //     euro have no attested Lingala name, so naming them here would be an invention on top of a
        //     sentence that already says which currency it means.
        //   · `badollar 45$ tii na badollar 10$` — the DOLLAR, named immediately before the figure. The
        //     layer's `NAMED` lookbehind (step 9) is what suppresses this on purpose: emitting the word would
        //     read the currency twice.
        //   · `ndako na €1` sits inside a French-language passage about a French city.
        currency: ["£", "€", "45$", "10$"],
        // LUA MODULE SOURCE quoted verbatim into the wiki (`local zehner = (zahl - zahl % 10 ) / 10;`), where
        // `%` is the MODULO OPERATOR. A percent word here would read a line of code as a proportion.
        percent: ["zahl % 10"],
        // ⚠ NO `minus` KEY, DELIBERATELY. Six lines still report, and all six are GENUINE negatives: two
        // negative latitudes (`-4.2667`, `-4.800`), the electron charge (`-1,602 189`), absolute zero
        // (`-273,15 °C`), and two BCE years (`mobú -753`, `mobú -3300`). Lingala has no attested word for
        // them — the corpus's only candidate, `molongola`, is an adjective describing a charge, not what a
        // reader says before a number — so the sign is silent and the silence INVERTS the value. Accepting
        // it here would turn a known-wrong reading into a green gate; the header of ln/normalize.ts records
        // the same refusal. The two `%`-flanked hyphens that used to report alongside them were never
        // negatives at all (`20%-40%`, `7.5%-10%`) and are now read as spans, step 7.
    },
    wuu: {
        // A SUPERSCRIPT IN A WU ARTICLE IS OFTEN A CHAO TONE NUMBER, NOT A POWER — the language's own
        // phonology is written with them, and wuu.wikipedia does it constantly: `khan³⁵-ban⁵⁵-kae³¹`,
        // `[ʑin²²ø⁵⁵tɕʰy²¹]`, `di⁶ jieu⁶`. Silence is the CORRECT reading; a rule that voiced these would
        // read a pronunciation gloss as arithmetic. That is a hazard specific to the Sinitic dirs and not a
        // gap. The remaining two are real exponents this layer cannot reach: `m³` needs the metre, which is
        // deliberately undeclared (米 is one character and inseparable from 米勒 "Miller" in an unspaced
        // script), and `公分³` puts the superscript on a HAN unit, which the shared tier cannot key on.
        // Instance-listed rather than class-silenced so a km² regression stays visible — km² IS read.
        exponent: ["khan³⁵", "ban⁵⁵", "kae³¹", "ʑin²²", "ø⁵⁵", "tɕʰy²¹", "di⁶", "jieu⁶", "doŋ²²³", "473m³",
            "公分³", "khan³⁵-ban⁵⁵-kae³¹"],
        // ⚠ NEITHER OF THESE IS ARITHMETIC, which is the whole reason the class refusal in
        // ACCEPTED_SIGN_SILENCE cannot carry them: that table is consulted per SIGN and the minus pattern is
        // CONTEXTUAL, so it can never match a single character (the tl entry records the same limitation).
        //   · `m = −1 で调和平均` — Japanese-language mathematics copy quoted in a wuu article.
        //   · `kg·m·s −2` — an SI derived unit, where the sign opens a NEGATIVE EXPONENT (s⁻²) spelled with
        //     an ASCII minus. Reading it as "minus two" would turn a unit into a subtraction.
        //   · `g·mol −1` and `g·cm −3` are the same SI shape twice more (mol⁻¹, cm⁻³) — one CHEMISTRY
        //     infobox carries both, so the line is only accepted once every span in it is named.
        minus: ["= −1", "s −2", "mol −1", "cm −3"],
        // A COLUMN HEADING IN A STATISTICS TABLE (`省内生产总值/GDP％ 人均省内生产总值`), where the sign
        // follows an INITIALISM and no number is in reach. The shared tier is right to require a number; a
        // percent word here would attach to nothing.
        percent: ["GDP％"],
        // The Japanese ideographic iteration mark inside JAPANESE text quoted in a wuu article
        // (`物理学や工学で様々な応用をもつ`). ⚠ AND THE DROP TEST IS A FALSE POSITIVE HERE FOR A SECOND
        // REASON: 様 is not a dict.tsv key, so the character it would repeat is skipped either way and the
        // reading is byte-identical with the mark deleted. The mark IS read wherever the base character is
        // in the dict — 佐々木 → 佐佐木, wu/normalize.ts step 13.
        iteration: ["様々"],
    },
    bar: {
        // ⚠ THE POINT OF THIS BLOCK IS THAT `minus` IS HERE AND NOT IN ACCEPTED_SIGN_SILENCE. Bavarian DOES
        // read the sign — `-13 °C`, `−20 °C`, `−45,9 Grad Celsius` all come out with *minus*, via the
        // degree-guarded rule in bavarian/normalize.ts. What is left over is five instances that are not
        // negatives at all, and unlike ln/ht/rw there is no genuine unreadable negative hiding among them:
        //   · a BCE year RANGE with the era marker on both ends (`4400 v. Kr.-4000 v. Kr.`);
        //   · a typo'd year range where a bracket has replaced a digit (`(180]–1927)`);
        //   · EasyTimeline CHART MARKUP, twice — `shift:(-10,5)` is a label offset in pixels, not a quantity,
        //     and it reaches the corpus because the dump-to-text keeps the template body;
        //   · an ELIDED YEAR — `de Finanzkrise vu de Joa 2007 und -8`, i.e. "2007 and '08", where the hyphen
        //     stands in for the dropped century exactly as an apostrophe would.
        // Listed by instance rather than silenced by class precisely so that a real negative outside the
        // degree slot would still surface.
        minus: ["v. Kr.-4000", "(180]–1927", "shift:(-10,5)", "und -8"],
        // ⚠ NEITHER IS A DEFECT THIS LAYER CAN CLOSE, and they are different in kind.
        //   · `3,2 Eihwohna/km²` is an exponent in a RATE DENOMINATOR. bar declares no `unitPer`, because its
        //     denominator nouns are unattested and the Bavarian subset has zero `km/h` (see normalize.ts) —
        //     and the numerator here is `Eihwohna`, a head noun no unit table would ever carry anyway.
        //   · `13.000 k² Eihkaaffsflächen` is a CORPUS TYPO: `k²` for `km²`, in an article about a shopping
        //     centre. `km²` itself IS read (→ *Quadratkilometa*), so no rule should learn `k²`.
        exponent: ["Eihwohna/km²", "13.000 k²"],
        // AN x86 ASSEMBLY LISTING in the article on assembly language. `%eax` and `%ebx` are REGISTER names —
        // the `%` is AT&T syntax, not a percentage — and `$4` is an immediate operand, not four dollars.
        // Silence is the correct reading for both, and the same two lines carry the `math-sign` refusal above.
        // ⚠ No `currency` key, although those same two lines contain `$4` and `$1`: the `$` there is an
        // IMMEDIATE OPERAND and the tier reads it as a currency, so the sign contributes and never reports.
        // An entry that cannot fire is ballast that would mask the regression this table exists to show.
        percent: ["%eax", "%ebx"],
        // ⚠ No `iteration` key either, and checking that was worth the two minutes. The artifact does carry a
        // Japanese iteration mark — `Yukihiro "chachamaru" Fujimura (茶々丸)`, a musician credit — and against
        // `bavarian.ts` alone it reports a drop. Through the REGISTRY's `phonemize`, which routes the Han run
        // to the CJK fallback, `々` SURVIVES into the IPA (`ʈ͡ʂʰɑ˧˥ 々 wɑn˧˥`), so it is a leak and not a drop
        // and the entry could never fire. An entry that cannot fire is ballast that would mask a real
        // regression — the `mi` lesson at the head of accepted-silent.test.ts.
        // ⚠ Measure an acceptance against the gate's OWN path (`phonemize(t, lang)`), not the engine's.
    },
    gu: { minus: ["એચજેઆર -3"] },
    kn: { minus: ["ಎಚ್‌ಜೆಆರ್ -3"] },
    mr: { minus: ["चंद्रयान -1"] },
    ta: { minus: ["சந்திரயான் -1"] },
    hi: {
        minus: [
            "चंद्रयान -1",
            // AN ERA RANGE, not a negative: "circa 600 BCE-1200 CE". The range lookbehind spans a digit plus
            // at most two letters and a dot, and `600 ई. पू.-` is longer than that — widening it far enough
            // to reach past two abbreviations would swallow hi's ONE true negative (`ख॰इ॰), -२.८८ परिमाण`),
            // which is the same shape. So the range is named instead of pattern-matched.
            "पू.-1200",
        ],
    },
    my: {
        // AN APPOSITION dash inside a list of ethnic groups — `(Koreans -၂သန်း)`, "Koreans – 2 million".
        minus: ["Koreans -၂သန်း"],
        // A COMPOUND JOINER, and this one is a linguistic judgement rather than a shrug. `အချိန်+ရပ်ဝန်းထု`
        // is *spacetime*; the `+` marks a compound and the words are spoken adjacent, exactly as a hyphen
        // would be. ⚠ Contrast a GLOSS sign (`=`), which separates a label from its expansion and must be
        // audible — burmese/normalize.ts step 12 draws the distinction — and Italian's `volo+hotel`, a
        // coordination whose reader was recorded saying *più*. Same glyph, different function.
        "math-sign": ["အချိန်+ရပ်ဝန်းထု", "ရပ်ဝန်း+အချိန်"],
        // A BARE ITERATION MARK HAS NOTHING TO REPEAT, so silence is the only correct output. These two are
        // wikitable rows from a Burmese article about JAPANESE kana marks — `ゝ`/`ゞ` are not Burmese
        // orthography at all. Routed to Japanese the mark still reads empty, because `ja` also (correctly)
        // has no antecedent to reduplicate.
        iteration: ["ゝ (reduplicates", "ゞ (reduplicates"],
    },
    xh: {
        // A STRAY HYPHEN. `ebhudla kangange -40 mph`, where the English original reads "winds blowing at
        // 40 mph" — so reading it as *thabatha* ("minus") would be confidently wrong. xhosa/normalize.ts
        // step 14 records this and measures its guarded pattern at 0 corpus matches.
        minus: ["kangange -40"],
    },
    nya: {
        // THE EURO, and it is the ONE currency sign in this corpus with no usable Chichewa name. The dollar
        // (`madola` ×29 in 19 ny.wikipedia articles, in monetary amounts) and the pound (`mapaundi` ×3, two
        // of them Nyasaland stamp denominations) are both declared and read; `yuro` scores ONE hit in ONE
        // article — and that article is the same machine-translated Europe piece the corpus itself carries,
        // so the wiki is not an independent source for it at all. One hit in one article is a lead, not a
        // finding, and a wrong currency word is confidently wrong where a silent sign is only missing.
        // ⚠ Listed BY INSTANCE rather than silencing the class, so the moment a `$` or `£` regresses — or a
        // € appears beside an attested Chichewa euro-word — the scan reports it again. Both listed lines
        // contain € and nothing else; the mixed `€ 94 miliyoni (£ 80 miliyoni)` line does NOT report,
        // because its pound IS read and the differential therefore changes.
        currency: ["€ 100 miliyoni", "€ 12 miliyoni"],
        // EASYTIMELINE PIXEL OFFSETS — a graph directive's x/y shift, not a number in any language. Nine
        // lines of ny.wikipedia population-graph source reach the artifact because `mine.ts` selects
        // adversarially and a chart is dense in exactly the characters the `signed-number` cell hunts.
        // ⚠ LISTED BY INSTANCE EVEN THOUGH THE CLASS REFUSAL IS ALREADY ARGUED IN `ACCEPTED_SIGN_SILENCE`,
        // for the same mechanical reason tl and wuu are: the `minus` DROPPABLE pattern is CONTEXTUAL
        // (`(?<!…)[-−–](?=\p{Nd})`), and `acceptedSignClass` tests a coarse class by matching it against a
        // SINGLE CHARACTER, which a contextual regex can never satisfy. The `=` lines above need no such
        // entry because `math-sign` is the plain character class `[+±×÷=<>]`.
        minus: ["shift:(-10,5)", "shift:(-60,-5)", "shift:(-15,5)", "shift:(-14,5)"],
    },
    za: {
        // ⚠ za IS THE SIXTH CORPUS TO PRODUCE THE ROMANIZATION-TONE-NUMBER FALSE POSITIVE, from a sixth
        // source — and unlike wuu/nan/cjy/hak/hsn, Zhuang is not Sinitic at all. za.wikipedia glosses its
        // headwords with CANTONESE readings, labelled in the text itself: `Vahgvangjdungh：hung¹ hei³`
        // (空氣), `Vahgvangjdungh：dang¹ taap³` (燈塔), `Vahgvangjdungh：ngaa⁴ caat²` (牙刷). Those
        // superscripts are jyutping tones, so voicing them would read a pronunciation gloss as arithmetic.
        // ⚠ Listed BY INSTANCE, never by class, because za's genuine unit exponents ARE read — `km²` →
        // *bingzfueng goengleix* (zhuang/normalize.ts step 5) — and a regression there must stay visible.
        exponent: ["hung¹ hei³", "dang¹ taap³", "ngaa⁴ caat²"],
    },
    bm: {
        // A PER-MILLE SIGN WITH NO OPERAND — the source article's template lost its figures, so the sentence
        // reads "… ka ca ( ‰ ka kɛɲɛ ni ‰ ye diɲɛ kɔnɔ)", three bare signs and not a number between them.
        // Silence is the CORRECT output: there is no quantity to attach a reading to, and no Bambara
        // per-mille word is attested either. The spans carry their neighbouring words deliberately, so a
        // NUMBERED `‰` would still report.
        percent: ["( ‰ ka kɛɲɛ ni ‰ ye diɲɛ kɔnɔ)", "ka kɛ ‰ ye Sahara"],
        // AN ENGLISH PRESS HEADLINE quoted whole inside a citation — "RELX said to be planning £100mln
        // takeover of Times Higher Education". `£` is the only non-`$` currency sign in the entire bm wiki
        // and no Bambara name for the pound is attested anywhere; `$` IS read (`dolar`, normalize.ts step
        // 10), so this is instance-listed rather than class-silenced to keep that reading under test.
        currency: ["£100mln"],
        // ⚠ NO BAMBARA CUBE WORD EXISTS, which is a sourcing block and not a rule gap. `kube` is attested ×2
        // on bm.wikipedia and BOTH hits mean CAPITAL CITY ("Kɔnakry kɛli a faaba (kube) ye"); `kubu` is ×0.
        // The corpus's own gloss writes raw French beside the symbol (`metre cube 135 000 m³`), i.e. it has
        // no Bambara word to offer either. Instance-listed rather than class-silenced so a `km²` regression
        // stays visible — km² IS read (`kilomɛtɛrɛ kɛnɛ`, sourced from 17 corpus glosses).
        exponent: ["metre cube 135 000 m³", "152 000 m³"],
    },
    mad: {
        // ⚠ THREE DESIGNATIONS AND A SPAN, AND WHAT IS *NOT* HERE IS THE POINT. Madurese's `minus` class is
        // deliberately NOT in `ACCEPTED_SIGN_SILENCE` (see there for why), so the two GENUINE negatives in
        // this corpus — `ka'dissa' -1 mèter dpl` and the integers article's `0, 1, -1, 2, - 2, ...` — keep
        // reporting. These three do not, because none of them is a sign at all:
        //   · `ka -8` and `kapèng -20` are the SPACED spelling of the ORDINAL prefix ⟨ka-⟩ ("the 8th prime
        //     minister", "the 20th century"), which the engine already reads correctly as a word plus a
        //     cardinal — the hyphen is orthographic, and normalize.ts adds no rule for it (playbook trap 16).
        //   · `35° Lintang Dâjâ -71° Lintang Dâjâ` is a COORDINATE SPAN whose endpoints have a two-word
        //     compass phrase between them, so no digit-adjacent rule can reach it; step 3 claims the spans
        //     whose mark and digit are contiguous and correctly declines this one.
        minus: ["ka -8", "kapèng -20", "Dâjâ -71°"],
        // A ± THE SENTENCE ALREADY SPELLS OUT — `Sorbhâjâ anḍi' lowas ra-kèra ±335,28 km²`. ⟨ra-kèra⟩ is
        // "approximately", which is exactly what this corpus's ± means (all four instances are a rounded
        // area or height, and one of them GLOSSES the sign: `korang lebbi ±1.752,21 km²`). normalize.ts
        // step 5 therefore CONSUMES the redundant sign rather than doubling the connective — the playbook's
        // trap-12 permissible drop, which no differential test can distinguish from a swallowed sign.
        // ⚠ `±` IS OTHERWISE READ (`korang lebbi`), which is why this is instance-listed and `plus-minus`
        // is absent from the class table: a regression on the unglossed form must stay visible.
        "math-sign": ["ra-kèra ±335,28"],
        // THREE CURRENCY SIGNS WITH NO MADURESE NAME, in a corpus where `$`, `US$`, `AS$`, `Rp` and `€` are
        // all read. `S$8 miliar` (Singapore) and `HK$ 490,3 miliar` (Hong Kong) cannot be reached by the
        // bare `$` key at all — the tier is letter-bounded on the left, correctly — and `¥ 150.000` has no
        // yen word anywhere in the corpus or on mad.wikipedia. The su/xh/ceb residue exactly: a currency
        // borrowing the language plausibly uses and no in-repo source records. Instance-listed rather than
        // class-silenced so the five signs that ARE read stay under test.
        currency: ["S$8 miliar", "¥ 150.000", "HK$ 490,3 miliar"],
        // A BARE-BASE EXPONENT INSIDE A FORMULA — `rumus persamaan massa-energi E = mc²`, the only one in
        // the corpus. `bareExponent` is deliberately not declared for mad (see normalize.ts): this wiki's
        // superscripts are overwhelmingly UNIT exponents, which the tier reads (`km²` → *kilomèter
        // persegi*), and the only things a bare-base rule would newly claim are this formula and a mangled
        // scientific notation. Same call `so` records for `E = mc²`, and instance-listed for the same
        // reason — a `km²` regression must stay visible.
        exponent: ["E = mc²"],
    },
    ht: {
        // A `km²` WITH NO NUMERAL IN FRONT OF IT. The unit rule keys on number-unit adjacency, which is
        // right; both of these lost their figures when the source article's template was stripped, so the
        // sentence reads `te gen abitan ak yon sifas tè km² ( mil kare)` and `pou chak km² ( pou chak mil
        // kare)` — a bare unit with nothing to measure. The ordinary exponents ARE read (`131 669 km²` →
        // *kilomèt kare*, normalize.ts step 5, sourced from `kilomèt kare` ×24 in the corpus's own prose),
        // which is what keeps this pair honest as a tier limitation rather than a data gap.
        exponent: ["sifas tè km²", "chak km²"],
        // THE POUND, the one currency sign here with no Haitian name. `$` IS read (`dola` ×493,
        // sense-checked, normalize.ts step 9) and `€` is dropped where the sentence already says *dola*
        // (trap 12, reported as REDUNDANT for exactly that reason). The pound has neither: no Haitian word
        // for it is attested anywhere in 800,158 paragraphs, and all three instances are one sentence about
        // the Chagos lease (`peman lwaye anyèl £165 milyon … apre sa £120 milyon pa ane`).
        // ⚠ Instance-listed rather than class-silenced, so a `$` regression reports again the moment it
        // happens — which is the whole reason the currency class is not in ACCEPTED_SIGN_SILENCE above.
        currency: ["£165 milyon", "£120 milyon"],
        // THE `=` AND `+` INSTANCES, LISTED BESIDE the class refusals above rather than instead of them,
        // because `acceptedSignClass` cannot accept `math-sign` — that class's regex matches a single
        // character and the scan reports per SENTENCE. Three families, none arithmetic a reader would voice:
        //   · EasyTimeline CHART MARKUP that survived extraction — `ScaleMajor = unit:year`, `PlotArea =
        //     left:50 right:20`, `ScaleMinor = unit:year increment:1000000`. This is code.
        //   · A BINARY ADDITION TABLE quoted whole from the computer-arithmetic article — `0 + 0 = 0 0 + 1
        //     = 1 1 + 0 = 1 1 + 1 = 0`, where the signs are a truth table's column headings.
        //   · DEFINITIONAL GLOSSES and school algebra — `(Radix = rasin)`, `lang=bon, kreyòl=pa bon`,
        //     `R = 4S`, `R = 4(20) = 80 goud`, `a n =(-1) n`, and the English melanoma title's `(< 1.00mm)`.
        "math-sign": ["ScaleMajor =", "ScaleMinor =", "PlotArea =", "Radix = rasin", "lang=bon", "kreyòl=pa",
            "R = 4S", "R = 4(20) = 80", "a n =(-1) n", "(< 1.00mm)", "anba Lisans >", "2 % (+38 %)",
            "0 + 0 = 0 0 + 1 = 1 1 + 0 = 1 1 + 1 = 0"],
    },
    rw: {
        // ⚠ THE CLASS-LEVEL REFUSALS AND THEIR MEASUREMENTS ARE IN `ACCEPTED_SIGN_SILENCE` ABOVE; these are the
        // per-INSTANCE residue the artifact scan still reports, and each is a case where silence is the
        // CORRECT reading rather than a missing rule.
        // ⚠ `minus` LISTS ONE DESIGNATION AND DELIBERATELY NOT THE OTHER LINE. `(HIV -1)` is a virus type
        // name whose hyphen is silent in speech — the `चंद्रयान -1` shape exactly. The corpus's OTHER minus is
        // a genuine negative LATITUDE (`ku bubangikane bwa −2.010556`, the Kabarondo coordinates) and is NOT
        // listed, so it keeps reporting: rw reads the negative TEMPERATURE it has a phrase for
        // (`munsi ya zeru`) and has no reading for a bare negative number, which must stay visible.
        minus: ["(HIV -1)"],
        // TWO SIGNS WITH NO KINYARWANDA MONEY BEHIND THEM, for two different reasons.
        // · `K¢` is not currency at all — it sits in a CYRILLIC TRANSLITERATION TABLE that reached the dump
        //   as `indagkk. K¢ 19: б [b], в [v], …`, i.e. dump debris where the cent sign is a lost glyph.
        // · `€` is the euro, and it is a SOURCING refusal: `iyero` scores 1 token in 1 article on
        //   rw.wikipedia, and that article is the SAME machine-translated Spain piece the corpus already
        //   carries — so the second haystack is not independent evidence. One hit in one article is a lead,
        //   not a finding. `$`/`US$` and `FRw`/`Rwf`/`RWF` ARE read (`amadolari`, `amafaranga y'u Rwanda`,
        //   both named beside their own symbols in rw.wikipedia's currency articles), so this is listed by
        //   INSTANCE rather than class-silenced to keep those two readings under test.
        currency: ["K¢ 19", "iyero (€)"],
        // A SUPERSCRIPT ZERO USED AS A SECTION MARKER, French `N°` style — `4⁰ Ihame ryo kumenyesha`, the
        // fourth principle in a numbered list of environmental principles. It is an ORDINAL indicator, not a
        // power, so reading it as one would be the defect. rw's real exponents ARE read: `km²`/`m³` compose
        // through the shared tier (`kilometero kare`, `metero kibe`, both attested collocations), which is
        // why this is one instance and not a class.
        exponent: ["4⁰"],
    },
    ug: {
        // ⚠ THE RESIDUE OF A CLASS THE LAYER DOES READ, listed by instance so the reading stays under test.
        // `مىنۇس` IS emitted for a real negative (see ACCEPTED_SIGN_SILENCE above and normalize.ts step 9);
        // these are the two mechanical families that share the shape and must stay silent — a clause-opening
        // dash glued to a year (`. -2006يىلى مۇقىم تېلپون`, the corpus's country-infobox boilerplate) and a
        // PERCENT RANGE (`ئىقتىسادى ئېشىش سۈرئىتى 5%-6%`, a growth rate). Plus one wiki signature.
        // ⚠ AND THE ONE GENUINE GAP IS DELIBERATELY NOT LISTED: `ياۋروپا ۋاقتى(-2ۋاقىت رايونى)` is a real
        // UTC offset, which the audio tier says IS voiced. One instance is not enough to widen a guard that
        // 28 counter-examples argued for (trap 9), so that line stays RED rather than accepted.
        minus: [
            "-2006يىلى", "-2005يىلى", "-1810يىلى",
            "2%-3%", "3%-4%", "5%-6%", "8%-9%",
            "--203.173.138.159",
        ],
        // FORUM SPAM, not prose. One paragraph of a bulletin-board signature block survived extraction
        // (`' i4 j9 k% K& x; y# K3 M5 @`) and carries a `%` and an `&`; another (`+ l# c9 ?& ]+ k`) and a
        // third (`9 Z$ t, _# B4 X( m3 P`) carry a `&` and a `$`. Nothing is read there because nothing is
        // said there. `%`, `&` and `$` are all read in this language's prose, which is why these are
        // instance-listed rather than class-silenced.
        percent: ["k% K&"],
        currency: ["9 Z$ t,"],
    },
    syl: {
        // TWO OF THE FOUR HYPHENS THE MINUS PROBE FINDS, and deliberately not the other two — this is the
        // instance list that keeps `review.ts --lang syl` HONESTLY red rather than quietly green.
        //  · `০°–১০০°` is a RANGE between two degree readings ("between 0° and 100° Celsius"). The range
        //    rule cannot claim it because the operands end in `°` rather than a digit, and the en-dash is
        //    correctly silent between two spoken temperatures.
        //  · `–5088` is a JSTOR citation's page span (`ꠜ꠆ꠞꠝꠘ –5088 |jstor=4414346`), not a quantity.
        // ⚠ WHAT IS NOT LISTED is the sentence carrying `-২৭৩.১৫°` and `-৪৫৯.৬৭°` — absolute zero in
        // Celsius and Fahrenheit, two real negatives whose sign this engine drops because no Sylheti word
        // for it is attested anywhere. Omitting a minus INVERTS, so that line must keep reporting. See
        // `ACCEPTED_SIGN_SILENCE` above for why the CLASS is not silenced either.
        minus: ["০°–১০০°", "–5088"],
    },
    rn: {
        // ⚠ THE CLASS-LEVEL REFUSALS AND THEIR MEASUREMENTS ARE IN `ACCEPTED_SIGN_SILENCE` ABOVE; this is the
        // per-INSTANCE residue the artifact scan still reports, and it is a case where silence is the CORRECT
        // reading rather than a missing rule.
        // ⚠ ONE OF rn's TWO MINUSES IS LISTED AND THE OTHER DELIBERATELY IS NOT. `(Kindergaten –2ème année)`
        // is a FRENCH grade range inside a parenthetical about English-language schooling — "Kindergarten to
        // 2nd year" — so the dash is a French connective in French text, not a Kirundi negative, and no
        // Kirundi reading of it could be right. The corpus's OTHER minus is a genuine negative TEMPERATURE
        // (`hakaba hakonje cane (nko munsi ya -39°C)`) and is NOT listed, so it keeps reporting: Kirundi has
        // no attested word for the sign and a dropped minus INVERTS the value, which must stay visible.
        minus: ["(Kindergaten –2ème année)"],
    },
};

/**
 * Is every occurrence of this class's symbol inside a designation accepted for this language?
 *
 * Deliberately strict: returns false when the sentence contains a match OUTSIDE a named span, and false when
 * the language names none, so the accept can only ever remove a hit it can fully account for.
 */
export function isAcceptedSilent(lang: string, cls: string, line: string, re: RegExp): boolean {
    const forms = ACCEPTED_SILENT[lang]?.[cls];
    if (forms === undefined) return false;
    const spans: [number, number][] = [];
    for (const f of forms)
        for (let i = line.indexOf(f); i !== -1; i = line.indexOf(f, i + 1)) spans.push([i, i + f.length]);
    if (spans.length === 0) return false;
    const saved = re.lastIndex;
    re.lastIndex = 0;
    let sawOne = false;
    for (let m = re.exec(line); m !== null; m = re.exec(line)) {
        sawOne = true;
        if (!spans.some(([a, b]) => m!.index >= a && m!.index < b)) { re.lastIndex = saved; return false; }
    }
    re.lastIndex = saved;
    return sawOne;
}

/**
 * ISO codes that denote each currency sign.
 *
 * ⚠ A CURRENCY IS ALSO NAMED BY ITS ISO CODE, which `contribution` cannot see: the code reads as spelled
 * letters, so the sign's own word is nowhere in the IPA and a correct drop still reports. Malay writes
 * `$45 juta AUD` — the sign and the code are the same currency stated twice, so saying it once is the right
 * reading and the deletion test cannot pass on it. Sign-keyed rather than a bare three-capitals shape,
 * because that shape is every other initialism in the corpus too.
 */
export const SIGN_CODES: Readonly<Record<string, string>> = {
    $: "USD|AUD|CAD|NZD|SGD|HKD|TWD|MXN|BRL|ARS|CLP|COP",
    "€": "EUR", "£": "GBP", "¥": "JPY|CNY|RMB", "₹": "INR", "₽": "RUB", "₩": "KRW", "₺": "TRY", "₪": "ILS",
};

/** Phonemize one probe string, or undefined if the engine throws on it. */
export type Say = (text: string) => string | undefined;

/**
 * The IPA tokens a symbol adds to a bare `5` — its own word, or [] if it says nothing at all.
 *
 * ⚠ THIS IS WHAT SEPARATES A PERMISSIBLE DROP FROM A DEFECT. A sentence like `($১৪.৭ বিলিয়ন আমেৰিকান ডলাৰ)`
 * already says "American dollar", so the correct reading is byte-identical with and without the sign and no
 * correct rule can escape the deletion test there. Ask instead whether the symbol's OWN WORD is in the
 * reading: present → the meaning IS spoken → permissible; absent → nothing says it → a real drop.
 *
 * Strictly narrower than "does the engine know this symbol anywhere": an engine that reads a bare `$5` but
 * swallows the `$` in `leUS$30` still reports. A symbol the engine never reads adds no tokens, so it can
 * never be downgraded.
 */
export function makeContribution(say: Say): (sym: string) => string[] {
    const memo = new Map<string, string[]>();
    return (sym: string): string[] => {
        const hit = memo.get(sym);
        if (hit !== undefined) return hit;
        let words: string[] = [];
        const bareRead = say("5");
        if (bareRead !== undefined) {
            const bare = new Set(bareRead.split(/\s+/u));
            for (const probe of [`5${sym}`, `${sym}5`]) {
                const read = say(probe);
                if (read === undefined) continue;
                const added = read.split(/\s+/u).filter((t) => t !== "" && !bare.has(t));
                if (added.length > 0) { words = added; break; }
            }
        }
        memo.set(sym, words);
        return words;
    };
}

/**
 * Is this drop PERMISSIBLE — i.e. does the sentence already say what the symbol means?
 *
 * Two ways it can: the symbol's own word is in the reading, or the sentence names a currency by its ISO CODE
 * and that code is itself spoken. ⚠ The code must be SPOKEN, or a dropped code would license a dropped sign.
 */
export function isRedundant(
    sentence: string,
    ipa: string,
    symbols: readonly string[],
    contribution: (sym: string) => string[],
    say: Say,
): boolean {
    if (symbols.length === 0) return false;
    return symbols.every((sym) => {
        const words = contribution(sym);
        if (words.length > 0 && words.every((w) => ipa.includes(w))) return true;
        const alt = SIGN_CODES[sym];
        if (alt === undefined) return false;
        const code = new RegExp(`(?<![\\p{L}\\p{M}])(?:${alt})(?![\\p{L}\\p{M}])`, "u").exec(sentence)?.[0];
        if (code === undefined) return false;
        const spelled = say(code)?.split(/\s+/u).filter((t) => t !== "") ?? [];
        return spelled.length > 0 && spelled.every((t) => ipa.includes(t));
    });
}

/**
 * THE PROBE STRING for the differential test: the sentence with the symbol replaced by a SPACE (see `dropsIn`
 * for why a space and not deletion).
 *
 * ⚠ EXPORTED BECAUSE THERE ARE TWO DIFFERENTIAL LOOPS, NOT ONE. `dropsIn` below tests every class against one
 * sentence, while a fleet sweep iterates PER CLASS and stops at the first hit — deliberately, since a class
 * whose instances sit late in the corpus is otherwise never tested. Those two shapes cannot share a loop, so
 * they share this instead, rather than writing the same one-character decision in two files.
 */
export const withoutSymbol = (sentence: string, re: RegExp): string => sentence.replace(re, " ");

/**
 * Are ALL occurrences of this sign inside LaTeX or template MARKUP rather than prose?
 *
 * ⚠ MARKUP IS NOT A LANGUAGE'S READING GAP. A maths article's complex-number formulas survive into an
 * artifact verbatim — `z_1z_2 = r_1r_2[cos(\alpha_1+\alpha_2)+isin(\alpha_1+\alpha_2)]\!` — and their `+` and
 * `=` get reported as defects. Nothing is read there because nothing should be: `\!` is a LaTeX thin-space
 * and `\alpha_1` a subscripted variable, and a reader voices neither.
 *
 * The test is per SIGN, not per line: a line may mix a formula with prose, and a dropped sign in the prose
 * half is still a defect. So every occurrence must be inside a markup neighbourhood for the line to be
 * excused.
 *
 * ⚠ AND THE MARKERS ARE BRACE-LESS AS OFTEN AS NOT. `\mathbb{R}` has braces and `\alpha_1`, `\!`, `\,`, `i^2`
 * do not, which is why the miner's own markup filter misses exactly these lines. Subscripts and superscripts
 * written with `_` and `^` are the giveaway that survives the dump converter.
 */
const LATEX = /\\[a-zA-Z]+|\\[!,;:]|[A-Za-z0-9)\]]_[0-9A-Za-z]|[A-Za-z0-9)\]]\^[0-9A-Za-z]/u;
export function allOccurrencesInMarkup(sentence: string, re: RegExp): boolean {
    if (!LATEX.test(sentence)) return false;
    const saved = re.lastIndex;
    re.lastIndex = 0;
    let sawOne = false;
    for (let m = re.exec(sentence); m !== null; m = re.exec(sentence)) {
        sawOne = true;
        // A window either side, because a formula's signs sit between its markers rather than beside them.
        const from = Math.max(0, m.index - 30), to = Math.min(sentence.length, m.index + m[0].length + 30);
        if (!LATEX.test(sentence.slice(from, to))) { re.lastIndex = saved; return false; }
    }
    re.lastIndex = saved;
    return sawOne;
}

/**
 * Is this symbol sitting inside a FOREIGN-LANGUAGE SPAN of a bilingual line?
 *
 * ⚠ WHY THIS IS NOT THE SAME AS THE NATIVE-SEGMENT FILTER, and why both are needed. `scripts.ts`'s
 * `isNativeSegment` discards a mined segment with no native letter at all — a wholly English article quoted
 * in a non-Latin wiki. It cannot help with a BILINGUAL segment, which is legitimately in the corpus because
 * most of it IS the language: 73 Khmer letters against 306 Latin ones, with the currency sign inside the
 * ENGLISH half. A dropped sign there is a fact about English, not about Khmer.
 *
 * The test is deliberately conservative — Latin must OUTNUMBER the native script on BOTH sides of the symbol
 * within a short window — so a native sentence that merely quotes a foreign name still counts as native. And
 * it is INERT for Latin-script languages: there `nativeRe` matches Latin, so Latin can never outnumber it.
 */
export function inForeignSpan(sentence: string, index: number, nativeRe: RegExp, window = 30): boolean {
    const side = (s: string): [number, number] => {
        let nat = 0, lat = 0;
        for (const ch of s) {
            if (nativeRe.test(ch)) nat++;
            else if (LATIN.test(ch)) lat++;
        }
        return [nat, lat];
    };
    const [ln, ll] = side(sentence.slice(Math.max(0, index - window), index));
    const [rn, rl] = side(sentence.slice(index + 1, index + 1 + window));
    return ll > ln && rl > rn && ll + rl > 0;
}
const LATIN = /\p{sc=Latn}/u;

/**
 * Do ALL occurrences of this class in the line sit in foreign-language spans? Only then is the drop not this
 * language's problem — one native-context occurrence makes it a real gap again.
 */
export function allOccurrencesForeign(sentence: string, re: RegExp, nativeRe: RegExp | undefined): boolean {
    if (nativeRe === undefined) return false;
    re.lastIndex = 0;
    const idx = [...sentence.matchAll(new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`))]
        .map((m) => m.index);
    if (idx.length === 0) return false;
    return idx.every((i) => inForeignSpan(sentence, i, nativeRe));
}

/**
 * Is a drop of this COARSE class an already-argued silence for this language?
 *
 * ⚠ WHY THE SCAN HAS TO ASK. `DROPPABLE` is coarse — `math-sign` alone covers `+ ± × ÷ = < >` — while
 * `ACCEPTED_SIGN_SILENCE` is per SIGN. A scan consulting only the per-INSTANCE table (`ACCEPTED_SILENT`)
 * makes km's `=` simultaneously a documented refusal and a hard scan failure: two tables disagreeing about
 * the same character.
 *
 * A coarse-class drop is accepted only when EVERY sign of that class present in the line belongs to an
 * accepted class. A line mixing `=` (accepted for km) with `×` (which km reads) is still a defect, because
 * the `×` may be the one being dropped.
 */
export function acceptedSignClass(lang: string, klass: string, sentence: string): boolean {
    const accepted = ACCEPTED_SIGN_SILENCE[lang];
    if (accepted === undefined) return false;
    const present = SIGN_CASES.filter(([, , re]) => { re.lastIndex = 0; return re.test(sentence); }).map(([n]) => n);
    if (present.length === 0) return false;
    // Only the signs this coarse class actually covers are relevant.
    const covered = DROPPABLE.find(([k]) => k === klass)?.[1];
    if (covered === undefined) return false;
    const relevant = present.filter((n) => {
        const re = SIGN_CASES.find(([m]) => m === n)?.[2];
        if (re === undefined) return false;
        // does this sign's own character belong to the coarse class's set?
        const ch = [...sentence].find((c) => { re.lastIndex = 0; return re.test(c); });
        if (ch === undefined) return false;
        covered.lastIndex = 0;
        return covered.test(ch);
    });
    return relevant.length > 0 && relevant.every((n) => n in accepted);
}

/**
 * Run the differential drop test for one sentence.
 *
 * ⚠ `re.lastIndex = 0` BEFORE EVERY `.test`: these regexes are `/g/` and shared across a whole corpus loop,
 * and `RegExp.prototype.test` ADVANCES lastIndex on a hit — so the next sentence resumes mid-string and the
 * one after that starts over (`re.test(s1), re.test(s2), re.test(s1)` → true, false, true on the same
 * pattern). Without the reset a scan silently skips about half its candidate sentences.
 */
export function dropsIn(
    sentence: string,
    ipa: string,
    say: Say,
    contribution: (sym: string) => string[],
): { klass: string; redundant: boolean }[] {
    const out: { klass: string; redundant: boolean }[] = [];
    for (const [klass, re] of DROPPABLE) {
        re.lastIndex = 0;
        if (!re.test(sentence)) continue;
        // ⚠ SUBSTITUTE A SPACE, DO NOT DELETE. Deleting the symbol also changes how its NEIGHBOURS tokenize,
        // and the test then attributes that change to the symbol — worst in an agglutinative language.
        // `32℃에` reads as two tokens (*sˈɐmsibi ˈe*); delete the ℃ and `32에` agglutinates into one
        // (*sˈɐmsibie*), so the readings differ, the test concludes the ℃ contributed, and the scan reports
        // NO DEFECTS while `20℃` reads as bare *isˈip̚*. Replacing the symbol with a space holds the token
        // boundary still, so what is compared is the symbol's own contribution and nothing else.
        const without = say(withoutSymbol(sentence, re));
        if (without === undefined || without !== ipa) continue;
        const symbols = [...new Set(sentence.match(re) ?? [])];
        out.push({ klass, redundant: isRedundant(sentence, ipa, symbols, contribution, say) });
    }
    return out;
}
