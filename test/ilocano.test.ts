import { describe, expect, test } from "vitest";

import { createIlocano, phonemizeWord, phonemizeWordRules } from "../src/languages/ilocano/ilocano.ts";

// Canonical-IPA goldens for Ilocano / Iloko (ilo) — Austronesian (Northern Luzon, NOT Bisayan), Latin. TWO paths:
// phonemizeWordRules = the non-circular RULE g2p (what the referee eval measures, ~83%); phonemizeWord = the shipped
// path (a stress-marked-referee lexicon first, then the rule). The rule's Ilocano-distinctive HIATUS: a HIGH vowel
// ⟨i u⟩ before a vowel GLIDES (dua→dwa, radio→ɾadjo). Whether a high vowel glides vs stays syllabic is LEXICAL
// (garcia stays but radio glides — identical C-i-V, differ only in lexical stress); the lexicon carries that.
// See docs/investigations/ilo_native_bringup_investigation.md.
describe("Ilocano — the RULE g2p (phonemizeWordRules; the non-circular eval path)", () => {
    test("high-vowel GLIDING hiatus: i→j, u→w before a vowel (the split from Bisayan)", () => {
        expect(phonemizeWordRules("dua")).toBe("dwˈa"); // ⟨u⟩ before a → w
        expect(phonemizeWordRules("radio")).toBe("ɾˈadjo"); // ⟨i⟩ before o → j
        expect(phonemizeWordRules("dies")).toBe("djˈɛs"); // ⟨i⟩ before e → j; ⟨e⟩→ɛ
    });
    test("non-high hiatus keeps the glottal; word-initial glottal", () => {
        expect(phonemizeWordRules("tao")).toBe("tˈaʔo"); // a+o hiatus → glottal
        expect(phonemizeWordRules("naimbag")).toBe("naʔˈimbaɡ"); // a+i hiatus glottal
        expect(phonemizeWordRules("agtutubo")).toBe("ʔaɡtutˈubo"); // word-initial glottal
    });
});

describe("Ilocano — the shipped LEXICON path (phonemizeWord) fixes the lexical residual", () => {
    test("lexical gliding: the stressed high vowel STAYS syllabic (what the rule can't derive)", () => {
        expect(phonemizeWord("garcia")).toBe("ɡaɾsˈia"); // i STAYS (rule wrongly glides → ɡaɾkja)
        expect(phonemizeWord("kua")).toBe("kuˈa"); // u STAYS (rule → kwa)
        expect(phonemizeWord("biblioteka")).toBe("bibliotˈɛka"); // io STAYS (rule → bibljo…)
    });
    test("OOV falls back to the rule g2p", () => {
        expect(phonemizeWord("zzqx")).toBe(phonemizeWordRules("zzqx"));
    });
});

// Native Ilocano cardinal numbers (numbers.ts): composed MORPHOLOGICALLY — "sanga-" for a multiplier of 1
// (sangapulo, sangagasut, sangaribo, sangariwriw), a fused vowel-final digit (duapulo) vs. the "a" ligature after a
// consonant-final one (uppat a pulo), and the places chained by "ket". The NATIVE set, not the co-current Spanish
// loans (onse, beinte, mil), following the tagalog/cebuano precedent. Sources cited in ilocano.jsonc + numbers.ts.
describe("Ilocano cardinal numbers", () => {
    const ilo = createIlocano();
    const say = (n: number): string => ilo.text(String(n)).trim();

    test("units and the tens (fused vs. the 'a' ligature)", () => {
        expect(say(0)).toBe("sˈɛɾo"); // sero (Spanish loan; native "awan" is 'none', not a numeral)
        expect(say(5)).toBe("lˈima"); // lima
        expect(say(20)).toBe("dwapˈulo"); // duapulo — vowel-final dua FUSES (⟨u⟩ glides → dw)
        expect(say(40)).toBe("ʔˈuppat ʔˈa pˈulo"); // uppat a pulo — consonant-final → ligature
    });

    test("compounds 11-99 chain with ket", () => {
        expect(say(11)).toBe("saŋapˈulo kˈɛt mˈajsa"); // sangapulo ket maysa
        expect(say(25)).toBe("dwapˈulo kˈɛt lˈima"); // duapulo ket lima
        expect(say(99)).toBe("sjˈam ʔˈa pˈulo kˈɛt sjˈam"); // siam a pulo ket siam
    });

    test("hundreds / thousands / millions (sanga- for 1)", () => {
        expect(say(100)).toBe("saŋaɡˈasut"); // sangagasut
        expect(say(101)).toBe("saŋaɡˈasut kˈɛt mˈajsa"); // sangagasut ket maysa
        expect(say(555)).toBe("limaɡˈasut kˈɛt limapˈulo kˈɛt lˈima"); // limagasut ket limapulo ket lima
        expect(say(1000)).toBe("saŋaɾˈibo"); // sangaribo
        expect(say(1000000)).toBe("saŋaɾˈiwɾiw"); // sangariwriw
    });

    test("the native series tops out at riwriw → ≥10⁹ reads digit-by-digit", () => {
        expect(say(1000000000).split(" ")).toHaveLength(10); // maysa sero sero … (documented fallback)
    });
});
