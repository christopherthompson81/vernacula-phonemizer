import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import {
    numberWords,
    phonemizeWord,
    phonemizeWordRules,
} from "../src/languages/tagalog/tagalog.ts";

// Canonical-IPA goldens for Tagalog / Filipino (tl) — shallow near-phonemic Latin orthography, rule-based g2p.
// Digraphs ng→ŋ, ch→t͡ʃ, ny/ñ→ɲ; r→ɾ; word-initial + intervocalic glottal stops [ʔ] (tao→taʔo); hyphen → [ʔ]
// (pag-ibig→paɡʔibiɡ); whole-word irregulars (mga→maŋa, ng→naŋ); penultimate stress (phonemic stress is
// unmarked in spelling). See docs/tl_native_bringup_investigation.md.
describe("tagalog canonical IPA", () => {
    test("g2p: ng digraph, r→ɾ, glottal stops, special words", () => {
        const cases: [string, string][] = [
            ["mabuti", "mabˈuti"], // penult stress, r→ɾ absent here
            ["tao", "tˈaʔo"], // intervocalic glottal stop
            ["maganda", "maɡandˈa"], // ɡ; final stress (magandá) — from the stress lexicon, not naive penult
            ["kaibigan", "kaʔibˈiɡan"], // intervocalic ʔ + ɡ; penult (default)
            ["ngayon", "ŋajˈon"], // ng→ŋ, y→j; final stress (ngayón) — stress lexicon
            ["mga", "maŋˈa"], // special word: plural marker, pronounced mangá (final stress) — stress lexicon
            ["araw", "ʔˈaɾaw"], // word-initial ʔ, r→ɾ, w
        ];
        for (const [w, exp] of cases) expect(phonemizeWord(w)).toBe(exp);
    });

    test("word-final glottal stop set (shipped) vs rule-only (unwritten, lexical)", () => {
        // The word-final ʔ is phonemic but unwritten (a lexical residual). The shipped path appends it for words in
        // the wikipron-sourced set; the rule engine (used by the non-circular referee eval) does not.
        expect(phonemizeWord("acda")).toBe("ʔˈakdaʔ");
        expect(phonemizeWordRules("acda")).toBe("ʔˈakda");
        expect(phonemizeWord("aguho")).toBe("ʔaɡˈuhoʔ");
        // Words NOT in the set are unchanged (and an already-ʔ-final rule output is not doubled):
        expect(phonemizeWord("tao")).toBe("tˈaʔo");
        expect(phonemizeWord("araw")).toBe("ʔˈaɾaw");
    });

    test("stress lexicon (shipped) vs penult default (rule-only)", () => {
        // Phonemic stress is unwritten; the rule engine defaults to penultimate, but ~23% of words stress elsewhere.
        // The shipped path pins stress from a kaikki-sourced lexicon (single confident position); the rule engine
        // (used by the non-circular referee eval, which folds stress anyway) keeps the penultimate default.
        expect(phonemizeWord("salmon")).toBe("salmˈon"); // final stress (loanword)
        expect(phonemizeWordRules("salmon")).toBe("sˈalmon"); // penult default
        expect(phonemizeWord("doktor")).toBe("doktˈoɾ");
        expect(phonemizeWordRules("doktor")).toBe("dˈoktoɾ");
        // Stress homographs (kaikki lists >1 position) are abstained → penult default on both paths:
        expect(phonemizeWord("balik")).toBe("bˈalik");
    });

    test("loanword phonology: safe rules + shipped loanword lexicon", () => {
        // Safe deterministic rules (no native counterexample): ⟨z⟩→[s] (no native [z]), geminate ⟨rr⟩→[ɾ].
        expect(phonemizeWordRules("almarez")).toBe("ʔalmˈaɾes"); // z→s
        expect(phonemizeWordRules("aparri")).toBe("ʔapˈaɾi"); // rr→ɾ (not ɾɾ)
        // The FOREIGN-SEGMENT loanword class (Spanish ⟨j⟩→[h], soft ⟨c⟩→[s]) is pinned per-word on the SHIPPED path
        // only — origin-specific, so it never touches native words; the rule engine keeps ⟨j⟩→[d͡ʒ] → non-circular eval.
        expect(phonemizeWord("abenojar")).toBe("ʔabenˈohaɾ"); // Spanish ⟨j⟩→[h]
        expect(phonemizeWord("abece")).toBe("ʔabˈese"); // soft ⟨c⟩→[s]
        expect(phonemizeWordRules("abenojar")).toBe("ʔabenˈod͡ʒaɾ"); // rule engine keeps native ⟨j⟩→[d͡ʒ]
        // The ambiguous VV/glide/hiatus class is deliberately NOT mined (same spelling is native): core native words
        // keep their glide/ʔ, and a loan spelled the same way keeps the rule reading — no per-word corruption.
        expect(phonemizeWord("siya")).toBe("sˈija"); // native glide intact (would be corrupted by VV mining)
        expect(phonemizeWord("tao")).toBe("tˈaʔo"); // native hiatus ʔ intact
        expect(phonemizeWord("mabuti")).toBe("mabˈuti");
    });

    test("hyphen → glottal stop; number", () => {
        expect(phonemize("pag-ibig", "tl")).toBe("paɡʔˈibiɡ");
        expect(phonemize("salamat", "tl")).toContain("salˈamat");
    });

    // Native Tagalog number morphology (Wiktionary Appendix:Tagalog_numbers): irregular teens (labing- sandhi) and
    // tens (o→u raising, na/ng split), the productive -ng/" na" ligature + daan→raan + at→'t sandhi. Orthography
    // asserted directly; the IPA is derived via g2p (numbers are final-stressed except a penult exception set).
    test("number orthography (composition + ligature sandhi)", () => {
        const cases: [number, string][] = [
            [12, "labindalawa"],
            [14, "labing-apat"],
            [17, "labimpito"],
            [20, "dalawampu"],
            [21, "dalawampu't isa"],
            [40, "apatnapu"],
            [90, "siyamnapu"],
            [100, "sandaan"],
            [101, "sandaan at isa"],
            [125, "sandaan at dalawampu't lima"],
            [200, "dalawang daan"],
            [400, "apat na raan"], // daan → raan after the " na" ligature
            [900, "siyam na raan"],
            [1000, "sanlibo"],
            [2000, "dalawang libo"],
            [12345, "labindalawang libo tatlong daan at apatnapu't lima"],
            [100000, "sandaang libo"], // n-final ligature: daan/sandaan → daang/sandaang (not " na")
            [200000, "dalawang daang libo"],
            [1000000, "isang milyon"],
        ];
        for (const [n, exp] of cases) expect(numberWords(n)).toBe(exp);
    });

    test("number stress (final-except-penult; number-sense homographs)", () => {
        expect(phonemize("0", "tl")).toBe("sˈeɾo"); // séro — penult exception
        expect(phonemize("5", "tl")).toBe("limˈa"); // limá — final (number sense, general lexicon abstains)
        expect(phonemize("20", "tl")).toBe("dalawampˈu"); // dalawampú — final
        expect(phonemize("100", "tl")).toBe("sandaʔˈan"); // sandaán — final
        expect(phonemize("1000", "tl")).toBe("sanlˈibo"); // sanlíbo — penult exception
        expect(phonemize("200", "tl")).toBe("dalawˈaŋ daʔˈan"); // dalawáng daán — ligature keeps final stress
    });
});
