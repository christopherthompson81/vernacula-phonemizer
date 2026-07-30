import { describe, expect, it } from "vitest";
import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/turkish/turkish.ts";
import { ordinalWords } from "../src/languages/turkish/normalize.ts";

describe("Turkish g2p (segmental)", () => {
    it("vowels, palatalization, dark-l, ğ", () => {
        const cases: [string, string][] = [
            ["merhaba", "mˈeɾhaba"],
            ["türkiye", "tˈyɾcije"], // ü→y, k→c before front i
            ["güzel", "ɟyzˈel"], // g→ɟ before front ü
            ["okul", "okˈuɫ"], // dark l after back u
            ["dil", "dˈil"], // clear l after front i
            ["çocuk", "t͡ʃod͡ʒˈuk"],
            ["dağ", "dˈaː"], // ğ lengthens
            ["değil", "dejˈil"], // ğ→j between front vowels
            ["düğün", "dˈyːn"], // ğ merges identical ü
            ["asker", "ascˈeɾ"], // k→c after consonant before front e
            ["teşekkür", "teʃecːˈyɾ"], // doubled stop → geminate ː; palatal cː between front e…ü
            ["anne", "annˈe"], // doubled sonorant stays double
            ["İzmir", "ˈizmiɾ"], // İ→i locale fold (+ lexicon stress)
        ];
        for (const [w, exp] of cases) expect(phonemizeWord(w)).toBe(exp);
    });

    it("pre-accenting suffixes → stress before the suffix", () => {
        expect(phonemizeWord("geliyor")).toBe("ɟelˈijoɾ"); // -Iyor progressive
        expect(phonemizeWord("istiyorum")).toBe("istˈijoɾum");
        expect(phonemizeWord("giderken")).toBe("ɟidˈeɾcen"); // -ken
        expect(phonemizeWord("benimle")).toBe("benˈimle"); // -lA instrumental
        expect(phonemizeWord("kaybetme")).toBe("kajbˈetme"); // -mA negation/verbal-noun
        expect(phonemizeWord("güzeldir")).toBe("ɟyzˈeldiɾ"); // -DIr copula
        expect(phonemizeWord("evdeyim")).toBe("evdˈejim"); // predicative person ending
    });

    it("conditional -sA is pre-accenting", () => {
        expect(phonemizeWord("olsa")).toBe("ˈoɫsa");
        expect(phonemizeWord("varsa")).toBe("vˈaɾsa");
    });

    it("no false positives: plain final-stress words stay final", () => {
        expect(phonemizeWord("kitap")).toBe("citˈap");
        expect(phonemizeWord("araba")).toBe("aɾabˈa");
        expect(phonemizeWord("olsun")).toBe("oɫsˈun"); // imperative -sIn, NOT pre-accenting (bare -sIn excluded)
        expect(phonemizeWord("arasında")).toBe("aɾasɯndˈa"); // possessive+locative -sInDA, not person -sIn
    });

    it("numbers", () => {
        expect(phonemize("0", "tr")).toBe("sɯfˈɯɾ");
        expect(phonemize("42", "tr")).toBe("kˈɯɾk icˈi");
        expect(phonemize("1985", "tr")).toBe("bˈin dokˈuz jˈyz secsˈen bˈeʃ"); // seksen: coda k→c after front e (referee: secsen)
    });
});

// #562 TEXT NORMALIZATION. Counts in the comments are over the 1,876 unique tr_tr FLEURS utterances
// (column 3, the cased one); see src/languages/turkish/normalize.ts for the full tabulation.
describe("Turkish text normalization (#562)", () => {
    it("ordinal builder: the -(I)ncI suffix under four-way harmony, dört the sole irregular stem", () => {
        const cases: [number, string][] = [
            [1, "birinci"], [2, "ikinci"], [3, "üçüncü"], [4, "dördüncü"], [5, "beşinci"],
            [6, "altıncı"], [7, "yedinci"], [8, "sekizinci"], [9, "dokuzuncu"], [10, "onuncu"],
            [15, "on beşinci"], [20, "yirminci"], [40, "kırkıncı"], [60, "altmışıncı"],
            [90, "doksanıncı"], [100, "yüzüncü"], [190, "yüz doksanıncı"],
            [247, "iki yüz kırk yedinci"], [1000, "bininci"],
        ];
        for (const [n, exp] of cases) expect(ordinalWords(n)).toBe(exp);
    });

    it("bare `N.` is an ordinal when a token follows — 41 of 42 corpus instances", () => {
        // Was: `ˈon secˈiz . jyzjˈɯɫ` — a cardinal plus a spurious PHRASE BREAK.
        expect(phonemize("18. yüzyıl", "tr")).toBe("ˈon secizind͡ʒˈi jyzjˈɯɫ");
        expect(phonemize("1. Dünya Savaşı", "tr")).toBe("biɾind͡ʒˈi dˈynja savaʃˈɯ");
        expect(phonemize("247. Maddesine", "tr")).toBe("icˈi jˈyz kˈɯɾk jedind͡ʒˈi madːesinˈe");
    });

    it("…and a SENTENCE-FINAL `N.` keeps its pause — the 42nd instance, `rekoru 7-2.`", () => {
        expect(phonemize("rekoru 7-2.", "tr")).toBe("ɾekoɾˈu jedˈi icˈi .");
        // The thousands dot and the 802.11 code must not be read as ordinals either.
        expect(phonemize("1.234 kişi", "tr")).toBe("bˈin icˈi jˈyz otˈuz dˈøɾt ciʃˈi");
    });

    it("apostrophe suffix on a numeral joins the last spoken word — ×115", () => {
        // Was: `… bˈeʃ tˈe` — the suffix split off as its own stressed word.
        expect(phonemize("1985'te", "tr")).toBe("bˈin dokˈuz jˈyz secsˈen beʃtˈe");
        expect(phonemize("2020’ye", "tr")).toBe("icˈi bˈin jiɾmijˈe"); // the curly apostrophe too
        expect(phonemize("1970'lerin", "tr")).toBe("bˈin dokˈuz jˈyz jetmiʃleɾˈin");
        expect(phonemize("36'sı", "tr")).toBe("otˈuz aɫtɯsˈɯ");
        expect(phonemize("34'ü", "tr")).toBe("otˈuz døɾdˈy"); // final-stop voicing: dört → dörd-
    });

    it("clock: the colon was a COMMA PAUSE inside the time — ×9 colon, ×4 dot", () => {
        expect(phonemize("saat 11:35'te", "tr")).toBe("saˈat ˈon bˈiɾ otˈuz beʃtˈe");
        expect(phonemize("07:19", "tr")).toBe("jedˈi ˈon dokˈuz");
        expect(phonemize("saat 11:00 civarında", "tr")).toBe("saˈat ˈon bˈiɾ d͡ʒivaɾɯndˈa"); // :00 dropped
        expect(phonemize("bugün 12.00 sularında", "tr")).toBe("bˈuɟyn ˈon icˈi suɫaɾɯndˈa");
    });

    it("percent stays a PREFIX and composes with the apostrophe suffix — ×4 sign, ×23 word", () => {
        expect(phonemize("%40", "tr")).toBe("jyzdˈe kˈɯɾk");
        expect(phonemize("40%", "tr")).toBe("jyzdˈe kˈɯɾk"); // either side → prefix order
        expect(phonemize("%80'ini", "tr")).toBe("jyzdˈe secseninˈi");
    });

    it("era markers and dotted abbreviations do not leave the dot as a phrase break", () => {
        expect(phonemize("MÖ 10. yüzyılda", "tr")).toBe("miɫatːˈan ønd͡ʒˈe onund͡ʒˈu jyzjɯɫdˈa");
        expect(phonemize("M.Ö. 323'te", "tr")).toBe("miɫatːˈan ønd͡ʒˈe ˈyt͡ʃ jˈyz jiɾmˈi yt͡ʃtˈe");
        expect(phonemize("peynir vb. lezzet", "tr")).toBe("pejnˈiɾ vˈe benzeɾˈi lezzˈet");
        expect(phonemize("Dr. Ahmet", "tr")).toBe("doktˈoɾ ahmˈet");
        // MS is only the era before a NUMBER — 2 of its 3 corpus occurrences are multiple sclerosis.
        expect(phonemize("MS 400", "tr")).toBe("miɫatːˈan sonɾˈa dˈøɾt jˈyz");
        expect(phonemize("MS hastalığı", "tr")).toBe("mˈe sˈe hastaɫɯːˈɯ");
    });

    it("initialisms: a vowelless or illegal-cluster letter run is spelled with TDK letter names", () => {
        expect(phonemize("ABD raporu", "tr")).toBe("ˈa bˈe dˈe ɾapoɾˈu"); // ×31; was ˈabd
        expect(phonemize("BM uzmanı", "tr")).toBe("bˈe mˈe uzmanˈɯ"); // ×5; was bm
        expect(phonemize("FBI'ın uyarısı", "tr")).toBe("fˈe bˈe ˈi ˈɯn ujaɾɯsˈɯ");
        expect(phonemize("GPS uygulaması", "tr")).toBe("ɟˈe pˈe sˈe ujɡuɫamasˈɯ");
        // Syllabifiable runs are left to the OOV g2p, which already reads them as words (I→ı is the
        // Turkish-locale lowercase fold, so FIFA is read as *fıfa* — a g2p matter, not this layer's).
        expect(phonemize("FIFA turnuvası", "tr")).toBe("fɯfˈa tuɾnuvasˈɯ");
    });

    it("units, degrees and signs", () => {
        expect(phonemize("70 km yol", "tr")).toBe("jetmˈiʃ ciɫometɾˈe jˈoɫ");
        expect(phonemize("4892 m", "tr")).toBe("dˈøɾt bˈin secˈiz jˈyz doksˈan icˈi mˈetɾe");
        expect(phonemize("165 km/s rüzgar", "tr")).toBe("saatːˈe jˈyz aɫtmˈɯʃ bˈeʃ ciɫometɾˈe ɾyzɡˈaɾ");
        expect(phonemize("30°C", "tr")).toBe("otˈuz deɾed͡ʒˈe"); // was otˈuz d͡ʒ — ° dropped, C read as Turkish c
        expect(phonemize("UTC+1", "tr")).toBe("ˈu tˈe d͡ʒˈe aɾtˈɯ bˈiɾ");
    });
});
