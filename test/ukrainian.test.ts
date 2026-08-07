import { describe, expect, test } from "vitest";

import { ROMAN_POLICY } from "../src/languages/ukrainian/romanOrdinals.ts";
import { normalizeUkrainian } from "../src/languages/ukrainian/normalize.ts";
import { phonemizeWord } from "../src/languages/ukrainian/ukrainian.ts";
import { getPhonemizer } from "../src/registry.ts";

// Canonical-IPA goldens for Ukrainian / українська (uk) — East Slavic, Cyrillic. Ukrainian has NO vowel
// reduction, so the g2p is a flat scan (no stress dictionary). Signatures: г→[ɦ] (vs Russian ɡ), dark л→[ɫ], в
// as /w/ with allophony ([w] before о/у + coda, [ʋ] before а/е/и, [ʋʲ] before і), PALATALISATION (Cʲ before ь/і/
// iotated) + REGRESSIVE palatalisation (a coronal before a palatalised consonant). Validated at 95.1% vs
// wikipron ukr_cyrl narrow (50k, human).
describe("Ukrainian canonical IPA", () => {
    test("г→ɦ (the Ukrainian hallmark), dark л→ɫ, palatalisation", () => {
        expect(phonemizeWord("голова")).toBe("ɦɔɫɔʋa"); // г→ɦ, dark ɫ, medial в→ʋ
        expect(phonemizeWord("день")).toBe("dɛnʲ"); // soft sign → nʲ
        expect(phonemizeWord("місто")).toBe("mʲistɔ"); // і palatalises м; о stays ɔ (no reduction)
    });

    test("в-allophony: [w] before о/у + coda, [ʋ] before а/е/и", () => {
        expect(phonemizeWord("вода")).toBe("wɔda"); // в before о → w
        expect(phonemizeWord("слово")).toBe("sɫɔwɔ"); // в before о → w (medial)
        expect(phonemizeWord("мова")).toBe("mɔʋa"); // в before а → ʋ
    });

    test("regressive palatalisation + palatalised geminates", () => {
        expect(phonemizeWord("Дніпро")).toBe("dʲnʲiprɔ"); // д before нʲ → dʲ (regressive)
        expect(phonemizeWord("Буття")).toBe("butʲːa"); // тть → geminate palatalised tʲː
    });

    test("iotated vowels (є→jɛ initial, palatalising after a consonant)", () => {
        expect(phonemizeWord("Європа")).toBe("jɛu̯rɔpa"); // Є initial → jɛ; в post-vocalic coda → [u̯]
        expect(phonemizeWord("сім'я")).toBe("sʲimja"); // apostrophe → no palatalisation, я → ja
    });

    test("numbers compose (Slavic decimal)", () => {
        expect(getPhonemizer("uk").text("100").trim()).toBe("stɔ"); // сто
        expect(getPhonemizer("uk").text("1000").trim()).toBe("tɪsʲat͡ʃa"); // тисяча — bare (no leading "один")
        expect(getPhonemizer("uk").text("2").trim()).toBe("dʋa"); // два
    });

    // MAGNITUDE-NOUN AGREEMENT (src/languages/ukrainian/numbers.ts). тисяча is a FEMININE noun, so the
    // multiplier must be feminine (дві, одна — not два, один), and the noun itself inflects for the count:
    // nom.sg after …1, nom.pl after …2–4, gen.pl after 5+/11–14. мільйон is masculine and keeps два.
    test("numbers: gender + count agreement on the magnitude nouns", () => {
        const uk = getPhonemizer("uk");
        expect(uk.text("1000").trim()).toBe("tɪsʲat͡ʃa"); // тисяча
        expect(uk.text("2000").trim()).toBe("dʲʋʲi tɪsʲat͡ʃʲi"); // дві тисячі — FEM two + nom.pl (not *два тисяча)
        expect(uk.text("5000").trim()).toBe("pjatʲ tɪsʲat͡ʃ"); // п'ять тисяч — gen.pl after 5
        expect(uk.text("21000").trim()).toBe("dʋadʲt͡sʲatʲ ɔdna tɪsʲat͡ʃa"); // двадцять одна тисяча — …1 → fem sg
        expect(uk.text("1000000").trim()).toBe("ɔdɪn mʲilʲjɔn"); // один мільйон — masc, multiplier KEPT
        expect(uk.text("2000000").trim()).toBe("dʋa mʲilʲjɔnɪ"); // два мільйони — nom.pl (not *два мільйон)
    });
});

// Roman-numeral ORDINAL policy (src/languages/ukrainian/romanOrdinals.ts). Ukrainian reads a century as an
// ordinal — XII століття → дванадцяте століття — and the century noun is NEUTER (століття/сторіччя), so the
// table is neuter -е, not the masculine -ий Russian and Polish need. вік is excluded from the context on
// purpose: a masculine head cannot take this table.
describe("Ukrainian roman-numeral ordinals", () => {
    const ord = (n: number): string | undefined => ROMAN_POLICY.ordinal?.(n);

    test("neuter ordinal words; only the last element inflects above 20", () => {
        expect(ord(1)).toBe("перше");
        expect(ord(12)).toBe("дванадцяте");
        expect(ord(19)).toBe("дев'ятнадцяте");
        expect(ord(21)).toBe("двадцять перше"); // cardinal tens + neuter ordinal unit
        expect(ord(40)).toBe("сорокове"); // own stem
        expect(ord(50)).toBe("п'ятдесяте");
        expect(ord(63)).toBe("шістдесят третє"); // past 50 — anniversary / congress range
        expect(ord(100)).toBe("соте");
        expect(ord(101)).toBeUndefined(); // out of range → the caller falls back to the cardinal
    });

    test("context matches the inflected century forms, but NOT masculine вік", () => {
        for (const w of ["століття", "столітті", "століттю", "століттям", "століть", "сторіччя", "сторіч", "річниця"])
            expect(ROMAN_POLICY.ordinalAfter?.test(w)).toBe(true);
        expect(ROMAN_POLICY.ordinalAfter?.test("вік")).toBe(false);
        expect(ROMAN_POLICY.ordinalAfter?.test("віку")).toBe(false);
    });

    test("the ordinal reading phonemizes in context", () => {
        expect(getPhonemizer("uk").text("дванадцяте століття").trim()).toBe("dʋanadʲt͡sʲatɛ stɔlʲitʲːa");
        expect(getPhonemizer("uk").text("двадцяте сторіччя").trim()).toBe("dʋadʲt͡sʲatɛ stɔrʲit͡ʃt͡ʃʲa");
    });

    test("a bare roman numeral still reads as a CARDINAL", () => {
        expect(getPhonemizer("uk").text("xii").trim()).toBe("dʋanadʲt͡sʲatʲ"); // дванадцять, not дванадцяте
        expect(getPhonemizer("uk").text("xx вік").trim()).toBe("dʋadʲt͡sʲatʲ ʋʲik"); // masculine head → cardinal
    });
});

// TEXT NORMALIZATION. Asserted on the normalize.ts text→text output where the point is the WORDS
// (a wrong word is the failure mode this layer has), and through `phonemize` where the point is that the
// pipeline downstream actually speaks them. Counts in the comments are from the uk_ua FLEURS corpus
// (1,925 unique utterances, column 3).
describe("Ukrainian text normalization", () => {
    const uk = (s: string): string => getPhonemizer("uk").text(s).trim();

    test("space-grouped thousands are de-grouped first (×20)", () => {
        // The number token cannot span a space, so `100 000` used to read as *сто нуль*.
        expect(normalizeUkrainian("приблизно 100 000 людей")).toBe("приблизно 100000 людей");
        expect(normalizeUkrainian("5 000 000 відвідувачів")).toBe("5000000 відвідувачів"); // two passes
        // The two comma-grouped instances are a mile conversion; a comma with 1–2 digits stays a DECIMAL.
        expect(normalizeUkrainian("Амазонки — 6,387 км")).toBe("Амазонки — 6387 км");
        expect(normalizeUkrainian("зі швидкістю 1,5 кілометра")).toBe("зі швидкістю 1,5 кілометра");
    });

    test("decimal comma reads as кома, not as a phrase break (×14)", () => {
        expect(uk("1,5 мільйона")).toBe("ɔdɪn kɔma pjatʲ mʲilʲjɔna");
        expect(uk("6,34 дюйма")).toBe("ʃʲisʲtʲ kɔma trɪ t͡ʃɔtɪrɪ dʲui̯ma"); // fraction read digit by digit
    });

    test("ORDINAL notation: the suffix is the case ending, not an appendable marker (×30)", () => {
        // Each of these used to speak the suffix letter as a bare consonant: `1-й` → […ɔdɪn i̯].
        expect(normalizeUkrainian("1-й полк")).toBe("перший полк");
        expect(normalizeUkrainian("3-й полк")).toBe("третій полк"); // the one SOFT stem
        expect(normalizeUkrainian("1-го січня")).toBe("першого січня");
        expect(normalizeUkrainian("15-му столітті")).toBe("п'ятнадцятому столітті");
        expect(normalizeUkrainian("7-м за величиною")).toBe("сьомим за величиною"); // -м is instrumental
        expect(normalizeUkrainian("37-е місце")).toBe("тридцять сьоме місце");
        expect(normalizeUkrainian("190-те місце")).toBe("сто дев'яносте місце");
        // Only the LAST element inflects; the head is the plain cardinal.
        expect(normalizeUkrainian("у 1970-х роках")).toBe("у тисяча дев'ятсот сімдесятих роках");
        expect(normalizeUkrainian("з 1800-х років")).toBe("з тисяча восьмисотих років");
        expect(normalizeUkrainian("1810-го")).toBe("тисяча вісімсот десятого");
        expect(normalizeUkrainian("у 2000-му році")).toBe("у двохтисячному році"); // round thousand
        expect(normalizeUkrainian("1000-ю маркою")).toBe("тисячною маркою"); // feminine instrumental
    });

    test("the same notation writes an oblique CARDINAL, told apart by suffix and roundness (×6)", () => {
        expect(normalizeUkrainian("останніх 3-х десятиліть")).toBe("останніх трьох десятиліть");
        expect(normalizeUkrainian("у віці 54-х років")).toBe("у віці п'ятдесяти чотирьох років");
        expect(normalizeUkrainian("з його 78-ми порад")).toBe("з його сімдесяти восьми порад");
        expect(normalizeUkrainian("близько 20-ти років")).toBe("близько двадцяти років"); // -ти ⇒ cardinal
        // `-х` on a round year is the DECADE ordinal, on a small number the cardinal — see above.
        expect(normalizeUkrainian("від 3-х до 5-ти")).toBe("від трьох до п'яти");
    });

    test("compound numeral+adjective is deliberately NOT claimed (×17)", () => {
        // Reading these needs the combining stem (двадцятивосьмирічний), which this layer does not have.
        for (const s of ["28-річний Відаль", "1600-кілометровий маршрут", "25-хвилинну зустріч",
            "24-годинною мережею", "100-метрове судно"])
            expect(normalizeUkrainian(s)).toBe(s);
    });

    test("a numeral followed by a period is NEVER an ordinal here — all 20 are sentence ends", () => {
        // German/Turkish/Polish each derived a bare-`N.` rule; the uk_ua tabulation forbids one.
        expect(normalizeUkrainian("столицею Самоа з 1959.")).toBe("столицею Самоа з 1959.");
        expect(normalizeUkrainian("рахунком 5:3.")).toBe("рахунком 5:3."); // single-digit minutes ⇒ no clock
        expect(uk("з 1959.").endsWith(".")).toBe(true); // the sentence-final pause survives
    });

    test("clock: a feminine ordinal in the case the preposition governs (×18)", () => {
        expect(normalizeUkrainian("о 20:30")).toBe("о двадцятій 30"); // locative
        expect(normalizeUkrainian("Об 11:20")).toBe("Об одинадцятій 20");
        expect(normalizeUkrainian("з 06:30 до 07:30")).toBe("з шостої 30 до сьомої 30"); // genitive
        expect(normalizeUkrainian("Між 22:00 та 23:00")).toBe("Між двадцять другою та двадцять третя"); // instr
        expect(normalizeUkrainian("о 12:00 GMT")).toBe("о дванадцятій GMT"); // :00 ⇒ hour alone
        expect(normalizeUkrainian("Рівно о 8:46 ранку")).toBe("Рівно о восьмій 46 ранку");
    });

    test("units: Cyrillic abbreviations, rates, exponents and the кв. square (×35)", () => {
        expect(uk("120 км")).toBe("stɔ dʋadʲt͡sʲatʲ kʲiɫɔmɛtʲrʲiu̯");
        expect(uk("11 км/год")).toBe("ɔdɪnadʲt͡sʲatʲ kʲiɫɔmɛtʲrʲiu̯ na ɦɔdɪnu"); // was: [km ɦɔd]
        expect(uk("133 м/с")).toBe("stɔ trɪdʲt͡sʲatʲ trɪ mɛtrɪ na sɛkundu");
        expect(normalizeUkrainian("35-40 миль/год")).toBe("35 до 40 миль на годину"); // spelled numerator
        expect(normalizeUkrainian("783 562 кв. км")).toBe("783562 км²"); // folded onto the shared seam
        expect(normalizeUkrainian("9 174 кв. миль")).toBe("9174 квадратних миль");
        expect(uk("3 850 км²")).toBe("trɪ tɪsʲat͡ʃʲi ʋʲisʲimsɔt pjatdɛsʲat kʋadratnɪx kʲiɫɔmɛtʲrʲiu̯");
        // `м` is NOT a shared unit key — the tier's guard would let `41 м'яч` become *метр'яч*.
        expect(normalizeUkrainian("100 м та 200 м")).toBe("100 метрів та 200 метрів");
        expect(normalizeUkrainian("за 41 м'яч")).toBe("за 41 м'яч");
    });

    test("percent, № and the signs, each of which was dropped outright", () => {
        expect(normalizeUkrainian("реактори № 1")).toBe("реактори номер 1");
        expect(normalizeUkrainian('"космонавт №11"')).toBe('"космонавт номер 11"');
        expect(normalizeUkrainian("+30°C")).toBe("плюс 30 градусів Цельсія"); // C was the ENGLISH letter
        // Three-way agreement through the shared tier: 31 відсоток / 88 відсотків.
        expect(uk("31%").endsWith("ʋʲidsɔtɔk")).toBe(true);
        expect(uk("88%").endsWith("ʋʲidsɔtʲkʲiu̯")).toBe(true);
        expect(uk("3 %").endsWith("ʋʲidsɔtkɪ")).toBe(true); // paucal
    });

    test("abbreviations: the dot is consumed mid-sentence and KEPT at a sentence end", () => {
        expect(normalizeUkrainian("356 р. до н. е. внаслідок")).toBe("356 року до нашої ери внаслідок");
        expect(normalizeUkrainian("до 1100 року н. е.")).toBe("до 1100 року нашої ери.");
        expect(normalizeUkrainian("(1989 р., стор. 109)")).toBe("(1989 року, сторінка 109)");
        expect(normalizeUkrainian("(див. нижче)")).toBe("(дивись нижче)");
        expect(normalizeUkrainian("та ін.")).toBe("та інше.");
        expect(normalizeUkrainian("полювання і т. п., тримаючи")).toBe("полювання і тому подібне, тримаючи");
    });

    test("ranges: the dash was dropped outright, fusing the endpoints (×19)", () => {
        expect(normalizeUkrainian("(1644-1912)")).toBe("(1644 до 1912)");
        expect(normalizeUkrainian("вкрите 2-3 км льоду")).toBe("вкрите 2 до 3 км льоду");
        expect(normalizeUkrainian("COVID-19")).toBe("COVID-19"); // digits required on BOTH sides
    });

    test("initialisms: `\\b` finds no Cyrillic boundary, so this was a total no-op (×123)", () => {
        expect(uk("США")).toBe("ɛs ʃa a"); // was the cluster [sʃa]
        expect(uk("ДНК")).toBe("dɛ ɛn ka");
        expect(uk("ВВП")).toBe("ʋɛ ʋɛ pɛ");
        expect(uk("ШІ")).toBe("ʃa i"); // readable but spelled ⇒ listed in the manifest
        // Readable AND said as words — left alone by the OOV rule, and deliberately not listed.
        expect(uk("ООН")).toBe("ɔɔn");
        expect(uk("ЗМІ")).toBe("zʲmʲi");
        expect(uk("ЮНЕСКО")).toBe("junɛskɔ");
    });

    test("fractions read as a feminine ordinal, agreeing with the elided частина", () => {
        expect(normalizeUkrainian("(1/5 дюйма)")).toBe("(одна п'ята дюйма)");
    });

    // the BARE METRE, both spellings. It had been excluded for the apostrophe in `41 м’яч` ("41
    // balls"), where a short key could bite into the next word — but the tier's trailing guard rejects
    // `'’ʼ` explicitly, so that string is safe and the exclusion was obsolete. Verified below.
    test("the bare metre, both spellings, and the apostrophe that kept it out", () => {
        expect(getPhonemizer("uk").text("120 m³").trim()).toContain("kubʲit͡ʃnɪx mɛtʲrʲiu̯");
        expect(getPhonemizer("uk").text("120 м³").trim()).toContain("kubʲit͡ʃnɪx mɛtʲrʲiu̯");
        expect(getPhonemizer("uk").text("41 м’яч").trim()).toContain("mjat͡ʃ"); // one word, not "41 metres" + яч
    });
});
