import { rewrite } from "../../core/provenance.ts";
/**
 * Tibetan (bo) text normalization — the pre-tokenizer pass that rewrites everything the Tibetan g2p cannot
 * already read into Tibetan-script words the pipeline speaks. Pure text→text, no IPA. Runs inside
 * tibetan.ts's `text()`, after `foldNativeDigits` and before the tokenizer.
 *
 * Evidence: `tools/corpus/mined/bo.jsonc` (89,427 dump paragraphs, 419 retained segments) and
 * `tools/corpus/attest/bo.jsonc`. The full working is in `docs/investigations/bo_normalization_investigation.md`.
 *
 * ⚠ **TIBETAN PREPOSES THE MEASURE NOUN TO ITS FIGURE, IN EVERY SLOT**, which is the one thing this layer has
 * to get right and the reason none of it can go on the shared `core/normalizeSymbols.ts` tier — that tier can
 * only postpose (playbook trap 47, reason 2). The corpus writes, without a counter-example:
 *
 *     སྤྱི་ལེ་ ༡༣༡ ལྷག        131-odd KILOMETRES         བརྒྱ་ཆ་ 95%             95 PERCENT
 *     སྨི་ (6,638 m           6,638 METRES               ཨ་སྒོར་༣༡,༢༠༠           $31,200
 *     ཆུ་ཚོད་ ༣༠༠༠            3000 HOURS                 སེ་དྲོད༣༩               39 °C
 *     མི་ལི་མེ་ཏྲེར་ ༣༥༠ ནས་ ༤༠༠  350–400 MILLIMETRES      སྤྱི་ལེ་གྲུ་བཞི་མ་ ༤༧་༠༠༠  47,000 SQUARE KILOMETRES
 *
 * ⚠ AND BECAUSE IT PREPOSES, EVERY RULE HERE NEEDS A REDUNDANCY PASS FIRST (playbook trap 12). The corpus
 * routinely writes the word AND the symbol — `སྤྱི་ལེ 80km`, `སྨི6000m`, `བརྒྱ་ཆའི་30%`, `ཨ་སྒོར་ $110`. Preposing
 * a second copy would read "kilometre 80 kilometre". So each rule runs twice: once to DELETE the abbreviation
 * where the language has already said the word, and once to prepose it where it has not.
 *
 * ⚠ THE SPAN FRAME IS A CIRCUMFIX AND IT IS THE CORPUS'S OWN. `X ནས Y བར` ("from X to Y") is written with
 * numerals on both sides throughout — `༧℃ནས16℃བར`, `38 ནས་ 50 ℃ བར`, `༢༣ནས་༢༨བར`, `༡༤༩༨ ནས་ ༡༥༡༨ བར` — so a
 * hyphen span is rewritten into the shape the language already writes, not into an invented joiner.
 *
 * ⚠ FIVE REFUSALS, recorded here so nobody re-derives them; each is priced against what NOT reading it costs
 * (playbook trap 53), and the full evidence is in the investigation doc.
 *
 *   1. THE DECIMAL POINT, and it is the expensive one — 355 corpus decimals keep a fabricated SENTENCE BREAK
 *      between the integer and the fraction, because `.` is clause punctuation in tibetan.ts's TOKEN. Every
 *      route is dry: `sources.ts` says `[NONE] decimal-point`, espeak does not ship Tibetan at all, Wikidata
 *      Q427968 / Q81365 / Q840057 / Q20154908 have no bo label and no bo article, and ten candidate spellings
 *      probed on bo.wikipedia return either 0 or the wrong sense — `ཚག` is a monastery name (ར་ཚག་རི་ཁྲོད) and
 *      `ཚེག` is the *tsheg punctuation mark itself* (ཚེག་བར་གསུམ་པ, "three-syllable"). It stands because the
 *      alternative is worse: emitting the digits with no separator makes `3.4` read "three four" and INVENTS a
 *      quantity, which is Igbo's `790 km2` → "790 kilometres two".
 *      The composed candidate is recorded rather than shipped: the ཆ-fraction series is attested as a series
 *      (a wiki dictionary entry lists `བརྒྱ་ཆ། སྟོང་ཆ། སྟོད་ཆ། སྨད་ཆ།` together) and `བརྒྱ་ཆ་༢༠` fixes the
 *      position, so `3.4` → `གསུམ་དང་བཅུ་ཆ་བཞི` composes from attested pieces in the Fula `e teemedere` manner.
 *      It renders a FRACTION, though, and nothing attests a reader using it for the decimal NOTATION — the
 *      Mooré `koabg pʋgẽ` distinction between a real phrase and the slot it is claimed for.
 *   2. THE MINUS. No word (Wikidata's subtraction label འཕྲི་རྩིས is the operation NOUN — trap 35), and almost
 *      nothing to read: the retained sign instances are a coordinate span (`97°54′-101°50′`), scientific
 *      notation (`1.6*10-19`, `1.672*10-27Kg`), a year span (`270-350 A.D.`), the column separators of one
 *      historic land register (`ཁལ་464 -5`, `220 – 14 – 3`), and `ཀླད་ཀོར་འོག་གི -25℃`, which writes "below
 *      zero" in words beside the sign and so is REDUNDANT anyway.
 *   3. A BARE `°`. ~20 of the 28 degree signs are geographic COORDINATES (`26°50’`, `78°25′`), which need a
 *      degree/arc-minute/arc-second reading rather than a degree word bolted onto the figure — the refusal tl,
 *      yo and hil record. ཏུའུ (Chinese 度) is a degree word exactly once (`དྲོད་ཚད་ཏུའུ ༡-༡༨བར`) against five
 *      wiki hits that are all Chinese proper names (ཏུའུ་མུའུ 杜牧, ཁྲིན་ཏུའུ Chengdu) — trap 37 with a healthy
 *      count. `°C` is read through the definitionally-sourced སེ་དྲོད instead. `°F` is ×0 and is not declared.
 *   4. THE CUBE. `གྲུ་གསུམ་མ` is ×0 on the wiki and nothing else surfaced, so — following ak rather than ig —
 *      the unit rules REFUSE a key followed by a digit or a superscript outright. `m³` reads exactly as it did
 *      before instead of becoming a confidently wrong LENGTH, and it stays red in the scan.
 *   5. `ft` (×2) and a bare `&`. No Tibetan foot word is sourced; every `&` in the retained text is either an
 *      HTML entity (already decoded by the registry's `stripMarkup`) or sits inside an embedded ENGLISH title
 *      (`"flower & Moon"`), where དང would be wrong. Both stay visible to the artifact scan.
 */

/** Tibetan digits ༠-༩ as well as ASCII. `foldNativeDigits` runs before this pass, so in practice the input is
 *  ASCII — the Tibetan half of the class is a belt on that brace, and costs nothing (playbook: `\p{Nd}`, never `\d`). */
const D = "0-9༠-༩";
/**
 * ONE NUMERIC OPERAND, optionally a span. ⚠ It must END IN A DIGIT: a class like `[\d.,-]*` also eats a
 * trailing clause comma, which is silent data loss the moment a rule stops re-emitting the operand verbatim
 * (playbook trap 14's third hazard).
 */
/**
 * EVERY DASH THAT CAN JOIN A SPAN, in ONE place.
 *
 * ⚠ IT WAS TWO PLACES AND THEY DISAGREED, which is how a rule that PREPOSES a word lands it in the MIDDLE of
 * a span. `NUM` listed only `- – — ~ ～` while the span rule also read `‐ ‑ ‒ ― −`, so for a span joined by
 * one of those five `NUM` matched the LEFT operand alone: `18‐25km` became `18‐་སྤྱི་ལེ་25`, read as
 * "eighteen kilometre twenty-five", and `18‐25%` the same — the ig `790 km2` → "790 kilometres two" shape
 * this file's header cites as the thing to avoid. Two copies of one decision drift; hoist the decision.
 */
const DASH = "[-‐-―−~～]";
const NUM = `[${D}]+(?:[.,][${D}]+)?(?:\\s*${DASH}\\s*[${D}]+(?:[.,][${D}]+)?)?`;
/** A Tibetan letter, vowel sign, subjoined letter or tsheg — NOT the shad, which is real clause punctuation. */
const TIB = "\\u0F0B\\u0F40-\\u0F6C\\u0F71-\\u0F84\\u0F90-\\u0FBC";
/**
 * THE END OF A DECLARED WORD: not another Tibetan letter — EXCEPT ⟨འ⟩ U+0F60, which carries the grammatical
 * suffixes (`འི` genitive, `འོ`, `འང`, `འམ`) that attach INSIDE the syllable.
 *
 * ⚠ WITHOUT IT THE REDUNDANCY ARM READS ONE UNIT AS ANOTHER, silently and by a factor of 100. `སྨི` (metre)
 * is a substring of `ལི་སྨིད` (centimetre) at a tsheg boundary, so `ལི་སྨིད་ 30 m` looked to the metre rule
 * like "the corpus already said metre", the `m` was DELETED, and 30 METRES read as 30 CENTIMETRES — with no
 * leftover symbol for any leak class to catch (trap 56: a defect that produces a plausible reading).
 * ⚠ AND ⟨འ⟩ HAS TO BE EXEMPTED OR THE ARM STOPS WORKING WHERE IT MUST: the corpus writes `བརྒྱ་ཆའི་30%`, the
 * percent word plus its genitive, in the commonest redundant shape the language has. `ལི་སྨིད`'s ⟨ད⟩ is a
 * root letter and no suffix particle, so the two cases separate cleanly on this one character.
 */
const WORD_END = "(?![\\u0F40-\\u0F5F\\u0F61-\\u0F6C\\u0F71-\\u0F84\\u0F90-\\u0FBC])";
/**
 * ⚠ AN INSERTED WORD OPENS WITH A TSHEG, AND THAT IS A SYLLABLE-BOUNDARY FIX, NOT PUNCTUATION. The corpus
 * writes the figure hard against the preceding word (`མི་གྲངས་ཀྱི43%`), so preposing a bare word gives
 * `…ཀྱིབརྒྱ་ཆ་43` — and tibetan.ts splits a word into syllables on the TSHEG, so ⟨ཀྱི⟩ and ⟨བ⟩ fuse into one
 * stack, ⟨བ⟩ is read as its SUFFIX and the syllable comes out *kʲip* instead of *kʲi*. Seven utterances had a
 * word corrupted this way before the tsheg was added. A doubled or leading tsheg costs nothing —
 * `phonemizeWord` filters empty syllables — so it is emitted unconditionally rather than guarded.
 */
const TSHEG = "་";

/**
 * A measure noun, its abbreviation, and the guard that keeps the key from claiming something else.
 *
 * ⚠ EVERY WORD HERE IS SOURCED IN SLOT, and bo.wikipedia's SI-unit stub series is what makes that unusually
 * strong: each stub NAMES THE ABBREVIATION in its own first sentence, so there is no slot question left.
 *   · ལི་སྨིད  — `ལི་སྨིད་(cm)ནི་ཚད་འཇལ་བྱེད་ཀྱི་སྡེ་ཚན་གཅིག་རེད། ༡ལི་སྨིད། = ༡/༡༠༠སྨི།` (names cm AND m)
 *   · སྟོང་ཁེའུ — `སྟོང་ཁེའུ་(མཚོན་རྟགས།: kg)ནི་ཚད་འཇལ་བྱེད་ཀྱི་སྡེ་ཚན་གཅིག་རེད།`
 *   · སྤྱི་ལེ   — artifact ×30 (`ཟི་ལིང་གྲོང་ཁྱེར་ནས་སྤྱི་ལེ་ ༡༣༡ ལྷག`), Wikidata label AND bo article title (Q828224)
 *   · སྨི       — artifact ×16 (`མཚོ་ངོས་ནས་སྨི6000m`), Wikidata + article title (Q11573)
 *   · མི་ལི་མེ་ཏྲེར — artifact and wiki, both in slot (`ཆར་ཆུའི་འབབ་ཚད་ནི་མི་ལི་མེ་ཏྲེར་ ༣༥༠ ནས་ ༤༠༠`, rainfall in mm)
 *
 * ⚠ LONGEST FIRST, so `km` is never matched as `m` with a stray `k` left behind.
 *
 * ⚠ THE GUARD REJECTS A FOLLOWING DIGIT OR SUPERSCRIPT, WHICH IS REFUSAL 4 AND NOT TIDINESS. Step 5 has
 * already claimed the squared forms; what is left after it is a CUBE, and there is no cube word. Refusing the
 * whole match leaves `m³` exactly as it read before, where claiming the key alone would turn a volume into a
 * confidently wrong LENGTH (playbook trap 53, ig's `790 km2`). It rejects `/` for the same reason: `9.8m/s2`
 * is a per-second-squared acceleration and only the `h` denominator of step 4 is sourced.
 *
 * ⚠ IT REJECTS A FOLLOWING **LATIN** LETTER, NOT A FOLLOWING LETTER, and the difference is playbook trap 27.
 * Tibetan writes its units hard against the next word (`600km2ཡོད་ཅིང་`, `སྨི6000m ལྷག`), so a `(?!\p{L})`
 * guard rejects the ORDINARY case and only the punctuation- or space-followed instances survive — the
 * shared tier needed `unspacedScript` for exactly this and Japanese/Korean/Cantonese needed it again for
 * `℃`. A Tibetan neighbour is already a token boundary by script change; what the guard has to stop is the
 * key biting into a LATIN word (`m` inside `mm`, `Kg` inside `W1KG14783`, the `Han`/`Manchu` glosses this
 * corpus is full of), and that is an ASCII question.
 * ⚠ THE CORPUS DIFF IS WHAT FOUND IT, and only after step 2b started removing the space that had been
 * hiding it — trap 28's shape, where a new change surfaces an old defect. `600km2` was reaching the IPA as
 * *ˈʊkm ɲiː˥*, "km two", before the guard was narrowed.
 *
 * ⚠ AND IT REJECTS A FOLLOWING LATIN LETTER, which is what makes the one-letter `m` key safe (trap 46). This corpus
 * writes no dotted version designation at all — the `version-dot` cell's 122 hits are decimals, and a
 * `\d+\.\d+[a-z]` grep over the retained text returns 4, all of them scientific notation or `m/s²` — but all 5
 * digit-adjacent bare `m` are genuine metres, so the key earns its place and the guard is what bounds it.
 */
const UNITS: [key: string, word: string][] = [
    ["km", "སྤྱི་ལེ"],
    ["mm", "མི་ལི་མེ་ཏྲེར"],
    ["cm", "ལི་སྨིད"],
    ["kg", "སྟོང་ཁེའུ"],
    ["m", "སྨི"],
];
/** What may not follow a unit key: another letter, a digit, a superscript, or the rate slash. */
const UNIT_TAIL = `(?![A-Za-z${D}²³/])`;

/**
 * THE SQUARED MODIFIER IS A SUFFIX ON THE UNIT NOUN, and the whole phrase still precedes the figure:
 * `རྒྱ་ཁྱོན་སྤྱི་ལེ་གྲུ་བཞི་མ་ ༤༧་༠༠༠`. `གྲུ་བཞི་མ` is attested on both sides of the corpus/wiki line and applied
 * PRODUCTIVELY to units other than the kilometre in the corpus's own text (`མི་ལི་མེ་ཏྲེར་གྲུ་བཞི་མ`,
 * `ལེ་དབར་གྲུ་བཞི་མ`), which is what licenses composing `སྨི་གྲུ་བཞི་མ` for `m²`.
 */
const SQUARED = "གྲུ་བཞི་མ";

/**
 * THE RATE DENOMINATOR PHRASE COMES FIRST, and the corpus states it: `མྱུར་ཚད་ཆུ་ཚོད་རེར་སྤྱི་ལེ་20རྒྱུག་ཐུབ་པ`
 * — "can run 20 km PER HOUR", with `ཆུ་ཚོད་རེར` ("per each hour") ahead of both the unit and the figure.
 * ཆུ་ཚོད is the hour in the artifact (×5), on the wiki (`ཆུ་ཚོད་གཅིག … ཆུ་སྲང་དྲུག་ཅུའི་ཚད`, one hour = sixty
 * minutes) and in the kaikki referee's word list.
 *
 * Only `h` is declared. `m/s` would need a per-second phrase, and this corpus's single instance is `m/s²`,
 * which refusal 4 declines whole.
 *
 * ⚠ THE WHOLE UNIT FAMILY IS CASE-SENSITIVE, DELIBERATELY, and this rule matches the others rather than
 * carrying the sibling layers' `i` flag. Measured: the ONLY uppercase unit-shaped token after a digit in this
 * corpus is `Kg`, ×2, and both are SCIENTIFIC NOTATION whose mantissa this layer does not read
 * (`1.672*10-27Kg`, `9.107*10-31Kg`) — matching them would read 10⁻²⁷ kg as "27 kilograms". Case-insensitivity
 * would also open the one-letter `m` key to `M`, which is a Roman numeral and an initial. Trap 7 is about a
 * class narrower than its ORTHOGRAPHY; an ASCII unit abbreviation has one canonical case, and here the
 * capitalized form is attested only where it must be declined.
 */
const RATE_DENOMINATORS: [key: string, phrase: string][] = [["h", "ཆུ་ཚོད་རེར"]];

/** Escape a literal for use inside a constructed pattern. */
const lit = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

/**
 * Prepose `word` to the figure a symbol marks — or, where the language has ALREADY written that word just
 * before the figure, delete the symbol instead and keep the position the corpus put it in (trap 12).
 *
 * `gap` is how far back the word may sit: a unit hugs its figure, but a currency name is separated from the
 * sign by the magnitude word (`ཨ་སྒོར་ཐེར་འབུམ་ $༩.༤༦༩`), so `$` needs a wider window than `km` does.
 *
 * ⚠ THE REDUNDANCY PASS RUNS FIRST. Run the other way round, the preposing pass inserts a second copy of the
 * word and the redundancy pass then finds its own output and cannot tell it from the corpus's.
 */
function prepose(t: string, word: string, opts: { gap: number; lead?: string; tail?: string }): string {
    const lead = opts.lead ?? "";
    const tail = opts.tail ?? "";
    const w = lit(word);
    // a) The word is already there — drop the symbol, keep the text.
    //    ⚠ THE WINDOW STOPS AT A CLAUSE BOUNDARY. `[^digit]` alone would let a shad or a newline inside it,
    //    so a `ཨ་སྒོར` in the PREVIOUS sentence could suppress this sentence's currency word — a silent drop
    //    where the gap is widest. All six of the corpus's `ཨ་སྒོར … $` windows sit inside one clause.
    t = rewrite(t,
        new RegExp(`(${w}${WORD_END}[^${D}།༎\\n]{0,${opts.gap}})${lead}(${NUM})${tail}`, "gu"),
        "$1$2",
    );
    // b) It is not — prepose it. ⚠ Anchored at the START of the digit run: a lookbehind only rejects one
    //    STARTING POSITION, and without this the engine simply retries a character along and reads half a
    //    numeral (playbook trap 52).
    return rewrite(t, 
        new RegExp(`(?<![${D}.,])${lead}(${NUM})${tail}`, "gu"),
        `${TSHEG}${word}་$1`,
    );
}

/** A digit run's numeric value, with Tibetan digits folded — see the span rule for why this is not `Number`. */
const value = (run: string): number =>
    Number(run.replace(/[༠-༩]/gu, (c) => String(c.codePointAt(0)! - 0x0F20)));

/** Delete a space that merely separates a numeral from a Tibetan word. See step 12 for the measurement. */
// ⚠ BOTH ARMS GO THROUGH THE SEAM. The inner one was `t.replace(...)` on the PIPELINE STRING, so the
// space it deleted was invisible to the provenance tracker — and the outer `rewrite`, which was correct,
// then reported against a string the tracker did not recognise and poisoned. 110 hits on the mined corpus,
// every one attributed to the arm that was right (#1179).
const squeezeNumeralSpace = (t: string): string =>
    rewrite(rewrite(t, new RegExp(`([${D}])[ \\t]+(?=[${TIB}])`, "gu"), "$1")
        , new RegExp(`([${TIB}])[ \\t]+(?=[${D}])`, "gu"), "$1");

export function normalizeTibetan(input: string): string {
    let t = input;

    // 1) ZERO-WIDTH MARKS, first. ⚠ This corpus writes ZWSP after EVERY TSHEG in places
    //    (`རྒྱལ་​དབང་​ལྔ་​པའི་`, 99 in one paragraph), and U+200B is outside tibetan.ts's word class — so the
    //    token breaks at each ZWSP and every syllable is read as word-INITIAL. Lhasa tone is contrastive only
    //    on syllable 1, so that is not cosmetic: it hands each syllable a tone the word does not have.
    t = rewrite(t, /[­​-‏⁠﻿]/gu, "");  // soft hyphen, ZWSP, RLM, word joiner, BOM

    // 2) COMPATIBILITY FORMS OF THE SIGNS THIS LAYER READS. ⚠ Only these — never blanket NFKC, which would
    //    turn `²` into a plain `2` and erase the exponent readings below (playbook trap 36). The corpus writes
    //    the percent sign three ways: `%`, `％` U+FF05 (×7) and `﹪` U+FE6A (×6); `foldFullwidthLatin` in the
    //    registry covers only fullwidth digits and letters, so these are this layer's job.
    //    ℃/℉ are folded by the registry already; repeated here, idempotently, so the pass is correct when a
    //    test calls it directly.
    t = rewrite(rewrite(rewrite(t, /[％﹪٪]/gu, "%"), /℃/gu, "°C"), /℉/gu, "°F");

    // 2b) THE SPACE AROUND A NUMERAL, ONCE HERE AND AGAIN AT STEP 12 — and it must be both.
    //     Here, because a rule that PREPOSES a word puts a letter where the digit used to be, so a space that
    //     was numeral-adjacent in the input is letter-adjacent in the output and step 12 can no longer see it
    //     (`དྲོད་ཚད་ ༢༠℃` → `དྲོད་ཚད་ ་སེ་དྲོད་20`, keeping a pause that the same rule removes everywhere else).
    //     Again at step 12, because a rule that CONSUMES a symbol exposes a space that was not numeral-adjacent
    //     before it ran (`38 ནས་ 50 ℃ བར` → `…སེ་དྲོད་50 བར`). Neither position covers the other, and the
    //     squeeze is idempotent, so running it twice costs nothing. The measurement is at step 12.
    t = squeezeNumeralSpace(t);

    // 3) COMMA-GROUPED THOUSANDS, BEFORE the comma can be read as a clause pause and cut a numeral in half —
    //    `92,900` reads as "ninety-two, nine hundred" without this. Repeated for several groups (`༢,༡༩༣,༠༣༡`).
    //    ⚠ ONLY THE COMMA. The corpus also groups with a period (`༥༥༣.༩༠༤`, ×19) and with a tsheg
    //    (`༤༧་༠༠༠`, ×3) against 87 periods that are decimal, and it is exactly the same character in both
    //    roles — so de-grouping those would merge two numbers and INVENT a quantity wherever it guessed wrong.
    //    A comma before exactly three digits is unambiguous here; the others are left as they are.
    t = rewrite(t, new RegExp(`(?<=[${D}])(?<!(?<![${D}\\.,])0),(?=[${D}]{3}(?![${D}]))`, "gu"), "");

    // 4) RATES — `118-149km/h`. ⚠ HERE, ahead of the unit, span and clock rules, because this rule MOVES the
    //    operand and every one of those needs it intact to match; once relocated it is read by those same
    //    rules in its new position (the span inside this corpus's only instance becomes `118ནས་149བར`).
    //    After de-grouping, so a grouped figure arrives whole.
    //    ⚠ THROUGH `prepose` LIKE EVERY OTHER RULE, so it gets the redundancy arm too. Written as a bare
    //    `.replace` it was the one rule in this file without one, against the header's own statement — and
    //    the corpus sentence that SOURCES the phrase is exactly the shape that needs it
    //    (`མྱུར་ཚད་ཆུ་ཚོད་རེར་སྤྱི་ལེ་20`, both words already written), so `ཆུ་ཚོད་རེར་སྤྱི་ལེ་118-149km/h`
    //    read "per-hour kilometre per-hour kilometre 118 to 149".
    for (const [dkey, dphrase] of RATE_DENOMINATORS)
        for (const [ukey, uword] of UNITS)
            t = prepose(t, `${dphrase}་${uword}`, {
                gap: 3,
                tail: `\\s*${ukey}\\s*/\\s*${dkey}(?![A-Za-z${D}])`,
            });

    // 5) SQUARED UNITS, ⚠ BEFORE the plain unit rule — otherwise `km²` has its `km` consumed first and the
    //    exponent is stranded with nothing to attach to, so an area reads as a plain length.
    //    Both spellings: the corpus writes `600km²` and `600km2` for the same place.
    for (const [key, word] of UNITS)
        t = prepose(t, `${word}་${SQUARED}`, { gap: 3, tail: `\\s*${key}\\s*[²2](?![A-Za-z${D}])` });

    // 6) PLAIN UNIT ABBREVIATIONS. A digit must be adjacent, so ordinary embedded English is left to the
    //    Latin fallback; see UNIT_TAIL for what the guard refuses and why.
    for (const [key, word] of UNITS) t = prepose(t, word, { gap: 3, tail: `\\s*${key}${UNIT_TAIL}` });

    // 7) PERCENT. བརྒྱ་ཆ ("hundred-part") — artifact ×16, wiki ×6, and the sense is read:
    //    `ཁ་ཆེའི་ཆོས་ལུགས་(མི་མང་གི་བརྒྱ་ཆ་༥༥)`, 55% Muslim. The corpus writes word and sign together seven
    //    times in the retained text (`བརྒྱ་ཆ་ 95%`, `བརྒྱ་ཆའི་30%`), which is what the redundancy pass is for.
    t = prepose(t, "བརྒྱ་ཆ", { gap: 3, tail: "\\s*%" });

    // 8) CURRENCY. ཨ་སྒོར is the US dollar — artifact ×7, wiki ×6, always in an amount (`ཨ་སྒོར་༣༡,༢༠༠`).
    //    ⚠ THE SIGN MUST BE FOLLOWED BY A DIGIT, and that is what keeps LaTeX out: this corpus's `$` also
    //    opens a maths span (`arecoline ($C_8H_{13}NO_2$)`), which a bare `$` rule would read as money.
    //    ⚠ THE WINDOW IS WIDER THAN A UNIT'S because a magnitude word stands between the name and the sign:
    //    `ཨ་སྒོར་ཐེར་འབུམ་ $༩.༤༦༩`, "$9.469 billion".
    //    ⚠ ONLY `$`. `€ £ ¥ ₹` are ×0 in this corpus — a language that never writes the sign never speaks its
    //    name, and inventing one is the Fula `tere` failure.
    t = prepose(t, "ཨ་སྒོར", { gap: 12, lead: "\\$\\s*" });

    // 9) DEGREES CELSIUS. སེ་དྲོད is definitional on bo.wikipedia and names the sign itself —
    //    `སེ་དྲོད་(མཚོན་རྟགས།: °C)ནི་ཚད་འཇལ་བྱེད་ཀྱི་སྡེ་ཚན་གཅིག་རེད།` — and it is used in slot, preposed, in
    //    the same wiki (`ལུས་ཀྱི་དྲོད་ཁམས་འཕེལ་ཏེ་སེ་དྲོད༣༩`, a fever of 39 °C). Wikidata agrees (Q25267).
    //    ⚠ THE APOSTROPHE VARIANT IS ATTESTED AND IS NOT A GUESS: this corpus writes `༧.༨'c` and `༢.༩'c` for
    //    a mean annual temperature, i.e. an ASCII stand-in for the degree sign. It is admitted only before
    //    ⟨c⟩, so the arc-minute `’` of `26°50’` cannot reach it.
    //    ⚠ A BARE `°` IS DELIBERATELY NOT READ — refusal 3 in the header.
    t = prepose(t, "སེ་དྲོད", { gap: 3, tail: "\\s*[°'′]\\s*[cC](?![A-Za-z])" });

    // 10) CLOCK. ⚠ THE CHAIN GUARD IS THE WHOLE RULE. Of the six colon shapes in the retained text, THREE are
    //     `hh:mm:ss` datetimes (`2009-10-08 11:50:00`) and one an elapsed sports time (`ཆུ་ཚོད1:25:16`) —
    //     none of which is a time of day — and only the two wiki-signature timestamps (`༡༥:༡༨`, `༢༣:༢༥`) are.
    //     Rejecting a colon on either side keeps the rule to the shape that is actually a clock, which is the
    //     ilo lesson: a ceb-shaped bare-colon rule would have fixed 23 cases and broken 182 there.
    //     ཆུ་ཚོད (hour) and སྐར་མ (minute) are both in the kaikki referee's word list, and the minute sense of
    //     སྐར་མ is read on the wiki — `པིན་ཆེན་ཆུ་ཚོད་ཀྱིས་སྐར་མ་བཅོ་ལྔ་རེའི་མཚམས་སུ`, Big Ben chiming every
    //     fifteen minutes (its other hits are སྐར་མ "star", trap 37).
    t = rewrite(t,
        new RegExp(`(?<![${D}:])([${D}]{1,2}):([${D}]{2})(?![${D}:])`, "gu"),
        `${TSHEG}ཆུ་ཚོད་$1་སྐར་མ་$2`,
    );

    // 11) SPANS → the corpus's own `X ནས Y བར` circumfix (see the header).
    //
    //     ⚠ THE SECOND OPERAND MUST BE THE GREATER, and that guard is measured rather than tidy. Counting
    //     every `N[-–—~～]N` pair in the retained text by direction gives 41 ascending and 31 descending, and
    //     EVERY descending pair is either one historic land register's column separators (`ཁལ་464 -5`,
    //     `184 – 18`, `61 – 10`, `2072 – 5`, `120513 – 16`, …) or a mining artefact where a Tibetan digit run
    //     abuts an ASCII one. Every ascending pair is a real span. A span is ascending by definition, so this
    //     costs nothing and removes the whole false-positive class.
    //     ⚠ A CHAIN IS NOT A SPAN — `220 – 14 – 3` is three land-register columns, and requiring both
    //     neighbours to be dash-free rejects every link of a chain while accepting a lone pair.
    //     ⚠ NOR IS A MANTISSA. `1.6*10-19`, `1.672*10-27Kg` and `9.107*10-31Kg` are scientific notation whose
    //     exponent sign is a hyphen; a `*`/`×`/`x` before the left operand is the discriminator, and the
    //     operand is anchored at BOTH edges because a lookbehind alone only moves where the engine starts
    //     (playbook trap 52 — this is the shape that read `802.11m` as "802.11 metres" in three languages).
    t = rewrite(t,
        new RegExp(
            `(?<![*×xX]\\s{0,2})(?<!${DASH}\\s{0,2})(?<![${D}.,])`
                + `([${D}]+)\\s*${DASH}\\s*([${D}]+)(?![${D}.,])(?!\\s*${DASH})`,
            "gu",
        ),
        //     ⚠ THE COMPARISON MUST FOLD THE DIGITS FIRST. `Number("༡༦༤༢")` is NaN and `NaN > NaN` is false,
        //     so an unfolded Tibetan operand made the span rule SILENTLY NO-OP — a false negative, the
        //     expensive direction (trap 57). It cannot happen through `text()`, where `foldNativeDigits` runs
        //     ahead of this pass, but every other rule in this file is purely lexical and works on both digit
        //     sets, so this one was the only place the class's "belt on that brace" claim was not true.
        (whole, a: string, b: string) => (value(b) > value(a) ? `${a}ནས་${b}བར་` : whole),
    );

    // 12) THE SPACE AROUND A NUMERAL, last, so it also tidies what the rules above left behind.
    //
    //     ⚠ A SPACE IS A CLAUSE PAUSE IN tibetan.ts's TOKEN (`[།༎ ,;:]`), and for the most part that is
    //     harmless or right — 2582 of this corpus's 3439 spaces sit immediately after a shad, which has
    //     already set the same pending pause, and of the 133 between two Tibetan letters a good many are
    //     genuine breaks: Tibetan omits the shad after a ⟨ག⟩ suffix and writes a space in its place
    //     (`མཚོ་འགག ནུབ་`, `འདུག བོད་`, `ཡན་ལག དབུས་`). Those are left alone.
    //     ⚠ WHAT IS WRONG IS THE 464 SPACES THAT SEPARATE A NUMERAL FROM A TIBETAN WORD. Those are
    //     typographic spacing around a figure — `སྤྱི་ལེ་ ༡༣༡ ལྷག`, `ཆུ་ཚོད་ ༣༠༠༠ ཙམ`, `མི་གྲངས་ཁྲི ༨༣༢༣` —
    //     and every one of them fabricates a pause inside a phrase. All 50 of the instances where the space
    //     follows a letter with NO tsheg were read: not one is a clause break either.
    //     ⚠ DIGIT-SPACE-DIGIT IS DELIBERATELY UNTOUCHED (16 instances, e.g. the wiki's space-grouped
    //     `༡ ༠༠༠ ༠༠༠`). Deleting that space would MERGE two numerals, which is the one move in this file that
    //     can invent a quantity; here the two token classes are disjoint, so nothing else can.
    t = squeezeNumeralSpace(t);

    return t;
}
