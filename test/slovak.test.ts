import { describe, expect, test } from "vitest";

import { phonemizeWord, createSlovak } from "../src/languages/slovak/slovak.ts";

// Slovak (sk) — West Slavic, Latin, sibling of Czech. Rule g2p (g2p.ts): palatalisation d/t/n/l→ɟ/c/ɲ/ʎ before soft
// vowels i/í/e (y/ý are HARD), the rising diphthongs ⟨ia ie iu⟩→ɪ̯a/ɪ̯e/ɪ̯u and ⟨ô⟩→u̯ɔ, ⟨ä⟩→æ, syllabic l̩/r̩
// (long ĺ/ŕ), ⟨v⟩ (onset→f before voiceless, coda stays v), ⟨h⟩=ɦ, ⟨ch⟩=x, gemination, voicing + final devoicing.
// Scored 89.0% folded on wikipron slk_latn_broad (HUMAN, 15950). See docs/investigations/sk_native_bringup_investigation.md.
describe("Slovak canonical IPA — rule g2p (Standard Slovak)", () => {
    test("palatalisation d/t/n/l → ɟ/c/ɲ/ʎ before soft vowels; y/ý stay HARD", () => {
        expect(phonemizeWord("deň")).toBe("ɟˈeɲ"); // d→ɟ before e, ň→ɲ
        expect(phonemizeWord("deti")).toBe("ɟˈeci"); // d→ɟ, t→c (children)
        expect(phonemizeWord("list")).toBe("ʎˈist"); // l→ʎ before i
        expect(phonemizeWord("milý")).toBe("mˈiliː"); // ý is HARD → l stays plain l
        expect(phonemizeWord("ľúbiť")).toBe("ʎˈuːbic"); // ľ=ʎ, ú=uː, ť=c
    });

    test("diphthongs ⟨ia ie iu ô⟩ + ⟨ä⟩", () => {
        expect(phonemizeWord("chlieb")).toBe("xʎˈɪ̯ep"); // ch=x, l→ʎ, ie=ɪ̯e, final b→p (devoicing)
        expect(phonemizeWord("kôň")).toBe("kˈu̯ɔɲ"); // ô=u̯ɔ, ň=ɲ
        expect(phonemizeWord("mäso")).toBe("mˈæsɔ"); // ä=æ
        expect(phonemizeWord("dievča")).toBe("ɟˈɪ̯evt͡ʃa"); // d→ɟ, ie=ɪ̯e, v INERT before č
    });

    test("syllabic liquids (short l̩/r̩, long ĺ/ŕ)", () => {
        expect(phonemizeWord("vlk")).toBe("vˈl̩k"); // syllabic l̩
        expect(phonemizeWord("krv")).toBe("kˈr̩v"); // syllabic r̩, v inert
        expect(phonemizeWord("stĺp")).toBe("stˈl̩ːp"); // long syllabic ĺ → l̩ː
    });

    test("voicing: final devoicing + ⟨v⟩ (onset→f before voiceless, coda stays v)", () => {
        expect(phonemizeWord("vták")).toBe("ftˈaːk"); // ONSET v → f before voiceless t
        expect(phonemizeWord("včera")).toBe("ft͡ʃˈera"); // onset v → f before č
        expect(phonemizeWord("stav")).toBe("stˈav"); // final (coda) v stays v (NOT f)
        expect(phonemizeWord("pravda")).toBe("prˈavda"); // coda v before d stays v
        expect(phonemizeWord("ch")).toBe("x"); // ch digraph = x
    });

    // tisíc and milión are both MASCULINE INANIMATE, and the masculine-inanimate form of "two" is dva (dve is
    // feminine/neuter) — so the multiplier is dva tisíce / dva milióny, matching Czech's dva tisíce. The noun
    // takes the paucal after 2–4 (tisíce) and the genitive plural after 5+ (tisíc, miliónov).
    test("cardinal numbers (paucal agreement; MASCULINE dva before the magnitudes)", () => {
        const sk = createSlovak();
        expect(sk.text("0").trim()).toBe("nˈula");
        expect(sk.text("15").trim()).toBe("pˈætnaːsc"); // pätnásť
        expect(sk.text("21").trim()).toBe("dvˈatsacjˌeɟen"); // dvadsaťjeden
        expect(sk.text("1000").trim()).toBe("cˈisiːt͡s"); // tisíc (t→c before i)
        expect(sk.text("2000").trim()).toBe("dvˈa cˈisiːt͡se"); // dva tisíce — masc. inan. (not *dve tisíce)
        expect(sk.text("5000").trim()).toBe("pˈæc cˈisiːt͡s"); // päť tisíc — indeclined after 5+
        expect(sk.text("21000").trim()).toBe("dvˈatsacjˌeɟen cˈisiːt͡s"); // dvadsaťjeden tisíc
        expect(sk.text("1000000").trim()).toBe("mˈiʎiɔːn"); // milión — bare, no leading jeden
        expect(sk.text("2000000").trim()).toBe("dvˈa mˈiʎiˌɔːni"); // dva milióny — masc. inan. (not *dve milióny)
        // >9 digits: read digit-by-digit (no miliarda tier; no float precision loss)
        expect(sk.text("1000000000").trim()).toBe("jˈeɟen nˈula nˈula nˈula nˈula nˈula nˈula nˈula nˈula nˈula");
    });

    test("text: words + clause punctuation", () => {
        expect(createSlovak().text("Mesto je pekné.")).toBe("mˈestɔ jˈe pˈekneː .");
    });
});
