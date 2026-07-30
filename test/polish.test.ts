import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/polish/polish.ts";
import { ROMAN_POLICY } from "../src/languages/polish/romanOrdinals.ts";

// Canonical-IPA goldens for Polish (pl) — West Slavic rule g2p, penultimate stress. Digraphs (ch→x, cz→t͡ʂ, sz→ʂ,
// rz→ʐ, dz/dź/dż), the ⟨i⟩ palatalizer, nasal vowels ą/ę (homorganic nasal by place; ą-final→ɔw̃, ę-final→ɛ),
// regressive voicing + final devoicing, progressive w/rz devoicing. 98.2% vs wikipron (human, 130k). See
// docs/investigations/pl_native_bringup_investigation.md.
describe("Polish canonical IPA", () => {
    test("digraphs, palatalization, voicing, nasals", () => {
        const cases: [string, string][] = [
            ["kot", "kˈɔt"],
            ["chleb", "xlˈɛp"], // ch→x, final b→p (devoicing)
            ["pies", "pjˈɛs"], // labial + i + V → pj glide
            ["kiedy", "kjˈɛdɨ"], // velar + i + V → kj (not kʲ)
            ["nogi", "nˈɔɡi"], // velar + i + end → ɡi
            ["siano", "ɕˈanɔ"], // si + V → ɕ (i silent)
            ["zima", "ʑˈima"], // zi + C → ʑi
            ["dzień", "d͡ʑˈɛɲ"], // dź→d͡ʑ, ń→ɲ
            ["cześć", "t͡ʂˈɛɕt͡ɕ"], // cz→t͡ʂ, ść→ɕt͡ɕ
            ["przez", "pʂˈɛs"], // rz→ʂ after voiceless p; final z→s
            ["świat", "ɕfjˈat"], // ś→ɕ, w→f after voiceless, i→j
            ["także", "tˈaɡʐɛ"], // ż triggers regressive voicing k→ɡ
        ];
        for (const [w, exp] of cases) expect(phonemizeWord(w)).toBe(exp);
    });

    test("nasal vowels ą/ę by following-consonant place", () => {
        expect(phonemizeWord("ząb")).toBe("zˈɔmp"); // ą + labial → ɔm
        expect(phonemizeWord("kąt")).toBe("kˈɔnt"); // ą + dental → ɔn
        expect(phonemizeWord("ręka")).toBe("rˈɛŋka"); // ę + velar → ɛŋ
        expect(phonemizeWord("wąs")).toBe("vˈɔns"); // ą + fricative → ɔn
        expect(phonemizeWord("gęś")).toBe("ɡˈɛw̃ɕ"); // ę + palatal fricative → ɛw̃ (nasal glide)
        expect(phonemizeWord("są")).toBe("sˈɔw̃"); // ą word-final → ɔw̃
        expect(phonemizeWord("imię")).toBe("ˈimjɛ"); // ę word-final → ɛ (denasalized)
    });

    test("au: diphthong in loans, hiatus after na-/za- prefix", () => {
        expect(phonemizeWord("auto")).toBe("ˈawtɔ"); // loan diphthong au→aw
        expect(phonemizeWord("pauza")).toBe("pˈawza");
        expect(phonemizeWord("nauka")).toBe("naˈuka"); // na-uka prefix hiatus (NOT nawka), stress on u
        expect(phonemizeWord("zaufanie")).toBe("zaufˈaɲɛ");
    });

    test("text", () => {
        expect(phonemize("dzień dobry", "pl")).toBe("d͡ʑˈɛɲ dˈɔbrɨ");
    });

    // Cardinal numbers (numbers.ts + the polish.jsonc table): space-separated words, irregular round hundreds,
    // and the Slavic three-way magnitude agreement with the POLISH twist — a compound ending in "jeden" takes the
    // genitive plural (dwadzieścia jeden tysięcy), unlike Russian двадцать одна тысяча.
    test("cardinal numbers: irregular hundreds + Polish magnitude agreement", () => {
        expect(phonemize("7", "pl").trim()).toBe("ɕˈɛdɛm"); // siedem
        expect(phonemize("15", "pl").trim()).toBe("pjɛntnˈaɕt͡ɕɛ"); // piętnaście
        expect(phonemize("21", "pl").trim()).toBe("dvad͡ʑˈɛɕt͡ɕa jˈɛdɛn"); // dwadzieścia jeden (space-separated)
        expect(phonemize("101", "pl").trim()).toBe("stˈɔ jˈɛdɛn"); // sto jeden
        expect(phonemize("555", "pl").trim()).toBe("pjˈɛɲt͡ɕsɛt pjɛɲd͡ʑd͡ʑˈɛɕɔnt pjˈɛɲt͡ɕ"); // pięćset pięćdziesiąt pięć
        expect(phonemize("1000", "pl").trim()).toBe("tˈɨɕɔnt͡s"); // tysiąc — the numeral "jeden" is dropped
        expect(phonemize("2000", "pl").trim()).toBe("dvˈa tɨɕˈɔnt͡sɛ"); // 2–4 → PAUCAL tysiące
        expect(phonemize("5000", "pl").trim()).toBe("pjˈɛɲt͡ɕ tɨɕˈɛnt͡sɨ"); // 5+ → GEN-PL tysięcy
        expect(phonemize("21000", "pl").trim()).toBe("dvad͡ʑˈɛɕt͡ɕa jˈɛdɛn tɨɕˈɛnt͡sɨ"); // ★ …jeden → GEN-PL, not sg
        expect(phonemize("100000", "pl").trim()).toBe("stˈɔ tɨɕˈɛnt͡sɨ"); // sto tysięcy
        expect(phonemize("12345", "pl").trim()).toBe("dvanˈaɕt͡ɕɛ tɨɕˈɛnt͡sɨ tʂˈɨsta t͡ʂtɛrd͡ʑˈɛɕt͡ɕi pjˈɛɲt͡ɕ");
        expect(phonemize("1000000", "pl").trim()).toBe("mˈiljɔn"); // milion
        expect(phonemize("2000000", "pl").trim()).toBe("dvˈa miljˈɔnɨ"); // dwa miliony (paucal)
        expect(phonemize("1000000000", "pl").trim()).toBe("mˈiljart"); // miliard (final ⟨d⟩ devoices)
    });
});

// Roman-numeral ORDINAL policy (src/languages/polish/romanOrdinals.ts). Polish reads a century as an ORDINAL,
// masculine nominative, agreeing with the masculine wiek. BOTH word orders occur — "XIX wiek" (dominant, and
// pl.wikipedia's canonical title) and "wiek XIX" — so both ordinalBefore and ordinalAfter are supplied. The
// table is nominative only: "w XIX wieku" wants the locative dziewiętnastym; see the policy file.
describe("Polish roman-numeral ordinals", () => {
    const ord = (n: number): string | undefined => ROMAN_POLICY.ordinal?.(n);

    test("ordinal words: BOTH elements inflect above 20 (unlike Russian)", () => {
        expect(ord(1)).toBe("pierwszy");
        expect(ord(8)).toBe("ósmy");
        expect(ord(19)).toBe("dziewiętnasty");
        expect(ord(21)).toBe("dwudziesty pierwszy");
        expect(ord(40)).toBe("czterdziesty");
        expect(ord(50)).toBe("pięćdziesiąty");
        expect(ord(63)).toBe("sześćdziesiąty trzeci"); // past 50 — the anniversary / congress range
        expect(ord(100)).toBe("setny");
        expect(ord(101)).toBeUndefined(); // out of range → the caller falls back to the cardinal
    });

    test("context matches the inflected century forms, in both word orders", () => {
        for (const w of ["wiek", "wieku", "wieki", "wieków", "wiekiem", "wiekach", "stulecie", "stulecia", "rocznica", "zjazd"]) {
            expect(ROMAN_POLICY.ordinalAfter?.test(w)).toBe(true);
            expect(ROMAN_POLICY.ordinalBefore?.test(w)).toBe(true);
        }
        expect(ROMAN_POLICY.ordinalAfter?.test("wielki")).toBe(false);
    });

    test("the ordinal reading phonemizes in context, either order", () => {
        expect(phonemize("dziewiętnasty wiek", "pl").trim()).toBe("d͡ʑɛvjɛntnˈastɨ vjˈɛk");
        expect(phonemize("wiek dziewiętnasty", "pl").trim()).toBe("vjˈɛk d͡ʑɛvjɛntnˈastɨ");
        expect(phonemize("czterdziesty zjazd", "pl").trim()).toBe("t͡ʂtɛrd͡ʑˈɛstɨ zjˈast");
    });

    test("a bare roman numeral still reads as a CARDINAL", () => {
        expect(phonemize("xix", "pl").trim()).toBe("d͡ʑɛvjɛntnˈaɕt͡ɕɛ"); // dziewiętnaście, not dziewiętnasty
    });
});
