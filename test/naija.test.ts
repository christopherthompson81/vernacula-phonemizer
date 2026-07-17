import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/naija/naija.ts";

// Adjudicated canonical-IPA gold for Nigerian Pidgin / Naija (pcm) — the first English-lexified creole. Media
// (English-etymological, BBC-Pidgin) orthography → a LEXICON of high-frequency irregular/open-mid words + a
// Naija-phonology RULE g2p for the rest (7 vowels, TH-stopping, no schwa, ɡ͡b/k͡p, ɲ/ŋ, ɾ, degemination). NO
// independent referee exists (no wikipron/epitran/kaikki pcm) — this gold, drawn from Faraclas (1996) + the NLA
// orthography manual, IS the committed anchor. Segmental only (Naija tone is unmarked in the media orthography).
// See docs/pcm_native_bringup_investigation.md.
describe("naija (Nigerian Pidgin) canonical IPA", () => {
    test("lexicon: irregular / open-mid high-frequency words", () => {
        const cases: [string, string][] = [
            ["na", "na"], // copula
            ["dey", "dɛ"], // continuous marker — irregular ⟨ey⟩→ɛ
            ["di", "di"], // 'the'
            ["dem", "dɛm"], // 'they/them', TH written ⟨d⟩
            ["e", "i"], // 3sg subject — ⟨e⟩ pronounced /i/
            ["wetin", "wɛtin"], // 'what'
            ["go", "ɡo"], // future marker — close-mid /o/
            ["don", "dɔn"], // perfect — open /ɔ/
            ["make", "mek"], // 'let/should' — silent ⟨e⟩
            ["say", "se"], // complementizer
            ["comot", "kɔmɔt"], // 'leave' — open /ɔ/
            ["chop", "t͡ʃɔp"], // 'eat' — ⟨ch⟩→t͡ʃ
            ["abeg", "abɛɡ"], // 'please'
            ["oyibo", "ɔjibo"], // 'white person'
            ["for", "fɔ"], // preposition — /fɔ/, r dropped
            ["sef", "sɛf"], // emphatic
            ["come", "kɔm"], // silent ⟨e⟩ → /kɔm/
            ["one", "wan"], // English-etymological → /wan/
            ["you", "ju"],
        ];
        for (const [w, exp] of cases) expect(phonemizeWord(w)).toBe(exp);
    });

    test("rule g2p: nativised (phonemically-spelled) words", () => {
        const cases: [string, string][] = [
            ["pikin", "pikin"], // 'child'
            ["wahala", "wahala"], // 'trouble'
            ["waka", "waka"], // 'walk'
            ["oga", "oɡa"], // 'boss'
            ["mumu", "mumu"], // 'fool'
            ["japa", "d͡ʒapa"], // 'flee' — ⟨j⟩→d͡ʒ
            ["katakata", "katakata"], // 'chaos'
            ["danfo", "danfo"], // minibus
            ["okada", "okada"], // motorbike taxi
            ["gbege", "ɡ͡bɛɡɛ"], // 'trouble' — labial-velar ɡ͡b
            ["jollof", "d͡ʒolof"], // degemination ll→l
        ];
        for (const [w, exp] of cases) expect(phonemizeWord(w)).toBe(exp);
    });

    test("English-spelling nativisation: known-English words → Naija phonetics (via the English dict)", () => {
        // BBC-Pidgin text is mostly ENGLISH-spelled; a known-English word (English CMUdict dict-hit) is nativised
        // to the 7-vowel system, TH-stopped, NON-rhotic. Routed through phonemize → the English knownWord lookup;
        // OOV substrate loans (danfo, egusi) fall through to the rule g2p instead.
        const cases: [string, string][] = [
            ["once", "wɔns"], // STRUT → ɔ
            ["when", "wɛn"], // DRESS → ɛ
            ["while", "wail"], // PRICE → ai
            ["because", "bikɔz"], // THOUGHT → ɔ
            ["sister", "sista"], // non-rhotic coda (r dropped) + lettER → a
            ["first", "fɔst"], // NURSE → ɔ
            ["abbreviate", "abɾivijet"], // palatal glide ʲ → j
            ["though", "do"], // ð → d (TH-stopping)
            ["people", "pipal"], // schwa → a (lossy — the documented GenAm-source ceiling)
        ];
        for (const [w, exp] of cases) expect(phonemize(w, "pcm")).toBe(exp);
        // An OOV substrate loan is NOT routed through English — the rule g2p reads it phonemically:
        expect(phonemize("danfo", "pcm")).toBe("danfo");
        expect(phonemize("egusi", "pcm")).toBe("eɡusi");
    });

    test("numbers (nativised English, compositional)", () => {
        expect(phonemize("1", "pcm")).toBe("wan");
        expect(phonemize("15", "pcm")).toBe("fiftin");
        expect(phonemize("21", "pcm")).toBe("twɛnti wan");
        expect(phonemize("100", "pcm")).toBe("wan hɔndɛd");
    });

    test("running text (BBC-Pidgin sentences)", () => {
        const s = phonemize("Wetin dey happen? Di pikin don chop.", "pcm");
        expect(s).toContain("wɛtin dɛ");
        expect(s).toContain("di pikin dɔn t͡ʃɔp");
        expect(phonemize("Abeg make you no vex.", "pcm")).toContain(
            "abɛɡ mek ju no vɛks",
        );
    });
});
