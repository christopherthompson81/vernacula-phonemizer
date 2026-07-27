import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/tibetan/tibetan.ts";
import { getPhonemizer } from "../src/registry.ts";

// Canonical-IPA goldens for Standard / Lhasa Tibetan (bo) — the fleet's first Bodish/Tibetic (Sino-Tibetan) language
// and ONE OF THE DEEPEST orthographies in the world. Classical spelling encodes Old Tibetan; the Lhasa reading is a
// syllable-stack rule engine: TONE from tonogenesis (˥ high / ˩ low), SILENT prefixes/superscripts, onset-cluster
// realization (ya-btags→palatal, ra-btags→retroflex affricate, subjoined-ha→ɬ), and suffix-driven vowel UMLAUT
// (a→ɛ o→ø u→y) / LENGTH / NASALIZATION / GLOTTALIZATION. Validated at 97.5% vs the INDEPENDENT hand-curated JIPA
// 'Central Tibetan (Lhasa)' illustration; 100% coverage on 300k independent TIBMD Lhasa tokens. See
// docs/investigations/bo_native_bringup_investigation.md.
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

    test("text: shad → clause break, Tibetan numerals → digits (spelling deferred)", () => {
        expect(getPhonemizer("bo").text("བོད་སྐད། ༢༠").trim()).toBe("pʰøʔ˩kɛʔ˥ , 20"); // 'Tibetan language', shad, ༢༠→20
    });
});
