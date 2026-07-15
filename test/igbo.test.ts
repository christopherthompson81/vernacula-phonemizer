import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/igbo/igbo.ts";

// Adjudicated canonical-IPA gold for Igbo / Asụsụ Igbo (ig) — Igboid (Volta-Niger), Yoruba's sibling. NO
// independent referee exists (no wikipron/epitran/kaikki ibo) → this hand-adjudicated gold (Emenanjo 1978;
// Green & Igwe 1963) is the committed anchor. Signature features: labial-velars ⟨gb⟩→ɡ͡b / ⟨kp⟩→k͡p, labialised
// ⟨nw⟩→ŋʷ ⟨kw⟩→kʷ ⟨gw⟩→ɡʷ, ⟨ny⟩→ɲ, ⟨ch⟩→t͡ʃ, ⟨gh⟩→ɣ; dotted vowels ị→ɪ ọ→ɔ ụ→ʊ (8-vowel harmony); TWO tones
// (High=acute ˥, Low=grave ˩) read only when MARKED (Igbo orthography usually omits tone). See docs/ig_native_bringup_investigation.md.
describe("igbo canonical IPA", () => {
    test("labial-velars, labialised, palatal, dotted vowels", () => {
        const cases: [string, string][] = [
            ["Igbo", "iɡ͡bo"], // gb → ɡ͡b
            ["asụsụ", "asʊsʊ"], // 'language' — ụ → ʊ
            ["nwoke", "ŋʷoke"], // 'man' — nw → ŋʷ
            ["nwaanyị", "ŋʷaaɲɪ"], // 'woman' — nw → ŋʷ, ny → ɲ, ị → ɪ
            ["kpọọ", "k͡pɔɔ"], // kp → k͡p, ọ → ɔ
            ["chọrọ", "t͡ʃɔɾɔ"], // 'want' — ch → t͡ʃ, r → ɾ
            ["ọma", "ɔma"], // 'good'
            ["ụlọ", "ʊlɔ"], // 'house'
            ["mmadụ", "mmadʊ"], // 'person' — syllabic-ish mm
        ];
        for (const [w, exp] of cases) expect(phonemizeWord(w)).toBe(exp);
    });

    test("tone read when marked (High ˥ / Low ˩)", () => {
        expect(phonemizeWord("ọ́nụ")).toBe("ɔ˥nʊ"); // 'mouth' — high tone (dot-below + acute)
        expect(phonemizeWord("àkwụ́kwọ́")).toBe("a˩kʷʊ˥kʷɔ˥"); // 'book' — low·high·high, kw → kʷ
        expect(phonemizeWord("ọ̀tụ̀tụ̀")).toBe("ɔ˩tʊ˩tʊ˩"); // 'many' — all low
    });
});
