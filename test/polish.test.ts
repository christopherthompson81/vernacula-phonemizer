import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/polish/polish.ts";
import { ROMAN_POLICY } from "../src/languages/polish/romanOrdinals.ts";
import { normalizePolish, normalizePolishInitialisms } from "../src/languages/polish/normalize.ts";

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

// TEXT NORMALIZATION (#562, src/languages/polish/normalize.ts). Assertions are on the text→text layer,
// because that is what the layer is: the IPA is the existing word path's job. Counts in the comments are
// from the pl_pl FLEURS corpus (1,919 unique cased utterances) and are the reason each rule exists.
describe("Polish text normalization", () => {
    const n = (s: string): string => normalizePolish(s);

    test("space-grouped thousands are de-grouped first (×16)", () => {
        // The number token cannot span a space: "104 500" read as "sto cztery pięćset".
        expect(n("104 500 baryłek")).toBe("104500 baryłek");
        expect(n("5 000 000 gości")).toBe("5000000 gości"); // two passes — the groups share a digit
        expect(n("330 000 zakażonych")).toBe("330000 zakażonych");
        expect(n("30 9")).toBe("30 9"); // NOT grouping — a 1-digit block must not fuse two numbers
    });

    test("decimal comma reaches the number token, and reads as przecinek", () => {
        // Handled in polish.ts's TOKEN so the number stays adjacent to its unit for the symbol tier.
        // A DECIMAL count takes neither the singular nor the paucal — 3,5 metra, so the genitive plural
        // (the nearer of the two forms a three-form table can hold) rather than *3,5 metry.
        expect(phonemize("3,5 m", "pl").trim()).toBe("tʂˈɨ pʂɛt͡ɕˈinɛk pjˈɛɲt͡ɕ mˈɛtruf");
    });

    test("multi-dot abbreviations are claimed before the single-dot rule (×6)", () => {
        expect(n("ok. 10 000 lat p.n.e.")).toBe("około 10000 lat przed naszą erą.");
        expect(n("400 n.e. i")).toBe("400 naszej ery i");
        expect(n("to m.in. zamiecie")).toBe("to między innymi zamiecie");
        // The abbreviation's dot was ALSO the sentence period — it has to be put back (7 utterances lost
        // their final pause before this guard existed).
        expect(n("do roku 1000 n.e.")).toBe("do roku 1000 naszej ery.");
    });

    test("dotted abbreviations expand and the dot stops being a phrase break (×70)", () => {
        expect(n("np. złoto")).toBe("na przykład złoto"); // ×27 — read as the nonce word [np] + a break
        expect(n("agentów ds. pornografii")).toBe("agentów do spraw pornografii");
        expect(n("w 1861 r. powstał")).toBe("w 1861 roku powstał");
        expect(n("uzyskał w 1839 r.")).toBe("uzyskał w 1839 roku."); // clause-final dot restored
        expect(n("zbudowana w 3 w. p.n.e.")).toBe("zbudowana w trzeci wieku przed naszą erą.");
        expect(n("podejrzanych itp.")).toBe("podejrzanych i tym podobne.");
        expect(n("lot nr CG4684")).toBe("lot numer CG4684"); // no dot in Polish → read as the cluster [nr]
    });

    test("`N.` ordinal vs sentence period — ZERO sentence-final pauses may be lost", () => {
        // Followed by a lowercase word (or a comma) ⇒ ordinal; by an uppercase word or end ⇒ full stop.
        expect(n("37. kraj świata")).toBe("trzydziesty siódmy kraj świata");
        expect(n("jego 60. trafieniem")).toBe("jego sześćdziesiąty trafieniem");
        expect(n("z 1. i 3. pułku")).toBe("z pierwszy i trzeci pułku");
        // The corpus trap: an AGE plus a full stop, not an ordinal. Must stay untouched.
        expect(n("Cuddeback, lat 21. Cuddeback prowadził")).toBe("Cuddeback, lat 21. Cuddeback prowadził");
        expect(n("wyniosła 168.")).toBe("wyniosła 168.");
        // Decades are the majority (6 of 14) and are the one context whose inflection IS recoverable.
        // The Roman century has ALREADY become an ordinal word at the registry seam by the time this
        // layer runs, so the word after `20.` is lowercase — which is what licenses the ordinal reading.
        expect(n("w latach 20. dwudziesty wieku")).toBe("w latach dwudziestych dwudziesty wieku");
        expect(n("z lat 30. dziewiętnasty")).toBe("z lat trzydziestych dziewiętnasty");
        expect(n("Na lata 50. dziewiętnasty")).toBe("Na lata pięćdziesiąte dziewiętnasty");
        expect(phonemize("w latach 20. XX wieku", "pl").trim())
            .toBe("f lˈatax dvud͡ʑˈɛstɨx dvud͡ʑˈɛstɨ vjˈɛku"); // end to end, through the roman seam
    });

    test("version dots between digits stop breaking the sentence (×5)", () => {
        expect(n("Norma 802.11n funkcjonuje")).toBe("Norma 802 kropka 11n funkcjonuje");
        expect(n("rysunek 1.1.")).toBe("rysunek 1 kropka 1.");
    });

    test("clock: feminine ordinal hour, inflected by the governing preposition (×17)", () => {
        expect(n("o 8:46 rano")).toBe("o ósmej 46 rano"); // locative — o + Loc
        expect(n("o godz. 12:00 GMT")).toBe("o godzinie dwunastej GMT"); // :00 drops the minutes
        expect(n("przed godz. 23:35")).toBe("przed godziną dwudziestą trzecią 35"); // instrumental
        expect(n("o godz. 22:08")).toBe("o godzinie dwudziestej drugiej 08"); // BOTH elements inflect
        expect(n("(02:30 UTC)")).toBe("(druga 30 UTC)"); // no preposition → nominative
        // Sports scores are NOT times — two digits are required after the colon.
        expect(n("wynosi zatem 3:2.")).toBe("wynosi zatem 3:2.");
        expect(n("wynosi 7:2.")).toBe("wynosi 7:2.");
    });

    test("numeric ranges keep their endpoints apart (×16)", () => {
        expect(n("(1418–1450)")).toBe("(1418 do 1450)");
        expect(n("35–40 mph")).toBe("35 do 40 mil na godzinę");
        expect(n("Ił-76")).toBe("Ił-76"); // a digit is required on BOTH sides
        expect(n("100-dolarowych")).toBe("100-dolarowych");
        expect(n("COVID-19")).toBe("COVID-19");
    });

    test("units, degrees, signs and fractions", () => {
        expect(n("83 km/godz. i")).toBe("83 kilometry na godzinę i"); // …3 ⇒ PAUCAL
        expect(n("70 km/h,")).toBe("70 kilometrów na godzinę,"); // …0 ⇒ genitive plural
        expect(n("jedenastu km / godz.")).toBe("jedenastu kilometrów na godzinę."); // no numeral adjacent
        // km²/mm² moved to the SHARED tier (exponentWords in polish.ts), so they are no longer visible to
        // normalizePolish alone — assert them through the full pipeline instead. Migrating them was
        // verified over the whole pl_pl corpus and FIXED an agreement bug: the local rule hardcoded the
        // genitive plural, so `864 mm2` read *milimetrów kwadratowych* where 864 takes the paucal.
        expect(phonemize("19 500 km²", "pl")).toContain("kilɔmˈɛtruf kfadratˈɔvɨx");
        expect(phonemize("864 mm2", "pl")).toContain("milimˈɛtrɨ kfadratˈɔvɛ"); // paucal, was genitive pl.
        expect(n("600 Mb/s.")).toBe("600 megabitów na sekundę.");
        expect(n("+30°C")).toBe("plus 30 stopni Celsjusza");
        expect(n("5 mm (1/5 cala)")).toBe("5 mm (jedna piąta cala)"); // mm is left to the shared tier
    });

    test("the shared symbol tier: percent and units, with POLISH count agreement", () => {
        // Three-way, but NOT slavicCountForm: a compound ending in 1 takes the genitive plural.
        expect(phonemize("1%", "pl").trim()).toBe("jˈɛdɛn prˈɔt͡sɛnt");
        expect(phonemize("3%", "pl").trim()).toBe("tʂˈɨ prɔt͡sˈɛntɨ"); // paucal — trzy procenty
        expect(phonemize("88%", "pl").trim()).toBe("ɔɕɛmd͡ʑˈɛɕɔnt ˈɔɕɛm prˈɔt͡sɛnt"); // gen-pl
        expect(phonemize("21%", "pl").trim()).toBe("dvad͡ʑˈɛɕt͡ɕa jˈɛdɛn prˈɔt͡sɛnt"); // ★ gen-pl, not sg
        expect(phonemize("12%", "pl").trim()).toBe("dvanˈaɕt͡ɕɛ prˈɔt͡sɛnt"); // 11–14 always gen-pl
        expect(n("100 m i 200 m stylem")).toBe("100 m i 200 m stylem"); // units are the tier's, not ours
        expect(phonemize("2 km", "pl").trim()).toBe("dvˈa kilɔmˈɛtrɨ");
        expect(phonemize("5 km", "pl").trim()).toBe("pjˈɛɲt͡ɕ kilɔmˈɛtruf");
    });

    test("initialisms: Polish letter names for the listed and the unpronounceable (×170)", () => {
        // LEXICAL (polish.jsonc): readable, but Polish spells them out.
        expect(normalizePolishInitialisms("siły USA i")).toBe("siły u es a i");
        expect(normalizePolishInitialisms("w RPA jest")).toBe("w er pe a jest");
        expect(normalizePolishInitialisms("obozu ONZ nie")).toBe("obozu o en zet nie");
        // OOV: no vowel ⇒ nothing else could be said. DVD read as [tft], GMT as [ɡmt].
        expect(normalizePolishInitialisms("format DVD jest")).toBe("format de fau de jest");
        expect(normalizePolishInitialisms("o godzinie GMT tak")).toBe("o godzinie gie em te tak");
        // OOV but pronounceable ⇒ left to the g2p, which reads them as words.
        expect(normalizePolishInitialisms("NASA i UNESCO oraz OPEC")).toBe("NASA i UNESCO oraz OPEC");
        // Attached to digits: a single letter is always a letter name (H5N1, M16).
        expect(normalizePolishInitialisms("karabinu M16 i")).toBe("karabinu em16 i");
    });
});
