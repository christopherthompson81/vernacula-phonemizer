import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/sepedi/sepedi.ts";
import { phonemize } from "../src/index.ts";
import { numberToWords } from "../src/languages/sepedi/numbers.ts";
import { normalizeSepedi } from "../src/languages/sepedi/normalize.ts";

// Canonical-IPA goldens for Sepedi / Northern Sotho (nso) — Bantu (Sotho-Tswana), Latin. CANNOT-VERIFY: authored
// from standard Sepedi phonology (Ziervogel & Mokgokong) with NO machine referee at all (no wikipron/kaikki/
// epitran) — these are hand examples of the distinctive graphemes, not a verified gold. Signatures: ⟨š⟩→ʃ,
// ⟨tš⟩→t͡ʃʼ, ⟨g⟩→x, ⟨kg⟩→kx, ⟨hl⟩→ɬ, EJECTIVE ⟨p t k⟩ (the Sotho-Tswana pattern, unverified for Sepedi). Tone
// deferred.
describe("Sepedi (Northern Sotho) canonical IPA — Sotho-Tswana rule g2p (authored)", () => {
    test("distinctive graphemes: ⟨š⟩→ʃ, ⟨kg⟩→kx, ⟨g⟩→x, ⟨hl⟩→ɬ", () => {
        expect(phonemizeWord("kgoši")).toBe("kxoʃi"); // kg→kx, š→ʃ
        expect(phonemizeWord("mošomo")).toBe("moʃomo"); // š→ʃ
        expect(phonemizeWord("hlogo")).toBe("ɬoxo"); // hl→ɬ, g→x
    });
    test("aspirate ⟨th⟩→tʰ, ejective ⟨p⟩→pʼ", () => {
        expect(phonemizeWord("batho")).toBe("batʰo"); // th→tʰ
        expect(phonemizeWord("sepedi")).toBe("sepʼedi"); // p→pʼ (ejective)
    });
});

// CARDINAL NUMBERS (nso). The compositor emits the CITATION / COUNTING series (tee, pedi, tharo …) — the list the
// UNISA Northern Sotho course has a speaker recite — because a bare integer gives the adjectival 1–5 no noun to
// agree with. Sepedi is deliberately NOT derived from the Sesotho compositor: the stems differ (tee/tshela/šupa/
// seswai/senyane/lesome vs st nngwe/tshelela/supa/robedi/robong/leshome) and 11–99 / 200–900 are written
// CONJUNCTIVELY as one word. Sources + the orthographic normalisations are cited in sepedi.jsonc "numbers".
describe("Sepedi cardinal numbers — citation series + conjunctive compounds", () => {
    test("units are the counting series — and differ from Sesotho's", () => {
        expect(numberToWords(0)).toBe("lefeela");
        expect(numberToWords(1)).toBe("tee"); // st has nngwe
        expect(numberToWords(7)).toBe("šupa"); // st has supa
        expect(numberToWords(8)).toBe("seswai"); // st has robedi
        expect(numberToWords(9)).toBe("senyane"); // st has robong
    });
    test("teens + tens are CONJUNCTIVE single words", () => {
        expect(numberToWords(10)).toBe("lesome");
        expect(numberToWords(11)).toBe("lesometee");
        expect(numberToWords(20)).toBe("masomepedi");
        expect(numberToWords(21)).toBe("masomepedi tee"); // Omniglot's hyphen → a word boundary
        expect(numberToWords(90)).toBe("masomesenyane");
    });
    test("hundreds are the conjunctive makgolo+STEM series (UNISA)", () => {
        expect(numberToWords(100)).toBe("lekgolo");
        expect(numberToWords(200)).toBe("makgolopedi");
        expect(numberToWords(555)).toBe("makgolohlano le masomehlano hlano");
    });
    test("thousands (cl.8 tše concord) and millions", () => {
        expect(numberToWords(1000)).toBe("sekete");
        expect(numberToWords(2000)).toBe("dikete tše pedi");
        expect(numberToWords(12345)).toBe("dikete lesomepedi le makgolotharo le masomenne hlano");
        expect(numberToWords(1000000)).toBe("milione");
        expect(numberToWords(1000000000)).toBe("bilione");
    });
    test("end-to-end through the g2p", () => {
        expect(phonemize("21", "nso").trim()).toBe("masomepʼedi tʼee");
        expect(phonemize("200", "nso").trim()).toBe("makxolopʼedi");
    });
});

// ── TEXT NORMALIZATION (src/languages/sepedi/normalize.ts) ────────────────────────────────────────────────
// ⚠ nso HAS NO REFEREE OF ANY KIND, so these tests cannot assert that a reading is right FOR THE LANGUAGE.
// What they pin is (a) that each rule fires on the shape the corpus writes, (b) that each measured guard
// still DECLINES the shape it was measured against, and (c) the BRANCHES of the rules that have several —
// the corpus's instances and the rule's branches are different sets (playbook trap 13). Every word form
// asserted here is sourced in normalize.ts's own comments, with its attest.ts count and the sense read.
describe("Sepedi text normalization", () => {
    test("percent — the noun PRECEDES its figure, and the two count forms differ in concord", () => {
        // `diperesente tše tharo (3%)` is attested on nso.wikipedia glossed against the sign itself.
        expect(normalizeSepedi("3%")).toBe("diperesente tše 3");
        expect(normalizeSepedi("40% ya badudi")).toBe("diperesente tše 40 ya badudi");
        // cl.9 singular, the `peresente ye masometharo tshela(36)` frame — a branch the corpus never writes.
        expect(normalizeSepedi("1%")).toBe("peresente ye 1");
        // a decimal percentage keeps the plural and is spelled digit-by-digit by step 9
        expect(normalizeSepedi("61.9%")).toBe("diperesente tše 61 9");
    });

    test("currency — $ on the shared tier, R local and GUARDED against the road designations", () => {
        expect(normalizeSepedi("$450 milione")).toBe("ditolara tše milione 450");
        expect(normalizeSepedi("R6.4 bilione")).toBe("diranta tše bilione 6 4");
        expect(normalizeSepedi("R50,000")).toBe("diranta tše 50000");
        // ⚠ THE MEASURED REFUSAL: `e lego R37 le R555` is two national ROADS, not money. 9 corpus currency
        // instances all carry a magnitude, a decimal or a grouping; neither road number carries any.
        expect(normalizeSepedi("ditsela tše pedi, e lego R37 le R555")).toBe("ditsela tše pedi, e lego R37 le R555");
        // £ is DECLINED — `diponto` is attested ×5 and every one is the pound WEIGHT beside a kilogram figure.
        expect(normalizeSepedi("£10 million")).toBe("£10 million");
    });

    test("units — measure noun first, cl.10 concord, and the citation form for a bare token", () => {
        expect(normalizeSepedi("200 km borwa")).toBe("dikhilomithara tše 200 borwa");
        expect(normalizeSepedi("1200 kg")).toBe("dikhilograma tše 1200");
        expect(normalizeSepedi("50 cm")).toBe("senthimetara 50"); // `disenthimetara` is ×0; the noun is bare
        expect(normalizeSepedi("60 mm")).toBe("dimilimithara tše 60");
        expect(normalizeSepedi("5.2 m")).toBe("dimithara tše 5 2");
        // the n=1 branch takes index 0, the bare noun — `1 kg` ×2 in the corpus
        expect(normalizeSepedi("1 kg")).toBe("dikhilograma 1");
        // a unit with NO numeral of its own: the bare-unit path, index 0, no dangling concord
        expect(normalizeSepedi("km")).toBe("dikhilomithara");
    });

    test("rates and the squared compound", () => {
        expect(normalizeSepedi("108 km/h")).toBe("dikhilomithara tše 108 ka iri");
        expect(normalizeSepedi("30 m/s")).toBe("dimithara tše 30 ka motsotswana");
        // `disekwere-khilomithara tše 1 221 037` — the di- moves to the FRONT and the head goes bare
        expect(normalizeSepedi("221,6 km²")).toBe("disekwere-khilomithara tše 221 6");
        expect(normalizeSepedi("361 km2")).toBe("disekwere-khilomithara tše 361");
        // ⚠ REFUSE THE WHOLE MATCH where no word exists (trap 53) — never a LENGTH where the text wrote a
        // volume, and never a stranded exponent. No cube word is attested for nso, and no cm² compound is.
        expect(normalizeSepedi("5 m³")).toBe("5 m³");
        expect(normalizeSepedi("5 cm²")).toBe("5 cm²");
    });

    test("⚠ `802.11m` is a DESIGNATION, not eleven metres — and the guard needs BOTH halves (trap 52)", () => {
        // rejected at `802`, the engine retries from `11m`; the lookbehind is what stops that.
        expect(normalizeSepedi("802.11m")).toBe("802 1 1m");
        expect(normalizeSepedi("802.11n")).toBe("802 1 1n");
    });

    test("degrees — Celsius is named, Fahrenheit is claimed and left unsaid, and ° may be U+00BA", () => {
        expect(normalizeSepedi("1.2 °C")).toBe("1 2 Celsius");
        expect(normalizeSepedi("1.02º Celsius")).toBe("1 0 2 Celsius"); // said once, not twice (trap 12)
        expect(normalizeSepedi("85°F")).toBe("85"); // `Fahrenheit` is ×0 in every nso source
        expect(normalizeSepedi("55°S")).toBe("55 borwa");
        expect(normalizeSepedi("90°")).toBe("90"); // no degree noun: `dikgato` is this wiki's word for the FOOT
    });

    test("ranges — `go ya go`, descending allowed, and every measured decline", () => {
        expect(normalizeSepedi("1901–2012")).toBe("1901 go ya go 2012");
        expect(normalizeSepedi("5–8 senthimetara")).toBe("5 go ya go 8 senthimetara");
        // DESCENDING is attested for nso (`7,000 go ya go 3,500 B.C.E.`), unlike the nya/rw siblings
        expect(normalizeSepedi("33,500–32,500 BP")).toBe("33500 go ya go 32500 BP");
        // 4-vs-2 digits is an ABBREVIATED year span; 4-vs-1 is a standard's part number
        expect(normalizeSepedi("1876-77")).toBe("1876-77");
        expect(normalizeSepedi("ISO 3166-1")).toBe("ISO 3166-1");
        // ⚠ A SPACED-HYPHEN CHAIN IS A YEAR INDEX, NOT FIVE SPANS — the guard has to reach across the space
        expect(normalizeSepedi("1970 - 1969 - 1968")).toBe("1970 - 1969 - 1968");
    });

    // ⚠ A SPAN THAT ENDS THE CLAUSE IS STILL A SPAN (playbook trap 58). The right guard rejected a bare
    // `.` or `,`, which is a sentence end far more often than a number's interior, so `nakong ya 1901–2012.`
    // was declined whole and read as two juxtaposed cardinals with no connective between them. The branch is
    // pinned, not the corpus instance (trap 13): the separator must carry a DIGIT to count as a number.
    test("a clause-final span keeps its joiner AND its pause", () => {
        expect(normalizeSepedi("nakong ya 1901–2012.")).toBe("nakong ya 1901 go ya go 2012.");
        expect(normalizeSepedi("magareng ga 1950–2020,")).toBe("magareng ga 1950 go ya go 2020,");
        expect(normalizeSepedi("mengwaga ye 25–34.")).toBe("mengwaga ye 25 go ya go 34.");
        // and the decimal half of the guard survives — a separator WITH a digit is still a number
        expect(normalizeSepedi("9.84-9.90")).toBe("9 8 4-9 9 0");
        // every measured decline still declines when the clause ends on it
        expect(normalizeSepedi("ISO 3166-1.")).toBe("ISO 3166-1.");
        expect(normalizeSepedi("1970 - 1969 - 1968.")).toBe("1970 - 1969 - 1968.");
    });

    test("separators — both characters carry both roles, and only the BLOCK LENGTH tells them apart", () => {
        expect(normalizeSepedi("1,600,000")).toBe("1600000");
        expect(normalizeSepedi("216.061 badudi")).toBe("216061 badudi");
        expect(normalizeSepedi("30 560 860")).toBe("30560860");
        expect(normalizeSepedi("9.84")).toBe("9 8 4");
        expect(normalizeSepedi("221,6")).toBe("221 6");
        // ⚠ `(1,2,3,4,5,6)` IS A LIST, not three decimals — both guards reject every member
        expect(normalizeSepedi("(1,2,3,4,5,6)")).toBe("(1,2,3,4,5,6)");
    });

    test("dotted initials lose their sentence breaks WITHOUT fusing into a digraph (trap 56)", () => {
        expect(normalizeSepedi("Verster T.L.")).toBe("Verster T-L."); // glued, ⟨tl⟩ would read t͡ɬʼ
        expect(normalizeSepedi("P.H. Nortjé")).toBe("P-H Nortjé"); // glued, ⟨ph⟩ would read pʰ
        expect(normalizeSepedi("3,500 B.C.E. kua Korea")).toBe("3500 B-C-E kua Korea");
    });

    test("the ampersand is the manifest's own conjunction, spaced on both sides", () => {
        expect(normalizeSepedi("Mail & Guardian")).toBe("Mail le Guardian");
        expect(normalizeSepedi("R&B")).toBe("R le B"); // never glued: `RB` would be one token
    });

    test("the English ordinal suffix is stripped — Sepedi writes its own ordinals as words", () => {
        expect(normalizeSepedi("Ngwagakgolo wa lesome senyane (19th)")).toBe("Ngwagakgolo wa lesome senyane (19)");
    });

    test("end-to-end through the g2p — the readings the layer exists to produce", () => {
        // ⚠ TWO TRAP-56 MISREADS CLOSED, neither of which any leak class could see: ⟨kg⟩ IS the Sepedi
        // digraph for /kx/, so `1200 kg` was PRONOUNCED as a velar affricate; ⟨c⟩ has no grapheme rule and
        // falls through to latinPhone, so ⟨cm⟩ read [km] — one ejective mark from ⟨km⟩ → [kʼm].
        expect(phonemize("1200 kg", "nso")).toContain("dikʰiloxrama");
        expect(phonemize("1200 kg", "nso")).not.toContain(" kx");
        expect(phonemize("50 cm", "nso")).toContain("sentʰimetʼara");
        expect(phonemize("108 km/h", "nso")).toBe("dikʰilomitʰara t͡ʃʼe lekxolo le seswai kʼa iri");
        expect(phonemize("40%", "nso")).toBe("dipʼeresentʼe t͡ʃʼe masomenne");
    });
});
