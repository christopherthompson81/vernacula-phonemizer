import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/naija/naija.ts";

// Adjudicated canonical-IPA gold for Nigerian Pidgin / Naija (pcm) — the first English-lexified creole. Media
// (English-etymological, BBC-Pidgin) orthography → a LEXICON of high-frequency irregular/open-mid words + a
// Naija-phonology RULE g2p for the rest (7 vowels, TH-stopping, no schwa, ɡ͡b/k͡p, ɲ/ŋ, ɾ, degemination). NO
// independent referee exists (no wikipron/epitran/kaikki pcm) — this gold, drawn from Faraclas (1996) + the NLA
// orthography manual, IS the committed anchor. Segmental only (Naija tone is unmarked in the media orthography).
// See docs/investigations/pcm_native_bringup_investigation.md.
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

    // The compositor stopped at tauzin, so 10⁶+ leaked the raw digit string into the IPA. Naija is English-lexified
    // and the numbers block stores IPA DIRECTLY, so the scales are added the same way: pcm.wikipedia.org writes
    // million ⟨miliọn⟩ ("pas 75 miliọn", article "Naijá langwej"), and ⟨ọ⟩ = /ɔ/ in NLA orthography → /miliɔn/;
    // /biliɔn/ is extrapolated from the same pattern (see naija.jsonc).
    test("numbers: the miliɔn / biliɔn scales", () => {
        expect(phonemize("12345", "pcm")).toBe("twɛlv tauzin tɾi hɔndɛd an foti faiv"); // thousands
        expect(phonemize("100000", "pcm")).toBe("wan hɔndɛd tauzin");
        expect(phonemize("1000000", "pcm")).toBe("wan miliɔn"); // was a DIGIT-LEAK
        expect(phonemize("2000000", "pcm")).toBe("tu miliɔn");
        expect(phonemize("1000000000", "pcm")).toBe("wan biliɔn"); // was a DIGIT-LEAK
    });

    test("running text (BBC-Pidgin sentences)", () => {
        const s = phonemize("Wetin dey happen? Di pikin don chop.", "pcm");
        expect(s).toContain("wɛtin dɛ");
        expect(s).toContain("di pikin dɔn t͡ʃɔp");
        expect(phonemize("Abeg make you no vex.", "pcm")).toContain(
            "abɛɡ mek ju no vɛks",
        );
    });

    test("#657 accented Latin stays ONE word and is NATIVISED, not routed and not deleted", () => {
        // `[A-Za-z]+` ended the token at a diacritic, so the letter carrying it became an unclaimed gap read as
        // an English LETTER NAME: `São Paulo` → *ɛs ˈə o pɔlo* ("ES ə O"), `Cañitas` → *kɔ ˈɛn itas*.
        // ⚠ NO FOREIGN ROUTING HERE, unlike id (#654) and om (#657). This engine NATIVISES — its header says the
        // rule g2p is applied to English-spelled tokens because "nativising is more correct for the creole", and
        // its own output proves it: `water` → wata, `computer` → kampjuta, not English's wˈɔːt̬ɚ / kəmpjˈuːt̬ɚ.
        expect(phonemize("water", "pcm")).toBe("wata");
        expect(phonemize("computer", "pcm")).toBe("kampjuta");
        // ⚠ AND WIDENING THE TOKEN ALONE MADE ONE CASE WORSE: pcm has no rule for `ö`, so the letter VANISHED and
        // `Klöcker` came out *klkkeɾ*, an unpronounceable cluster. Nativising needs a letter to read; dropping it
        // is not nativising, it is deleting. So an accent folds to its BASE first.
        for (const [acc, ascii] of [["São Paulo", "Sao Paulo"], ["Cañitas", "Canitas"], ["Klöcker", "Klocker"]])
            expect(phonemize(acc, "pcm"), acc).toBe(phonemize(ascii, "pcm"));
        expect(phonemize("Klöcker", "pcm")).toBe("klokkeɾ");
        // Native Naija is untouched.
        expect(phonemize("di pikin dem", "pcm")).toBe("di pikin dɛm");
    });
});
