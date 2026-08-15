import { describe, expect, test } from "vitest";

import { phonemizeWord, phonemizeWordRules } from "../src/languages/akan/akan.ts";
import { normalizeAkan } from "../src/languages/akan/normalize.ts";
import { getPhonemizer } from "../src/registry.ts";

// Canonical-IPA goldens for Akan / Akan kasa (ak) — a Kwa (Niger-Congo) language of Ghana.
// Shallow, well-standardised Latin orthography (Asante/Akuapem Twi + Fante). Segmental signature: the
// consonant DIGRAPH system (palatal ⟨ky gy hy ny⟩ → t͡ɕ d͡ʑ ɕ ɲ + labialised ⟨tw dw kw gw hw nw⟩ → t͡ɕʷ d͡ʑʷ kʷ ɡʷ ɕʷ
// ŋʷ), Glide Formation (boa→bwa), coda-nasal + Labial Nasalization (Paster 2010), and ATR harmony. TONE (H/L) and
// vowel nasality are lexical (unwritten) → carried by a mined lexicon on the SHIPPED phonemizeWord (Chao letters
// H→˥/L→˩); phonemizeWordRules is the tone-free segmental path. Authored from Dolphyne (1988)/Paster (2010),
// anchored on kaikki.
describe("Akan (Twi) canonical IPA", () => {
    test("palatal digraph series ⟨ky gy hy ny⟩", () => {
        expect(phonemizeWordRules("kyerɛ")).toBe("t͡ɕɪrɛ"); // ky → t͡ɕ; ⟨e⟩ → [ɪ] via ATR harmony (−ATR word)
        expect(phonemizeWordRules("gyina")).toBe("d͡ʑina"); // gy → d͡ʑ ("stand")
        expect(phonemizeWordRules("ɔhyɛ")).toBe("ɔɕɛ"); // hy → ɕ
        expect(phonemizeWordRules("nyansa")).toBe("ɲansa"); // ny → ɲ ("wisdom")
    });

    test("labialised digraph series ⟨tw dw kw hw⟩ — the signature Akan labial-palatalisation", () => {
        expect(phonemizeWordRules("twi")).toBe("t͡ɕʷi"); // the language's own name
        expect(phonemizeWordRules("dwom")).toBe("d͡ʑʷom"); // dw → d͡ʑʷ ("song")
        expect(phonemizeWordRules("kwan")).toBe("kʷan"); // kw → kʷ ("road/way")
        expect(phonemizeWordRules("hwɛ")).toBe("ɕʷɛ"); // hw → ɕʷ ("look")
        expect(phonemizeWordRules("akwaaba")).toBe("akʷaaba"); // "welcome"
    });

    test("Glide Formation + Labial Nasalization + coda assimilation (Paster 2010)", () => {
        expect(phonemizeWordRules("boa")).toBe("bwa"); // round V before another V → w ("help")
        expect(phonemizeWordRules("mba")).toBe("mma"); // /b/ → [m] after a nasal (Labial Nasalization)
        expect(phonemizeWordRules("nkran")).toBe("ŋkran"); // n → ŋ before k (Accra)
    });

    test("ATR harmony resolves ⟨e⟩/⟨o⟩ (the unwritten [+ATR]/[−ATR] merger)", () => {
        expect(phonemizeWordRules("bisa")).toBe("bisa"); // +ATR (has i) — ⟨a⟩ neutral
        expect(phonemizeWordRules("ɔkɔtɔ")).toBe("ɔkɔtɔ"); // −ATR (ɔ), no ambiguous mid
        expect(phonemizeWordRules("obue")).toBe("obwe"); // +ATR (has u) → ⟨o⟩→o, ⟨e⟩→e, + glide formation
    });

    test("TONE (H/L) + vowel nasality — lexical, from the mined lexicon (shipped path)", () => {
        expect(phonemizeWord("papa")).toBe("pa˩pa˥"); // L H
        expect(phonemizeWord("ɔkɔtɔ")).toBe("ɔ˩kɔ˥tɔ˩"); // L H L ("crab")
        expect(phonemizeWord("huu")).toBe("hu˥u˩"); // H L
        expect(phonemizeWord("mifi")).toBe("mĩ˩fi˥"); // L H, first vowel NASAL
        expect(phonemizeWordRules("papa")).toBe("papa"); // rule path stays tone-free (non-circular)
    });

    test("numbers — Twi cardinals through the g2p", () => {
        const ak = getPhonemizer("ak");
        expect(ak.text("12").trim()).toBe("du mmienu"); // du + mmienu
        expect(ak.text("100").trim()).toBe("ɔha");
    });

    // Source for the magnitude words: Omniglot "Numbers in Twi" (omniglot.com/language/numbers/twi.htm) —
    // apem 10³, ɔpepem 10⁶, ɔpepepem 10⁹; the plurals take the regular ɔ-/a- → m- change (ɔha→aha, apem→mpem).
    test("numbers — units, 21–99 compounds, hundreds, thousands, millions, billions", () => {
        const ak = getPhonemizer("ak");
        expect(ak.text("4").trim()).toBe("nnan"); // ennan/nnan — the ⟨nn⟩ unit
        expect(ak.text("40").trim()).toBe("adwanan"); // aduanan
        expect(ak.text("44").trim()).toBe("adwanan nnan");
        expect(ak.text("21").trim()).toBe("adwonu baako"); // aduonu baako
        expect(ak.text("555").trim()).toBe("ahanum adwonum nnum"); // ahanum aduonum nnum
        expect(ak.text("1000").trim()).toBe("apem");
        expect(ak.text("2000").trim()).toBe("mpem mmienu");
        // ⚠ 10⁶/10⁹ need their OWN branch. Without one the multiplier indexes past the end of the hundreds
        // table and the undefined slot stringifies straight into the output ("mpem undefined").
        expect(ak.text("1000000").trim()).toBe("ɔpɪpɪm"); // ɔpepem (⟨e⟩ → ɪ by −ATR harmony)
        expect(ak.text("1000000000").trim()).toBe("ɔpɪpɪpɪm"); // ɔpepepem
    });

    test("full text via the registry", () => {
        expect(getPhonemizer("ak").text("Akwaaba, wo ho te sɛn?")).toBeTruthy();
    });
});

// TEXT NORMALIZATION (src/languages/akan/normalize.ts). ⚠ ak.wikipedia is LOCKED, so the evidence is
// tw.wikipedia (Asante/Akuapem Twi, 27,415 paragraphs) + fat.wikipedia (Fante, 9,029) and the artifact
// mined from both. Asserted on the TEXT function where the rule's own output is the thing under test, and
// through `phonemize` where the point is that the rewrite reaches the g2p. See the file header for the
// corpus counts behind every rule and for the eight classes it deliberately declines.
describe("Akan (Twi) text normalization", () => {
    test("the elision apostrophe — a clitic is not a standalone consonant", () => {
        // The largest class in the language: ×4,930 tw + ×2,664 fat. `n'`/`w'`/`m'` are the possessive
        // clitics whose vowel elides; the TOKEN splits on the apostrophe, so they reached the g2p as a bare
        // [n] / [w] / [m], which is not a possible Akan word.
        expect(normalizeAkan("n'awofoɔ")).toBe("nawofoɔ");
        expect(normalizeAkan("w'ate")).toBe("wate");
        expect(normalizeAkan("m'adwuma")).toBe("madwuma");
        expect(getPhonemizer("ak").text("n'adwuma").trim()).toBe("nad͡ʑʷuma");
        // ⚠ AND NOT THE ENGLISH POSSESSIVE, which both wikis carry in quantity (`People's` ×690 tw,
        // `Women's` ×163, `Master's` ×126). Two independent guards: the clitic must be the WHOLE preceding
        // token, and what follows must be a VOWEL.
        expect(normalizeAkan("People's Convention")).toBe("People's Convention");
        expect(normalizeAkan("Women's Union")).toBe("Women's Union");
        expect(normalizeAkan("Lincoln's Inn")).toBe("Lincoln's Inn");
    });

    test("digit de-grouping — and the dot only de-groups a CHAIN", () => {
        expect(normalizeAkan("16,083")).toBe("16083"); // comma ×3,128 tw + 2,171 fat
        expect(normalizeAkan("3 500 nnipa")).toBe("3500 nnipa"); // space ×29 + 2
        // ⚠ TWO OR MORE GROUPS FOR THE DOT. `3.038.217` is a population figure; a SINGLE `.ddd` is
        // ambiguous in this corpus (28 chained groupings against 35 three-decimal decimals) and is left to
        // the decimal rule, which is the branch the next assertion pins.
        expect(normalizeAkan("3.038.217")).toBe("3038217");
        expect(normalizeAkan("0.206 km")).toBe("0 akyiri pɔ 2 0 6 kilomita");
        // A number followed by its own clause comma must not lose its tail to the de-grouper.
        expect(normalizeAkan("24,000, na")).toBe("24000, na");
    });

    test("percent — PREPOSED, and said only once", () => {
        // `ɔha mu nkyekyɛmu` ×1,387 tw + 215 fat, always before the figure.
        expect(normalizeAkan("49.6%")).toBe("ɔha mu nkyekyɛmu 49 akyiri pɔ 6");
        // A span takes the word once, in front — `10-15%` ×44 tw.
        expect(normalizeAkan("10-15%")).toBe("ɔha mu nkyekyɛmu 10 kosi 15");
        expect(normalizeAkan("40%-50%")).toBe("ɔha mu nkyekyɛmu 40 kosi 50");
        // ⚠ REDUNDANCY (trap 12): 893 of the 5,154 percent signs already have the word written in front of
        // them, because the sentence spells the figure out and then repeats it in digits. Saying it twice
        // is the defect; the sign is dropped instead.
        expect(normalizeAkan("ɔha mu nkyekyɛmu 58.99%")).toBe("ɔha mu nkyekyɛmu 58 akyiri pɔ 99");
        // …but a sentence break between the word and the figure ends the redundancy window.
        expect(normalizeAkan("ɔha mu nkyekyɛmu aduonu. Na 12%")).toBe("ɔha mu nkyekyɛmu aduonu. Na ɔha mu nkyekyɛmu 12");
    });

    test("the decimal point — BOTH branches of the fractional reading", () => {
        // ⚠ The corpus reads a 1–2 digit tail as a CARDINAL (55.77 → *akyiri pɔ aduɔson nson*), which is
        // the branch it exercises; nothing attests a cardinal for a longer tail, and a leading zero cannot
        // be expressed by one at all. Trap 13: pin the branch the corpus does NOT contain.
        expect(normalizeAkan("55.77")).toBe("55 akyiri pɔ 77"); // cardinal — attested
        expect(normalizeAkan("1.8")).toBe("1 akyiri pɔ 8");
        expect(normalizeAkan("1.05")).toBe("1 akyiri pɔ 0 5"); // leading zero → digit by digit
        expect(normalizeAkan("3.14159")).toBe("3 akyiri pɔ 1 4 1 5 9"); // long tail → digit by digit
        expect(normalizeAkan("12,5")).toBe("12 akyiri pɔ 5"); // the minority comma decimal, ×39 tw
        expect(getPhonemizer("ak").text("0.53%").trim())
            .toBe("ɔha mu ŋt͡ɕɪt͡ɕɛmu ɕʷee at͡ɕiri pɔ adwonum mmiɛnsa"); // the corpus's own gloss of 0.53%
    });

    test("ranges — ascending only, and a hyphen CHAIN is not a range", () => {
        expect(normalizeAkan("1989-1997")).toBe("1989 kosi 1997"); // ×1,125 tw + 264 fat
        // Descending is left alone: a birth–death pair offers `1961 – 25`, and a score reads differently.
        expect(normalizeAkan("1961 – 25 Ɔbɛnem")).toBe("1961 – 25 Ɔbɛnem");
        // An ISBN is a catalogue number, not arithmetic — the chain guard is why ak needs no ISBN rule.
        expect(normalizeAkan("ISBN 978-9988-1-2")).toBe("ISBN 978-9988-1-2");
    });

    // TRAP 58 — the right guard used to reject a following `.`, so a span that ENDS A CLAUSE was declined and
    // read as two juxtaposed cardinals with `kosi` gone. ⚠ THE ARTIFACT GAINS NOTHING FROM THIS (0/237): its
    // one clause-final span is `1964-1967, Belfast`, a COMMA, and the comma is deliberately still rejected.
    // The branch is therefore pinned here rather than counted as corpus movement.
    test("a range that ENDS A CLAUSE keeps `kosi`, and the comma is still rejected", () => {
        expect(normalizeAkan("1964-1967.")).toBe("1964 kosi 1967.");
        // the comma stays a rejection: ak writes a comma decimal (×39 tw + 13 fat) and groups with a comma
                // ⚠ THE COMMA IS NOW READ, and this assertion used to pin the opposite. The argument for rejecting it
        // was that a comma after the right operand may open a DECIMAL — true, and it only holds when a DIGIT
        // follows. The guard is now `[.,]\d`, so a fraction is still declined and a clause comma is not.
        // One shape, eleven layers: the same six characters were wrong in each. See test/clause-final-range.ts.
        expect(normalizeAkan("1964-1967, Belfast")).toBe("1964 kosi 1967, Belfast");
        expect(normalizeAkan("1964-1967,5")).not.toContain(" kosi "); // a DECIMAL right operand still declines
        // a decimal RIGHT operand is now claimed, and step 9 still reads its tail whole
        expect(normalizeAkan("10-15.5")).toBe("10 kosi 15 akyiri pɔ 5");
    });

    test("units — the abbreviation, not a new word", () => {
        // The words are the corpus's own; one tw sentence glosses the abbreviation against the word
        // ("24 kilomita fi Damongo … 146 km wɔ Tamale").
        expect(normalizeAkan("12 km")).toBe("12 kilomita");
        expect(normalizeAkan("62 m tenten")).toBe("62 mita tenten");
        expect(normalizeAkan("173cm")).toBe("173 sɛntimita"); // ⚠ sɛntimita ×91, NOT the composed sentimita
        expect(normalizeAkan("5 kg")).toBe("5 kilogram");
        // ⚠ THE SQUARE WORD, AND THIS EXPECTATION IS THE ONE THAT CHANGED. Both lines used to pin the
        // REFUSAL — `45 km²` → `45 km²`, `11.41 km2` → `11 akyiri pɔ 41 km2` — on the stated grounds that
        // no Akan square word was attested and that reading `km²` as *kilomita* would state an area as a
        // distance. The word has since been found and GLOSSED AGAINST THE SYMBOL by tw.wikipedia's own km²
        // article — *"Kilomita ahinanan, agyiraehyɛde km2, yɛ beae a wɔsusuw"* — so the refusal was a
        // sourcing gap, not a permanent one, and it was ak's entire `RAW-LATIN` leak (`km ×7`, all of them
        // squared). See normalize.ts `SQUARED`. The reading is unit-then-modifier, which is what every
        // attested instance agrees on.
        expect(normalizeAkan("45 km²")).toBe("45 kilomita ahinanan");
        expect(normalizeAkan("11.41 km2")).toBe("11 akyiri pɔ 41 kilomita ahinanan");
        // ⚠ AND THE CUBE IS STILL REFUSED — the narrowing is to the square only; nothing attests a cubed
        // modifier and `km³` is ×0 in this artifact.
        expect(normalizeAkan("45 km³")).toBe("45 km³");
        expect(normalizeAkan("45 km3")).toBe("45 km3");
        // ⚠ AND THE WIKITEXT TABLE PIPE IS FOLDED so step 4 can reach across it — the artifact's one `|`
        // is an infobox field that lost its markup (`973.78|km²`), and the character was already silent.
        expect(normalizeAkan("973.78|km²")).toBe("973 akyiri pɔ 78 kilomita ahinanan");
        // ⚠ AND `m` AFTER A MONEY AMOUNT IS THE MAGNITUDE, not the metre (×5 across the two wikis).
        expect(normalizeAkan("US$ 1m")).toBe("dɔla 1m");
        expect(normalizeAkan("5.20m")).toBe("5 akyiri pɔ 20 mita"); // …while a plain decimal still reads
    });

    test("currency — PREPOSED, and the cedi is spelled the way this g2p can read it", () => {
        expect(normalizeAkan("$10,000")).toBe("dɔla 10000");
        expect(normalizeAkan("US$120")).toBe("dɔla 120");
        // ⚠ `cedi` is the commoner corpus spelling and ⟨c⟩ IS NOT AN AKAN LETTER — it falls through to
        // latinPhone and reads [kedi]. `sidi` is attested in the same money slot and reads [sidi].
        expect(normalizeAkan("GH₵50")).toBe("sidi 50");
        expect(getPhonemizer("ak").text("GH₵50").trim()).toBe("sidi adwonum");
        // € and £ are DECLINED — `euro` ×784 tw is the football tournament and the continent.
        expect(normalizeAkan("€126 million")).toBe("€126 million");
    });

    test("dotted abbreviations lose their INTERIOR dots and keep the final one", () => {
        // ×940 tw + 222 fat, read as three spurious clause breaks. The era markers are the same shape.
        expect(normalizeAkan("U.S.A.")).toBe("USA.");
        expect(normalizeAkan("afe 3500 A.Y.B.")).toBe("afe 3500 AYB."); // BC, ×155 tw + 25 fat — NOT expanded
        expect(normalizeAkan("500 Y.B.")).toBe("500 YB."); // AD, ×43 + 13
        // ⚠ The trailing dot is a sentence period as often as not, and deleting it deletes the pause.
        expect(getPhonemizer("ak").text("U.S.A. Ɛyɛ")).toContain(".");
    });

    test("the English ordinal suffix, and the ampersand", () => {
        expect(normalizeAkan("24th February")).toBe("24 February"); // ×528 tw + 254 fat
        expect(normalizeAkan("3rd century")).toBe("3 century");
        // ⚠ SPACES ON BOTH SIDES: deleting the sign would merge `A&B` into one initialism (trap 18/26).
        expect(normalizeAkan("S&P")).toBe("S ne P");
    });

    test("⚠ the classes this layer REFUSES stay refused", () => {
        // Each is argued from the corpus in normalize.ts's header; a rule appearing here later must bring
        // its own attestation with it.
        expect(normalizeAkan("-1.850")).toBe("-1 akyiri pɔ 8 5 0"); // no minus word — the sign stays silent
        expect(normalizeAkan("37.2 °C")).toBe("37 akyiri pɔ 2 °C"); // no degree word, no scale name
        expect(normalizeAkan("12:30")).toBe("12:30"); // no clock — the colon-numerals are mostly not clocks
        expect(normalizeAkan("2/3")).toBe("2/3"); // no fraction series
        expect(normalizeAkan("2 + 2 = 4")).toBe("2 + 2 = 4"); // never arithmetic in this corpus
        expect(normalizeAkan("mu no. 2.")).toBe("mu no. 2."); // `no` is the Akan article, not "number"
    });
});
