/**
 * Min Nan / Taiwanese Hokkien (nan) text normalization — the pre-tokenizer pass that rewrites what is not
 * yet a pronounceable word into words the POJ/Han → IPA pipeline already speaks. Pure text→text, no IPA.
 *
 * ⚠ TWO ORTHOGRAPHIES, AND THEY SPLIT THE JOB: THE EVIDENCE IS POJ, THE OUTPUT IS HAN.
 *
 * nan.wikipedia — the corpus — is written in POJ (Pe̍h-ōe-jī) romanization: the retained text holds **268
 * Han characters against 38,490 Latin**, so `latin-in-native: 413971` is not embedded foreign text, it is
 * the language. That is where every word below was SOURCED. But it is an editorial convention of that wiki,
 * not what users type: real-world Taiwanese is written in HAN, and this engine's Han front end (MOE dict)
 * is built for exactly that. So the words are sourced from POJ prose and EMITTED IN HAN.
 *
 * ⚠ THE REASON FOR THAT SPLIT CHANGED UNDER IT, AND THE CORRECTED VERSION IS THE ONE THAT MATTERS. It was
 * originally forced: the POJ spellings LEAKED ASCII, because the converter was Tâi-lô-only —
 * `1/5` came out *ɡɔ˧ hun˥ **chi˥*** and `50%` *paʔ˥˩ hun˧ **chi˥***, the 之 syllable unmapped. That defect
 * is now FIXED at its cause (`pojToTailo` in minnan.ts), so POJ and Han read the same:
 * `Liap-sī` = `攝氏`, `kàu` = `到`, `tiám` = `點`. **The leak is no longer the argument.**
 *
 * Han is still what is emitted, for reasons that survive the fix:
 *   · USERS WRITE HAN. The corpus's POJ is nan.wikipedia's editorial convention; real Taiwanese is Han, and
 *     the Han front end (MOE dict) is built for it. Emitting Han keeps the output coherent with that input.
 *   · 13 OF THE 16 WORDS THIS LAYER EMITS ARE DICT WORDS — 攝氏 公里 公尺 公斤 美金 箍 每 秒 到 佮 點 度 平方 —
 *     so each is one tone group and gets its word-internal sandhi. ⟨攝氏⟩ in particular reads *Liap-sī*, the
 *     very Celsius term this corpus defines.
 *   · A Han word inside POJ prose still reads: the tokenizer has its own Han group, so the choice costs the
 *     POJ corpus nothing.
 *
 * ⚠ AND THE RESIDUAL COST, STATED RATHER THAN GLOSSED: 百分之 and 分之 are NOT dict words, so they are read
 * character by character and get no word-internal sandhi, where the hyphenated POJ token `pah-hun-chi`
 * would. It is confined to those two words, and the digits either side are separate tokens in both spellings
 * anyway — but it is a real difference and the one place the other choice would read better.
 *
 * The POJ↔Han pairing is verified word by word (到 = kàu, 點 = tiám, 箍 = kho͘, 每 = múi, 秒 = biáu/bió,
 * 平方 = pêng-hong), and the corpus confirms the method outright: `Kong-lí ta̍k tiám-cheng (公里逐點鐘)`.
 *
 * Nothing here is modelled on cmn/yue/wuu — those are Han-corpus languages whose evidence came from Han
 * prose. This one's evidence is romanized and its output is not.
 *
 * ⚠ THE HYPHEN IS A WORD-INTERNAL SYLLABLE JOINER, WHICH GOVERNS THE WHOLE LAYER. POJ writes a polysyllable
 * with hyphens (`hái-chúi`, `pêng-hong kong-lí`, `ko͘-1-ê`), so a dash rule is far more dangerous here than
 * in any language treated so far. Counted over the retained text:
 *
 *   EN DASH  5 instances — 5/5 GENUINE RANGES (384–22 nî · 1707–78 nî · 15–16 sè-kí · 1795–1929)
 *   TILDE    4 instances — 4/4 GENUINE RANGES (25℃~30℃ · 3~4 km/biáu · 32~64 mg/kg)
 *   ASCII -  26 instances — MOSTLY NOT RANGES: the `ISO 8859-1 … 8859-16` designation block is ~18 of
 *            them, plus an ISBN (`957-2053-07-8`), arithmetic (`2^7-1=127`), citation pages (`313-332`)
 *            — and POJ's own word-internal hyphens (`ko͘-1-ê`, `bó͘-1-ê`, `--1-piàn`)
 *
 * So the en dash and the tilde are claimed and THE ASCII HYPHEN IS DECLINED. Javanese made the opposite
 * call on the same character; each corpus decided its own.
 *
 * ⚠ `\b` IS NEVER USED — POJ carries ⟨á à â ā a̍ ⁿ o͘⟩, and an ASCII-defined boundary silently fails against
 * every one of them. Every boundary here is an explicit lookaround over `[\p{L}\p{M}]`.
 *
 * Deliberately left alone, with the measurement:
 *   · THE ASCII HYPHEN, as above — the single largest refusal in this layer, and the one most specific to
 *     the orthography.
 *   · A NEGATIVE NUMBER. The corpus has genuine ones (`10°C kàu -2°C`, `2^7-1`), but no Min Nan
 *     negative-number word occurs anywhere in it, and the shape is inseparable from the word-internal
 *     hyphen above. Reading it would need a word this corpus does not supply.
 *   · THE CLOCK. `clock: 1490` corpus-wide, but the retained text's `\d+:\d+` are EasyTimeline template
 *     coordinates (`from: 25/10/1945 till: $now`, `ScaleMajor = unit:year increment:20`), not times of day.
 *
 * ⚠ TWO WORDS ARE SHIPPED ON INFERENCE, flagged at their declarations, and one is much better founded:
 *   1. `pah-hun-chi` (percent) is unattested AS A WHOLE but is COMPOSITIONAL FROM PARTS THIS CORPUS ATTESTS
 *      IN THIS CONSTRUCTION — 百分之 is `pah` + `hun chi`, and the corpus writes `1-pah-bān-hun chi it`
 *      ("one millionth"), the same construction with a magnitude prefix. Pieces, order and pattern attested.
 *   2. `tiám` (decimal) is the weak one: ×12 in the corpus and every instance is the NOUN "point" inside a
 *      compound (`te̍k-tiám`, `khí-tiám`, `koan-tiám`), never a separator. Shipped for the reason jv's
 *      `koma` and wuu's 点 were — 55 dot-decimals otherwise read their separator as a clause pause.
 *
 * ⚠ AND A NOTE ON THE EVIDENCE TOOL: `attest.ts` CANNOT DO TOKEN ATTESTATION FOR POJ. It splits prose on
 * non-letters, and a POJ word CONTAINS hyphens, so the full form never appears as a token — `Liap-sī`, which
 * this corpus uses four times to define the Celsius scale, reports `0 token / 10 substring`. Trap 19 in a
 * new guise. For this language the substring count is the evidence, and an `absent` verdict only means
 * something at 0 substring.
 *
 * ── THE RAW-LATIN PASS: 16 HITS, 7 UNITS AND 9 THINGS THAT ARE NOT MIN NAN ─────────────────────────────
 *
 * `rawLatinIn` reports an ASCII run with no vowel that the source typed and the IPA still says verbatim.
 * ⚠ IN POJ THAT CLASS IS UNUSUALLY EXPOSED, which is the hazard this file's `defects.ts` entry already
 * names from the other direction: the orthography IS ASCII, so an abbreviation and a word are written in
 * the same alphabet, and the converter gives the leaked run A TONE — `cm˥`, `mg˥`, `ssp˧˨`. It does not
 * merely survive; it is spoken as a syllable of Min Nan.
 *
 * SEVEN ARE GENUINE UNITS and are declared — `cm ×3`, `mg ×2`, `kg ×1`, `ml ×1`. See the `units` note for
 * the sourcing, which is weaker here than for `km`/`m`/`kg` and says so, and for the `kong-si` trap.
 *
 * ── AND THE NINE LEFT REPORTED, NONE OF WHICH IS MIN NAN ───────────────────────────────────────────────
 *
 *   `cn ×2`, `tw ×2`,  EASYTIMELINE TEMPLATE CODE that survived extraction — `color:cn1912tw1945`,
 *   `jptw ×1`          `color:jptw`, on the same lines this header's CLOCK note and the `equals` entry in
 *                      `defects.ts` already identify as template rather than prose (`from: 25/10/1945
 *                      till: $now`, `ScaleMajor = unit:year`). ⚠ THEY ARE NOT SILENCED, because the
 *                      shared `allOccurrencesInMarkup` recognises LaTeX and not EasyTimeline, and
 *                      widening it is not this layer's to do. Reported, and correctly: the line is not a
 *                      sentence of any language, and the run beside them (`color`) leaks too — invisibly,
 *                      since it has a vowel.
 *   `ssp ×1`           the Latin taxonomic *subspecies* in a binomial — `ha̍k-miâ: Zea mays ssp. mays`.
 *                      The sentence marks it as a scientific name with `ha̍k-miâ` ("scientific name"), so
 *                      the Latin is quoted material, not Min Nan.
 *   `kjj`, `gg`,       ⚠ ONE LINE OF VANDALISM IN THE MINED ARTIFACT, in Vietnamese — *"Dêhs từ kjj đã đc
 *   `gfgvbbvvfrhf`     mà bà gfgvbbvvfrhf kjj cyiggbd để gây khó₫44' gg 5_ Full gọn)+ km"*. A keyboard
 *                      mash. Left reported rather than quietly excluded: a corpus-quality defect that
 *                      shows up in a normalization gate is worth seeing, and a rule that made it quiet
 *                      would be a rule that could quieten real text.
 */
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { degroupThousands, readDecimals, readDegrees } from "../../core/sinitic.ts";
import { rewrite } from "../../core/provenance.ts";


/**
 * ⚠ EVERY UNIT AND EVERY WORD HERE IS FROM THE CORPUS'S OWN PROSE — sourced in POJ, written in Han (see the
 * header) — and several are glossed by the corpus outright:
 *   · `kong-lí` ×20 (kilometre) · `kong-chhioh` ×10 (metre, `chhim 8605 kong-chhioh`) · `kong-kin` (kilo)
 *   · `biáu` (second) as a RATE DENOMINATOR, which is the shape that needs it: `3~4 km/biáu`, `5~6km/biáu`
 *   · `kho͘` (the currency unit) — `Ji̍t-phiò 91 kho͘ (¥91)` and `Bí-kim 1 kho͘ (US$1)`, the corpus
 *     supplying both the sign and its reading in the same parenthesis
 *   · `kap` ×114 for the ampersand — Min Nan's own conjunction, NOT the 和 the other Sinitic layers use
 *
 * ⚠ `pêng-hong` IS `before`, NOT `compound`: the corpus writes `pêng-hong kong-lí` WITH A SPACE (×5). The
 * two are not interchangeable — `compound` would fuse it into one unreadable token.
 * ⚠ CUBED IS UNDECLARED. No cube word occurs in the corpus, and `km³`/`m³` do not either; inventing one to
 * fill the slot would be a reading with nothing behind it.
 * ⚠ `¥ € £` ARE UNDECLARED although all three occur (×2, ×2, ×6): `kho͘` is the unit word, not the currency
 * name, and no Min Nan name for yen/euro/pound appears anywhere in the corpus. An unsourced currency is left
 * unread rather than guessed.
 */
const SYMBOLS = makeSymbolNormalizer({
    ampersand: "佮",
    percent: ["百分之"],
    percentPrefix: true,
    /**
     * ⚠ `cm mg ml` ARE DECLARED ON THE DICTIONARY ALONE, AND THAT IS A WEAKER LEG THAN THE THREE ABOVE —
     * said here rather than buried, because the two kinds of evidence must not be allowed to look alike.
     *
     * `km m kg` were sourced from the corpus's OWN POJ PROSE (`kong-lí` ×21, `kong-chhioh` ×10, `kong-kin`)
     * and then written in Han. For these three the first leg is simply ABSENT: `kong-hun`, `hô-khik` and
     * `hô-seng` are ×0 in the corpus, which writes only the ABBREVIATION — `36-45.7 cm`, `120mg/100ml`,
     * `32~64 mg/kg`, ×13 digit-adjacent instances in all. What holds them up is the second leg on its own,
     * the SHIPPED MOE DICTIONARY (`dict.tsv`, Taiwan Ministry of Education): 公分 kong-hun, 毫克 hô-khik,
     * 毫升 hô-sing — the same published source that validated 百分之 in the sourcing note, giving the Han
     * spelling and its Taiwanese reading together.
     *
     * ⚠ AND THE OBVIOUS CORPUS HIT IS A TRAP 37, CHECKED AND REJECTED. `kong-si` looks like the milligram
     * (公絲) and occurs ×5 — every one of them is 公司, the COMPANY: *"khek-poâⁿ kong-si soan-thoân"*, a
     * record company. Had that been taken for an attestation the layer would have read every milligram as
     * "company". The count said yes and the examples said no.
     *
     * ⚠ THE MAGNITUDE-CONFUSABLE PAIRS ARE DISTINCT, which is `misread.ts`'s question: 公分 ≠ 公里 (cm/km)
     * and 毫克 ≠ 公斤 (mg/kg). `l` stays undeclared, so ml/l cannot collide either.
     */
    units: { km: ["公里"], m: ["公尺"], kg: ["公斤"], cm: ["公分"], mg: ["毫克"], ml: ["毫升"] },
    // ⚠ `ml` IS A RATE DENOMINATOR TOO, because the corpus's blood-sugar article writes the concentration
    // that way throughout — `120mg/100ml`, `200mg/ml`, `180mg/100ml`. Without it the tier's rate branch
    // declines the whole match and BOTH units stay raw, which is how `mg` and `ml` came to be leaking side
    // by side on one line.
    rateDenominators: { biáu: "秒", s: "秒", kg: "公斤", ml: "毫升" },
    // ⟨múi⟩ is the distributive "every/each", attested ×2 in exactly that sense: `Hoat-kok múi ji̍t ē-po͘
    // chhut-khan` (published every day) and `múi-chi̍t-hūn chiū-sī Liap-sī 1 tō͘` (each part is one degree).
    unitPer: "每",
    exponentWords: { squared: ["平方"], position: "compound" },
    // ⚠ `US$` NEEDS ITS OWN KEY — a bare `$` cannot match there, the sign being preceded by a letter and the
    // tier's word-guard correctly refusing it (Indonesian and Javanese hit the identical case). The corpus
    // supplies the reading in a gloss: `Bí-kim 1 kho͘ (US$1)` — 美金, US currency.
    currency: { "US$": ["美金"], $: ["箍"] },
    // ⚠ POJ PUTS THE MAGNITUDE WORD BETWEEN THE NUMBER AND THE UNIT — `1.797 ek km²`, `5-ek 1000-ban km²`,
    // `7676 bān 2 chheng pêng-hong kong-lí` — so without these the unit was not digit-adjacent and the whole
    // `km²` dropped. Spellings as the corpus writes them, including the unaccented `ban`/`ek` it also uses.
    magnitudes: ["ek", "bān", "ban", "chheng", "pah", "億", "萬", "千", "百"],
});

/**
 * Normalize one Min Nan string. The steps are ORDER-DEPENDENT; each states what breaks if it moves.
 */
export function normalizeMinNan(input: string): string {
    let s = input;

    // ── 0. the SECOND SPELLING OF ⟨o͘⟩ ───────────────────────────────────────────────────────────
    // POJ's ⟨o͘⟩ is U+0358 COMBINING DOT ABOVE RIGHT, but running text writes it just as often with a
    // free-standing MIDDLE DOT — this corpus has 366 of the combining mark and 146 of the dot
    // (`un-tō·`, `Kó·-lōng-sū`, `kàng-hō·-liōng`). `pojToTailo` in minnan.ts folds both spellings, and
    // ⚠ IT NEVER SAW THE SECOND ONE: U+00B7 is `Script=Common`, so the tokenizer's Latin word arm ENDS
    // at it and the dot was never part of the token. The vowel contrast /ɔ/ vs /ə/ was lost in all 146.
    // ⚠ FOLDED HERE RATHER THAN WIDENED INTO THE TOKEN CLASS, because the dot is also word-FINAL
    // (`un-tō·`) — `medialOnly` cannot reach it, and making it lead-legal would let a bare `·` open a
    // word. A pre-tokenizer rewrite is exactly what this layer is for.
    // ⚠ THE GUARD IS THE ⟨o⟩ VOWEL IN BOTH SPELLINGS, precomposed and decomposed. Counted over the
    // corpus, 145 of the 146 dots follow one (`ō· ×61, ó· ×37, ò· ×16, o· ×16, ô· ×13, O· ×2`); the one
    // that does not follows a hyphen and is not this vowel, so it is left alone rather than rewritten.
    s = rewrite(s, /([oOòóôōǒÒÓÔŌǑ]\p{M}*)[·‧]/gu, "$1͘");

    // ── 1. de-group thousands ────────────────────────────────────────────────────────────────────
    // ⚠ FIRST, and this language's number format is unambiguous, unlike Javanese's: the corpus is
    // ENGLISH-STYLE by a wide margin — comma groups ×45 (`181,040 km²`, `¥147,778`, `331,210 pêng-hong
    // kong-lí`) against 3 dot-groups, and dot decimals ×55 (`50.11%`, `1.8 kong-lí`, `31.26 m²`) against 2
    // comma-decimals. So the comma groups and the dot is the decimal, with no contest to resolve.
    // Left alone, the comma is read as a clause pause and the value is destroyed.
    s = degroupThousands(s);

    // ── 2. the two range marks that ARE ranges ───────────────────────────────────────────────────
    // ⚠ EN DASH AND TILDE ONLY — see the header for the count that draws this line, and for why the ASCII
    // hyphen is not here. ⟨kàu⟩ is the corpus's own connective (×48) and is used in exactly this slot:
    // `Chúi-un tī 10°C kàu -2°C`, `lak kàu Liap-sī 0-tō͘`, `US$3 khí kàu óa-kīn $1`.
    // BEFORE the degree and percent rules, because `25℃~30℃` and `32~64 mg/kg` put the mark between two
    // NUMBERS and those rules would otherwise consume the endpoints' adjacency first.
    // ⚠ THE LEFT ENDPOINT MAY CARRY ITS UNIT — `25℃~30℃` puts the mark after the SIGN, not after a digit,
    // so a `(\d)` pattern never reaches it and the range vanished while both halves still read. Captured and
    // RE-EMITTED (playbook trap 10) so step 3 still sees `25°C` intact and gives it its Liap-sī reading.
    s = rewrite(s, /(\d)((?:\s*°\s*C|℃|\s*°|%)?)\s*[–~〜]\s*(?=\d)/gui, "$1$2 到 ");

    // ── 2b. THE MINUS, AND THIS CORPUS GLOSSES ITS OWN SIGN ──────────────────────────────────────
    // ⚠ THE SENTENCE CARRYING THE SIGN NAMES IT. `(2000 kg) × (−10 m/s) = 20000 kg⋅m/s, hū-hō tāi-piáu
    // hong-hiòng ǹg sai` — "the MINUS SIGN (hū-hō, 負號) represents the direction toward the west". That is
    // the sign glossed in the same breath as its own operand, which is stronger evidence than any word count,
    // and nan.wikipedia's integers article writes the operand form too: `hū-chū-jiân-sò͘ (−1, −2, −3, ...)`.
    // ⟨負⟩ is emitted as HAN, the way this file emits ⟨度⟩ ⟨點⟩ ⟨攝氏⟩, and the dict reads it hū.
    //
    // ⚠ BEFORE THE DEGREE RULES, NOT AFTER — trap 39, a guard's evidence has a lifetime. Arm (a) looks ahead
    // for a `°`, and step 3 rewrites that `°` into a WORD; placed after it, `溫度 −5 °C` had nothing left to
    // look at and the sign was dropped while every other shape worked.
    //
    // ⚠ TWO ARMS, BECAUSE ONE GUARD CANNOT COVER BOTH SHAPES — the kurmanji pattern.
    //   (a) a leading minus whose number CARRIES a unit, degree or percent: `(−10 m/s)`;
    //   (b) a leading minus at a bracket, COMMA or string start: `(−1, −2, −3, ...)`, bare integers in maths
    //       prose — the comma is in the class because the list's second and third members have nothing else
    //       to their left, and claiming only the first would sign one of three.
    //
    // ⚠ U+2212 ONLY — THE ASCII HYPHEN IS NOT CLAIMED, and that is the whole argument rather than caution.
    // U+2212's sole Unicode meaning is the arithmetic operator and no keyboard types it, so its identity is
    // the evidence. The hyphen carries POJ's own compounding (`hū-hō`, `chū-jiân-sò͘`), ISBNs, page spans and
    // EasyTimeline offsets (`shift:(-10,5)`), none of which this rule should touch; leaving it refused costs
    // nothing that was ever read and removes the entire hazard class.
    //
    // ⚠ AND BOTH REFUSE A PRECEDING `digit + space`, which is the SPACE-SEPARATED NEGATIVE EXPONENT — the
    // shape a plain leading-position lookbehind cannot see, because it looks one character back and finds
    // only the space. `9.10938356(11)×10 −31 kg` is 10⁻³¹, not "ten minus thirty-one"; the base is two
    // characters away. Seven languages in this fleet's corpora write an exponent exactly that way.
    const NAN_UNIT_AHEAD = "(?=\\p{Nd}[\\d.,]*\\s*(?:°|%|\\p{sc=Latn}))";
    s = rewrite(s, new RegExp(`(?<![\\p{L}\\p{M}\\p{Nd}])(?<!\\p{Nd}\\s)\u2212${NAN_UNIT_AHEAD}`, "gu"), "負");
    s = rewrite(s, /(^|[(（,，])\s?\u2212(?=\p{Nd})/gmu, "$1負");

    // ── 3. coordinates, then the temperature, then the bare degree ───────────────────────────────
    // ⚠ COORDINATES FIRST: `tang-keng 118°04'04"`, `pak-hūi 24°26'46"`, `118°24′`, `25°10′` — the minute
    // and second marks must be consumed before the bare-degree rule takes the ° and strands them.
    // ⚠ ONLY THE DEGREE IS READ. ⟨tō͘⟩ is corpus-attested (`lâm-hūi 65-tō͘`), but no arc-minute or
    // arc-second word is — ⟨hun⟩ occurs ×4 and never in this sense, ⟨biáu⟩ only as a time unit in `km/biáu`
    // — so the marks are dropped rather than read with a guessed word, and the digits still speak.
    s = rewrite(s, /(\d+)\s*°\s*(\d+)\s*[′']\s*(\d+)\s*[″"]/gu, "$1度 $2 $3");
    s = rewrite(s, /(\d+)\s*°\s*(\d+)\s*[′']/gu, "$1度 $2");
    // ⚠ CELSIUS IS PREPOSED, and the corpus DEFINES it: `siat-tēng-chòe Liap-sī 0 tō͘ (0 °C)` and
    // `Liap-sī 100 tō͘ (100 °C)`. So the reading wraps around the numeral — the scale name before it, the
    // degree word after — which no `units` entry can express, hence the local rule. ⟨攝氏⟩ is a dict WORD
    // reading as Liap-sī. ℃ arrives already folded to `°C`.
    // ⚠ BEFORE the bare-degree rule, or that rule eats the ° and leaves a lone ⟨C⟩ read as a bare consonant,
    // which is what `10°C` did: *t͡sap̚˥ c˥*.
    // ⚠ THE GUARD IS `\p{sc=Latn}`, NOT `\p{L}`, AND THE POJ CORPUS COULD NEVER HAVE SHOWN WHY. A Han
    // character IS `\p{L}`, so in Han running text — which is what users actually write — `溫度10°C到2°C`
    // failed the guard, fell through to the bare-degree rule, and fused the degree word onto the stranded
    // ⟨C⟩ as one Latin token: *un-tō͘ tsa̍p **toc** kàu…*. In POJ prose a space or punctuation always
    // follows the scale letter, so the bug was invisible there.
    // ⚠ MIGRATED TO THE SHARED RULE, AND THAT FIXED A SECOND BUG THIS FILE WAS CARRYING. The local pattern
    // captured `(\d+)`, which on `13.3°C` matches only the `3` — so the preposed scale name landed INSIDE
    // the number and `13.3°C` read `13.` + 攝氏三度. yue had the identical defect; wuu did not, only because
    // it POSTposes Celsius. hak found it, being the first layer built ON `core/sinitic.ts`. Both guards this
    // file earned — `\p{sc=Latn}` and temperature-before-bare — are in the shared rule, which is why the
    // migration is a straight substitution. Fahrenheit stays UNDECLARED: `°F` has no corpus instance and no
    // Min Nan word was sourced for it.
    s = readDegrees(s, { celsius: (n) => `攝氏${n}度`, bare: (n) => `${n}度 ` });

    // ── 4. THE FRACTION RULE WAS REMOVED IN REVIEW, and the count is why ────────────────────────
    // A `a/b` → `b分之a` rule shipped here first, on the strength of the corpus's attested ⟨hun chi⟩
    // construction. Then the slash was counted: the retained corpus contains **exactly one** digit/digit
    // instance and it is **`Fahrenheit 9/11`**, a film title — which the rule read as "nine elevenths".
    // Zero genuine instances, one false positive.
    //
    // ⚠ AND THE CONSTRUCTION NEEDS NO RULE ANYWAY. This corpus writes its fractions in WORDS, mixed with
    // digits: `Tē-kiû ê gō͘ hun chi it` (1/5) and `sè-kài jîn-kháu ê 7 hun chi 1` (1/7). The second form is
    // already read correctly as it stands — the digits go through the number path and ⟨hun chi⟩ through the
    // POJ path — so the layer has nothing to add. Playbook trap 9: a rule with no attested instance is a
    // misfire generator, and this one demonstrated it on the only instance available.

    // ── 5. percent, currency, units, exponents and the ampersand, via the shared tier ────────────
    // AFTER de-grouping (the tier needs the number contiguous), AFTER the range rule (which has already
    // separated `25℃~30℃`), and AFTER the degree rules (so no ⟨C⟩ is still in play for its unit
    // alternation to compete with).
    s = SYMBOLS(s);

    // ── 6. decimals ──────────────────────────────────────────────────────────────────────────────
    // LAST of the number rules: the tier matches ASCII digits next to a sign, and replacing the "." with
    // ⟨tiám⟩ would break that adjacency for every decimal percentage — of which this corpus has several
    // (`50.11%`, `62.96%`, `0.03%`).
    // ⚠ THE FRACTIONAL PART IS READ DIGIT BY DIGIT, the reading every Sinitic variety gives it.
    // ⚠ `(?!\.\d)` KEEPS A DOTTED DESIGNATION OUT — `ISO 8859`-style identifiers and version triples share
    // the decimal's shape, and the same guard earned its place in the Javanese layer.
    // ⚠ SHARED — same rule, same guards: the fractional part digit by digit, and `(?!\.\d)` keeping a
    // dotted designation out (the guard the jv layer earned on `nomer 1.2.3`).
    s = readDecimals(s, "點");

    return s;
}
