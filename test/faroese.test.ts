import { describe, expect, test } from "vitest";
import { phonemize } from "../src/index.ts";
import { normalizeFaroese } from "../src/languages/faroese/normalize.ts";

import { phonemizeWord } from "../src/languages/faroese/faroese.ts";
import { getPhonemizer } from "../src/registry.ts";
import { numberToWords } from "../src/languages/faroese/numbers.ts";

// Canonical-IPA goldens for Faroese / føroyskt (fo) — North Germanic (Insular Scandinavian, sibling of Icelandic),
// one of the deepest orthographies in the fleet. The core rule is that vowel LENGTH conditions vowel QUALITY
// (open syllable → long/diphthongal, closed → short/monophthong); plus b/d/g→p/t/k, intervocalic ð/g→glide,
// g/k→t͡ʃ before front vowels, skerping, ng-palatalization. Referee: wikipron fao_latn_broad (human).
describe("Faroese (føroyskt) canonical IPA", () => {
    test("length-conditioned vowel quality (open→long, closed→short) + b/d/g→p/t/k", () => {
        expect(phonemizeWord("maður")).toBe("mɛaːvʊɹ"); // open: a→[ɛaː] long; ð→[v] (round u); m man
        expect(phonemizeWord("land")).toBe("lant"); // closed: a→[a] short (before cluster); d→[t]
        expect(phonemizeWord("dagur")).toBe("tɛaːvʊɹ"); // d→[t]; open a→[ɛaː]; intervocalic g→[v] (round u)
        expect(phonemizeWord("bátur")).toBe("pɔɑːtʊɹ"); // b→[p]; á→[ɔɑː] long
    });

    test("intervocalic ⟨g ð⟩ glide by neighbour (front→j, round→v) + front-vowel affrication", () => {
        expect(phonemizeWord("vegur")).toBe("veːvʊɹ"); // g→[v] (round u wins; e is neutral)
        expect(phonemizeWord("Eyður")).toBe("ɛiːjʊɹ"); // ð→[j] (the i-offglide of ⟨ey⟩ wins over round u)
        expect(phonemizeWord("kirkja")).toBe("t͡ʃɪɹt͡ʃa"); // ⟨k⟩→[t͡ʃ] before front ⟨i⟩ and ⟨kj⟩→[t͡ʃ]
        expect(phonemizeWord("gøta")).toBe("køːta"); // ⟨g⟩ before ⟨ø⟩ is NOT affricated → [k]; ø→[øː] long
    });

    test("the Faroese hallmarks — skerping + ng-palatalization", () => {
        expect(phonemizeWord("dúgva")).toBe("tɪkva"); // SKERPING: ú→[ɪ] before ⟨gv⟩
        expect(phonemizeWord("nýggjur")).toBe("nʊt͡ʃʊɹ"); // SKERPING before ⟨ggj⟩: ý drops the offglide → [ʊ]; gg+j→[t͡ʃ]
        expect(phonemizeWord("gangi")).toBe("kɛɲt͡ʃɪ"); // ng: ⟨n⟩→[ɲ] before the affricate, a→[ɛ]; ⟨g⟩→[t͡ʃ]
        expect(phonemizeWord("fólk")).toBe("fœlk"); // ó→[œ] short (before cluster)
        expect(phonemizeWord("hús")).toBe("hʉuːs"); // ú→[ʉuː] long
    });

    test("registry wiring", () => {
        expect(getPhonemizer("fo").text("land").trim()).toBe("lant");
    });

    // CARDINAL NUMBERS — like Danish, Faroese is units-FIRST fused with "og" (einogtjúgu = 21) and chains magnitude
    // groups with "og". Two judgment calls: the modern DECIMAL tens (fimmti/seksti/sjeyti/áttati/níti) over the
    // Danish-derived vigesimal layer (hálvtrýss/trýss/hálvfjerðs/fýrs/hálvfems), and the NEUTER counting series
    // (eitt, tvey, trý) as the citation form. Sources: omniglot + faroeseonline. See faroese/numbers.ts.
    test("numbers: units-first og-compounds on the decimal tens, neuter citation forms", () => {
        expect(numberToWords(0)).toBe("null");
        expect(numberToWords(3)).toBe("trý"); // NEUTER counting form (not masc. tríggir)
        expect(numberToWords(21)).toBe("einogtjúgu"); // unit first, fused; compound "one" is ein-, not eitt-
        expect(numberToWords(55)).toBe("fimmogfimmti"); // decimal fimmti, not vigesimal hálvtrýss
        expect(numberToWords(99)).toBe("níggjuogníti");
        expect(numberToWords(100)).toBe("eitt hundrað");
        expect(numberToWords(555)).toBe("fimm hundrað og fimmogfimmti");
        expect(numberToWords(1000)).toBe("eitt túsund");
        expect(numberToWords(12345)).toBe("tólv túsund og trý hundrað og fimmogfýrati");
        expect(numberToWords(1000000)).toBe("ein millión");
        expect(numberToWords(1000000000)).toBe("ein milliard");
    });

    test("numbers: wired into the phonemizer", () => {
        expect(getPhonemizer("fo").text("21").trim()).toBe("aiːnɔkt͡ʃʏvʊ"); // einogtjúgu
        expect(getPhonemizer("fo").text("1000").trim()).toBe("ait tʉuːsʊnt"); // eitt túsund
    });
});

// ── TEXT NORMALIZATION (src/languages/faroese/normalize.ts) ─────────────────────────────────────────
//
// Evidence: `tools/corpus/mined/fo.jsonc` (fo.wikipedia dump, 52,355 paragraph segments). The argument
// for every case is in the normalizer's own header.
describe("Faroese text normalization", () => {
    const fo = { text: (s: string) => phonemize(s, "fo") };

    test("⚠ THE FULL STOP DOES FIVE JOBS, and the layer resolves them in order", () => {
        // 1. the TIME — two dots, and the only instance is the leap second.
        expect(normalizeFaroese("23.59.60")).toBe("23 59 60");
        // 2. the THOUSANDS GROUP — exactly three digits follow.
        expect(normalizeFaroese("49.267")).toBe("49267");
        expect(normalizeFaroese("11.738")).toBe("11738");
        // 3. the DECIMAL — fewer than three, and in this corpus always a dollar figure.
        expect(normalizeFaroese("3.00 kr")).toBe("3,00 kr");
        expect(normalizeFaroese("4.19$")).toBe("4,19$");
        // 4. the ORDINAL MARKER — a lowercase word follows.
        expect(normalizeFaroese("1. juli 2011")).toBe("1 juli 2011");
        expect(normalizeFaroese("2. og 3. ættarlið")).toBe("2 og 3 ættarlið");
        // 5. ⚠ AND THE SENTENCE END MUST SURVIVE — an uppercase word follows.
        expect(normalizeFaroese("Tað var 1998. Síðan kom")).toBe("Tað var 1998. Síðan kom");
    });

    test("the ORDINAL WORD is refused and the false BREAK is fixed — not the same thing", () => {
        // The date slot takes the WEAK form (`fyrsta` ×51 against `fyrsti` ×29), and of the 31 day
        // ordinals `sekstandi` (16), `nítjandi` (19) and every compound above 20 score ZERO. A bounded
        // table would cover about half the month and be in the wrong case for all of it.
        expect(fo.text("23. apríl")).toBe(fo.text("23 apríl"));
        expect(fo.text("1. juli")).not.toContain(".");
    });

    test("the abbreviations, every expansion the corpus's own", () => {
        // "62° norðurbreidd, 7° vesturlongd" spells out what `n.br.` abbreviates, three articles away.
        expect(normalizeFaroese("57°71° n.br.")).toBe("57 stig 71 stig norðurbreidd.");
        expect(normalizeFaroese("4000 f.Kr.")).toBe("4000 fyri Kristus.");
        expect(normalizeFaroese("kl. 3 e.m.")).toBe("klokkan 3 eftir middag.");
        expect(normalizeFaroese("2,5 mió. kr.")).toBe("2,5 milliónir kr.");
    });

    test("⚠ THE COLON IS NOT A CLOCK HERE — it is a national swimming record", () => {
        // `9:59.91`, `14:46.33`, `2:25.36` are minutes:seconds.hundredths; the one real clock in the
        // corpus is written `kl. 3 e.m.` with no colon at all. A clock rule would read every record as a
        // time of day (trap 9).
        expect(normalizeFaroese("9:59.91")).toBe("9:59,91");
    });

    test("degrees, the decimal comma and the range's pause", () => {
        expect(fo.text("56,7 °C")).toBe("sɛksɔkfɪmtɪ kɔma ʃɛiː stiːk kɛlsɪʊs");
        expect(fo.text("79 %")).toBe("nʊt͡ʃʊɔkʃɛitɪ pɹoːsɛnt");
        expect(normalizeFaroese("1269–1308")).toBe("1269, 1308");
        // ⚠ NOTHING MAY BE REQUIRED AFTER THE SECOND NUMBER (trap 58).
        expect(normalizeFaroese("s. 96-100.")).toBe("s. 96, 100.");
    });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// #1080 — the bignum fallback used to re-read the float it exists to bypass.
//
// `unitsFirstNumbers.ts` is shared by da, fo, lb and bar; Danish's call site was threaded in #1079 and the
// other three were reported rather than copied, because a sibling is a hypothesis and each call site's
// SHAPE had to be read first. ⚠ fo's is the one that differs: its number arm carries a DECIMAL COMMA and is split, so the `raw` is the
// piece before the comma, not the whole match — the same trap Croatian's call site set.
//
// ⚠ The reading was a confidently WRONG quantity, not a drop — the sentence still scans, so no leak gate
// and no referee names it, and this golden's longest digit run is far short of the fallback.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────
describe("a numeral past 2^53 reads the digits the writer typed", () => {
    const words = (s: string): string[] => phonemize(s, "fo").trim().split(" ");

    test("the low digits are the token's, not the double's", () => {
        // 9007199254740993 is 2^53+1; as a double it IS 2^53, so re-stringifying reads …992.
        expect(words("9007199254740993").slice(-1)[0]).toBe("tɹʊiː"); // …993, was its neighbour's …992
    });

    test("and above 1e21, where String(n) is exponent form, every digit is still read", () => {
        expect(words("1000000000000000000000")).toHaveLength(22);
    });
});
