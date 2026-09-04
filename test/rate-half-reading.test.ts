/**
 * A RATE MUST NOT THROW AWAY THE HALF IT CAN READ.
 *
 * ⚠ THIS FILE HAS ARGUED BOTH SIDES, AND THE MEASUREMENT IS WHY. `km/h` is a unit and a DENOMINATOR NOUN,
 * and a language that has not sourced the noun cannot say it. The shared tier first matched the numerator
 * anyway — speaking "five kilometres" and leaving `/h` outside the match to reach the phoneme sink as a bare
 * letter (`5 m/s` → *five metres s*, the speed of light read out as a distance, #1093). #1098 answered that
 * by rejecting the whole match on a trailing `(?!\s?/\s?[A-Za-z])`, on the stated trade that "a half reading
 * is worse than a visible leak": the abbreviation would then stay in the text where the gates and a reader
 * can see it. Fleet-wide it took 290 half readings to 29, and this file asserted that state.
 *
 * ⚠ THE LEAK IT DECLINED TO IS NOT VISIBLE, AND THAT IS WHAT #1249 MEASURED. Declining discards the
 * NUMERATOR's reading as well, and in **34 of the 193 registry codes** the stranded `km` never reaches the
 * output as raw ASCII at all: it routes to the English foreign reader and comes back as LETTER NAMES —
 * am `160 km/h` read *məto sɨlsa kʰˈeᶦəm ˈeᶦt͡ʃ*, "one-sixty kay-em aitch", with nothing raw left for a gate
 * to find. Confident, audible, wrong.
 *
 * ⚠ AND THE DECIDING FACT IS THAT THE DENOMINATOR'S FATE DOES NOT CHANGE EITHER WAY. Across every diff the
 * residue after the slash is character-for-character what the decline left there — et `km h` → `kˈilomeːtrit
 * h`, ltg `km x` → `kʲilɔmʲætri x`, ab `kʼm kʼm` → `kʼilometʼra kʼm`. The guard never bought visibility for
 * the `h`; it only spent the numerator. So the trade #1098 priced was not on offer, and the tier now reads
 * what it can read and strands only the part with no word behind it.
 *
 * ⚠ AND THIS IS THE COUNTED ARM ONLY. `makeBareUnitNormalizer` keeps its `/` guard and a bare `km/h` still
 * declines — the two premises above are a NUMERAL underwriting the numerator and a denominator that is an
 * abbreviation rather than the other half of a ratio, and a bare key has neither. Taking the guard off there
 * too read `mm/dd/yyyy` as *millimetre/dd/yyyy* and `mg/kg` as *milligram/kg*; see that function's header.
 *
 * THE INSTRUMENT IS LANGUAGE-AGNOSTIC and needs no IPA knowledge: ask whether the plain unit reads as a
 * WORD, and then whether the rate spells the SAME symbol out — as raw ASCII, or as the English letter names
 * a non-Latin host routes it to. A language that never reads the unit is out of scope on its own terms.
 */
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { phonemize } from "../src/index.ts";

const SHAPES = [["km", "h"], ["m", "s"], ["km²", "h"], ["m³", "s"], ["kg", "m"]] as const;

/**
 * ⚠ STILL DECLINING THE WHOLE RATE, LISTED BY CODE AND SHAPE SO THE LIST CAN ONLY SHRINK.
 *
 * ⚠ EVERY ENTRY IS PRE-EXISTING AND THE LEDGER SHRANK BY 347. Run on both sides of #1249 the sweep found
 * **383** code+shape pairs declining a rate whose numerator the language reads, and **36**: no pair is new.
 *
 * ⚠ AND "EACH", NOT "MOST" — CHECKED RATHER THAN INFERRED, which is the caution #1095 was filed about.
 * Every one of the fifteen codes here handles units LOCALLY rather than through the shared tier: fourteen
 * never call `makeSymbolNormalizer` at all, and `nci` calls it without `units` and says so in its own
 * header ("this layer declares no shared symbol tier"), keeping a hand-written rule whose lookahead spells
 * out its own `/` for its own corpus reasons. So the core fix cannot reach them, and every one is a
 * per-file edit needing its own before/after.
 *
 * ⚠ A NEW ENTRY MUST NOT JOIN THIS LIST. It exists to be emptied.
 */
const ACCEPTED_DECLINE = new Set(
    ("ak kg/m|ak km²/h|ak km/h|ak m/s|bal km/h|bal m/s|bm km²/h|bm km/h|bo kg/m|bo m/s|ee km²/h|ee km/h|" +
        "ee m/s|hmn km²/h|hmn km/h|ht kg/m|ht km²/h|ht m³/s|ki km/h|ki m/s|lg kg/m|lg km/h|lg m/s|ln kg/m|" +
        "ln km²/h|ln km/h|lt km/h|lt m/s|mn kg/m|mn km²/h|mn km/h|mos km²/h|mos km/h|nci km/h|nci m/s|" +
        "ro kg/m").split("|"),
);

const CODES = [
    ...new Set([...readFileSync("src/registry.ts", "utf8").matchAll(/^\s*case "([^"]+)":/gmu)].map((m) => m[1]!)),
];

const say = (s: string, code: string): string | null => {
    try {
        return phonemize(s, code).trim();
    } catch {
        return null; // an unported/throwing engine is a different test's business
    }
};

/**
 * Is the SYMBOL itself in this reading, rather than a word for it?
 *
 * Two spellings, because a leak has two fates and only one of them is raw. In a Latin-script host the
 * abbreviation survives into the IPA as its own letters, so a whitespace-delimited token equal to the key
 * is the test. In a host that does not write Latin the run routes to the English foreign reader instead and
 * comes back as LETTER NAMES, which is why the second test asks ENGLISH what it would say rather than
 * pattern-matching its output — the failure #1249 is about is invisible to the first test alone.
 */
const EN = new Map<string, string>();
const enReads = (sym: string): string => {
    if (!EN.has(sym)) EN.set(sym, phonemize(sym, "en").trim());
    return EN.get(sym)!;
};
/** IPA-shaped Latin back to the key's letters (ɡ→g): a host that emits `kɡ` has left `kg` raw. ⚠ Recognised
 *  by the LETTERS, not only by what English says for them — the pruned n-gram happened to return `kg` as the
 *  literal `kɡ`, and retraining it (#1260) turned `enReads("kg")` into *kʰˈɪŋ*, which made five unchanged
 *  outputs look as though they had started reading the unit. */
const latin = (t: string): string => t.replace(/ɡ/gu, "g").replace(/[ˈˌːʰ]/gu, "");
const spelledOut = (reading: string, sym: string): boolean =>
    reading.split(/\s+/u).some((t) => t === sym || latin(t) === sym) || reading.includes(enReads(sym));

describe("an unreadable rate reads its numerator and strands only the denominator (#1249)", () => {
    test("no engine discards a numerator reading it has", () => {
        const declined: string[] = [];
        for (const code of CODES) {
            if (code === "en" || code.startsWith("en-")) continue; // English's own reading IS the yardstick
            for (const [sym, den] of SHAPES) {
                const key = sym.replace(/[²³]/gu, "");
                const plain = say(`5 ${sym}`, code);
                const rate = say(`5 ${sym}/${den}`, code);
                if (plain === null || rate === null) continue;
                if (spelledOut(plain, key)) continue; // the language never reads this unit — out of scope
                if (!spelledOut(rate, key)) continue; // the numerator survived the rate
                if (ACCEPTED_DECLINE.has(`${code} ${sym}/${den}`)) continue;
                declined.push(`${code} ${sym}/${den} → ${JSON.stringify(rate)} (plain ${JSON.stringify(plain)})`);
            }
        }
        expect(declined).toEqual([]);
    });

    test("⚠ THE ACCEPTED LIST MAY ONLY SHRINK — an entry that now reads must be removed", () => {
        const fixed: string[] = [];
        for (const entry of ACCEPTED_DECLINE) {
            const [code, shape] = entry.split(" ") as [string, string];
            const [sym, den] = shape.split("/") as [string, string];
            const key = sym.replace(/[²³]/gu, "");
            const plain = say(`5 ${sym}`, code);
            const rate = say(`5 ${sym}/${den}`, code);
            if (plain === null || rate === null) continue;
            if (!spelledOut(plain, key) && !spelledOut(rate, key)) fixed.push(entry);
        }
        expect(fixed).toEqual([]);
    });

    test("the numerator is read, and the unreadable denominator is now SILENT rather than spoken", () => {
        // ⚠ THIS ASSERTION HAS MOVED TWICE AND THE HISTORY IS THE POINT (#1093 → #1098 → #1249 → #1255).
        // #1249 pinned the stranded `h` here, on the argument that it "is exactly as present as it was under
        // the decline". True, and #1255 measured what "present" then means: in 36 non-Latin hosts the `h`
        // routes to the English foreign reader and is VOICED (*ˈeᶦt͡ʃ*), in 23 Latin hosts it stays a literal
        // `h` which IS a valid IPA symbol and is rendered, and in 11 more the host's own g2p reads it as a
        // native phone (haw `/s` → [k]). It was never a leak anyone could see; it was a reading. The symbol
        // is now consumed and dropped — a missing word, which this file's ordering prefers to a wrong one.
        // The DENOMINATOR NOUN is still the repair; test/rate-denominator.test.ts ledgers who lacks one.
        expect(phonemize("160 km/h", "et").trim()).toBe("sˈɑdɑ kˈuːskymːend kˈilomeːtrit");
        expect(phonemize("160 km/h", "am").trim()).toBe("məto sɨlsa kilo metɨɾ");
        // …and the EXPONENT is still recovered, which was #1249's own second finding: the decline rejected
        // that branch too, so `160 m³/s` lost the POWER as well as the noun in 100+ engines.
        expect(phonemize("160 m³/s", "es").trim()).toBe("θjˈento sesˈenta mˈetɾos kˈuβikos");
        expect(phonemize("5 m2/s", "et").trim()).toBe("vˈiːs rˈuːtmeːtrit"); // the ASCII twin, likewise
    });

    test("a DECLARED rate still reads, and the two measured counter-examples are untouched", () => {
        expect(phonemize("5 km/h", "mt").trim()).toContain("fɪs"); // fis-siegħa, Maltese's fused per-hour
        expect(phonemize("5 km/h", "shi").trim()).toContain("tasraɡt"); // Tashelhit reads every rate probed
        // ⚠ `120mg/100ml` is a RATIO of two readable quantities — Min Nan's blood-sugar article writes it,
        // and this arm reads the first while its own next match reads the second.
        expect(phonemize("120mg/100ml", "nan").trim()).not.toMatch(/\bmg\b|\bml\b/u);
        // ⚠ `12.8 km/秒` (a Japanese golden row) has a denominator that IS a word the engine reads. Neither
        // shape ever entered the ASCII guard, and neither moves.
        expect(phonemize("12.8 km/秒", "ja").trim()).toBe("d͡ʑɯᵝːni te̞ɴhät͡ɕi kiɾo̞me̞ꜜːto̞ɾɯᵝ bʲo̞ꜜː");
    });
});
