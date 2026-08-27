import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/luganda/luganda.ts";
import { normalizeLuganda } from "../src/languages/luganda/normalize.ts";
import { phonemize } from "../src/index.ts";
import { numberToWords } from "../src/languages/luganda/numbers.ts";

// Canonical-IPA goldens for Luganda / Oluganda (lg) — Bantu (Great Lakes, JE15), Latin orthography.
// Phonology grounded in Wikipedia (Luganda) + the epitran lug-Latn map. The greedy g2p + gemination + prenasal
// lengthening is refereed by epitran lug-Latn (tools/referee-eval, 1500 words) — ⚠ but epitran is itself
// rule-based, so that comparison is partly CIRCULAR (single-source). These goldens pin the segmental backbone.
// Tone (3-way H/L/falling) is lexical + unwritten → deferred.
describe("Luganda canonical IPA — greedy g2p + gemination + prenasal lengthening", () => {
    test("PRENASALISED consonants as units + vowel LENGTHENING before them", () => {
        expect(phonemizeWord("nga")).toBe("ᵑɡa"); // ⟨ng⟩ → ᵑɡ
        expect(phonemizeWord("buganda")).toBe("buɡaːⁿda"); // ⟨nd⟩ → ⁿd; the a before it is LENGTHENED
        expect(phonemizeWord("omuntu")).toBe("omuːⁿtu"); // ⟨nt⟩ → ⁿt; u lengthened
        expect(phonemizeWord("enkima")).toBe("eːᵑkima"); // ⟨nk⟩ → ᵑk; e lengthened
    });

    test("⟨ng'⟩ → ŋ (velar nasal, distinct from ⟨ng⟩ → ᵑɡ); ⟨nny⟩ → ɲː", () => {
        expect(phonemizeWord("ng'")).toBe("ŋ"); // velar nasal
        expect(phonemizeWord("nng'")).toBe("ŋː"); // geminate velar nasal
        expect(phonemizeWord("nnyo")).toBe("ɲːo"); // ⟨nny⟩ → ɲː
    });

    test("GEMINATION (doubled → Cː) and prenasal + LABIALISATION (⟨ndw⟩ → ⁿdʷ)", () => {
        expect(phonemizeWord("bbiri")).toBe("bːiɾi"); // "two" — ⟨bb⟩ → bː; ⟨r⟩ → ɾ
        expect(phonemizeWord("kitto")).toBe("kitːo"); // ⟨tt⟩ → tː
        expect(phonemizeWord("ndwadde")).toBe("ⁿdʷadːe"); // ⟨nd⟩ + ⟨w⟩ → ⁿdʷ (prenasal keeps the labialisation)
        expect(phonemizeWord("mwana")).toBe("mʷana"); // ⟨mw⟩ → mʷ (labialisation)
    });

    test("common words", () => {
        expect(phonemizeWord("luganda")).toBe("luɡaːⁿda"); // the language name
        expect(phonemizeWord("era")).toBe("eɾa"); // "and" — ⟨r⟩ → ɾ (tap)
    });
});

// CARDINAL NUMBERS (lg). The compositor emits the CITATION / COUNTING series (emu, bbiri, ssatu, nnya, ttaano …):
// Luganda 1–5 are adjectival and take class concord (bbiri ~ abiri ~ bibiri ~ bubiri), so a bare integer — which
// has no noun to agree with — must use the counting shape. 6–9 are NOUNS and never inflect. Sources are cited in
// luganda.jsonc "numbers" (Wikivoyage Luganda phrasebook §Numbers + eggsforeducation + Omniglot).
describe("Luganda cardinal numbers — citation series, the 60–90 nouns, mu/na connectives", () => {
    test("units + the teens 'na'/'n'' connective", () => {
        expect(numberToWords(7)).toBe("musanvu");
        expect(numberToWords(10)).toBe("kkumi");
        expect(numberToWords(11)).toBe("kkumi n'emu"); // elision before the vowel-initial emu
        expect(numberToWords(12)).toBe("kkumi na bbiri");
    });
    test("20–50 are multiplicative amakumi + cl.6 a-; 60–90 are SINGLE nouns", () => {
        expect(numberToWords(20)).toBe("amakumi abiri");
        expect(numberToWords(50)).toBe("amakumi ataano");
        expect(numberToWords(60)).toBe("nkaaga"); // NOT amakumi mukaaga
        expect(numberToWords(90)).toBe("kyenda");
        expect(numberToWords(21)).toBe("amakumi abiri mu emu"); // the "mu" component connective
    });
    test("hundreds take their OWN bi- multiplier series (attested compounds)", () => {
        expect(numberToWords(100)).toBe("kikumi");
        expect(numberToWords(122)).toBe("kikumi mu amakumi abiri mu bbiri");
        expect(numberToWords(222)).toBe("bikumi bibiri mu amakumi abiri mu bbiri");
    });
    test("thousands, millions, billions", () => {
        expect(numberToWords(1000)).toBe("lukumi");
        expect(numberToWords(2000)).toBe("nkumi bbiri");
        expect(numberToWords(1000000)).toBe("kakadde kamu");
        expect(numberToWords(1000000000)).toBe("akawumbi kamu");
    });
    test("end-to-end through the g2p (gemination + prenasal lengthening apply to numerals too)", () => {
        expect(phonemize("2", "lg").trim()).toBe("bːiɾi"); // ⟨bb⟩ → bː
        expect(phonemize("60", "lg").trim()).toBe("ᵑkaːɡa"); // vowel lengthened before the prenasal
        expect(phonemize("122", "lg").trim()).toBe("kikumi mu amakumi abiɾi mu bːiɾi");
    });
});

// TEXT NORMALIZATION (lg) — src/languages/luganda/normalize.ts. The evidence for every word emitted here is
// cited at its declaration in that file; these tests pin the rule's BRANCHES rather than the corpus's
// instances (playbook trap 13), so several cases below are shapes tools/corpus/mined/lg.jsonc does NOT
// contain, and at least one is a shape it contains and the rule must REFUSE.
describe("Luganda text normalization — noun-first units, `ku kikumi`, `okutuuka`", () => {
    test("thousands de-group in all three conventions this wiki writes", () => {
        expect(normalizeLuganda("abantu 1,208,544 era")).toBe("abantu 1208544 era");
        expect(normalizeLuganda("Obugazi: 1 244.7 km²")).toBe("Obugazi: kiromita eza kyebiriga 1244 7");
        expect(normalizeLuganda("Helsinki esulwaamu abantu 570 074.")).toBe("Helsinki esulwaamu abantu 570074.");
        // the period-grouped arm — the numeral glossary's own entries, and the 1–9 head is what makes it safe
        expect(normalizeLuganda("200.000 Mitwalo abiri")).toBe("200000 Mitwalo abiri");
        // ⚠ THE BRANCH THAT MUST NOT FIRE: an HDI figure is a decimal, not a period-grouped thousand
        expect(normalizeLuganda("HDI ya 0.628 (omutono)")).toBe("HDI ya 0 6 2 8 (omutono)");
        // a DIGIT LIST is not a number, and it is the whole of this corpus's `\d+,\d{1,2}`
        expect(normalizeLuganda("digito satu (0,1, ne 2)")).toBe("digito satu (0,1, ne 2)");
    });

    test("ranges take `okutuuka mu` for a year pair and `okutuuka ku` for a quantity", () => {
        expect(normalizeLuganda("olwa 1775–1783")).toBe("olwa 1775 okutuuka mu 1783");
        expect(normalizeLuganda("Kilo 10-12")).toBe("Kilo 10 okutuuka ku 12");
        expect(normalizeLuganda("wakati wa 25–31 °C")).toBe("wakati wa 25 okutuuka ku 31 °C");
        // ⚠ THREE SHAPES THE ASCENDING GUARD DECLINES, each a real hazard in this corpus:
        expect(normalizeLuganda("bawangula Aizawl F.C. 4-1")).toBe("bawangula Aizawl F.C. 4-1"); // a SCORE
        expect(normalizeLuganda("mu 2008–09")).toBe("mu 2008–09"); // the abbreviated second year
        expect(normalizeLuganda("(15. o'gwomunaana 1769-5. o'gwoogutaanu 1821)"))
            .toBe("(15. o'gwomunaana 1769-5. o'gwoogutaanu 1821)"); // a birth–death line, second operand a DAY
        // ⚠ AND TWO THE BIBLIOGRAPHY WOULD OTHERWISE HAND IT — the `/` and the trailing `-` guards
        expect(normalizeLuganda("doi:10.1186/1742-4690-3-72")).toBe("doi:10 1 1 8 6/1742-4690-3-72");
        expect(normalizeLuganda("ISBN 978-0-7817-6299-1")).toBe("ISBN 978-0-7817-6299-1");
    });

    test("percent is postposed `ku kikumi`, and is not said twice", () => {
        expect(normalizeLuganda("byaweebwa ebitundu 4.8%")).toBe("byaweebwa ebitundu 4 8 ku kikumi");
        expect(normalizeLuganda("abantu nga 54.4% baali")).toBe("abantu nga 54 4 ku kikumi baali");
        expect(normalizeLuganda("ebitundu 20–25%")).toBe("ebitundu 20 okutuuka ku 25 ku kikumi");
        // trap 12 — the wiki sentences that are this reading's own evidence write BOTH the sign and the words
        expect(normalizeLuganda("Abantu 75% ku kikumi")).toBe("Abantu 75 ku kikumi");
        expect(normalizeLuganda("ebitundu 8 ku buli kikumi")).toBe("ebitundu 8 ku buli kikumi");
    });

    test("the currency noun PRECEDES its amount, and the redundancy guard is the majority case", () => {
        expect(normalizeLuganda("ezitasukka $2.15 buli lunaku")).toBe("ezitasukka ddoola 2 1 5 buli lunaku");
        expect(normalizeLuganda("ssente US$50,000 mu")).toBe("ssente ddoola 50000 mu");
        expect(normalizeLuganda("($178k oba €134k)")).toBe("(ddoola 178k oba euro 134k)");
        // trap 12, on both sides — this wiki names the currency in Luganda and THEN writes the sign
        expect(normalizeLuganda("obukadde bwa ddoola US$29")).toBe("obukadde bwa ddoola 29");
        expect(normalizeLuganda("n'asasulwa pawundi £30 buli wiiki")).toBe("n'asasulwa pawundi 30 buli wiiki");
        // no shilling word is sourced, so the letters are left exactly as they were
        expect(normalizeLuganda("obuwumbi bwa Uganda USh35")).toBe("obuwumbi bwa Uganda USh35");
    });

    test("units are noun-FIRST, and the one-letter `m` key is narrowed on a real counter-example", () => {
        expect(normalizeLuganda("obugulumivu bwa 10 cm")).toBe("obugulumivu bwa sentimita 10");
        expect(normalizeLuganda("ekinnya sima 30cm")).toBe("ekinnya sima sentimita 30");
        expect(normalizeLuganda("obwagagavu bwa 449 964 km²")).toBe("obwagagavu bwa kiromita eza kyebiriga 449964");
        // the ASCII exponent is the worse of the two — it is a NUMBER, not a visible leak (trap 53)
        expect(normalizeLuganda("Ku 580,367 km2 (224,081 sq mi)"))
            .toBe("Ku kiromita eza kyebiriga 580367 (224081 sq mi)");
        expect(normalizeLuganda("(1.5kg)")).toBe("(kilo 1 5)");
        expect(normalizeLuganda("ku buwanvu bwa 3,540 feet (1,079 m)"))
            .toBe("ku buwanvu bwa 3540 feet (mmita 1079)"); // `ft` declined: an English gloss
        // ⚠ THE COUNTER-EXAMPLE, AND IT IS IN THIS CORPUS: `1.5m` is ONE AND A HALF MILLION BIRDS
        expect(normalizeLuganda("ebiwerera ddala akakadde kamu n'ekitundu (1.5m)"))
            .toBe("ebiwerera ddala akakadde kamu n'ekitundu (1.5m)");
        // and the same shape gives the version guard for free (trap 52 — the engine restarts at `11m`)
        expect(normalizeLuganda("802.11m")).toBe("802.11m");
        // no rate idiom is sourced, so the slash declines the whole match
        expect(normalizeLuganda("ku misinde egya 299,792 km/s")).toBe("ku misinde egya 299792 km/s");
    });

    test("decimals lose the separator and keep every digit — there is no point word to insert", () => {
        expect(normalizeLuganda("ogwa 4.2/10")).toBe("ogwa 4 2/10");
        // ⚠ A SENTENCE-FINAL DECIMAL IS THIS CORPUS'S COMMONEST ONE — the trailing guard is `\.\d`, not `\.`
        expect(normalizeLuganda("Obugazi: 600.2 km².")).toBe("Obugazi: kiromita eza kyebiriga 600 2.");
        // a multi-dot run is a DATE or a designation, never a quantity
        expect(normalizeLuganda("Anastacia (Chicago, 17.09.1968)")).toBe("Anastacia (Chicago, 17.09.1968)");
        // ⚠ reading the tail as a NUMBER would say a different quantity, so the digits are spaced apart
        expect(phonemize("2.15", "lg").trim()).toBe("bːiɾi emu tːaːno");
    });

    test("the English ordinal suffix is stripped; Luganda spells its own ordinals as words", () => {
        expect(normalizeLuganda("medicine (4th ed.)")).toBe("medicine (4 ed.)");
        expect(normalizeLuganda("omulundi ogwokusatu")).toBe("omulundi ogwokusatu"); // the language's own
    });

    test("end to end through the phonemizer", () => {
        // the percent word is COMPOSED of pieces this engine already owns — `kikumi` is its own 100
        expect(phonemize("25%", "lg").trim()).toBe("amakumi abiɾi mu tːaːno ku kikumi");
        expect(phonemize("5 km²", "lg").trim()).toBe("kiɾomita eza kjebiɾiɡa tːaːno");
        // ⚠ THE REFUSALS, PINNED SO A LATER "FIX" HAS TO ARGUE WITH THEM: no scale name is sourceable, so
        // the whole `°C` match is declined rather than half of it (trap 53).
        expect(phonemize("20 °C", "lg").trim()).toBe("amakumi abiɾi c");
    });
});

// ⚠ THE GUARD BRANCHES, PINNED SEPARATELY BECAUSE THE CORPUS CANNOT SEE THEM. Every case below is a defect
// that shipped in the first cut of this layer and that the corpus diff scored at 0/445 changed — the shapes
// simply do not occur in the retained text. Playbook trap 8: zero corpus instances is not evidence of
// correctness, and trap 13: pin the rule's branches, not the corpus's instances.
describe("Luganda normalization — the trap-12 guards and the shapes the corpus never writes", () => {
    test("a guard needle is WORD-BOUNDED — `kilo` must not match inside `kilometers`", () => {
        // this corpus writes `kiri ku kilometers 333 (207 mi)`; a substring needle consumed the `kg` and
        // emitted NO unit noun, so the mass read as a bare number — silent deletion, worse than the raw key
        expect(normalizeLuganda("kilometers 333 ne 5kg")).toBe("kilometers 333 ne kilo 5");
        // and it still suppresses when the noun really is there
        expect(normalizeLuganda("Kilo 10 ne 5kg")).toBe("Kilo 10 ne 5");
    });

    test("a guard needle is CASE-INSENSITIVE and knows the long-vowel spellings", () => {
        // every one of these nouns is quoted sentence-initially in its own attestation block
        expect(normalizeLuganda("Kiromita zaayo 1300 km")).toBe("Kiromita zaayo 1300");
        expect(normalizeLuganda("Euro 134 oba €134")).toBe("Euro 134 oba 134");
        // the maths textbook's spelling — the article the squared reading was sourced from
        expect(normalizeLuganda("kiromiita 20 ne 30 km")).toBe("kiromiita 20 ne 30");
    });

    test("the percent guard keys on the COLLOCATION — `kikumi` alone is this engine's own 100", () => {
        expect(normalizeLuganda("abantu kikumi mu ataano ne 25%")).toBe("abantu kikumi mu ataano ne 25 ku kikumi");
        // the real redundancies still suppress
        expect(normalizeLuganda("Abantu 75% ku kikumi")).toBe("Abantu 75 ku kikumi");
        expect(normalizeLuganda("ebitundu 8 ku buli kikumi")).toBe("ebitundu 8 ku buli kikumi");
    });

    test("a clause-final metre figure still reads — the `m` right guard carries no `.` or `,`", () => {
        expect(normalizeLuganda("misinde egya 800 m.")).toBe("misinde egya mmita 800.");
        expect(normalizeLuganda("yadduka 100 m, era")).toBe("yadduka mmita 100, era");
        // and the counter-example and the version string are still excluded by the LEFT side
        expect(normalizeLuganda("(1.5m)")).toBe("(1.5m)");
        expect(normalizeLuganda("802.11m")).toBe("802.11m");
    });

    // TRAP 58 — the range rule's right guard used to reject a following `.`, so it declined every span that
    // ENDS A CLAUSE and the reading fell back to two juxtaposed cardinals with nothing between them. The
    // corpus instance is *"…mu alipoota emu eri wakati wa 0–1."* (the World Bank HCI scale).
    test("a range that ENDS A CLAUSE keeps its joiner, and the dot stays a sentence end", () => {
        expect(normalizeLuganda("wakati wa 0–1.")).toBe("wakati wa 0 okutuuka ku 1.");
        expect(normalizeLuganda("olwa 1775–1783.")).toBe("olwa 1775 okutuuka mu 1783.");
        // the COMMA is deliberately still rejected: lg writes a decimal comma (`7,2`, `5,3`) and the comma is
        // this rule's own grouping evidence, so a trailing `,` can open the right operand rather than close a
        // clause. This asserts the branch we did NOT take.
        expect(normalizeLuganda("olwa 1775–1783, era")).toBe("olwa 1775–1783, era");
        // and the decimal range is still declined — by the LOOKBEHIND, which is untouched (step 7 then reads
        // each operand's own decimal, exactly as it did before this change)
        expect(normalizeLuganda("0.1–0.4 ha")).toBe("0 1–0 4 ha");
        // a decimal RIGHT operand is now claimed, and its tail still reaches step 7 whole
        expect(normalizeLuganda("5–13.7 ha")).toBe("5 okutuuka ku 13 7 ha");
    });

    test("the year arm reads the GROUPING, which is why ranges run above de-grouping", () => {
        // an ungrouped four-digit pair is a year span — the temporal locative
        expect(normalizeLuganda("olwa 1775–1783")).toBe("olwa 1775 okutuuka mu 1783");
        // a GROUPED one is a quantity, and de-grouping first would have destroyed the only evidence
        expect(normalizeLuganda("abantu 1,000-2,000 mu kibuga")).toBe("abantu 1000 okutuuka ku 2000 mu kibuga");
        expect(normalizeLuganda("1,500–2,000 mmita")).toBe("1500 okutuuka ku 2000 mmita");
    });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// #1102 — the marked clock. `saawa` is written in front and is the discriminator; the spelling varies
// (`saawa`/`ssaawa`, glued in `kusaawa`) and the trailing markers catch the ones written without it.
describe("a marked clock keeps its pause off (#1102)", () => {
    test.each([
        ["Awo kusaawa 11:29, okwekalakaasa", "Awo kusaawa 11 29, okwekalakaasa"], // glued, and clause-final
        ["ku ssaawa 11:00, abeekalakaasi", "ku ssaawa 11 00, abeekalakaasi"],
        ["ku saawa 8:46 am zenyini", "ku saawa 8 46 am zenyini"],
        ["saawa 12.00 GMT", "saawa 12 00 GMT"],
        ["1:15 ezekiro kulwomukaag", "1 15 ezekiro kulwomukaag"],   // the day-part is `ez` + ANY letter
        ["07:19 ez’okumakya", "07 19 ez’okumakya"],
    ])("%s", (a, b) => expect(normalizeLuganda(a)).toBe(b));

    test("⚠ THE COUNTER-EXAMPLES ARE IN THIS CORPUS AND IN THE GOLDEN", () => {
        expect(normalizeLuganda("bwa 3.50 m.")).toContain("3 5 0");        // a MEASUREMENT — lg.tsv's own row
        expect(normalizeLuganda("akebanga 4:41.30")).toContain("4:41");    // a ski result
        expect(normalizeLuganda("ne 802.11a")).toBe("ne 802.11a");
        expect(normalizeLuganda("wa 06:30 ne 07:30.")).toBe("wa 06:30 ne 07:30."); // unmarked range
    });
});
