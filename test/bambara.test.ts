import { describe, expect, test } from "vitest";

import { createBambara, phonemizeWord as raw } from "../src/languages/bambara/bambara.ts";
import { numberToWords } from "../src/languages/bambara/numbers.ts";
import { normalizeBambara } from "../src/languages/bambara/normalize.ts";

// The g2p emits combining marks (nasal ã = a + U+0303) to match the referee; normalise NFC for stable literals.
const phonemizeWord = (w: string) => raw(w).normalize("NFC");

// Canonical-IPA goldens for Bambara / Bamanankan (bm) — Mande (Manding), Latin orthography. Hand-adjudicated
// against kaikki Bambara (Wiktionary, narrow) — ⚠ only 74 words, a thin referee. Its folds strip TONE
// (2-level H/L + downstep) and vowel LENGTH, both lexical and absent from the standard orthography, so these
// goldens are what pin the segmental + nasalisation backbone. Tone and length are deferred; numbers are
// composed in numbers.ts; N'Ko is a second script, folded to Latin.
describe("Bambara canonical IPA — greedy g2p + nasalisation", () => {
    test("affricates and sibilant: ⟨c⟩→t͡ʃ, ⟨j⟩→d͡ʒ, ⟨sh⟩→ʃ", () => {
        expect(phonemizeWord("cɔnkɔ")).toBe("t͡ʃɔ̃kɔ".normalize("NFC")); // ⟨c⟩ → t͡ʃ (+ nasal ɔ̃)
        expect(phonemizeWord("jan")).toBe("d͡ʒã".normalize("NFC")); // ⟨j⟩ → d͡ʒ (+ nasal ã)
        expect(phonemizeWord("shinye")).toBe("ʃiɲe".normalize("NFC")); // ⟨sh⟩ → ʃ, ⟨ny⟩ → ɲ
    });

    test("NASALISATION: a syllable-final ⟨n⟩ nasalises the preceding vowel; an onset ⟨n⟩ stays [n]", () => {
        expect(phonemizeWord("ban")).toBe("bã".normalize("NFC")); // word-final n → nasal ã (n dropped)
        expect(phonemizeWord("dɔn")).toBe("dɔ̃".normalize("NFC")); // → dɔ̃
        expect(phonemizeWord("kunun")).toBe("kunũ".normalize("NFC")); // ku.nun → the ONSET n stays [n], only the final n nasalises
        expect(phonemizeWord("na")).toBe("na".normalize("NFC")); // onset n before a vowel → [n]
        expect(phonemizeWord("kalan")).toBe("kalã".normalize("NFC")); // → kalã
    });

    test("palatal ⟨ny⟩/⟨ɲ⟩ → ɲ; word-initial prenasal keeps the nasal", () => {
        expect(phonemizeWord("nya")).toBe("ɲa".normalize("NFC")); // ⟨ny⟩ → ɲ
        expect(phonemizeWord("mburu")).toBe("mburu".normalize("NFC")); // word-initial ⟨mb⟩ prenasal → m + b
        expect(phonemizeWord("sanga")).toBe("sãɡa".normalize("NFC")); // medial: ⟨n⟩ nasalises a, ⟨g⟩ stays ɡ
    });

    test("oral vowels + a common word", () => {
        expect(phonemizeWord("ala")).toBe("ala".normalize("NFC")); // "God"
        expect(phonemizeWord("kelen")).toBe("kelẽ".normalize("NFC")); // "one" — final n → nasal ẽ
    });

    test("N'Ko (ߒߞߏ) front-end — transliterates to Latin, IDENTICAL IPA (the vowel-naming trap + nasal mark)", () => {
        expect(phonemizeWord("ߒߞߏ")).toBe("ŋko".normalize("NFC")); // N + KA + OO(=/o/); the standalone N → ŋ before k
        expect(phonemizeWord("ߘߋߣ")).toBe("dẽ".normalize("NFC")); // da + EE(=/e/) + na → nasal ẽ ("child")
        expect(phonemizeWord("ߖߐ߲")).toBe("d͡ʒɔ̃".normalize("NFC")); // ja + O(=/ɔ/) + NASALIZATION MARK → d͡ʒɔ̃
        expect(phonemizeWord("ߓߊ߲")).toBe("bã".normalize("NFC")); // ba + a + NASALIZATION MARK → nasal ã
        expect(phonemizeWord("ߓߊ߲")).toBe(phonemizeWord("ban")); // N'Ko ≡ the Latin spelling
    });

    // NUMBERS — DECIMAL. Bambara is NOT quinary (6–9 are opaque stems) and NOT vigesimal either, despite the
    // areal reputation of Mande: tan/mugan are a lexical fossil but bi- is ×10, and bm.wikipedia glosses its
    // own arithmetic — `biwɔɔrɔ ni wɔɔrɔ (66)`, `tone ba saba dɔrɔn (3 000 tonnes)`. Bespoke because 10 tan /
    // 20 mugan are lexical while 30–90 are solid bi- derivations, and every magnitude noun takes a FOLLOWING
    // multiplier — except 100, which is the bare kɛmɛ. Slots join with ni 'and'.
    // Sources: Bamadaba (Bailleul 2007 / Corpus Bambara de Référence) for every headword spelling, An ka taa,
    // Omniglot "Numbers in Bambara", languagesandnumbers.com bam (the 1234 worked example), kasahorow (fu).
    // See src/languages/bambara/numbers.ts.
    test("numbers: units, lexical tan/mugan, bi- tens, ni compounds", () => {
        expect(numberToWords(7)).toBe("wolonwula");
        expect(numberToWords(10)).toBe("tan");
        expect(numberToWords(11)).toBe("tan ni kelen");
        expect(numberToWords(20)).toBe("mugan"); // lexical, not *bifila
        expect(numberToWords(21)).toBe("mugan ni kelen");
        expect(numberToWords(42)).toBe("binaani ni fila"); // bi- + unit, written solid
        expect(numberToWords(8)).toBe("segin"); // Bamadaba headword; seegin is its listed variant
        expect(numberToWords(66)).toBe("biwɔɔrɔ ni wɔɔrɔ"); // the wiki writes `biwɔɔrɔ ni wɔɔrɔ (66)` — bi- is ×10
        expect(numberToWords(80)).toBe("bisegin");
        // 90 KEEPS its medial ⟨n⟩: all four lexica agree, against bm.wikipedia's `bikɔnɔtɔn` ×2
        expect(numberToWords(99)).toBe("bikɔnɔntɔn ni kɔnɔntɔn");
    });

    test("numbers: kɛmɛ hundreds (bare at 100), ba thousands, miliyɔn millions, miliyari milliards", () => {
        expect(numberToWords(100)).toBe("kɛmɛ"); // the multiplier is omitted for exactly 100
        expect(numberToWords(101)).toBe("kɛmɛ ni kelen");
        expect(numberToWords(555)).toBe("kɛmɛ duuru ni biduuru ni duuru");
        expect(numberToWords(1000)).toBe("ba kelen"); // the thousand DOES keep its multiplier
        expect(numberToWords(12345)).toBe("ba tan ni fila ni kɛmɛ saba ni binaani ni duuru");
        // the wiki glosses this exact shape itself: `tone ba kɛmɛ fila (200 000 tonnes)`
        expect(numberToWords(200_000)).toBe("ba kɛmɛ fila");
        expect(numberToWords(1_000_000)).toBe("miliyɔn kelen");
        expect(numberToWords(2_000_000)).toBe("miliyɔn fila");
        // 10⁹ is a real Bambara loan (Bamadaba \lx míliyari \ge milliard; bm.wikipedia ×5, always with a
        // figure), so it composes rather than falling back to digit-by-digit.
        expect(numberToWords(1_000_000_000)).toBe("miliyari kelen");
        expect(numberToWords(1_500_000_000)).toBe("miliyari kelen ni miliyɔn kɛmɛ duuru");
        // above miliyari there is no attested numeral — read the digits rather than invent a "trillion"
        expect(numberToWords(1e12)).toBe("kelen fu fu fu fu fu fu fu fu fu fu fu fu");
    });

    test("numbers: both registered scripts — N'Ko digits (߀–߉) ≡ ASCII", () => {
        const bm = createBambara();
        expect(bm.text("21").normalize("NFC")).toBe("muɡã ni kelẽ".normalize("NFC")); // nasalisation applies to the numerals too
        expect(bm.text("߂߁")).toBe(bm.text("21")); // N'Ko digits fold to ASCII → identical IPA
    });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// TEXT NORMALIZATION (normalize.ts). Asserted on the STRING the pass produces, not on IPA, because
// that is the layer under test — and separately through `phonemize` where the point is that the rule
// reaches the g2p at all. Evidence and counts live in normalize.ts's header and in
// docs/investigations/bm_normalization_investigation.md; these pin the rule's BRANCHES (trap 13), so
// several cases below are deliberately shapes the corpus does NOT contain.
describe("Bambara text normalization", () => {
    test("percent: kɛmɛsarada, POSTPOSED — and the sign is dropped when the word is already there", () => {
        expect(normalizeBambara("40%")).toBe("40 kɛmɛsarada");
        expect(normalizeBambara("50.5%")).toBe("50 5 kɛmɛsarada"); // the decimal branch still runs after
        // the sign is a token boundary, so the replacement has to supply one (`10%ye`, corpus)
        expect(normalizeBambara("a 10%ye bagangena")).toBe("a 10 kɛmɛsarada ye bagangena");
        // ONE intervening word is allowed — `ye`/`ma`/`dɔrɔn`/`dafa`, 10 corpus instances
        expect(normalizeBambara("hakɛ ye 52 ye %")).toBe("hakɛ ye 52 ye kɛmɛsarada");
        // trap 12: the corpus writes the word AND the sign; say it once
        expect(normalizeBambara("bikɔnɔtɔn kɛmɛsarada 90%")).toBe("bikɔnɔtɔn kɛmɛsarada 90");
    });

    test("units: the noun goes BEFORE the number, and km² takes kɛnɛ", () => {
        expect(normalizeBambara("5km")).toBe("kilomɛtɛrɛ 5");
        expect(normalizeBambara("619,745 km²")).toBe("kilomɛtɛrɛ kɛnɛ 619745"); // de-grouped first
        expect(normalizeBambara("13000 Km2")).toBe("kilomɛtɛrɛ kɛnɛ 13000"); // ⚠ CAPITAL K, corpus form
        // the magnitude hop, and the decimal tail still reaches step 11 afterwards
        expect(normalizeBambara("30.2 million km²")).toBe("kilomɛtɛrɛ kɛnɛ 30 2 million");
        // the SPAN branch — one unit, two endpoints, joined like any other range
        expect(normalizeBambara("5-10 cm")).toBe("santimɛtɛrɛ 5 fo 10");
        // m²/m2 are ×0 in the corpus and declared as km²'s compositional neighbour (trap 8)
        expect(normalizeBambara("120 m2")).toBe("mɛtɛrɛ kɛnɛ 120");
        // ⚠ NO CUBE WORD IS SOURCEABLE — m³ is left exactly as it was, deliberately (see the header)
        expect(normalizeBambara("152 000 m³")).toBe("152000 m³");
    });

    test("de-grouping: all three separators, and exactly three digits is the discriminator", () => {
        expect(normalizeBambara("619,745")).toBe("619745");
        expect(normalizeBambara("114.983")).toBe("114983");
        expect(normalizeBambara("241 038")).toBe("241038");
        expect(normalizeBambara("1.231.238")).toBe("1231238");
        // the SAME two marks are the decimal separators; a non-3-digit tail is left for step 11
        expect(normalizeBambara("7,62")).toBe("7 6 2");
        expect(normalizeBambara("1.8 milion")).toBe("1 8 milion");
        // a trailing CLAUSE comma must survive rather than being eaten as a fourth group
        expect(normalizeBambara("san 24,000, nka")).toBe("san 24000, nka");
    });

    test("ranges: `fo`, ascending pairs only", () => {
        expect(normalizeBambara("(1965-1969)")).toBe("(1965 fo 1969)");
        expect(normalizeBambara("san 40 - 10 ɲɔgɔnna")).toBe("san 40 - 10 ɲɔgɔnna"); // descending → declined
        expect(normalizeBambara("9500- 9500")).toBe("9500- 9500"); // equal → declined
        // an ISBN is claimed whole, so its inner pairs never reach the range rule
        expect(normalizeBambara("ISBN 978-84-8168-394-3.")).toBe("ISBN 9 7 8 8 4 8 1 6 8 3 9 4 3.");
    });

    // TRAP 58 — the right guard used to reject a following `.` as well, so a span that ENDS A CLAUSE was
    // declined and read as two juxtaposed cardinals with no `fo` at all. Both of this corpus's clause-final
    // spans are page ranges in a reference list.
    test("a range that ENDS A CLAUSE keeps `fo`, and the comma is still rejected", () => {
        expect(normalizeBambara("pp. 86–99.")).toBe("pp. 86 fo 99.");
        expect(normalizeBambara("san 1954 -1981.")).toBe("san 1954 fo 1981.");
        // ⚠ THE COMMA IS THE BRANCH WE DID NOT TAKE: Bambara writes a decimal comma ×42 (`7,62`), so a
        // trailing `,` can open the right operand's fractional part rather than close a clause.
                // ⚠ THE COMMA IS NOW READ, and this assertion used to pin the opposite. The argument for rejecting it
        // was that a comma after the right operand may open a DECIMAL — true, and it only holds when a DIGIT
        // follows. The guard is now `[.,]\d`, so a fraction is still declined and a clause comma is not.
        // One shape, eleven layers: the same six characters were wrong in each. See test/clause-final-range.ts.
        expect(normalizeBambara("1965-1969, ni")).toBe("1965 fo 1969, ni");
        expect(normalizeBambara("1965-1969,5")).not.toContain(" fo "); // a DECIMAL right operand still declines
        // a decimal RIGHT operand is now claimed, and step 11 still reads its tail whole (it read `10-15 5`
        // before this change, so the joiner is the only thing that moved)
        expect(normalizeBambara("10-15.5")).toBe("10 fo 15 5");
    });

    test("the elision apostrophe: C'V glues, V'C does not", () => {
        expect(normalizeBambara("k'a ta san 1914")).toBe("ka ta san 1914");
        expect(normalizeBambara("i n’a fɔ")).toBe("i na fɔ"); // the curly apostrophe too
        expect(normalizeBambara("y'i")).toBe("yi");
        // ⚠ the non-standard orthography apostrophises a PRONOUN off the next word — a boundary, not an
        // elision, and gluing it would fuse two words. The vowel-on-the-left test is what separates them.
        expect(normalizeBambara("u'be taa")).toBe("u'be taa");
        expect(normalizeBambara("N'ko")).toBe("N'ko"); // C'C — the script's own name is untouched
    });

    test("dotted: the era marker expands, initialisms lose their dots, a sentence period survives", () => {
        expect(normalizeBambara("304 K.Ɲ. fo san 232 K.Ɲ.")).toBe("304 Krisita ɲɛ fo san 232 Krisita ɲɛ.");
        expect(normalizeBambara("A.R.P. bangera")).toBe("ARP bangera");
        expect(normalizeBambara("kengani U.S.A. Awa katti")).toBe("kengani USA. Awa katti"); // capital → keep
        // ⚠ the 27-group alphabet listing is left alone rather than half-claimed (see the header)
        expect(normalizeBambara("A.B.C.D.E.Ɛ.F.")).toBe("A.B.C.D.E.Ɛ.F.");
    });

    test("currency and ampersand", () => {
        expect(normalizeBambara("$4")).toBe("dolar 4");
        expect(normalizeBambara("dolar miliyar $4")).toBe("dolar miliyar 4"); // trap 12, magnitude in the way
        expect(normalizeBambara("dolar wari US$ 1.25")).toBe("dolar wari US 1 2 5"); // the code keeps its boundary
        expect(normalizeBambara("S&P")).toBe("S ani P"); // spaced, so `A&B` does not become one token
    });

    test("through the real phonemizer — every emitted word comes from the g2p, both scripts", () => {
        const bm = createBambara();
        expect(bm.text("25 %").normalize("NFC")).toBe("muɡã ni duuru kɛmɛsarada".normalize("NFC"));
        expect(bm.text("5 km²").normalize("NFC")).toBe("kilomɛtɛrɛ kɛnɛ duuru".normalize("NFC"));
        expect(bm.text("$5").normalize("NFC")).toBe("dolar duuru".normalize("NFC"));
        // ⚠ THE N'KO PATH IS UNTOUCHED — no rule in this layer keys on a character N'Ko uses.
        expect(bm.text("ߒߞߏ ߂߁")).toBe(bm.text("ߒߞߏ 21"));
    });

    // HOMOGLYPHS FOR ɛ ɔ ɲ — a census of the artifact's non-ASCII characters: ε U+03B5 ×179, ԑ U+0511 ×26,
    // ᴐ U+1D10 ×9, ɳ U+0273 ×8, against the correct ɛ ×2910 / ɔ ×2461 / ɲ ×265. None is in this g2p's
    // grapheme table and none is ASCII, so the tokenizer ENDED THE WORD at the character and dropped it:
    // `Ntεnεndon` came out `nt n ndõ`, three fragments, two of them vowelless ASCII runs in the IPA.
    // ⚠ Not foldable globally — `core/unicode.ts` would have to send ε to `e`, and /e/ and /ɛ/ are two
    // different Bambara phonemes. ⚠ ⟨ʃ⟩ is ×3 with an unsettled target and is deliberately left alone.
    test("homoglyphs for ɛ ɔ ɲ are folded to the language's own letters", () => {
        expect(normalizeBambara("Ntεnεndon")).toBe("Ntɛnɛndon");
        expect(normalizeBambara("sԑbԑn sᴐrᴐ")).toBe("sɛbɛn sɔrɔ");
        expect(normalizeBambara("A boɳa")).toBe("A boɲa");
        expect(normalizeBambara("ʃi fɔcogo")).toBe("ʃi fɔcogo"); // unsettled target, left alone
        const bm = createBambara();
        // the word is whole again, and identical to the correctly-spelled input
        expect(bm.text("Ntεnεndon ne bε Taa")).toBe(bm.text("Ntɛnɛndon ne bɛ Taa"));
        expect(bm.text("A boɳa bɛ")).toBe(bm.text("A boɲa bɛ"));
    });
});
