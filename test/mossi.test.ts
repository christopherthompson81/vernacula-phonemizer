import { describe, expect, test } from "vitest";

import { phonemizeWord, createMossi } from "../src/languages/mossi/mossi.ts";
import { numberToWords } from "../src/languages/mossi/numbers.ts";
import { normalizeMossi } from "../src/languages/mossi/normalize.ts";

// Canonical-IPA goldens for Mossi / Mooré (mos) — Niger-Congo GUR (Oti-Volta), Latin (Burkinabé) orthography,
// Hand-adjudicated against en.wiktionary Moore (Wiktionary). The greedy g2p
// + gemination is refereed by tools/referee-eval — ⚠ only 39 words, so the two residuals are referee
// artifacts (a gemination-notation inconsistency + a y/j typo), so the segmental backbone is ~100%. Signatures:
// dedicated ATR letters ⟨ɛ ɩ ʋ⟩, ⟨o⟩=o always (no ⟨ɔ⟩), DOUBLING = length, TILDE = nasal, ⟨r⟩=ɾ, ⟨y⟩=j. TONE
// (2-tone H/L) is not written in the orthography → not emitted; numbers are composed in numbers.ts.
describe("Mooré canonical IPA — greedy g2p + gemination", () => {
    test("dedicated ATR letters ⟨ɛ⟩=ɛ, ⟨ɩ⟩=ɪ, ⟨ʋ⟩=ʊ; ⟨o⟩=o always (no ɔ)", () => {
        expect(phonemizeWord("lakrɛ")).toBe("lakɾɛ"); // ⟨ɛ⟩ → ɛ
        expect(phonemizeWord("malɛka")).toBe("malɛka"); // "angel" — ⟨ɛ⟩ → ɛ
        expect(phonemizeWord("fɩnetre")).toBe("fɪnetɾe"); // ⟨ɩ⟩ → ɪ
        expect(phonemizeWord("boko")).toBe("boko"); // ⟨o⟩ → o (not ɔ)
        expect(phonemizeWord("laloa")).toBe("laloa"); // /ɔ/ is written as the hiatus ⟨oa⟩, not a letter
    });

    test("DOUBLING = LENGTH (aa→aː, ee→eː, ɛɛ→ɛː, uu→uː, ʋʋ→ʊː)", () => {
        expect(phonemizeWord("baare")).toBe("baːɾe"); // ⟨aa⟩ → aː
        expect(phonemizeWord("lɛɛre")).toBe("lɛːɾe"); // ⟨ɛɛ⟩ → ɛː
        expect(phonemizeWord("weefo")).toBe("weːfo"); // ⟨ee⟩ → eː
        expect(phonemizeWord("fulfuugu")).toBe("fulfuːɡu"); // ⟨uu⟩ → uː
        expect(phonemizeWord("faktɩʋʋre")).toBe("faktɪʊːɾe"); // ⟨ʋʋ⟩ → ʊː (long ʊ)
    });

    test("NASAL = TILDE (ã ẽ ĩ õ ũ); the nasal-long digraph ⟨ãa⟩ → ãː", () => {
        expect(phonemizeWord("burkĩna")).toBe("buɾkĩna"); // ⟨ĩ⟩ → ĩ (nasal i)
        expect(phonemizeWord("rõde")).toBe("ɾõde"); // ⟨õ⟩ → õ
        expect(phonemizeWord("esãase")).toBe("esãːse"); // ⟨ãa⟩ → ãː (nasal long a)
    });

    test("⟨r⟩=ɾ (tap), ⟨y⟩=j, ⟨g⟩=ɡ; CONSONANT GEMINATION (doubled → Cː)", () => {
        expect(phonemizeWord("zirga")).toBe("ziɾɡa"); // ⟨r⟩ → ɾ, ⟨g⟩ → ɡ
        expect(phonemizeWord("lay")).toBe("laj"); // ⟨y⟩ → j
        expect(phonemizeWord("yelle")).toBe("jelːe"); // ⟨y⟩ → j, ⟨ll⟩ → lː (geminate)
    });

    test("NASAL place assimilation: ⟨n⟩ → ŋ before a velar g/k (FSI /n/=[n,ŋ])", () => {
        expect(phonemizeWord("tenga")).toBe("teŋɡa"); // "village" — ⟨ng⟩ → ŋɡ (FSI tengá→teŋɡa)
        expect(phonemizeWord("sh")).toBe("ʃ"); // ⟨sh⟩ → ʃ (FSI /s/ allophone spelling)
    });

    test("text: words + clause punctuation (tone deferred)", () => {
        expect(createMossi().text("Burkĩna Faso. Yelle?")).toBe("buɾkĩna faso . jelːe ?");
    });

    // NUMBERS — DECIMAL. Mooré 6–9 (yoobe, yopoe, nii, wɛ) are opaque stems with no living 5+n formation, so
    // there is nothing quinary to compose; the sources call the system flatly décimal. Bespoke because of two
    // Gur features: each unit has a full and a SHORT combining stem (yembre ~ ye, yiibu ~ yi, tãabo ~ tã), and a
    // bare unit inside a compound needs the numeral particle a (piig la a ye 11) while a tens phrase takes la
    // alone. Tens/hundreds/thousands are the noun-class PLURALS piiga→pisi/pis, koabga→kobs, tusri→tus.
    // Sources: desmotsetdeslangues.eklablog.com/moore, Peace Corps/Burkina Faso "Introduction to Mooré" (2006),
    // Lexique français-mooré (zaalem 'zero'). See src/languages/mossi/numbers.ts.
    test("numbers: units, piig la a teens, pis- tens, la a compounds", () => {
        expect(numberToWords(0)).toBe("zaalem");
        expect(numberToWords(7)).toBe("yopoe");
        expect(numberToWords(10)).toBe("piiga");
        expect(numberToWords(11)).toBe("piig la a ye"); // combining piig + la + particle a + SHORT stem
        expect(numberToWords(20)).toBe("pisi"); // the plural of piiga
        expect(numberToWords(21)).toBe("pisi la a ye");
        expect(numberToWords(42)).toBe("pis naase la a yi");
        expect(numberToWords(99)).toBe("pis wɛ la a wɛ");
    });

    test("numbers: koabga hundreds, tusri thousands; ≥ 10⁶ falls back to digit-by-digit", () => {
        expect(numberToWords(100)).toBe("koabga"); // singular; 200 takes the plural stem kobs
        expect(numberToWords(101)).toBe("koabga la a ye");
        expect(numberToWords(555)).toBe("kobs a nu la pis nu la a nu");
        expect(numberToWords(1000)).toBe("tusri");
        expect(numberToWords(12345)).toBe("tus piig la a yi la kobs a tã la pis naase la a nu");
    });

    // ⚠ THIS GOLDEN CHANGED. It used to assert that 10⁶ read digit-by-digit ("yembre zaalem zaalem …"), on
    // the stated ground that no Mooré numeral above tusri was attested in any source consulted. The
    // mos.wikipedia dump, filtered to Mooré paragraphs, refutes that: `milyõ` ×219 and `milyaar` ×51 are
    // ordinary running vocabulary, and the corpus supplies the syntax too — `milyõ a ye`, `milyõ a yopoe`,
    // `milyaar a ye` below ten, `milyõ 37` and `milyaar 128` above it, which is the same particle-plus-SHORT
    // stem compound as `tus a yi` and `kobs a nu`. Neither word alternates for number, so 1 million is
    // `milyõ a ye` and not a bare singular. See src/languages/mossi/numbers.ts.
    // Pinned per BRANCH rather than per corpus instance (playbook trap 13): the under-ten particle branch,
    // the ten-and-above composed branch, the remainder join, and the boundary above which nothing is attested.
    test("numbers: milyõ 10⁶ / milyaar 10⁹; ≥ 10¹² falls back to digit-by-digit", () => {
        expect(numberToWords(1_000_000)).toBe("milyõ a ye"); // no bare singular — the particle is obligatory
        expect(numberToWords(7_000_000)).toBe("milyõ a yopoe"); // corpus: `ligd milyõ a yopoe`
        expect(numberToWords(37_000_000)).toBe("milyõ pis tã la a yopoe"); // ≥10 multiplier → composed figure
        expect(numberToWords(1_000_000_000)).toBe("milyaar a ye");
        expect(numberToWords(1_001_000_000)).toBe("milyaar a ye la milyõ a ye"); // both scales in one figure
        expect(numberToWords(19_811_000)).toBe("milyõ piig la a wɛ la tus kobs a nii la piig la a ye");
        // Nothing above milyaar is attested, so 10¹² still reads its digits rather than inventing a word.
        expect(numberToWords(1e12)).toBe("yembre zaalem zaalem zaalem zaalem zaalem zaalem zaalem zaalem zaalem zaalem zaalem zaalem");
    });

    test("numbers: end-to-end through the g2p (text path)", () => {
        expect(createMossi().text("20")).toBe("pisi");
        expect(createMossi().text("1000")).toBe("tusɾi"); // ⟨r⟩ → the tap ɾ
    });
});

// TEXT NORMALIZATION (src/languages/mossi/normalize.ts). ⚠ There is no FLEURS for Mooré, no kaikki and no
// wikipron, and espeak does not ship the language, so the 39-word wiktionary referee is a TRIPWIRE for the
// word path and can arbitrate none of this. The evidence is the mos.wikipedia dump — 12,650 paragraphs —
// filtered to Mooré with `filter-by-language.py --lang mos`, because 11.6% of that wiki is English.
// Full log: docs/investigations/mos_normalization_investigation.md.
describe("Mooré text normalization — de-grouping and the two sourceable currency signs", () => {
    const say = (s: string): string => createMossi().text(s);

    // The pass asserted at its own layer as well as through the phonemizer: this is pure text→text, so the
    // rewrite is readable on its own and a failure here localises to the rule rather than to the g2p.
    test("normalizeMossi is a pure text→text rewrite", () => {
        expect(normalizeMossi("vote 21,552 tɩ")).toBe("vote 21552 tɩ");
        expect(normalizeMossi("koees 15.043")).toBe("koees 15043");
        expect(normalizeMossi("doolaar 100 000")).toBe("doolaar 100000");
        expect(normalizeMossi("€10,000 la $5")).toBe("Ero 10000 la doolaar 5");
        expect(normalizeMossi("29.6 la 53,6")).toBe("29.6 la 53,6"); // decimals: untouched, no word to use
        expect(normalizeMossi("£50,000")).toBe("£50000"); // de-grouped; the unsourceable sign left alone
    });

    // The layer's largest fix, and the only one needing no vocabulary at all: a grouping separator was
    // being read as CLAUSE PUNCTUATION, dropping a pause into the middle of one figure. ~983 instances.
    // The role is decided by the DIGIT COUNT after the mark — 3 is a group, 1–2 is a decimal — which is
    // how the corpus itself uses both marks for both roles (comma groups ×698 / comma decimals ×365;
    // period groups ×61 / period decimals ×1,050).
    test("de-groups a comma-, period- and space-separated thousands figure", () => {
        expect(say("vote 21,552")).toBe("vote tus pisi la a je la kobs a nu la pis nu la a ji");
        expect(say("koees 15.043")).toBe("koeːs tus piːɡ la a nu la pis naːse la a tã");
        expect(say("doolaar 100 000")).toBe("doːlaːɾ tus koabɡa");
        // ⟨y⟩ → j and ⟨õ⟩ stays nasal, so the milyõ of numbers.ts surfaces as *miljõ* through the g2p.
        expect(say("1,234,567")).toBe("miljõ a je la tus kobs a ji la pis tã la a naːse la kobs a nu la pis joːbe la a jopoe");
    });

    // ⚠ THE ADVERSARIAL NEIGHBOURS (trap 8): every one of these is a shape the rule must NOT claim, and each
    // is attested in this corpus. 1–2 digits after the mark is the DECIMAL and keeps its current reading,
    // because no decimal-point word is sourceable for Mooré (see normalize.ts's header).
    test("leaves decimals, comma lists, DOIs and version dots exactly where they were", () => {
        expect(say("29.6")).toBe("pisi la a wɛ . joːbe"); // period decimal — 1 digit, untouched
        expect(say("53,6")).toBe("pis nu la a tã , joːbe"); // comma decimal — the French convention
        expect(say("(1,5,13)")).toBe("jembɾe , nu , piːɡ la a tã"); // a LIST of small numbers, not a group
        expect(say("802.11n")).toBe("kobs a niː la a ji . piːɡ la a je n"); // version dot — 2 digits
    });

    // Sentence periods must survive, which is the whole reason no abbreviation rule exists here: the
    // artifact's `abbrev` cell (×6,148) is ordinary Mooré words before a full stop — `wã.` ×4,316,
    // `ye.` ×2,660, `pʋgẽ.` ×1,962 — and claiming them would delete ~6,000 real pauses.
    test("does not touch a sentence-final period", () => {
        expect(say("Yʋʋm 2006 wã. Yaa sõma ye.")).toBe("jʊːm tus a ji la a joːbe wã . jaː sõma je .");
    });

    // The currency NOUN precedes the figure in Mooré, so the rule reorders — the shared tier can only
    // postpose. `Ero` is glossed against its own sign in the corpus (`Ero wã milyo a naase(€4 million)`);
    // `doolaar` is ×8 across 7 articles, always in this slot. ⚠ `£` is DECLINED and stays silent: it is the
    // corpus's most frequent sign (×18) and no Mooré word for the pound is attested anywhere.
    test("reads € and $ as preposed nouns, and leaves the unsourceable £ unread", () => {
        expect(say("€10,000")).toBe("eɾo tus piːɡa");
        expect(say("$5")).toBe("doːlaːɾ nu");
        expect(say("£50,000")).toBe("tus pis nu"); // de-grouped, sign correctly still silent
    });
});
