import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/odia/odia.ts";
import { getPhonemizer } from "../src/registry.ts";

// Canonical-IPA goldens for Odia / ଓଡ଼ିଆ (or) — Eastern Indo-Aryan, Odia Brahmic abugida read by the generic
// engine like the Dravidian trio: NO inherent-vowel deletion, inherent vowel /ɔ/ (ଘର→ɡʱɔɾɔ), like Bengali. Odia
// has NO phonemic vowel length. Distinctive: SIBILANT MERGER ଶ/ଷ/ସ→[s] (ଭାଷା→bʱasa), the retroflex flap ଡ଼→ɽ,
// ଳ→ɭ, dental t̪ d̪ n̪. Validated at 98.3% vs kaikki ori (folded).
describe("Odia canonical IPA", () => {
    test("inherent vowel /ɔ/ retained (no schwa deletion) + retroflex flap ଡ଼→ɽ", () => {
        expect(phonemizeWord("ଓଡ଼ିଆ")).toBe("ˈoɽia"); // 'Odia' — ଡ଼ → ɽ (flap)
        expect(phonemizeWord("ଘର")).toBe("ɡʱˈɔɾɔ"); // 'house' — final inherent ɔ retained (cf. Hindi ɡʱəɾ)
        expect(phonemizeWord("ଭାରତ")).toBe("bʱˈaɾɔt̪ɔ"); // 'India' — every akshara pronounced
    });

    test("sibilant merger ଶ/ଷ/ସ → [s], ଳ→ɭ, dental n̪", () => {
        expect(phonemizeWord("ଭାଷା")).toBe("bʱˈasa"); // ଷ → s (no /ʃ/)
        expect(phonemizeWord("କଳିଙ୍ଗ")).toBe("kˈɔɭiŋɡɔ"); // 'Kalinga' — ଳ→ɭ, ଙ୍ଗ→ŋɡ
        expect(phonemizeWord("ନୂତନ")).toBe("n̪ˈut̪ɔn̪ɔ"); // 'new' — dental n̪, no vowel length (ୂ→u)
    });

    test("nasalisation (chandrabindu) + conjunct palatal nasal", () => {
        expect(phonemizeWord("ମୁଁ")).toBe("mˈũ"); // 'I' — chandrabindu nasalises
        expect(phonemizeWord("ପାଞ୍ଚ")).toBe("pˈaɲt͡ʃɔ"); // 'five' — ଞ୍ଚ → homorganic ɲt͡ʃ
    });

    test("word-final anusvara nasalizes (not [m])", () => {
        expect(phonemizeWord("ଏବଂ")).toBe("ˈebɔ̃"); // 'and' (common function word) — ebɔ̃, NOT ebɔm
    });

    test("numbers compose, incl. NATIVE Odia digits ୦-୯", () => {
        expect(getPhonemizer("or").text("3").trim()).toBe("t̪ˈin̪i"); // ASCII → ତିନି
        expect(getPhonemizer("or").text("୩").trim()).toBe("t̪ˈin̪i"); // NATIVE digit ୩ → ତିନି
        // NO `bareMagnitude`: Odia genuinely says *ek śaha*, and the corpus writes "ଏକ ଶହ ରନ୍" in full.
        expect(getPhonemizer("or").text("100").trim()).toBe("ˈekɔ sˈɔɦɔ"); // ଏକ ଶହ
    });
});

// TEXT NORMALIZATION. Counts and provenance are in src/languages/odia/normalize.ts's header; these
// pin the behaviours that the or_in corpus diff (158/1327 utterances changed) actually moved.
const or = (s: string): string => getPhonemizer("or").text(s).trim();

describe("Odia text normalization", () => {
    test("fused 21-99 cardinals — the map, not the two-word fallback", () => {
        expect(or("21")).toBe("ˈekoisɔ"); // ଏକୋଇଶ, not [ˈekɔ kˈoɽie] "one twenty"
        expect(or("56")).toBe("t͡ʃʰˈɔpɔn̪ɔ"); // ଛପନ, not "six fifty" — corpus "56 ପ୍ରକାର ଖାଦ୍ୟ"
        expect(or("1947")).toBe("ˈekɔ ɦˈɔd͡ʒaɾɔ n̪ˈɔɔ sˈɔɦɔ sˈɔt̪ɔt͡ʃaɭisɔ"); // …ସତଚାଳିଶ, not "…ସାତ ଚାଳିଶ"
        expect(or("93")).toBe("t̪ˈejan̪ɔbe"); // ତେୟାନବେ, verified on or.wiktionary
        // One of the 12 values left un-authored still degrades to the readable two-word fallback rather
        // than leaking a "?" — 68 is ଅଠ-, a prefix or.wiktionary's import has no pages for at all.
        expect(or("68")).toBe("ˈaʈʰɔ sˈaʈʰie");
    });

    test("Latin `I` is the corpus's DANDA, not the English pronoun", () => {
        // ×23, every one sentence-final. Before, the Latin branch spoke it as [ˈaᶦ] AND the break vanished.
        expect(or("ନାହିଁ I")).toBe("n̪ˈaɦĩ ."); // no space in the source is also live: "…ପାଇଥିଲେI"
        expect(or("ହୋଇଛିI")).toBe("ɦˈoit͡ʃʰi .");
    });

    test("grouped numerals, decimals and the clock stop producing phrase breaks", () => {
        expect(or("7,000")).toBe("sˈat̪ɔ ɦˈɔd͡ʒaɾɔ"); // was [sˈat̪ɔ , sˈun̪jɔ] — "seven, zero"
        expect(or("1.2")).toBe("ˈekɔ d̪ˈui"); // was a SENTENCE BREAK mid-number
        expect(or("11:29")).toBe("ˈeɡaɾɔ ˈɔɳɔt̪iɾisɔ"); // colon was a comma pause
        expect(or("10:00ଟା")).toBe("d̪ˈɔsɔ ʈˈa"); // :00 drops out — not "ଦଶ ଶୂନ୍ୟ ଟା"
        // The ratio ୩:୨ is NOT a clock: the two-digit minute guard rejects it (it stays as it was).
        expect(or("୩:୨")).toBe("t̪ˈin̪i , d̪ˈui");
    });

    test("ordinal suffix fuses to the cardinal's last word", () => {
        expect(or("18ଶ ଶତାବ୍ଦୀ")).toBe("ˈɔʈʰɔɾɔsɔ sˈɔt̪abd̪i"); // was […ˈɔʈʰɔɾɔ sˈɔ] — suffix as its own word
        expect(or("1000ତମ")).toBe("ˈekɔ ɦˈɔd͡ʒaɾɔt̪ɔmɔ");
        // ଶହ is the HUNDRED word and must survive the single-letter ଶ rule: "18ଶହ ଶତାବ୍ଦୀ" ×2 in the corpus.
        expect(or("18ଶହ ଶତାବ୍ଦୀ")).toBe("ˈɔʈʰɔɾɔ sˈɔɦɔ sˈɔt̪abd̪i");
    });

    test("shared symbol tier: percent, currency incl. the US$ multi-character key, units, rate, exponent", () => {
        expect(or("93%")).toBe("t̪ˈejan̪ɔbe pˈɾɔt̪isɔt̪ɔ"); // ପ୍ରତିଶତ postposed — corpus ×9
        expect(or("$5")).toBe("pˈaɲt͡ʃɔ ɖˈɔlaɾɔ");
        expect(or("US$14.7 ବିଲିଅନ୍")).toBe("t͡ʃˈɔud̪ɔ sˈat̪ɔ bˈiliɔn̪ ɖˈɔlaɾɔ"); // the letter code was stranded
        expect(or("70km/h")).toBe("sˈɔt̪uɾi kˈilomiʈɔɾɔ pˈɾɔt̪i ɡʱˈɔɳʈa"); // unitPer + rateDenominator
        expect(or("3136 mm2")).toBe("t̪ˈin̪i ɦˈɔd͡ʒaɾɔ ˈekɔ sˈɔɦɔ t͡ʃʰˈɔt̪isɔ bˈɔɾɡɔ mˈilimiʈɔɾɔ"); // ବର୍ଗ BEFORE
    });

    test("Odia unit abbreviations, the rate slash, and dotted abbreviations", () => {
        expect(or("1600 କି.ମି.")).toBe("ˈekɔ ɦˈɔd͡ʒaɾɔ t͡ʃʰˈɔɔ sˈɔɦɔ kˈilomiʈɔɾɔ"); // two phrase breaks gone
        expect(or("160କିମି/ଘଣ୍ଟା")).toBe("ˈekɔ sˈɔɦɔ sˈaʈʰie kˈilomiʈɔɾɔ pˈɾɔt̪i ɡʱˈɔɳʈa");
        expect(or("ଡଃ. ଏହୁଦ୍")).toBe("ɖˈakt̪ɔɾɔ ˈeɦud̪");
        // A slash between ordinary words is NOT a rate: nine of the corpus's fourteen are ଏବଂ/କିମ୍ବା etc.
        expect(or("ଏବଂ/କିମ୍ବା")).toBe("ˈebɔ̃ kˈimba");
    });

    test("#586 yen, pound, and the UTC offset's plus", () => {
        // Same sentence and same finding as bn — the or_in speaker voices no currency either.
        expect(or("ମୂଲ୍ୟ ପ୍ରାୟ ¥7,000 ହେବା ସହିତ।")).toContain("jˈen̪ɔ");
        // `£` stayed hidden behind `¥`: the audit reports the FIRST defective instance per cell, so closing
        // one instance revealed another. A cell is not done until it re-scans clean.
        expect(or("ପାଲମେରାସରୁ £27 ନିୟୁତ ଦେୟ ସହିତ।")).toContain("pˈauɳɖɔ");
        // Both or_in speakers SKIP the whole parenthetical, so this word ships on typology: the six Indic
        // languages whose plus was resolved from audio in this sweep all borrow, with no counterexample.
        expect(or("ସମୟ ପ୍ରାୟ 11:00 (UTC+1)ରେ")).toContain("plˈɔs");
    });
});
