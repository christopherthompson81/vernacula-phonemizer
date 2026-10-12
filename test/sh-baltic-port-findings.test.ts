/**
 * Serbian, Croatian, Bosnian, Slovenian, Lithuanian and Latvian defects the Rust port found (#1532), fixed
 * TS-first. Probe text is synthetic; the expectations are the fixed engine's output, checked against what each
 * fix intends (docs/investigations/rust-port/rust_{sr_hr_bs,sl,lt,lv}_port_investigation.md).
 */
import { describe, expect, test } from "vitest";
import { phonemize } from "../src/index.ts";
import { normalizeSerbian } from "../src/languages/serbian/normalize.ts";
import { normalizeCroatian } from "../src/languages/croatian/normalize.ts";
import { normalizeBosnian } from "../src/languages/bosnian/normalize.ts";
import { normalizeSlovenian } from "../src/languages/slovenian/normalize.ts";
import { normalizeLithuanian } from "../src/languages/lithuanian/normalize.ts";
import { normalizeLatvian } from "../src/languages/latvian/normalize.ts";

describe("Object.prototype names after an ordinal (#1532, sr hr bs lv)", () => {
    test("an inherited member is not a licensor, so the `N.` is left as written", () => {
        expect(normalizeSerbian("Bilo je 5. constructor i dalje.")).toBe("Bilo je 5. constructor i dalje.");
        expect(normalizeBosnian("U 3. i 4. constructor.")).toBe("U 3. i 4. constructor.");
        expect(normalizeBosnian("Bilo je 5. constructor i dalje.")).toBe("Bilo je 5. constructor i dalje.");
        // Croatian does not lowercase its key, so every lowercase-initial member reached it.
        expect(normalizeCroatian("Bilo je 7. hasOwnProperty i 3. toString.")).toBe("Bilo je 7. hasOwnProperty i 3. toString.");
        // Latvian drops the period before an untabulated noun and leaves the cardinal.
        expect(normalizeLatvian("Viņš bija 3. constructor.")).toBe("Viņš bija 3 constructor.");
        for (const [t, l] of [["Bilo je 5. constructor.", "sr"], ["Bilo je 7. toString.", "hr"],
            ["U 3. i 4. constructor.", "bs"], ["Viņš bija 3. constructor.", "lv"]] as const)
            expect(phonemize(t, l)).not.toContain("undefined");
    });
});

describe("Serbian dotted abbreviations (#1532)", () => {
    test("the `,;:` arm has the #1122 miss guard", () => {
        // U+1C81 folds onto д under `iu`, so the pattern matches while the table has no such key.
        expect(normalizeSerbian("Voće итᲁ., даље")).toBe("Voće итᲁ., даље");
        expect(normalizeSerbian("Voće itd., dalje")).toBe("Voće i tako dalje, dalje");
    });

    test("a capital after the dot keeps the sentence break", () => {
        expect(normalizeSerbian("Voće, povrće itd. Sutra idemo.")).toBe("Voće, povrće i tako dalje. Sutra idemo.");
        expect(normalizeSerbian("Воће итд. Сутра.")).toBe("Воће i tako dalje. Сутра.");
        expect(normalizeSerbian("Voće, povrće itd. sutra idemo.")).toBe("Voće, povrće i tako dalje sutra idemo.");
        expect(phonemize("Voće itd. Sutra idemo.", "sr")).toContain(" . ");
        expect(phonemize("Voće itd. sutra idemo.", "sr")).not.toContain(" . ");
    });
});

describe("a clock before `.` or `,` (#1532, sr hr bs)", () => {
    test("is read as a time", () => {
        expect(normalizeSerbian("Sastanak u 11:00.")).toBe("Sastanak u jedanaest sati.");
        expect(normalizeSerbian("Sastanak u 11:30, zatim ručak."))
            .toBe("Sastanak u jedanaest sati i trideset minuta, zatim ručak.");
        expect(normalizeCroatian("Sastanak u 11:00.")).toBe("Sastanak u jedanaest sati.");
        expect(normalizeBosnian("Sastanak u 11:00.")).toBe("Sastanak u jedanaest sati.");
        expect(normalizeBosnian("u 22:08 sati.")).toBe("u dvadeset dva sata i osam minuta.");
    });

    test("a digit beyond the `.`/`,` is still declined", () => {
        expect(normalizeSerbian("u 11:30,5")).toBe("u 11:30 zarez 5");
        expect(normalizeCroatian("u 11:30,5")).toBe("u 11:30 zarez 5");
        expect(normalizeSerbian("u 11:30.5")).toBe("u 11:30.5");
    });
});

describe("Croatian (#1532)", () => {
    test("a prenominal Roman ordinal takes the slot its licensor governs", () => {
        expect(normalizeCroatian("U I. stoljeću.")).toBe("U prvom stoljeću.");
        expect(normalizeCroatian("U I. svjetskom ratu.")).toBe("U prvom svjetskom ratu.");
    });

    test("a fraction's denominator is not an elided year, a season's second year is", () => {
        expect(normalizeCroatian("Vrijednost 2/1000.")).toBe("Vrijednost 2/1000.");
        expect(normalizeCroatian("u sezoni 2003./2004. kada"))
            .toBe("u sezoni dvije tisuće treće/dvije tisuće četvrte kada");
        expect(normalizeCroatian("Bilo je 1990.")).toBe("Bilo je tisuću devetsto devedesete.");
    });
});

describe("Slovenian (#1532)", () => {
    test("a list dash before a number is not a minus; an attached sign is", () => {
        expect(normalizeSlovenian("Seznam: - 5 jabolk.")).toBe("Seznam: - 5 jabolk.");
        expect(normalizeSlovenian("Temperatura je -5 stopinj.")).toBe("Temperatura je minus 5 stopinj.");
        expect(normalizeSlovenian("(-5 stopinj)")).toBe("(minus 5 stopinj)");
    });
});

describe("Lithuanian (#1532)", () => {
    test("a sentence-final `m.` keeps its full stop; mid-sentence it does not", () => {
        expect(normalizeLithuanian("Bokšto aukštis siekia 50 m.")).toBe("Bokšto aukštis siekia penkiasdešimt metų.");
        expect(normalizeLithuanian("Tai įvyko 1990 m.")).toBe("Tai įvyko tūkstantis devyni šimtai devyniasdešimt metais.");
        // A capital after the year is mostly a genitive proper noun in this corpus, not a new sentence.
        expect(normalizeLithuanian("1802 m. Vilniuje")).toBe("tūkstantis aštuoni šimtai du metais Vilniuje");
        expect(phonemize("Tai įvyko 1990 m.", "lt").endsWith(" .")).toBe(true);
    });

    test("`km/h` and `km/val.` are read, the kilometre agreeing with its figure", () => {
        expect(normalizeLithuanian("Jis bėgo 5 km/h greičiu.")).toBe("Jis bėgo penki kilometrai per valandą greičiu.");
        expect(normalizeLithuanian("Jis bėgo 21 km / h, o")).toBe("Jis bėgo dvidešimt vienas kilometras per valandą, o");
        expect(normalizeLithuanian("Greitis 2,5 km/h")).toBe("Greitis du kablelis penki kilometrų per valandą");
        expect(normalizeLithuanian("Vėjas siekė 240 km/val. greitį."))
            .toBe("Vėjas siekė du šimtai keturiasdešimt kilometrų per valandą greitį.");
        expect(normalizeLithuanian("Jis bėgo 5 km/h.")).toBe("Jis bėgo penki kilometrai per valandą.");
    });

    test("a marked clock counts its hours AND its minutes", () => {
        expect(normalizeLithuanian("Sausio 5 d. 10:30 val.")).toBe("Sausio penkios dieną dešimt valandų trisdešimt minučių.");
        expect(normalizeLithuanian("Prasidėjo 8.46 val. ryte.")).toBe("Prasidėjo aštuonios valandos keturiasdešimt šešios minutės ryte.");
        expect(normalizeLithuanian("21:21 val.")).toBe("dvidešimt viena valanda dvidešimt viena minutė.");
        expect(normalizeLithuanian("10:30 val. Kitas")).toBe("dešimt valandų trisdešimt minučių Kitas");
    });

    test("a score after `Laimėjo` is a pair, but a temporal span after it is still a span", () => {
        expect(normalizeLithuanian("Laimėjo 3–2.")).toBe("Laimėjo 3–2.");
        expect(normalizeLithuanian("Laimėjo 1990–1995 metais.")).toBe("Laimėjo 1990 iki 1995 metais.");
    });
});

describe("Latvian (#1532)", () => {
    test("a clock is read without the colon's pause", () => {
        expect(normalizeLatvian("Pulksten 10:30 sākās.")).toBe("Pulksten 10 30 sākās.");
        expect(normalizeLatvian("Sākās plkst. 7:05.")).toBe("Sākās pulksten 7 0 5.");
        expect(normalizeLatvian("plkst. 12:00 pēc")).toBe("pulksten 12 pēc");
        expect(normalizeLatvian("no 06:30 - 07:30")).toBe("no 6 30 līdz 7 30");
        expect(phonemize("Pulksten 10:30 sākās.", "lv")).not.toContain(",");
    });

    test("a score, a duration and an hour above 23 are not clocks", () => {
        expect(normalizeLatvian("rezultāts 25:00 komandai")).toBe("rezultāts 25:00 komandai");
        expect(normalizeLatvian("ar laiku 3:12.45")).toBe("ar laiku 3:12.45");
    });

    test("a non-ascending pair of small whole numbers is a score, not a range", () => {
        expect(normalizeLatvian("Rezultāts 5 - 3.")).toBe("Rezultāts 5 3.");
        expect(normalizeLatvian("Rezultāts 7–2.")).toBe("Rezultāts 7 2.");
        expect(normalizeLatvian("No 10 - 20 metriem.")).toBe("No 10 līdz 20 metriem.");
        expect(normalizeLatvian("Pirms 5,1–4,6 miljoniem."))
            .toBe("Pirms pieci komats viens līdz četri komats seši miljoniem.");
    });
});
