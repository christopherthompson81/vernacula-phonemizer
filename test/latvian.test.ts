import { describe, expect, test } from "vitest";

import { createLatvian, phonemizeWord } from "../src/languages/latvian/latvian.ts";

// Latvian (lv, latviešu) — Baltic (~1.5M), sister of Lithuanian but a SEPARATE engine. Latvian WRITES what Lithuanian
// leaves implicit: palatalization (ģ ķ ļ ņ → ɟ c ʎ ɲ), vowel length (macrons ā ē ī ū → ː), and stress is FIXED on
// the first syllable (emitted). So the g2p is a mostly-direct grapheme→IPA scan + the native ⟨o⟩→[uɔ̯] diphthong +
// falling-diphthong offglides + regressive devoicing. The narrow referee (1,657 headwords) carries syllable tone +
// the lexical ⟨e⟩ quality (folded in the eval); these golds lock the segment skeleton. 84.0% folded / 96.6% symbol
// accuracy vs wikipron lav_latn_narrow.
describe("Latvian canonical IPA — Baltic rule g2p (written palatals/length + first-syllable stress)", () => {
    const lv = createLatvian();

    test("written palatals ⟨ģ ķ ļ ņ⟩ → ɟ c ʎ ɲ (direct, no contextual palatalization)", () => {
        expect(phonemizeWord("ģimene")).toBe("ɟˈimɛnɛ"); // ⟨ģ⟩ → ɟ
        expect(phonemizeWord("kaķis")).toBe("kˈacis"); // ⟨ķ⟩ → c
        expect(phonemizeWord("ļauns")).toBe("ʎˈauns"); // ⟨ļ⟩ → ʎ
        expect(phonemizeWord("ceļš")).toBe("t͡sˈɛʎʃ"); // ⟨c⟩→t͡s, ⟨ļ⟩→ʎ
    });

    test("native ⟨o⟩ → the falling diphthong [uɔ̯]; ⟨ie⟩ → [iɛ]; ⟨ai/au⟩ offglides; ⟨v⟩ vocalizes in the coda", () => {
        expect(phonemizeWord("loks")).toBe("lˈuɔ̯ks"); // native ⟨o⟩ = [uɔ̯]
        expect(phonemizeWord("roka")).toBe("rˈuɔ̯ka"); // "hand"
        expect(phonemizeWord("dievs")).toBe("dˈiɛws"); // ⟨ie⟩ diphthong (i nucleus) + coda ⟨v⟩→[w]
        expect(phonemizeWord("Valmiera")).toBe("vˈalmiɛra"); // onset ⟨v⟩ stays [v]
        expect(phonemizeWord("maize")).toBe("mˈaizɛ"); // ⟨ai⟩ offglide
        expect(phonemizeWord("neuzmanība")).toBe("nˈɛuzmaniːba"); // ⟨eu⟩ is HIATUS, not a diphthong (no offglide)
    });

    test("written length (macrons) + fixed first-syllable stress", () => {
        expect(phonemizeWord("Jūrmala")).toBe("jˈuːrmala"); // ⟨ū⟩ = [uː], stress on the first syllable
        expect(phonemizeWord("Latvija")).toBe("lˈatvija"); // first-syllable stress
        expect(phonemizeWord("akustiķe")).toBe("ˈakusticɛ"); // stress first even when the long/palatal is later
    });

    test("regressive DEVOICING before a voiceless obstruent (draugs→drauks); no reverse voicing", () => {
        expect(phonemizeWord("draugs")).toBe("drˈauks"); // ⟨g⟩ → k before the voiceless s
        expect(phonemizeWord("zvaigzne")).toBe("zvˈaiɡznɛ"); // ⟨g⟩ stays voiced before the voiced z
    });

    test("cardinal numbers: -padsmit teens, last-digit-1 singular agreement, hundreds-in-thousands", () => {
        expect(lv.text("15").trim()).toBe("pˈiɛt͡spatsmit"); // piecpadsmit (⟨c⟩→t͡s, ⟨d⟩→t before s)
        expect(lv.text("21").trim()).toBe("dˈiwdɛsmit vˈiɛns"); // divdesmit viens (coda ⟨v⟩→w in divdesmit)
        expect(lv.text("234").trim()).toBe("dˈivi sˈimti trˈiːsdɛsmit t͡ʃˈɛtri"); // divi simti trīsdesmit četri
        expect(lv.text("21000").trim()).toBe("dˈiwdɛsmit vˈiɛns tˈuːkstuɔ̯tis"); // ...viens → SINGULAR tūkstotis
        expect(lv.text("100000").trim()).toBe("sˈimts tˈuːkstuɔ̯ʃi"); // simts tūkstoši (hundreds-in-thousands, no "undefined")
        expect(lv.text("1000000").trim()).toBe("vˈiɛns mˈiljuɔ̯ns"); // viens miljons (keeps the numeral, unlike tūkstotis)
    });

    test("clause assembly", () => {
        expect(lv.text("Labdien, Latvija!").trim()).toBe("lˈabdiɛn , lˈatvija !");
    });
});
