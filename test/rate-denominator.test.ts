/**
 * A RATE'S DENOMINATOR IS READ, OR IT IS SILENT — never spoken as something it is not.
 *
 * ⚠ #1249 FIXED THE NUMERATOR AND LEFT THE DENOMINATOR STRANDED, on the premise that the abbreviation then
 * "stays visible to the leak gates". #1255 measured that premise over all 193 registry codes and it is false
 * on every side. What was left behind is not a gap a reader spots — it is a READING, and a wrong one:
 *
 *   · 36 non-Latin hosts never saw the `h` at all. It routes to the English foreign reader and is VOICED —
 *     ja `160 km/h` read *…kiɾo̞me̞ꜜːto̞ɾɯᵝ ˈeᶦt͡ʃ*, "one-sixty kilometre AITCH".
 *   · 23 Latin hosts kept it as literal `h`, and `h` IS A VALID IPA SYMBOL — et's `kˈilomeːtrit h` is the
 *     voiceless glottal fricative to anything consuming this IPA. `s`, `l`, `t`, `m`, `min`, `yr` likewise.
 *   · ⚠ AND 11 MORE HAD THE HOST'S OWN G2P READ THE LETTER AS A NATIVE PHONE, which is the worst of the
 *     three because it looks like success: haw `160 m/s` → *mika **k*** (Hawaiian has no /s/), ltg and pl
 *     `/h` → *x*, cdo `/h` → a TONED *h˥˥*, el → *eits*, pcm → *et͡ʃ*. A count that scored "an extra token
 *     appeared" as "the denominator was read" credited all eleven.
 *
 * `isBareUnitKey`'s own header already records why no gate catches the second class ("a Latin run in a
 * Latin-script language looks exactly like a word"); the first never reaches the output as Latin at all.
 *
 * ⚠ THE ORDERING THAT SETTLES IT IS normalizeSymbols.ts's OWN, from the exponent branch: **missing word ≥
 * wrong word ≫ invented number** — and the repo litigated this exact "the leak gate can see it" premise once
 * before, in test/bare-exponent.test.ts, where it was found to be certifying a bug in 169 of 193 codes.
 *
 * ⚠ AND DROPPING IT IS NOT THE REPAIR, only the better of two wrong answers. The repair is the DENOMINATOR
 * NOUN — per-language data, and per-DENOMINATOR at that (cmn reads `km/h` and fails only on `/s`). Dropping
 * the wrong reading must not be allowed to hide that gap, which is what `SILENT_BUDGET` below is for.
 */
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { phonemize } from "../src/index.ts";

const CODES = [
    ...new Set([...readFileSync("src/registry.ts", "utf8").matchAll(/^\s+case "([A-Za-z0-9-]+)":/gmu)].map((m) => m[1]!)),
].filter((c) => c !== "en" && !c.startsWith("en-")); // English's own reading IS the yardstick below

const SHAPES = [["km", "h"], ["m", "s"], ["kg", "h"]] as const;

const say = (t: string, code: string): string | null => {
    try {
        return phonemize(t, code).trim();
    } catch {
        return null;
    }
};
const EN = new Map<string, string>();
const en = (s: string): string => {
    if (!EN.has(s)) EN.set(s, phonemize(s, "en").trim());
    return EN.get(s)!;
};
const tokens = (s: string): string[] => s.split(/\s+/u).filter(Boolean);

/**
 * The three outcomes for one language × one rate shape, from the outside.
 *
 * ⚠ TOKENS, NOT SUBSTRINGS. An earlier draft tested `rate.includes(en(denom))` and reported nl's perfectly
 * correct *mˈeːtər pˈɛr sˈeːkɔndə* as a failure, because `zˈɛstəx` contains `ˈɛs`. Every check here is on a
 * whitespace-delimited token.
 */
const classify = (code: string, unit: string, denom: string): "unread-unit" | "read" | "silent" | "spoken" => {
    const plain = say(`160 ${unit}`, code);
    const rate = say(`160 ${unit}/${denom}`, code);
    if (plain === null || rate === null) return "unread-unit";
    const pt = tokens(plain);
    if (pt.includes(unit) || pt.some((t) => t === en(unit))) return "unread-unit"; // a different gap entirely
    const extra = tokens(rate).filter((t) => !pt.includes(t));
    if (extra.length === 0) return "silent";
    return extra.some((t) => t === denom || t === denom.toUpperCase() || t === en(denom)) ? "spoken" : "read";
};

/**
 * ⚠ STILL SPEAKING THE SYMBOL, LISTED BY CODE AND SHAPE SO THE LIST CAN ONLY SHRINK — 229 pairs before
 * #1255 and 47 after, a strict subset with nothing new.
 *
 * Every one of these reads its rate through a LOCAL arm in its own engine rather than the shared tier, so
 * the tier's match never covers the `/denominator` and cannot consume it. Same population as
 * `ACCEPTED_DECLINE` in test/rate-half-reading.test.ts, and the same per-file work: each arm hand-wrote its
 * own guard and each needs its own before/after.
 * ⚠ A NEW ENTRY MUST NOT JOIN THIS LIST. It exists to be emptied.
 */
const ACCEPTED_SPOKEN = new Set(
    ("ko kg/h|kl kg/h|ro kg/h|mr km/h|mr kg/h|sd kg/h|ak km/h|ak m/s|ak kg/h|ps km/h|ps kg/h|pbt km/h|" +
        "pbt kg/h|bg kg/h|is kg/h|haw kg/h|bo m/s|nci m/s|naq kg/h|ee km/h|ee m/s|bar kg/h|hmn km/h|" +
        "bal km/h|bal m/s|mn km/h|mn kg/h|yo m/s|my m/s|nya m/s|ln km/h|ln kg/h|bm km/h|mos km/h|ki km/h|" +
        "ki m/s|ki kg/h|ka km/h|ka kg/h|lt km/h|lt m/s|lt kg/h|lg km/h|lg m/s|lg kg/h|ug km/h|ug kg/h"
    ).split("|"),
);

/**
 * ⚠ THE DATA LEDGER, AS A BUDGET RATHER THAN A LIST. 208 code+shape pairs across 102 languages read their
 * numerator and have no word for the denominator, so the symbol is dropped and the rate reads short —
 * `160 km/h` as "one hundred sixty kilometres". That is a MISSING WORD, which is the better wrong answer,
 * and it is 15 pairs before this change against 208 after because the other 193 were speaking the symbol.
 *
 * A budget rather than 208 pinned lines because the entries are not a decision to defend one by one — they
 * are a to-do list, and every `rateDenominators`/`unitPer` declaration that lands shrinks it. The failure
 * message prints the whole list, so anyone who moves the number sees exactly which languages moved.
 */
const SILENT_BUDGET = 208;

describe("a rate denominator with no word is silent, not spoken (#1255)", () => {
    test("no engine speaks the denominator SYMBOL — as raw Latin, or as an English letter name", () => {
        const spoken: string[] = [];
        for (const code of CODES) {
            for (const [u, d] of SHAPES) {
                if (classify(code, u, d) !== "spoken") continue;
                if (ACCEPTED_SPOKEN.has(`${code} ${u}/${d}`)) continue;
                spoken.push(`${code} ${u}/${d} → ${JSON.stringify(say(`160 ${u}/${d}`, code))}`);
            }
        }
        expect(spoken).toEqual([]);
    });

    test("⚠ THE ACCEPTED LIST MAY ONLY SHRINK — an entry that no longer speaks it must be removed", () => {
        const fixed = [...ACCEPTED_SPOKEN].filter((e) => {
            const [code, shape] = e.split(" ") as [string, string];
            const [u, d] = shape.split("/") as [string, string];
            return classify(code, u, d) !== "spoken";
        });
        expect(fixed).toEqual([]);
    });

    test("⚠ THE SILENT LEDGER MAY ONLY SHRINK — each entry is a missing denominator noun, not a decision", () => {
        const silent: string[] = [];
        for (const code of CODES) {
            for (const [u, d] of SHAPES) if (classify(code, u, d) === "silent") silent.push(`${code} ${u}/${d}`);
        }
        expect(silent.length, `declare a denominator noun for these:\n${silent.join(" · ")}`)
            .toBeLessThanOrEqual(SILENT_BUDGET);
    });

    test("the reported shapes, and the counter-examples that must not move", () => {
        // ⚠ THE ISSUE'S THREE CLASSES. The English letter name is gone…
        expect(phonemize("160 km/h", "ja").trim()).toBe("çäkɯᵝɾo̞kɯᵝd͡ʑɯᵝː kiɾo̞me̞ꜜːto̞ɾɯᵝ");
        expect(phonemize("133 m/s", "cmn").trim()).toBe("ji˥˩ paⁱ˨˩˦ san˥˥ ʂʐ̩˧˥ san˥˥ mi˨˩˦");
        // …and so is the spurious phone the Latin hosts were emitting.
        expect(phonemize("160 km/h", "et").trim()).toBe("sˈɑdɑ kˈuːskymːend kˈilomeːtrit");
        expect(phonemize("160 km/h", "tr").trim()).toBe("jˈyz aɫtmˈɯʃ ciɫometɾˈe");
        // ⚠ A DECLARED DENOMINATOR IS UNTOUCHED — this only ever removes a symbol with no word behind it.
        expect(phonemize("160 km/h", "de").trim()).toContain("ʃtˈʊndə");
        expect(phonemize("160 m/s", "tr").trim()).toBe("sanijedˈe jˈyz aɫtmˈɯʃ mˈetɾe"); // a PREFIX arm, still read
        // ⚠ AND A SHORT RUN **WITH A VOWEL** IS LEFT ALONE, because it may be a word the host reads — which
        // is `isBareUnitKey`'s own discriminator, five screens up in the same file. Without it the guard ate
        // nl's *ˈyr* (`km/uur`), sw's *sˈaː* (`km/saa`) and cs's *ɦˈot* (`km/hod`).
        expect(phonemize("160 km/uur", "nl").trim()).toBe("ɦˈɔndərtzˈɛstəx kˈiloːmətər ˈyr");
        expect(phonemize("160 km/saa", "sw").trim()).toContain("sˈaː");
        // …while the vowel-free ones are exactly the defect this closes.
        expect(phonemize("160 km/Std", "de").trim()).toBe("ˈaɪ̯nhʊndɐtzɛçt͡sɪç kilomˈeːtɐ");
        expect(phonemize("160 km/hr", "fr").trim()).toBe("sɑ̃ swasɑ̃t kilɔmˈɛtʁ");
        // ⚠ AND NEITHER IS A DENOMINATOR IN THE HOST'S OWN SCRIPT, nor a ratio of two readable quantities:
        // the guard is 1–3 ASCII letters, so `秒` and `100ml` are both outside it.
        expect(phonemize("12.8 km/秒", "ja").trim()).toBe("d͡ʑɯᵝːni te̞ɴhät͡ɕi kiɾo̞me̞ꜜːto̞ɾɯᵝ bʲo̞ꜜː");
        expect(phonemize("120mg/100ml", "nan").trim()).not.toMatch(/\bmg\b|\bml\b/u);
    });
});
