import { describe, expect, test } from "vitest";

import { phonemizeWord, createCebuano } from "../src/languages/cebuano/cebuano.ts";
import { phonemize } from "../src/index.ts";

// Canonical-IPA goldens for Cebuano / Sinugboanon (ceb) — Philippine (Central Bisayan), the Tagalog near-phonemic
// pattern: the digraph ⟨ng⟩→ŋ, a WORD-INITIAL glottal [ʔ] before a vowel, a HIATUS glottal between two vowels
// (kaon→kaʔon), a hyphen→[ʔ], ⟨y⟩→j, penultimate stress (phonemic but unwritten → folded by the eval). The
// unwritten word-final glottal (bata child [bataʔ] vs robe [bata]) is deferred. Referees: wikipron ceb broad
// + epitran. ⚠ The residual is almost entirely Spanish-surname proper nouns, not the native core.
describe("Cebuano canonical IPA", () => {
    test("word-initial + hiatus glottal stop; ng→ŋ; penult stress", () => {
        expect(phonemizeWord("adlaw")).toBe("ʔˈadlaw"); // word-initial ʔ
        expect(phonemizeWord("inom")).toBe("ʔˈinom"); // word-initial ʔ
        expect(phonemizeWord("kaon")).toBe("kˈaʔon"); // hiatus ʔ
        expect(phonemizeWord("maayo")).toBe("maʔˈajo"); // hiatus ʔ, penult stress
        expect(phonemizeWord("langit")).toBe("lˈaŋit"); // ng → ŋ
    });

    test("y→j; penult stress; hyphen→ʔ", () => {
        expect(phonemizeWord("gugma")).toBe("ɡˈuɡma"); // penult stress
        expect(phonemizeWord("balay")).toBe("bˈalaj"); // y → j
        expect(phonemizeWord("salamat")).toBe("salˈamat"); // penult stress
        expect(phonemizeWord("pag-asa")).toBe("paɡʔˈasa"); // hyphen → ʔ
    });

    test("numbers (tens-first with ug; ka ligature) + mga", () => {
        const d = createCebuano();
        expect(d.text("11").trim()).toBe("napˈulo ʔˈuɡ ʔˈusa"); // napulo ug usa
        expect(d.text("21").trim()).toBe("kaluhˈaʔan ʔˈuɡ ʔˈusa"); // kaluhaan ug usa
        expect(d.text("100").trim()).toBe("ʔˈusa kˈa ɡˈatos"); // usa ka gatos
        expect(d.text("mga").trim()).toBe("mˈaŋa"); // mga → maŋa
    });

    // ── NORMALIZATION ────────────────────────────────────────────────────────────────────────────────
    // ⚠ THE CORPUS IS FLEURS ceb_ph, NOT ceb.wikipedia, AND THAT IS THE LOAD-BEARING DECISION. ceb.wikipedia
    // is ~99% Lsjbot-generated — a 1,845 MB dump for a 20M-speaker language built from a handful of templates
    // — so mining it would measure two sentence moulds rather than Cebuano. The price is small counts (1,932
    // sentences), and they are quoted as they are rather than inflated.
    describe("text normalization", () => {
        test("thousands and decimals, English convention", () => {
            expect(phonemize("1,100 km", "ceb")).toContain("lˈibo"); // ×41 — was *usa , usa ka gatos*
            expect(phonemize("2.5 metros", "ceb")).toContain("pˈunto"); // ×19
            expect(phonemize("US$14.7 bilyones", "ceb")).toContain("pˈunto"); // the corpus's own shape
            // ⚠ THE ORDINAL SEAM ALREADY WORKED and is untouched (trap 16): ⟨ika⟩ is an ordinary prefix.
            expect(phonemize("ika-20 nga siglo", "ceb")).toBe("ʔˈika kaluhˈaʔan ŋˈa sˈiɡlo");
        });

        // ⚠ THE CLOCK IS WRITTEN WITH BOTH SEPARATORS, which only the corpus diff revealed: `12.00 GMT` and
        // `15.00 UTC` sit beside `9:30 sa buntag`. The period form is otherwise identical to a decimal
        // (`6.34 pulgada`), so the FOLLOWING MARKER is what licenses the clock reading.
        test("clock, in both separators", () => {
            expect(phonemize("alas 07:19 sa buntag", "ceb")).toContain("pˈito ʔˈuɡ napˈulo");
            expect(phonemize("sa 12.00 GMT", "ceb")).not.toContain("pˈunto"); // a TIME, not a decimal
            expect(phonemize("6.34 pulgada", "ceb")).toContain("pˈunto"); // …but this one IS a decimal
            // ⚠ AND THE MILITARY FORM, four digits with NO separator (`0230 UTC`, `1200 GMT`, ×2). The number
            // path read them as cardinals — *usa ka libo ug duha ka gatos*. A four-digit number is also the
            // shape of a YEAR, so the timezone is REQUIRED, not optional.
            expect(phonemize("0230 UTC", "ceb")).toContain("dˈuha ʔˈuɡ katlˈoʔan"); // 2:30
            expect(phonemize("tuig 1990", "ceb")).toContain("lˈibo"); // a year is untouched
        });

        test("percent, currency, units and the range", () => {
            expect(phonemize("25%", "ceb")).toContain("poɾsjˈento"); // sign ×4; the WORD is ×16
            expect(phonemize("$50", "ceb")).toContain("dˈoljaɾ");
            // ⚠ `pound` ×3 is the CURRENCY; `libra` ×5 is the unit of WEIGHT. The count alone would have
            // priced things in pounds-avoirdupois.
            expect(phonemize("£27 milyon", "ceb")).toContain("pˈoʔund");
            expect(phonemize("10 km", "ceb")).toContain("kilomˈetɾo");
            expect(phonemize("3,850 km²", "ceb")).toContain("kwadɾˈado"); // kwadrado ×3
            expect(phonemize("1990-1995", "ceb")).toContain("ŋˈadto sˈa"); // ×12
            expect(phonemize("A & B", "ceb")).toContain("ʔˈuɡ"); // ug ×1,176
            expect(phonemize("Dr. Santos", "ceb")).toContain("dˈoktoɾ");
        });

        // ⚠ WHAT IS DELIBERATELY LEFT UNREAD, and it is a larger list than usual because ceb has no second
        // haystack: for most languages an unattested word can be probed against Wikipedia, but ceb.wikipedia
        // is bot-generated, so a hit there is a fact about a template. Each of these has BOTH the sign ×0 (or
        // near it) and no attested Cebuano word, so a reading would be invention (the Fula `tere` lesson).
        test("the refusals stay refusals", () => {
            expect(phonemize("25 °C", "ceb")).not.toContain("ɡɾˈado"); // grado/digri/celsius all ×0
            expect(phonemize("¥2,500", "ceb")).not.toContain("jen"); // the ONE currency with no ceb name
        });
    });
});
