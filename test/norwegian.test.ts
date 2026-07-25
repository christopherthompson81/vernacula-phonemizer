import { describe, expect, test } from "vitest";

import { phonemizeWord, createNorwegian } from "../src/languages/norwegian/norwegian.ts";

// Norwegian Bokmål (nb) — North Germanic, Latin, Urban East Norwegian. Rule g2p with complementary vowel length
// (which picks quality: ⟨o⟩→uː/ɔ, ⟨u⟩→ʉː/ʉ, ⟨å⟩→oː/ɔ, short ⟨i⟩=ɪ), front-vowel softening (sk/k/g→ʃ/ç/j), the
// digraphs sj/skj→ʃ, kj/tj→ç, hv→ʋ, retroflex r+coronal→ʈ/ɳ/ɭ/ʂ, silent final ⟨d⟩, and unstressed ⟨e⟩→ə. First-
// syllable stress; pitch accent + length folded in the referee (27.5% folded on wikipron nob, referee-limited by
// loanword stress). See docs/investigations/nb_native_bringup_investigation.md.
describe("Norwegian Bokmål canonical IPA — rule g2p", () => {
    test("vowel quality via complementary length: ⟨o⟩→uː, ⟨u⟩→ʉː, ⟨å⟩→oː", () => {
        expect(phonemizeWord("bok")).toBe("ˈbuːk"); // o → uː (long, open)
        expect(phonemizeWord("hus")).toBe("ˈhʉːs"); // u → ʉː
        expect(phonemizeWord("norsk")).toBe("ˈnɔʂk"); // short o → ɔ, rs → retroflex ʂ
        expect(phonemizeWord("år")).toBe("ˈoːɾ"); // å → oː
        expect(phonemizeWord("hånd")).toBe("ˈhɔn"); // å short (nd closes), final d silent
    });

    test("digraphs + softening: sj/skj→ʃ, kj/tj→ç, gj/hj→j, hv→ʋ, sk/k before front", () => {
        expect(phonemizeWord("sjø")).toBe("ˈʃøː"); // sj → ʃ
        expect(phonemizeWord("kjøre")).toBe("ˈçøːɾə"); // kj → ç, unstressed e → ə
        expect(phonemizeWord("gjøre")).toBe("ˈjøːɾə"); // gj → j (word-initial)
        expect(phonemizeWord("hva")).toBe("ˈʋɑː"); // hv → ʋ
        expect(phonemizeWord("ski")).toBe("ˈʃiː"); // sk before front i → ʃ
    });

    test("retroflex, silent-d, unstressed schwa", () => {
        expect(phonemizeWord("barn")).toBe("ˈbɑːɳ"); // rn → retroflex ɳ
        expect(phonemizeWord("god")).toBe("ˈɡuː"); // final d silent
        expect(phonemizeWord("jord")).toBe("ˈjuːɾ"); // rd → r (d silent), o long
        expect(phonemizeWord("Bergen")).toBe("ˈbæɾɡən"); // e→æ before r; unstressed e → ə
    });

    test("cardinal numbers", () => {
        const nb = createNorwegian();
        expect(nb.text("0").trim()).toBe("ˈnʉlː"); // null
        expect(nb.text("7").trim()).toBe("ˈʃʉː"); // sju
        expect(nb.text("100").trim()).toBe("ˈhʉndɾə"); // hundre
        expect(nb.text("1000").trim()).toBe("ˈtʉːsən"); // tusen
    });

    test("text: words + clause punctuation", () => {
        expect(createNorwegian().text("Norsk er et språk.")).toBe("ˈnɔʂk ˈæːɾ ˈeːt ˈspɾoːk  . ");
    });
});
