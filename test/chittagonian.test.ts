import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/chittagonian/chittagonian.ts";

// Hand-adjudicated canonical-IPA gold for Chittagonian / চাটগাঁইয়া (ctg) — Eastern Indo-Aryan, Bengali-Assamese
// script. ⚠ CANNOT-VERIFY: no independent referee (no wikipron/epitran/kaikki; no JIPA; the phonology grammars
// Moniruzzaman 2007 / Hai 1965 are out of reach). Chittagonian is a DISTINCT language described almost entirely
// comparatively against Bengali, so the engine reuses the Bengali G2P (makeNativeBengali) with the DOCUMENTED
// divergences. This gold targets the DISTINCTIVE features — the axis where ctg ≠ Bengali and a Bengali clone is
// demonstrably wrong — adjudicated from Uddin (IIUC Studies 12, drawing on Moniruzzaman 2007). The shared Bengali
// bulk is asserted, not measured. See docs/investigations/ctg_native_bringup_investigation.md.
describe("chittagonian canonical IPA (distinctive features vs Bengali)", () => {
    test("SPIRANTISATION — voiceless খ→[x], ফ→[f] (Bengali has aspirated stops)", () => {
        expect(phonemizeWord("খবর")).toBe("xɔbɔɾ"); // 'news' — খ [kʰ]→[x], the sources' xabar (Bengali: kʰɔbor)
        expect(phonemizeWord("খানা")).toBe("xana"); // 'food'
        expect(phonemizeWord("ফুল")).toBe("ful"); // 'flower' — ফ [pʰ]→[f]
        expect(phonemizeWord("ফল")).toBe("fɔl"); // 'fruit'
    });

    test("LOSS OF VOICED ASPIRATES — ঘ→[ɡ], ধ→[d̪], ভ→[b] (Bengali keeps ɡʱ/d̪ʱ/bʱ)", () => {
        expect(phonemizeWord("ঘর")).toBe("ɡɔɾ"); // 'house' — ঘ [ɡʱ]→[ɡ] (deaspirated)
        expect(phonemizeWord("ধান")).toBe("d̪an"); // 'paddy' — ধ [d̪ʱ]→[d̪]
        expect(phonemizeWord("ভাত")).toBe("bat̪"); // 'rice' — ভ [bʱ]→[b], the source's bát
    });

    test("DEAFFRICATION — চ ছ → [s], জ ঝ → [z] (Bengali keeps t͡ʃ/d͡ʒ)", () => {
        expect(phonemizeWord("চা")).toBe("sa"); // 'tea'
        expect(phonemizeWord("ছয়")).toBe("sɔj"); // 'six'
        expect(phonemizeWord("মাছ")).toBe("mas"); // 'fish' — final ছ→s
        expect(phonemizeWord("জল")).toBe("zɔl"); // 'water'
        expect(phonemizeWord("ঝড়")).toBe("zɔɽ"); // 'storm'
    });

    test("[s]/[ʃ] CONTRAST — স→[s], শ→[ʃ] (Bengali merges all sibilants to [ʃ])", () => {
        expect(phonemizeWord("সাত")).toBe("sat̪"); // 'seven' — স→s
        expect(phonemizeWord("সময়")).toBe("sɔmɔj"); // 'time' — স→s
        expect(phonemizeWord("শহর")).toBe("ʃɔɦɔɾ"); // 'city' — শ→ʃ
    });

    test("contrastive NASALISATION — candrabindu (আর vs আঁর)", () => {
        expect(phonemizeWord("আর")).toBe("aɾ"); // 'and' (oral)
        expect(phonemizeWord("আঁর")).toBe("ãɾ"); // 'my' (nasal) — the paper's minimal pair
        expect(phonemizeWord("আঁই")).toBe("ãi"); // 'I'
    });

    test("shared Bengali core (asserted where ctg does not diverge)", () => {
        expect(phonemizeWord("গম")).toBe("ɡɔm"); // 'wheat/good'
        expect(phonemizeWord("পানি")).toBe("pani"); // 'water'
        expect(phonemizeWord("মাটি")).toBe("maʈi"); // 'soil' — retroflex ট kept Bengali (undocumented for ctg)
    });
});
