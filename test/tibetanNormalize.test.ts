import { describe, expect, test } from "vitest";

import { normalizeTibetan } from "../src/languages/tibetan/normalize.ts";
import { getPhonemizer } from "../src/registry.ts";

const say = (s: string): string => getPhonemizer("bo").text(s);

/**
 * Tibetan (bo) normalization — the pre-tokenizer pass in src/languages/tibetan/normalize.ts.
 *
 * ⚠ THESE PIN THE RULE'S BRANCHES, NOT THE CORPUS'S INSTANCES (playbook trap 13). Every rule here has two
 * arms — the corpus has already written the measure noun, or it has not — and the corpus exercises both, so
 * both are asserted. The refusals get cases too: a refusal that quietly starts firing is the failure mode
 * the header's five entries exist to prevent.
 */
describe("Tibetan text normalization", () => {
    /**
     * Tibetan PREPOSES the measure noun (`སྤྱི་ལེ་ ༡༣༡`, "kilometre 131"), so every rule has a redundancy arm:
     * where the corpus has already written the word, the abbreviation is DELETED rather than the word doubled
     * (playbook trap 12).
     */
    test("units prepose — and the abbreviation is dropped where the corpus already wrote the word", () => {
        expect(normalizeTibetan("1457m")).toBe("་སྨི་1457"); // metre, sourced by Wikidata label + article title
        expect(normalizeTibetan("སྨི6000m")).toBe("སྨི6000"); // the corpus said it — drop the key, keep its position
        expect(normalizeTibetan("111 cm")).toBe("་ལི་སྨིད་111"); // the wiki's own stub names ⟨cm⟩
        expect(normalizeTibetan("641 mm")).toBe("་མི་ལི་མེ་ཏྲེར་641");
        expect(normalizeTibetan("80km")).toBe("་སྤྱི་ལེ་80");
        expect(normalizeTibetan("སྤྱི་ལེ 80km")).toBe("སྤྱི་ལེ80"); // step 12 also takes the typographic space
    });

    /** ⟨cm⟩ read as ⟨km⟩ before this layer existed — a defect that produces a plausible READING (trap 56), and
     *  one no leak class can see. Asserted through the phonemizer, because that is where it was invisible. */
    test("⟨cm⟩ is the centimetre, not the kilometre", () => {
        expect(say("111 cm")).toBe("li˩miʔ˥ kʲa˩taŋ˥t͡ɕu˥t͡ɕiʔ˥");
        expect(say("111 km")).toBe("t͡ɕi˥le˥ kʲa˩taŋ˥t͡ɕu˥t͡ɕiʔ˥");
    });

    /**
     * ⚠ THE UNIT GUARD REJECTS A FOLLOWING **LATIN** LETTER, NOT A FOLLOWING LETTER — playbook trap 27.
     * Tibetan writes its units hard against the next word, so a `(?!\p{L})` guard rejects the ORDINARY case
     * and only the space- or punctuation-followed instances survive. `600km2ཡོད་ཅིང་` was reaching the IPA as
     * *ˈʊkm ɲiː˥* — "km two" — and two `℃` were being read as the English letter C for the same reason.
     * What the guard has to stop is the key biting into a LATIN word, and that is an ASCII question.
     */
    test("a Tibetan letter after a unit key is the ordinary case; a Latin one is not", () => {
        expect(normalizeTibetan("600km2ཡོད")).toBe("་སྤྱི་ལེ་གྲུ་བཞི་མ་600ཡོད");
        expect(normalizeTibetan("20°Cཡོད")).toBe("་སེ་དྲོད་20ཡོད");
        expect(normalizeTibetan("སྨི6000mལྷག")).toBe("སྨི6000ལྷག");
        expect(normalizeTibetan("5 kg ཡོད")).toBe("་སྟོང་ཁེའུ་5ཡོད");
        // …and the Latin cases the guard exists for, all present in this corpus's embedded English
        expect(normalizeTibetan("25 mmol")).toBe("25 mmol");
        expect(normalizeTibetan("W1KG14783")).toBe("W1KG14783");
    });

    /**
     * ⚠ THE UNIT FAMILY IS CASE-SENSITIVE, DELIBERATELY. The only uppercase unit-shaped token after a digit
     * in this corpus is `Kg` ×2, and both are SCIENTIFIC NOTATION whose mantissa this layer does not read —
     * matching them would read 10⁻²⁷ kg as "27 kilograms".
     */
    test("an uppercase key is not a unit here", () => {
        expect(normalizeTibetan("1.672*10-27Kg")).toBe("1.672*10-27Kg");
    });

    /** The squared modifier is a SUFFIX on the unit noun and the whole phrase still precedes the figure. Both
     *  spellings, because the corpus writes `600km²` and `600km2` for the same place. */
    test("squared units, and the CUBE is refused WHOLE rather than half-read", () => {
        expect(normalizeTibetan("600km²")).toBe("་སྤྱི་ལེ་གྲུ་བཞི་མ་600");
        expect(normalizeTibetan("600km2")).toBe("་སྤྱི་ལེ་གྲུ་བཞི་མ་600");
        // ⚠ No Tibetan cube word is sourced. Claiming the key alone would read a VOLUME as a length and the
        //   bare `3` as a quantity — ig's `790 km2` → "790 kilometres two". The whole match is declined.
        expect(normalizeTibetan("600km³")).toBe("600km³");
        expect(normalizeTibetan("600km3")).toBe("600km3");
        // ⚠ …and so is a rate whose denominator is not the sourced one: `m/s²` has no reading here.
        expect(normalizeTibetan("9.8m/s2")).toBe("9.8m/s2");
    });

    /**
     * ⚠ A UNIT WORD THAT IS A SUBSTRING OF A LONGER ONE MUST NOT SATISFY THE REDUNDANCY ARM. `སྨི` (metre) is
     * a substring of `ལི་སྨིད` (centimetre) at a tsheg boundary, so the metre rule read the centimetre word as
     * "the corpus already said metre", deleted the `m`, and 30 METRES came out as 30 CENTIMETRES — a silent
     * 100× error with no leftover symbol for any leak class to catch (trap 56).
     * ⚠ And ⟨འ⟩ has to be exempted from that boundary or the arm stops working where it matters most: the
     * corpus's commonest redundant shape is the percent word plus its genitive, `བརྒྱ་ཆའི་30%`.
     */
    test("a unit word inside a longer unit word does not satisfy the redundancy arm", () => {
        expect(normalizeTibetan("ལི་སྨིད་ 30 m")).toBe("ལི་སྨིད་་སྨི་30"); // the metre is READ, not inherited
        expect(normalizeTibetan("བརྒྱ་ཆའི་30%")).toBe("བརྒྱ་ཆའི་30"); // the genitive still counts as the word
    });

    /**
     * ⚠ ONE DASH CLASS. `NUM` and the span rule each carried their own, and they disagreed on `‐ ‑ ‒ ― −` —
     * so for a span joined by one of those five, `NUM` matched the LEFT operand alone and a preposing rule
     * landed its word in the MIDDLE of the span: `18‐25km` → "eighteen kilometre twenty-five", the ig
     * `790 km2` shape. Two copies of one decision drift.
     */
    test("every dash that joins a span is one class", () => {
        for (const dash of ["-", "‐", "‑", "‒", "–", "—", "―", "−", "~", "～"])
            expect(normalizeTibetan(`18${dash}25km`)).toBe("་སྤྱི་ལེ་18ནས་25བར་");
    });

    /** The rate's denominator phrase comes FIRST — `མྱུར་ཚད་ཆུ་ཚོད་རེར་སྤྱི་ལེ་20`, the corpus's own frame — and
     *  the rule runs before the span rule so the operand it moves is still intact when the span claims it. */
    test("a rate preposes its denominator phrase, and the span inside it still reads", () => {
        expect(normalizeTibetan("118-149km/h")).toBe("་ཆུ་ཚོད་རེར་སྤྱི་ལེ་118ནས་149བར་");
        // ⚠ …and it goes through `prepose` like every other rule, so it has the redundancy arm too. The very
        //   corpus sentence that SOURCES the phrase writes both words out, so without this it doubled them.
        expect(normalizeTibetan("ཆུ་ཚོད་རེར་སྤྱི་ལེ་118-149km/h")).toBe("ཆུ་ཚོད་རེར་སྤྱི་ལེ་118ནས་149བར་");
    });

    test("percent and currency prepose, with the same redundancy arm", () => {
        expect(normalizeTibetan("43%")).toBe("་བརྒྱ་ཆ་43");
        expect(normalizeTibetan("13.27％")).toBe("་བརྒྱ་ཆ་13.27"); // U+FF05, one of this corpus's three spellings
        expect(normalizeTibetan("བརྒྱ་ཆའི་30%")).toBe("བརྒྱ་ཆའི་30");
        expect(normalizeTibetan("$110")).toBe("་ཨ་སྒོར་110");
        // the currency name is separated from the sign by a magnitude word, so its window is wider than a unit's
        expect(normalizeTibetan("ཨ་སྒོར་ཐེར་འབུམ་ $9.469")).toBe("ཨ་སྒོར་ཐེར་འབུམ་9.469");
        // ⚠ `$` OPENS A LATEX SPAN IN THIS CORPUS TOO. Requiring a digit after the sign is what keeps a
        //   chemical formula from being read as money.
        expect(normalizeTibetan("arecoline ($C_8H_{13}NO_2$)")).toBe("arecoline ($C_8H_{13}NO_2$)");
    });

    /** `°C` is read through སེ་དྲོད, which bo.wikipedia defines while naming the sign. A BARE `°` is not: four
     *  fifths of this corpus's degree signs are geographic coordinates, which need a coordinate reading. */
    test("°C is read; a coordinate degree is deliberately not", () => {
        expect(normalizeTibetan("20°C")).toBe("་སེ་དྲོད་20");
        expect(normalizeTibetan("7.8'c")).toBe("་སེ་དྲོད་7.8"); // the corpus's ASCII stand-in for the sign
        expect(normalizeTibetan("26°50’")).toBe("26°50’");
        expect(say("༢༠℃")).toBe("se˥ʈ͡ʂøʔ˥ ɲi˩ɕu˥"); // ℃ folds at the registry; the C was read as English *sˈiː*
    });

    /**
     * A span becomes the corpus's own `X ནས Y བར` circumfix. Three guards, each measured against a shape this
     * corpus contains: the second operand must be the GREATER (41 ascending pairs are spans, all 31 descending
     * ones are one land register's columns), a CHAIN is not a span, and a MANTISSA is not a span.
     */
    test("spans, and the three shapes that are not spans", () => {
        expect(normalizeTibetan("1642-1720")).toBe("1642ནས་1720བར་");
        expect(normalizeTibetan("ཁལ་464 -5")).toBe("ཁལ་464 -5"); // descending — a land-register column pair
        expect(normalizeTibetan("220 – 14 – 3")).toBe("220 – 14 – 3"); // a chain
        expect(normalizeTibetan("1.6*10-19")).toBe("1.6*10-19"); // a scientific-notation exponent
        // ⚠ AND THE ASCENDING TEST MUST FOLD THE DIGITS: `Number("༡༦༤༢")` is NaN, `NaN > NaN` is false, and
        //   the rule silently no-opped. `foldNativeDigits` runs ahead of this pass inside `text()`, but every
        //   other rule here is lexical and digit-set-agnostic, so this was the one place that was untrue.
        expect(normalizeTibetan("༡༦༤༢-༡༧༢༠")).toBe("༡༦༤༢ནས་༡༧༢༠བར་");
    });

    /** Of the six colon shapes in the retained text only two are times of day; the rest are `hh:mm:ss`
     *  datetimes and one elapsed sports time. Rejecting a colon on either side is what separates them. */
    test("a clock, but never an hh:mm:ss chain", () => {
        expect(normalizeTibetan("15:18")).toBe("་ཆུ་ཚོད་15་སྐར་མ་18");
        expect(normalizeTibetan("1:25:16")).toBe("1:25:16");
        expect(normalizeTibetan("11:50:00")).toBe("11:50:00");
    });

    /**
     * ⚠ THE COMMA IS CLAUSE PUNCTUATION, so a grouped numeral read as two numbers with a pause between them.
     * Only the comma is de-grouped: this corpus also groups with a period and a space, and the period is the
     * same character it uses as a decimal point, so guessing there would MERGE two numbers.
     */
    test("comma de-grouping, and the two groupings deliberately left alone", () => {
        expect(normalizeTibetan("92,900")).toBe("92900");
        expect(normalizeTibetan("2,193,031")).toBe("2193031");
        expect(normalizeTibetan("5 000")).toBe("5 000");
        expect(normalizeTibetan("1.234")).toBe("1.234");
    });

    /**
     * ⚠ AN INSERTED WORD OPENS WITH A TSHEG. tibetan.ts splits a word into syllables on the tsheg, so a bare
     * `བརྒྱ་ཆ` glued to `…ཀྱི` fuses ⟨ཀྱི⟩ and ⟨བ⟩ into ONE stack and reads *kʲip* — a corrupted syllable, not
     * merely an unlovely join. Four utterances had a word damaged this way before the tsheg was added.
     */
    test("an inserted word cannot corrupt the syllable it lands against", () => {
        expect(normalizeTibetan("མི་གྲངས་ཀྱི43%")).toBe("མི་གྲངས་ཀྱི་བརྒྱ་ཆ་43");
        expect(say("མི་གྲངས་ཀྱི༤༣%")).toBe("mi˩ʈ͡ʂaŋ˥kʲi˥kʲa˥t͡ɕʰa˥ ɕe˩sum˥"); // ⟨ཀྱི⟩ intact, not *kʲip*
    });

    /**
     * ⚠ A SPACE IS A CLAUSE PAUSE in tibetan.ts's TOKEN, and 464 of this corpus's spaces merely separate a
     * numeral from a Tibetan word. Only those are removed — a space between two Tibetan letters can be a real
     * break (Tibetan omits the shad after a ⟨ག⟩ suffix and writes a space instead), and a space between two
     * DIGITS is never removed, because merging two numerals is the one move here that can invent a quantity.
     */
    test("the typographic space around a numeral, and the two that stay", () => {
        expect(normalizeTibetan("སྤྱི་ལེ་ 131 ལྷག")).toBe("སྤྱི་ལེ་131ལྷག");
        expect(say("སྤྱི་ལེ་ ༡༣༡ ལྷག")).toBe("t͡ɕi˥le˥ kʲa˩taŋ˥so˥t͡ɕiʔ˥ ɬaʔ˥"); // no fabricated pauses
        expect(normalizeTibetan("འདུག བོད")).toBe("འདུག བོད"); // a shad-replacing space between letters
        expect(normalizeTibetan("1 000 000")).toBe("1 000 000"); // never merge two numerals
        // ⚠ THE SQUEEZE RUNS TWICE AND BOTH POSITIONS ARE LOAD-BEARING. Once BEFORE the sign rules, because
        //   preposing a word puts a letter where the digit was and the late pass can no longer see the space;
        //   once AFTER, because consuming a symbol exposes a space that was not numeral-adjacent before.
        expect(normalizeTibetan("དྲོད་ཚད་ 20°C")).toBe("དྲོད་ཚད་་སེ་དྲོད་20"); // the early pass
        expect(normalizeTibetan("38 ནས་ 50 °C བར")).toBe("38ནས་་སེ་དྲོད་50བར"); // the late pass
    });

    /**
     * ZWSP after every tsheg is how parts of this dump are written. U+200B is outside tibetan.ts's word class,
     * so the token broke at each one and every syllable was read as word-INITIAL — and Lhasa tone is
     * contrastive only on syllable 1, so that hands each syllable a tone the word does not have.
     */
    test("zero-width marks inside a word", () => {
        expect(say("རྒྱལ་​ལྔ་​པའི་")).toBe(say("རྒྱལ་ལྔ་པའི་"));
    });

    /**
     * Nothing this layer emits may reach the phoneme sink as a spelling (playbook trap 6): every word above is
     * inserted as TEXT and phonemized by the tokenizer.
     * ⚠ THE TEST IS UPPERCASE-ONLY AND A SYMBOL SWEEP, NOT `/[A-Za-z]/`. IPA is written in ASCII Latin, so a
     * lowercase test over the output is a tautology rather than a detector (defects.ts's LEAK_CLASSES makes
     * the same point). No IPA symbol is an uppercase ASCII letter, and none of these symbols is one either.
     */
    test("no emitted word or symbol reaches the IPA as orthography", () => {
        for (const s of ["43%", "$110", "20°C", "600km²", "641 mm", "15:18", "118-149km/h"]) {
            expect(say(s)).not.toMatch(/[A-Z]/u);
            expect(say(s)).not.toMatch(/[%$°²³/]/u);
        }
    });
});
