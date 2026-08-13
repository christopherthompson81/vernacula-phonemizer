/**
 * Igbo text normalization — the symbols a reader voices.
 *
 * ⚠ IGBO HAS NO INDEPENDENT REFEREE (wikipron ibo_latn, epitran ibo-Latn and the kaikki extract are all 404), so
 * every expectation here rests on corpus counts from a 558,991-line ig.wikipedia dump, recorded beside each rule in
 * normalize.ts. The language's documented non-corpus tier is the hand-adjudicated gold in igbo.test.ts
 * (Emenanjo 1978; Green & Igwe 1963).
 */
import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { normalizeIgbo } from "../src/languages/igbo/normalize.ts";

describe("igbo normalization", () => {
    test("⚠ the grouping comma is de-grouped — it used to split the number in two", () => {
        // `1,500` read *otu , naɾɪ ise* — "one, five hundred", with a clause pause inside the number. Igbo groups
        // with a COMMA (16,847 lines) and points decimals with a PERIOD (16,658), the Nigerian convention.
        expect(normalizeIgbo("1,500")).toBe("1500");
        expect(normalizeIgbo("1,234,567")).toBe("1234567");
        expect(String(phonemize("1,500", "ig"))).toBe("otu puku na naɾɪ ise");
    });

    test("⚠ the percent WORD precedes the number even though the SIGN follows it", () => {
        // The one thing assuming English order would get wrong. Written: `60%`, sign after (1,018 occurrences).
        // Spoken: `pasent 60`, word first — 1,161 occurrences against 87 the other way, and those 87 are comma
        // boundaries (`2004, pasent`). Same shape as Turkish `yüzde 40`.
        expect(String(phonemize("60%", "ig"))).toBe("pasent iɾi isii");
        // With a decimal, the percent word still leads and the separator lands between the halves — this is the
        // assertion that catches rule 4 running before the symbol tier (which gave *asatɔ pasent atɔ*).
        expect(String(phonemize("8.3%", "ig"))).toBe("pasent asatɔ ntʊk͡pɔ atɔ");
    });

    test("currency: ₦ and $, word after the number", () => {
        // ₦ 30 sign hits / naira 280 · $ 898 / dollar 641. The corpus writes `nde naira`, `narị ise puku dollar`,
        // so the word follows — the tier's default. £/€ are deliberately absent: the signs occur (147, 49) but
        // `pound` (45) is ambiguous with the weight unit and `euro` (19) is too thin.
        expect(String(phonemize("₦500", "ig"))).toContain("naiɾa");
        expect(String(phonemize("$20", "ig"))).toContain("dollaɾ");
    });

    test("⚠ a digit-flanked dash is a RANGE, never a minus", () => {
        // 4,993 digit-flanked dashes in a 26 MB sample: 1,734 year-year, 1,741 small-small. A minus rule would read
        // every date range as arithmetic — the defect nl, mr, ta and yue all record. `ruo` ("to") is the range word,
        // 1,687 digit-flanked instances (`peeji 20 ruo 80`, `Site na 1958 ruo 1966`).
        expect(normalizeIgbo("1967-1970")).toBe("1967 ruo 1970");
        expect(normalizeIgbo("1,200-2,000")).toBe("1200 ruo 2000");
    });

    test("the ampersand is `na`, the ordinary connective", () => {
        expect(String(phonemize("A & B", "ig"))).toBe("a na b");
    });

    test("⚠ the separator is `ntụkpọ`, which the corpus does not contain — a dictionary settles it", () => {
        // ⚠ A WRITTEN CORPUS IS WEAK EVIDENCE ABOUT A SPOKEN SYMBOL: writers type `2.5`, they never spell out
        // how they say it, so zero corpus hits for a decimal word does NOT mean the language lacks one. Sourced
        // instead from Nkọwa okwu: `ǹtụ̀kpọ`, n. "decimal point; decimal number".
        expect(normalizeIgbo("2.5")).toBe("2 ntụkpọ 5");
        // Untoned, like every other word this layer emits — igbo.ts reads tone only when marked, and the toned
        // headword would voice ˩ tones (n̩˩tʊ˩k͡pɔ) that Igbo standard orthography does not write.
        expect(String(phonemize("2.5", "ig"))).toBe("abʊɔ ntʊk͡pɔ ise");
        // The fraction stays digit-by-digit AFTER the word: "three point one four one five nine".
        expect(normalizeIgbo("3.14159")).toBe("3 ntụkpọ 1 4 1 5 9");
        expect(String(phonemize("3.14159", "ig"))).toBe("atɔ ntʊk͡pɔ otu anɔ otu ise itoolu");
        // And the period still must not survive as punctuation — TOKEN treats `.` as a clause break, so the
        // untreated `2.5` read *abʊɔ . ise*, a sentence boundary inside a number.
        expect(normalizeIgbo("2.5")).not.toContain(".");
    });

    test("a sentence-final period is untouched", () => {
        // The decimal rule requires a digit on BOTH sides, so ordinary prose keeps its clause boundaries.
        expect(normalizeIgbo("Afọ 2020. Ọ dị mma.")).toBe("Afọ 2020. Ọ dị mma.");
    });

    test("⚠ the unit WORD precedes the number even though the ABBREVIATION follows it", () => {
        // This layer shipped with NO `units` table at all, so every metric abbreviation reached the phoneme
        // string verbatim: `10 km` → *iɾi km*. `kg` was worse than a leak — it was PRONOUNCED, *iɾi anɔ na
        // asatɔ kɡ*, a cluster asserting itself as Igbo phonology.
        expect(String(phonemize("10 km", "ig"))).toBe("kilomita iɾi");
        expect(String(phonemize("48 kg", "ig"))).toBe("kiloɡɾam iɾi anɔ na asatɔ");
        expect(String(phonemize("24 cm", "ig"))).toBe("sentimita iɾi abʊɔ na anɔ");
        // Order, established from the SPELLED-OUT instances — the ones that show what a reader says rather
        // than how the abbreviation is typed. `kilomita` precedes a spelled numeral 330 times on ig.wikipedia
        // and follows one 61 (84% noun-first), because an Igbo numeral follows the noun it counts (*ụlọ atọ*).
        // Same split this layer already records for `%`: sign after the number, word before it.
        expect(normalizeIgbo("10 km")).toBe("kilomita 10");
        expect(normalizeIgbo("1500 mm")).toBe("milimita 1500");
    });

    test("mm is rainfall, and the corpus glosses its own abbreviation", () => {
        // ⚠ `milimita`'s wiki hit count is a TRAP: the densest passage is a banknote list (*5 milimita 10
        // milimita … dinar 1*), which is the Tunisian *millime*, a currency subunit. What settles the sense is
        // the artifact, where all nine after-a-digit `mm` are rainfall and one line spells the word out beside
        // the figure: *"mmiri ozuzo kwa afọ nke 580 milimita (22.8 in)"*.
        expect(String(phonemize("1,100mm na 1,300mm", "ig"))).toBe(
            "milimita otu puku na otu naɾɪ na milimita otu puku na naɾɪ atɔ",
        );
    });

    test("⚠ `m` is REFUSED — the corpus contains a counterexample", () => {
        // `m` has the HIGHEST after-a-digit exposure of any abbreviation (14, against mm's 9 and km's 7) and is
        // still not declared. One of the 14 is *"a $60 m big-screen adaptation"*, where `m` is *million*; and
        // `m` is the Igbo first-person singular pronoun, which makes the tier's one-letter-key trap sharper
        // here than its own `Il-76s` example. The letter stays unread — silently, unlike `kg`.
        expect(String(phonemize("$60 m", "ig"))).toBe("iɾi isii dollaɾ m");
    });

    test("the squared word is `skwea`, and the obvious candidate was the wrong word", () => {
        // The artifact writes `km2` in ASCII (4 after a digit; it contains no `km²` at all). Declaring `km`
        // WITHOUT a measure word made that worse, not better: the tier re-emits the exponent, and an ascii `2`
        // is not a visible leak — it is a NUMBER, so `790 km2` read *"… kilomita abʊɔ"*, "790 kilometres two".
        // ⚠ Both corpora write *"square kilomita"* and `square` attests ×154 — but every example is a proper
        // noun (`P-Square`, `Cabot Square`, `Square Records`). The measure word is `skwea` (×44 / 19 articles),
        // and every one of ITS examples is this slot: *"kilomita skwea 7,223 (maịl skwea 2,789)"*. Noun, then
        // modifier, then number — `position: "after"` plus `unitPrefix`, which is that shape exactly.
        expect(normalizeIgbo("790 km2")).toBe("kilomita skwea 790");
        expect(String(phonemize("790 km²", "ig"))).toBe("kilomita skʷea naɾɪ asaa na iɾi itoolu");
    });

    test("⚠ rule 2b: a letter fused to a quantity, because unitPrefix moves the noun LEFT", () => {
        // The artifact writes *"mpaghara ala198 km2"* with no space. Before units existed this read fine — the
        // number path inserts its own boundary. The unit rule rewrites `198 km2` starting AT the digit, so the
        // noun lands against `ala` and the utterance gained a fused word, *alakilomita*. A defect this layer
        // INTRODUCED, one utterance in 459, caught by the corpus diff and not by any probe.
        expect(normalizeIgbo("mpaghara ala198 km2")).toBe("mpaghara ala kilomita skwea 198");
        // ⚠ Deliberately narrow — it fires only when a DECLARED UNIT follows, which is what makes the digits a
        // quantity. A general letter/digit split would maul every alphanumeric designation in the corpus.
        expect(normalizeIgbo("Il-76 na 1990")).toBe("Il-76 na 1990");
        expect(normalizeIgbo("COVID19 na 2020")).toBe("COVID19 na 2020");
    });

    test("⚠ the ENGLISH ORDINAL TAIL — the largest single raw-Latin leak in the artifact", () => {
        // Igbo has no digit-ordinal orthography of its own, so ig.wikipedia writes the English suffix inside
        // Igbo prose. The number was already read; only the two letters survived, and igbo.ts PRONOUNCES an
        // unknown ASCII run — `32nd` came out *"iri atọ na abụọ nd"*. 13 of 31 raw-Latin hits, one shape.
        //
        // The reading is `nke` + the CARDINAL, which the corpus states rather than implies: 48 instances of
        // `nke` before a numeral, ordinal in sense every time it is checkable (*"ụbọchị nke iri na isii"*,
        // *"narị afọ nke iri na itoolu"*). ⚠ And one of them is inside a sentence this rule fires on —
        // *"Nigeria bụ mba 8th nke kacha emepụta mmanụ, na nke iri kachasị"* writes the English ordinal and
        // the Igbo one in the same breath.
        expect(normalizeIgbo("mba 32nd kachasị")).toBe("mba nke 32 kachasị");
        expect(String(phonemize("Nigeria bụ mba 8th", "ig"))).toBe("niɡeɾia bʊ mba nke asatɔ");
        expect(String(phonemize("Naijiria na 2007 bu 37th", "ig"))).toBe(
            "naid͡ʒiɾia na puku abʊɔ na asaa bu nke iɾi atɔ na asaa",
        );
        // ⚠ No word is coined and no numeral is recomposed here: the rule emits `nke` plus the ORIGINAL
        // DIGITS and hands them to the one compositor, so a grouped ordinal survives rule 1 first.
        expect(normalizeIgbo("1,000th")).toBe("nke 1000");
    });

    test("⚠ the ordinal rule is anchored on the DIGIT, because the two letters are Igbo material", () => {
        // Igbo's dotted vowels ⟨ị ọ ụ⟩ are not ASCII, so a plain-ASCII run falls out of the middle of an
        // ordinary word — `ndị` yields `nd` and `Kraịst` yields `st`, both of which RAW-LATIN reports. A
        // letter-anchored rule would rewrite the language; only the digit separates the ordinal from the
        // orthography.
        expect(normalizeIgbo("Ndị Kraịst na ndị ọzọ")).toBe("Ndị Kraịst na ndị ọzọ");
        // `St.` the saint title is not a digit ordinal either, and stays untouched (and reported).
        expect(normalizeIgbo("nke Ndị Kraịst bịa St. Columba")).toBe("nke Ndị Kraịst bịa St. Columba");
    });
});
