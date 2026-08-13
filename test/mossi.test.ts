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

    // ⚠ THE KILOMETRE, AND THE UNIT NOUN COMES FIRST — the same head-initial order the currency rule found,
    // reached independently. `kilometr` is attested ×31 across 20 articles and the corpus GLOSSES IT AGAINST
    // THE SYMBOL in two unrelated articles (`kilometr a yiibu (2 km)`, `kilometr ramba koabga (62 mi)`),
    // which is the evidence that settled `Ero` for the euro. The position is measured, not assumed: the wiki
    // writes both orders, but restricted to instances where the numeral is SPELLED OUT IN MOORÉ — the spoken
    // form, which is the only form this layer's output has to match — it is 11 preposed to 1.
    test("reads km as the preposed noun `kilometr`, whichever side the symbol was written on", () => {
        expect(normalizeMossi("10 km")).toBe("kilometr 10");
        expect(normalizeMossi("140 km (87 mi)")).toBe("kilometr 140 (87 mi)");
        expect(normalizeMossi("100km (62mi)")).toBe("kilometr 100 (62mi)"); // glued
        expect(say("10 km")).toBe("kilometɾ piːɡa");
        // ⚠ AND THE OTHER ARM: the corpus already writes the SYMBOL in front of its own figure — `km 2,04`,
        // `km2 77.0`, and the marathon splits `zoe km 10 … km 15 … km 30`. Writers reaching for the symbol
        // still put the unit where Mooré puts the noun, which is the independent corroboration of the order.
        // Here the figure never moves; only the symbol is swapped.
        expect(normalizeMossi("a zoe km 10 n pa ta")).toBe("a zoe kilometr 10 n pa ta");
        expect(normalizeMossi("zĩiga yaa km2 77.0")).toBe("zĩiga yaa kilometr 77.0");
    });

    // ⚠ THE EXPONENT IS CONSUMED AND UNREAD, and that is a stated LOSS rather than a fix — Mooré offers three
    // rival square-words that agree neither on count nor on position (`kars` ×1; `zem-taas` ×3, one of which
    // is a square MILE and whose other two sit on OPPOSITE SIDES of the unit noun; `men-yɩlende` ×2), which
    // is a lead and not a finding. It ships only because what it replaces is worse than a silence: `km2 77.0`
    // read as `km` RAW plus the `2` claimed by the number path as the CARDINAL TWO — the `za` `810km2` bug.
    // mos is deliberately NOT added to ACCEPTED_SIGN_SILENCE for `exponent`; review.ts stays red on it.
    test("km² is read as the bare unit and the squared-ness is dropped, not invented", () => {
        expect(normalizeMossi("(20.4 km2)")).toBe("(kilometr 20.4)");
        expect(normalizeMossi("225.67km^2")).toBe("kilometr 225.67");
        expect(normalizeMossi("(akre 860; km² 3.5)")).toBe("(akre 860; kilometr 3.5)");
        expect(say("km2 77.0")).not.toContain("jiːbu"); // no stray cardinal TWO from the exponent
    });

    // ⚠ THE SPAN KEEPS ITS SHAPE BEHIND ONE NOUN, which is a move only a head-initial language gets for free.
    // `20--40 km (12-25 mi)` is in the corpus and mos has NO range joiner (that cell is only 47% Mooré and is
    // dominated by football scores). Matching just the right endpoint would emit `20--kilometr 40` and drop
    // the unit into the middle of the span; preposing lets the pair stay the two bare cardinals it already
    // read as, now with the unit attached.
    test("a hyphenated span takes one preposed unit noun rather than being split by it", () => {
        expect(normalizeMossi("yaa 20--40 km (12-25 mi)")).toBe("yaa kilometr 20--40 (12-25 mi)");
    });

    // ⚠ THE ADVERSARIAL NEIGHBOURS (trap 6): `km` is two ASCII letters in a Latin-script language, so a
    // residue is invisible to every leak class and an unguarded key bites into ordinary words. Both
    // lookarounds are asserted. The de-grouping coupling is asserted too — run before step 3 the rule would
    // emit `kilometr 18` and leave `,476` behind as a clause pause.
    test("the km key never bites a word, and sees the figure de-grouping has already joined up", () => {
        expect(normalizeMossi("kmall akm 5")).toBe("kmall akm 5");
        expect(normalizeMossi("18,476km")).toBe("kilometr 18476");
    });
});
