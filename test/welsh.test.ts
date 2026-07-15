import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/welsh/welsh.ts";

// Canonical-IPA goldens for Welsh (cy) — espeak-independent, Northern-leaning (u/clear-y → ɨ). Welsh spelling is
// highly phonemic: the g2p resolves digraphs (ch→χ dd→ð ll→ɬ rh→r̥ th→θ) and vowel clusters (diphthongs carry a
// superscript offglide) then applies PENULTIMATE stress and the vowel-LENGTH rule. Bootstrapped from the
// espeak-ng-portable cy canonical phonemize() output over the 50k corpus (its ə/ɨ y-vowel relabel, NOT the raw
// --ipa ʌ/ø); every golden below matches that reference. See docs/cy_bringup_investigation.md.
describe("welsh canonical IPA", () => {
    test("consonant digraphs (ch→χ dd→ð ff→f ll→ɬ rh→r̥ th→θ) + always-hard c/g", () => {
        expect(phonemizeWord("chwech")).toBe("χwˈeːχ"); // ch → χ
        expect(phonemizeWord("oedd")).toBe("ˈɔᶤð"); // dd → ð
        expect(phonemizeWord("llaw")).toBe("ɬˈaᶷ"); // ll → ɬ (voiceless lateral)
        expect(phonemizeWord("rhaid")).toBe("r̥ˈaᶦd"); // rh → r̥ (voiceless r)
        expect(phonemizeWord("traeth")).toBe("trˈaᶤθ"); // th → θ
        expect(phonemizeWord("gwlad")).toBe("ɡwlˈaːd"); // c/g always hard; gw- onset w stays consonant
    });

    test("diphthongs carry a superscript offglide (ae/au→aᶤ, ai/ei→aᶦ/eᶦ, aw/ew→aᶷ/ɛᶷ, oe→ɔᶤ, wy→ʊᶤ)", () => {
        expect(phonemizeWord("gwaith")).toBe("ɡwˈaᶦθ"); // ai → aᶦ
        expect(phonemizeWord("traeth")).toBe("trˈaᶤθ"); // ae → aᶤ
        expect(phonemizeWord("mewn")).toBe("mˈɛᶷn"); // ew → ɛᶷ (short; referee: mɛun)
        expect(phonemizeWord("llaw")).toBe("ɬˈaᶷ"); // aw → aᶷ
        expect(phonemizeWord("oedd")).toBe("ˈɔᶤð"); // oe → ɔᶤ
        expect(phonemizeWord("eglwys")).toBe("ˈɛɡlʊᶤs"); // wy diphthong → ʊᶤ (referee: ɛɡlʊɨs)
        expect(phonemizeWord("cymdeithas")).toBe("kəmdˈeᶦθas"); // ei → eᶦ (referee-backed)
    });

    test("the y-vowel: obscure ə (non-final) vs clear ɨ (final syllable); unstressed i → ɨ", () => {
        expect(phonemizeWord("cymru")).toBe("kˈəmrɨ"); // 1st y (non-final) → ə, u → ɨ
        expect(phonemizeWord("ysgol")).toBe("ˈəsɡɔl"); // obscure y → ə
        expect(phonemizeWord("blwyddyn")).toBe("blˈʊᶤðɨn"); // wy → ʊᶤ; final y → clear ɨ (referee: blʊɨðɨn)
        expect(phonemizeWord("lladin")).toBe("ɬˈadin"); // unstressed i stays FRONT (referee-backed; N Welsh centralizes only u/y)
        expect(phonemizeWord("dim")).toBe("dˈim"); // stressed short i stays front (referee: dɪm, not the oracle ɨ)
        expect(phonemizeWord("dinas")).toBe("dˈinas"); // stressed short i in an OPEN syllable stays front
    });

    test("penultimate stress + secondary stress on a long word's first syllable", () => {
        expect(phonemizeWord("cymru")).toBe("kˈəmrɨ"); // penult
        expect(phonemizeWord("prifysgol")).toBe("privˈəsɡɔl"); // penult (3 syllables, no secondary)
        expect(phonemizeWord("gorffennaf")).toBe("ɡɔrfˈɛnav"); // nn degeminates → n (referee: ɡɔrfɛna); penult
        expect(phonemizeWord("llywodraeth")).toBe("ɬɨᵘˈɔdraᶤθ"); // penult
    });

    test("vowel length: long in a monosyllable open/before a single voiced coda; tense-quality-only in penults", () => {
        expect(phonemizeWord("mis")).toBe("mˈiːs"); // long before s
        expect(phonemizeWord("tad")).toBe("tˈaːd"); // long before d
        expect(phonemizeWord("nos")).toBe("nˈoːs"); // long before s
        expect(phonemizeWord("braf")).toBe("brˈaːv"); // long before f→v
        expect(phonemizeWord("nesaf")).toBe("nˈɛsav"); // penult stays LAX ɛ (referee-backed; not espeak-tensed e)
        expect(phonemizeWord("pobol")).toBe("pˈɔbɔl"); // penult stays LAX ɔ (referee: pɔbɔl)
        expect(phonemizeWord("bore")).toBe("bˈɔrɛ"); // lax ɔ before r (a deferred n/r/l lengthener)
        expect(phonemizeWord("papur")).toBe("pˈapɨr"); // lax a before p (voiceless)
    });

    test("Run 2 — word-initial nasal mutation, irregular function words, apostrophe enclitics", () => {
        expect(phonemizeWord("nhw")).toBe("n̥ˈuː"); // word-initial nh → n̥ (nasal mutation)
        expect(phonemizeWord("nghymru")).toBe("ŋ̥ˈəmrɨ"); // ngh → ŋ̥
        expect(phonemizeWord("enghraifft")).toBe("ˈɛŋhraᶦft"); // MEDIAL ngh is ŋ+h, not the mutation
        expect(phonemizeWord("dechrau")).toBe("dˈɛχra"); // NW final unstressed -au → [a] (referee: dɛχra)
        expect(phonemizeWord("i")).toBe("ˈiː"); // the word ⟨i⟩ → front iː (referee-backed; the Run-2 oracle ɨ was an artifact)
        expect(phonemizeWord("bod")).toBe("bˈɔd"); // irregular: short ɔ, not the regular oː
        expect(phonemizeWord("heb")).toBe("hˈɛb"); // irregular: lax ɛ
        expect(phonemizeWord("un")).toBe("ˈɨːn"); // irregular: long ɨː before n
        expect(phonemizeWord("o'r")).toBe("ˈoːr"); // enclitic: stem ⟨o⟩ stays open (oː) + r
        expect(phonemizeWord("hi'n")).toBe("hˈiːn"); // enclitic: stem ⟨hi⟩ open (hiː) + n
    });

    test("w/i as consonants before a vowel; ⟨si⟩+V → ʃ; ⟨w⟩ as vowel (ʊ) otherwise", () => {
        expect(phonemizeWord("wal")).toBe("wˈal"); // word-initial w + vowel → consonant /w/ (not vowel ʊ)
        expect(phonemizeWord("teithio")).toBe("tˈeᶦθjɔ"); // ei → eᶦ (referee-backed); i+vowel → /j/
        expect(phonemizeWord("bara")).toBe("bˈara"); // plain
    });
});
