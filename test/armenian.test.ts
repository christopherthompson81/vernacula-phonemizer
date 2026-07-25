import { describe, expect, test } from "vitest";

import { phonemizeWord, createArmenian } from "../src/languages/armenian/armenian.ts";

// Armenian (hy) — Indo-European (own branch), own alphabet. EASTERN Armenian (Yerevan). Left-to-right greedy scan +
// the ⟨ու⟩=u digraph, word-initial glides (ե→je, ո→vo, և→jev), and schwa epenthesis (word-initial/final clusters).
// Signatures: the three-way stop/affricate system (b/p/pʰ …), uvulars խ→χ/ղ→ʁ, tap ր→ɾ vs trill ռ→r. Scored 81.1%
// folded on wikipron hye_armn_e broad (HUMAN, 18090). See docs/investigations/hy_native_bringup_investigation.md.
describe("Armenian canonical IPA — rule g2p (Eastern Armenian)", () => {
    test("three-way stops/affricates + uvulars", () => {
        expect(phonemizeWord("բարև")).toBe("bɑɾev"); // բ=b, ր=ɾ (tap), և=ev
        expect(phonemizeWord("գիրք")).toBe("ɡiɾkʰ"); // գ=ɡ, ք=kʰ (aspirated)
        expect(phonemizeWord("քաղաք")).toBe("kʰɑʁɑkʰ"); // ք=kʰ, ղ=ʁ (uvular)
        expect(phonemizeWord("ձուկ")).toBe("d͡zuk"); // ձ=d͡z, ու=u
        expect(phonemizeWord("չար")).toBe("t͡ʃʰɑɾ"); // չ=t͡ʃʰ (aspirated affricate)
    });

    test("ու=u digraph + word-initial glides ե→je, ո→vo, և→jev", () => {
        expect(phonemizeWord("ուս")).toBe("us"); // ու → u
        expect(phonemizeWord("Երևան")).toBe("jeɾevɑn"); // ե→je (initial), և→ev (medial)
        expect(phonemizeWord("որդի")).toBe("voɾdi"); // ո→vo (initial)
        expect(phonemizeWord("ով")).toBe("ov"); // ո before վ → o (haplology, not *vov)
        expect(phonemizeWord("ջուր")).toBe("d͡ʒuɾ"); // ջ=d͡ʒ, ու=u
    });

    test("schwa epenthesis (initial/final clusters; s+stop kept)", () => {
        expect(phonemizeWord("գնալ")).toBe("ɡənɑl"); // #գն → ɡən
        expect(phonemizeWord("խնդիր")).toBe("χəndiɾ"); // #խն → χən
        expect(phonemizeWord("եզր")).toBe("jezəɾ"); // final զр (rising) → zəɾ
        expect(phonemizeWord("սպանել")).toBe("spɑnel"); // #սպ = s+stop kept as onset
        expect(phonemizeWord("ընկեր")).toBe("ənkeɾ"); // written ը = ə
        expect(phonemizeWord("կոմունիզմ")).toBe("komunizm"); // final -զմ stays bare (no ə before /m/)
    });

    test("cardinal numbers", () => {
        const hy = createArmenian();
        expect(hy.text("0").trim()).toBe("zəɾo"); // զրո
        expect(hy.text("2").trim()).toBe("jeɾku"); // երկու
        expect(hy.text("15").trim()).toBe("tɑsnhinɡ"); // տասնհինգ
        expect(hy.text("21").trim()).toBe("kʰəsɑn mek"); // քսան մեկ
    });

    test("text: words + Armenian clause punctuation (։)", () => {
        expect(createArmenian().text("Բարև ձեզ։")).toBe("bɑɾev d͡zez  . ");
    });
});
