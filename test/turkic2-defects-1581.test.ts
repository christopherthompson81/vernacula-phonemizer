/**
 * #1581: the ba/crh/kaa/nog/chv/tg defects the Rust port of the turkic2 group found. Synthetic probes, and
 * relational throughout: each fixed reading is compared with the engine's own reading of a form it already gets
 * right, so no IPA is typed. Mirrored in C# (`TurkicDefects1581Tests.cs`) and Rust (each language's own tests).
 */
import { describe, expect, test } from "vitest";
import { joinSpaceGroups, separatorHygiene } from "../src/core/separatorHygiene.ts";
import { phonemize } from "../src/index.ts";
import { phonemizeWordNative as baWord } from "../src/languages/bashkir/bashkir.ts";
import { normalizeChuvash } from "../src/languages/chuvash/normalize.ts";
import { phonemizeWord as kaaWord } from "../src/languages/karakalpak/karakalpak.ts";
import { phonemizeWord as nogWord } from "../src/languages/nogai/nogai.ts";
import { digitWords, numberWords } from "../src/languages/tajik/tajik.ts";

describe("tg: numbers from 10¹⁵ keep their leading digits", () => {
    test("the trillion count is composed in full", () => {
        expect(numberWords(1e15)).toBe("ҳазор триллион");
        expect(phonemize("1000000000000000", "tg")).toBe(phonemize("ҳазор триллион", "tg"));
        expect(phonemize("1000000000000000", "tg")).not.toBe(phonemize("1000000000000", "tg"));
    });

    test("past 2⁵³ a digit run is read digit by digit", () => {
        const run = "9007199254740993";
        expect(digitWords(run).split(" ")).toHaveLength(run.length);
        expect(phonemize(run, "tg")).toBe(phonemize([...run].join(" "), "tg"));
    });
});

describe("ba and kaa: a trillion word", () => {
    test("10¹² is not *thousand milliard*", () => {
        expect(phonemize("1000000000000", "ba")).toBe(phonemize("бер триллион", "ba"));
        expect(phonemize("1000000000000", "kaa")).toBe(phonemize("bir trillion", "kaa"));
    });
});

describe("the space-group join takes a run whole", () => {
    test("one pass joins every group", () => {
        expect(joinSpaceGroups("1 000 000")).toBe("1000000");
        expect(joinSpaceGroups("5 781 203 и")).toBe("5781203 и");
    });

    test("a run that starts with a standalone 0 is refused whole, not half joined", () => {
        expect(joinSpaceGroups("0 000 000")).toBe("0 000 000");
        expect(separatorHygiene("0 000 000")).toBe("0 000 000");
        expect(joinSpaceGroups("0 000")).toBe("0 000");
    });

    test("its guards are unchanged", () => {
        expect(joinSpaceGroups("21 2001")).toBe("21 2001");
        expect(joinSpaceGroups("3,0 000")).toBe("3,0000");
    });
});

describe("ba", () => {
    test("a range with a stray space is not a subtraction", () => {
        expect(phonemize("1990 -1995", "ba")).toBe(phonemize("1990-1995", "ba"));
        expect(phonemize("-5", "ba")).toBe(phonemize("минус 5", "ba")); // a real minus still reads
    });

    test("a case suffix after the gram sign is glued to the word", () => {
        expect(phonemize("5 г-ға", "ba")).toBe(phonemize("5 граммға", "ba"));
    });

    test("a word-initial cluster is the whole onset", () => {
        expect(baWord("спорт").startsWith("ˈ")).toBe(true);
        const kitaplar = baWord("китаплар"); // medially one consonant is the onset
        expect(kitaplar.indexOf("ˈ")).toBe(kitaplar.lastIndexOf("ɑ") - 2);
    });
});

describe("nog: a medial cluster splits for stress", () => {
    test("китаплар is kitap.lar, as in tk and tt", () => {
        const w = nogWord("китаплар");
        expect(w.indexOf("ˈ")).toBe(w.indexOf("l") - 1);
        expect(nogWord("спорт").startsWith("ˈ")).toBe(true);
    });
});

describe("crh", () => {
    test("the percent rule takes a suffix, not the next word", () => {
        expect(phonemize("50% ve", "crh")).toBe(phonemize("50 faiz ve", "crh"));
        expect(phonemize("0,7%-ine", "crh")).toBe(phonemize("0,7 faizine", "crh"));
    });

    test("a spaced dash before a number is not a minus", () => {
        expect(phonemize("fiyatı - 5 lira", "crh")).toBe(phonemize("fiyatı 5 lira", "crh"));
        expect(phonemize("-6 °C", "crh")).toBe(phonemize("minus 6 °C", "crh"));
    });
});

describe("kaa", () => {
    test("the word function stresses a word whose last vowel is å", () => {
        expect(kaaWord("tåw").startsWith("ˈ")).toBe(true);
    });

    test("24:00 is a clock; 24:30 is not", () => {
        expect(phonemize("24:00", "kaa")).toBe(phonemize("24 00", "kaa"));
        expect(phonemize("24:30", "kaa")).not.toBe(phonemize("24 30", "kaa"));
    });
});

describe("chv", () => {
    test("the Latin-ĕ suffix forms expand in a direct call", () => {
        expect(normalizeChuvash("15-мĕшĕсенче")).toBe(normalizeChuvash("15-мӗшӗсенче"));
        expect(normalizeChuvash("11-15-мĕшĕсенче")).toBe(normalizeChuvash("11-15-мӗшӗсенче"));
        expect(normalizeChuvash("15-мĕшĕсенче")).not.toContain("15");
    });

    test("24:30 is not a clock; 24:00 is", () => {
        expect(normalizeChuvash("24:30")).toBe("24:30");
        expect(phonemize("24:00", "chv")).toBe(phonemize("24", "chv"));
    });
});
