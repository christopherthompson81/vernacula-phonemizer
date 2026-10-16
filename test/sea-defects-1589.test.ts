/**
 * #1589: number and clock defects in vi/lo/my/jv/su/mad, found by the Rust port of the seasia group. Every
 * assertion is RELATIONAL — the defective input against a spelling the engine already reads right — so no IPA is
 * typed. Synthetic probes. Mirrored in C# (`SeaDefects1589Tests.cs`) and Rust (each language's own tests).
 */
import { describe, expect, test } from "vitest";
import { phonemize } from "../src/index.ts";

const same = (lang: string, input: string, spelled: string): void =>
    expect(phonemize(input, lang), `${lang}: ${input}`).toBe(phonemize(spelled, lang));

describe("#1589", () => {
    test("vi: a number of 10¹² or more keeps its scale word, composed on tỷ", () => {
        same("vi", "1000000000000", "một nghìn tỷ");
        same("vi", "2500000000000", "hai nghìn năm trăm tỷ");
        same("vi", "1000000005", "một tỷ không trăm linh năm"); // below 10¹², unchanged
    });

    test("lo: a grouped number ending in a decimal in the other mark is one number", () => {
        same("lo", "1,234.5", "1234.5");
        same("lo", "1.234,5", "1234,5");
    });

    test("my: the clock consumes a following hour word, drops :00, and refuses an out-of-range time", () => {
        same("my", "၉:၃၀ နာရီ", "၉:၃၀");
        same("my", "12:00", "12 နာရီ");
        same("my", "8:46 နာရီတိတိ", "8:46 နာရီ တိတိ");
        same("my", "123:45", "123 45"); // no longer "123 hours 45 minutes"
    });

    test("jv: a clock with minutes after jam has no pause, and pada marks leave single spaces", () => {
        same("jv", "jam 07.30", "jam 7 30");
        same("jv", "jam 8:46 esuk", "jam 8 46 esuk");
        same("jv", "ꦲꦏꦸ꧈ ꦲꦏꦸ꧉ ꦲꦏꦸ", "aku, aku. aku");
        expect(phonemize("ꦲꦏꦸ꧈ ꦲꦏꦸ꧉ ꦲꦏꦸ", "jv")).not.toMatch(/ {2}/);
    });

    test("su: a long decimal is one decimal, and miliar/triliun are said", () => {
        same("su", "3,14159", "3 koma 1 4 1 5 9");
        same("su", "1000000000", "samiliar");
        same("su", "1000000000000", "satriliun");
        same("su", "2500000000", "dua miliar lima ratus yuta");
    });

    test("mad: a clock with minutes, a long decimal, and no era after a currency amount", () => {
        same("mad", "jam 7.30", "jam 7 30");
        same("mad", "7.30 WIB", "7 30 WIB");
        same("mad", "3.14159", "3 koma 1 4 1 5 9");
        same("mad", "Rp 5 M", "Rp 5 m");
        const era = phonemize("Masèhi", "mad").trim();
        expect(phonemize("Rp 5 M", "mad")).not.toContain(era);
        expect(phonemize("940 M", "mad")).toContain(era); // a year still takes the era
    });
});
