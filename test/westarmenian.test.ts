import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/westarmenian/westarmenian.ts";
import { phonemizeWord as eastern } from "../src/languages/armenian/armenian.ts";

// Canonical-IPA goldens for WESTERN Armenian (hyw) — արեւմտահայերէն, the Istanbul/diaspora standard. The signature is
// the CONSONANT SHIFT: the classical three-way stop/affricate system collapses to a two-way one — classical VOICED
// ⟨բ դ գ ձ ջ⟩ and classical ASPIRATE ⟨փ թ ք ց չ⟩ both → voiceless-aspirated [pʰ tʰ kʰ t͡sʰ t͡ʃʰ], while classical
// VOICELESS ⟨պ տ կ ծ ճ⟩ → VOICED [b d ɡ d͡z d͡ʒ]. Referee: wikipron hye_armn_w broad + narrow.
describe("Western Armenian (արեւմտահայերէն) canonical IPA", () => {
    test("THE CONSONANT SHIFT — classical voiceless ⟨պ տ կ⟩ → VOICED [b d ɡ]", () => {
        expect(phonemizeWord("պատ")).toBe("bɑd"); // 'wall' — ⟨պ⟩→[b], final ⟨տ⟩→[d]
        expect(phonemizeWord("տուն")).toBe("dun"); // 'house' — ⟨տ⟩→[d]
        expect(phonemizeWord("կով")).toBe("ɡov"); // 'cow' — ⟨կ⟩→[ɡ]
        expect(phonemizeWord("ծառ")).toBe("d͡zɑɾ"); // 'tree' — ⟨ծ⟩→[d͡z]
        expect(phonemizeWord("ճամբա")).toBe("d͡ʒɑmpʰɑ"); // 'road' — ⟨ճ⟩→[d͡ʒ], and ⟨բ⟩→[pʰ]
    });

    test("THE CONSONANT SHIFT — classical voiced ⟨բ դ գ⟩ → voiceless-ASPIRATED [pʰ tʰ kʰ]", () => {
        expect(phonemizeWord("բարի")).toBe("pʰɑɾi"); // 'kind' — ⟨բ⟩→[pʰ]
        expect(phonemizeWord("դուռ")).toBe("tʰuɾ"); // 'door' — ⟨դ⟩→[tʰ], and ⟨ռ⟩→[ɾ] (neutralised)
        expect(phonemizeWord("գործ")).toBe("kʰoɾd͡z"); // 'work' — ⟨գ⟩→[kʰ], ⟨ծ⟩→[d͡z]
        expect(phonemizeWord("ձուկ")).toBe("t͡sʰuɡ"); // 'fish' — ⟨ձ⟩→[t͡sʰ], ⟨կ⟩→[ɡ]
        expect(phonemizeWord("ջուր")).toBe("t͡ʃʰuɾ"); // 'water' — ⟨ջ⟩→[t͡ʃʰ]
    });

    test("classical aspirate ⟨փ թ ք⟩ stay [pʰ tʰ kʰ] — MERGING with the shifted voiced column", () => {
        expect(phonemizeWord("փակ")).toBe("pʰɑɡ"); // ⟨փ⟩→[pʰ] (= ⟨բ⟩), ⟨կ⟩→[ɡ]
        expect(phonemizeWord("թութ")).toBe("tʰutʰ"); // ⟨թ⟩→[tʰ] (= ⟨դ⟩)
        expect(phonemizeWord("քար")).toBe("kʰɑɾ"); // ⟨ք⟩→[kʰ] (= ⟨գ⟩)
    });

    test("shared features + the front-rounded ⟨յու⟩→[ʏ] is POST-CONSONANT ONLY", () => {
        expect(phonemizeWord("Երևան")).toBe("jeɾevɑn"); // word-initial ⟨ե⟩→[je]; ligature ⟨և⟩→[ev]
        expect(phonemizeWord("Առյուծ")).toBe("ɑɾʏd͡z"); // C+⟨յու⟩→[ʏ] front-rounded (after ⟨ռ⟩); ⟨ծ⟩→[d͡z]
        expect(phonemizeWord("Հարություն")).toBe("hɑɾutʰʏn"); // C+⟨յու⟩→[ʏ] (the -ություն suffix, after ⟨թ⟩)
        expect(phonemizeWord("յոթ")).toBe("jotʰ"); // 'seven' — word-initial ⟨յո⟩ is the GLIDE [jo], NOT [œ]
        expect(phonemizeWord("յուղ")).toBe("juʁ"); // 'oil' — word-initial ⟨յու⟩ is the GLIDE [ju], NOT [ʏ]
    });

    test("the same word diverges from EASTERN precisely on the stop series", () => {
        expect(phonemizeWord("պատ")).toBe("bɑd"); // Western
        expect(eastern("պատ")).toBe("pɑt"); // Eastern — the voicing is mirror-imaged
        expect(phonemizeWord("բարի")).toBe("pʰɑɾi"); // Western
        expect(eastern("բարի")).toBe("bɑɾi"); // Eastern
    });
});
