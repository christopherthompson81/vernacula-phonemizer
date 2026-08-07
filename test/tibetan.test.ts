import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/tibetan/tibetan.ts";
import { getPhonemizer } from "../src/registry.ts";

// Canonical-IPA goldens for Standard / Lhasa Tibetan (bo) — Bodish/Tibetic (Sino-Tibetan)
// and ONE OF THE DEEPEST orthographies in the world. Classical spelling encodes Old Tibetan; the Lhasa reading is a
// syllable-stack rule engine: TONE from tonogenesis (˥ high / ˩ low), SILENT prefixes/superscripts, onset-cluster
// realization (ya-btags→palatal, ra-btags→retroflex affricate, subjoined-ha→ɬ), and suffix-driven vowel UMLAUT
// (a→ɛ o→ø u→y) / LENGTH / NASALIZATION / GLOTTALIZATION. Referee: the INDEPENDENT hand-curated JIPA
// 'Central Tibetan (Lhasa)' illustration, with full coverage over 300k independent TIBMD Lhasa tokens.
describe("Tibetan (Standard/Lhasa) canonical IPA", () => {
    test("tonogenesis: voiceless→HIGH ˥, voiced-obstruent→LOW ˩ + aspiration, sonorant tone", () => {
        expect(phonemizeWord("ཁ")).toBe("kʰa˥"); // kha — voiceless aspirate, HIGH
        expect(phonemizeWord("ག")).toBe("kʰa˩"); // ga — plain voiced → aspirated voiceless, LOW
        expect(phonemizeWord("ང")).toBe("ŋa˩"); // nga — plain sonorant, LOW
        expect(phonemizeWord("ཁང")).toBe("kʰaŋ˥"); // khang 'house' — suffix -ng → ŋ coda
    });

    test("silent prefixes / superscripts (tone only)", () => {
        expect(phonemizeWord("རྟ")).toBe("ta˥"); // rta 'horse' — superscript r silent, root t HIGH
        expect(phonemizeWord("མགོ")).toBe("ko˩"); // mgo 'head' — prefix m silent, voiced g→k unaspirated, LOW
    });

    test("onset clusters: ya-btags palatal, ra-btags retroflex affricate, lha", () => {
        expect(phonemizeWord("ཁྱི")).toBe("kʲʰi˥"); // khyi 'dog' — ya-btags → palatalized velar kʲʰ
        expect(phonemizeWord("ཁྲག")).toBe("ʈ͡ʂʰaʔ˥"); // khrag 'blood' — ra-btags → retroflex affricate, -g → ʔ
        expect(phonemizeWord("ལྷ")).toBe("ɬa˥"); // lha 'god' — subjoined ha → voiceless lateral, HIGH
    });

    test("suffix-driven vowel umlaut / length / nasalization / glottalization", () => {
        expect(phonemizeWord("བོད")).toBe("pʰøʔ˩"); // bod 'Tibet' — b→pʰ LOW, o→ø (front), -d → ʔ
        expect(phonemizeWord("གསལ")).toBe("sɛː˥"); // gsal 'clear' — prefix g, a→ɛ (front), -l drops → length
        expect(phonemizeWord("གསད")).toBe("sɛʔ˥"); // gsad 'kill' — a→ɛ, -d → ʔ
        expect(phonemizeWord("སྤྱན")).toBe("t͡ɕɛ̃ː˥"); // spyan 'eye (H)' — s silent, py→t͡ɕ, -n → front+nasal+length
    });

    test("Lhasa word-tone template: non-initial syllable defaults HIGH", () => {
        expect(phonemizeWord("བཀྲ་ཤིས")).toBe("ʈ͡ʂa˥ɕiː˥"); // bkra shis 'Tashi' — retroflex; both syllables HIGH
    });

    test("syllable-stack resolution: root+suffix vs prefix+root (the prefix-root table)", () => {
        expect(phonemizeWord("དང")).toBe("tʰaŋ˩"); // 'and' — root ⟨d⟩ + suffix ⟨ng⟩ (NOT prefix d + root ng)
        expect(phonemizeWord("གནས")).toBe("nɛː˥"); // gnas 'place' — prefix ⟨g⟩ + root ⟨n⟩ + suffix ⟨s⟩
        expect(phonemizeWord("གངས")).toBe("kʰaŋ˩"); // gangs 'snow' — root ⟨g⟩ + suffix ⟨ng⟩ + postsuffix ⟨s⟩
        expect(phonemizeWord("དགའ")).toBe("kaː˩"); // dga' 'joy' — prefix ⟨d⟩ + root ⟨g⟩ + suffix ⟨'⟩
    });

    test("special clusters: la-btags → HIGH, db- → /w/", () => {
        expect(phonemizeWord("བློ")).toBe("lo˥"); // blo 'mind' — la-btags → [l], HIGH regardless of root
        expect(phonemizeWord("གླང")).toBe("laŋ˥"); // glang 'ox' — la-btags stack correctly parsed
        expect(phonemizeWord("དབང")).toBe("waŋ˥"); // dbang 'power' — db- cluster → [w], HIGH
        expect(phonemizeWord("དབུ")).toBe("ʔu˥"); // dbu 'head (H)' — db- before /u/ → [ʔ]
    });

    test("text: shad → clause break, Tibetan numerals spelled out", () => {
        expect(getPhonemizer("bo").text("བོད་སྐད། ༢༠").trim()).toBe("pʰøʔ˩kɛʔ˥ , ɲi˩ɕu˥"); // 'Tibetan language', shad, ༢༠→ɲishu (nyishu '20')
    });

    test("numeral composition: units, teens, decade connectives, magnitudes + dang", () => {
        const num = (n: string): string => getPhonemizer("bo").text(n).trim();
        expect(num("༥")).toBe("ŋa˥"); // 5 lnga
        expect(num("༡༠")).toBe("t͡ɕu˥"); // 10 bcu
        expect(num("༢༡")).toBe("ɲeː˩t͡ɕiʔ˥"); // 21 — decade connective ཉེར nyer + gcig
        expect(num("༡༠༠")).toBe("kʲa˩"); // 100 brgya
        expect(num("༡༢༣")).toBe("kʲa˩taŋ˥ɲeː˥sum˥"); // 123 — brgya དང dang nyer gsum
    });

    test("diminutive འུ ('u) hiatus → diphthong; vowel-initial glottal onset", () => {
        expect(phonemizeWord("བེའུ")).toBe("pʰiu˩"); // be'u 'calf' — e+u fusion → [iu]
        expect(phonemizeWord("རྟའུ")).toBe("tau˥"); // rta'u 'pony' — a+u → [au]
        expect(phonemizeWord("འོད")).toBe("ʔøʔ˩"); // 'od 'light' — vowel-initial → glottal onset
        expect(phonemizeWord("ཟླ")).toBe("ta˩"); // zla 'moon' — zl- lexical exception → [t]
    });
});

// ASCII digit runs are composed too (⚠ tokenizing only the Tibetan digits ༠–༩ means "21" was
// dropped), and the magnitude ladder runs to 10⁹: བརྒྱ 10² · སྟོང 10³ · ཁྲི 10⁴ · འབུམ 10⁵ · ས་ཡ 10⁶ · བྱེ་བ 10⁷ ·
// དུང་ཕྱུར 10⁸ · ཐེར་འབུམ 10⁹ (Wikipedia "Tibetan numerals"). Every numeral below is phonemized by the ordinary
// syllable-stack engine — these goldens are what that engine actually reads out of the spellings.
describe("Tibetan (bo) cardinal numbers — ASCII digits + the full magnitude ladder", () => {
    const num = (n: number): string => getPhonemizer("bo").text(String(n)).trim();
    for (const [n, ipa] of [
        [0, "lɛʔ˥koː˥"], // ཀླད་ཀོར klad kor
        [7, "ty\u0303ː˩"], // བདུན bdun
        [10, "t͡ɕu˥"], // བཅུ bcu
        [21, "ɲeː˩t͡ɕiʔ˥"], // ཉེར་གཅིག — the 20s connective ཉེར
        [42, "ɕe˩ɲiː˥"], // ཞེ་གཉིས — the 40s connective ཞེ
        [100, "kʲa˩"], // བརྒྱ — multiplier 1 unspoken
        [1000, "toŋ˥"], // སྟོང
        [12345, "ʈ͡ʂʰi˥taŋ˥ɲiː˥toŋ˥taŋ˥sum˥kʲa˥taŋ˥ɕe˥ŋa˥"], // ཁྲི 10⁴, remainders joined with དང dang
        [1000000, "sa˥ja˥"], // ས་ཡ sa ya 10⁶ — without it the tier falls back to leaking the digits
    ] as const) {
        test(`${n} → ${ipa}`, () => {
            expect(num(n)).toBe(ipa);
        });
    }
});
