import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/chuvash/chuvash.ts";
import { getPhonemizer } from "../src/registry.ts";
import { phonemize } from "../src/index.ts";
import { foldCyrillicConfusables } from "../src/core/unicode.ts";
import { normalizeChuvash, ordinalOf } from "../src/languages/chuvash/normalize.ts";

// Canonical-IPA goldens for Chuvash (chv) — Чӑвашла, the SOLE surviving Oghur (Bulgaric) Turkic language, CYRILLIC.
// Two signatures: (1) ALLOPHONIC VOICING — the voiceless letters ⟨п т к ч с ҫ ш х⟩ voice between vowels or after a
// nasal (Chuvash has no phonemic voicing contrast), and a GEMINATE blocks it → single long [Cː]; (2) REDUCED-VOWEL
// STRESS — the reduced vowels ⟨ӑ⟩→[ə], ⟨ӗ⟩→[ɘ] cannot bear stress; it falls on the last full vowel, else the first.
// Referee: English Wiktionary 'Chuvash terms with IPA pronunciation' (84 human pairs).
describe("Chuvash (Чӑвашла) canonical IPA", () => {
    test("HALLMARK 1 — allophonic intervocalic / post-nasal VOICING", () => {
        expect(phonemizeWord("апат")).toBe("aˈbat"); // ⟨п⟩→[b] between vowels; final ⟨т⟩ stays [t]
        expect(phonemizeWord("ача")).toBe("aˈd͡ʑa"); // ⟨ч⟩→[d͡ʑ] intervocalic
        expect(phonemizeWord("вӑкӑр")).toBe("ˈʋəɡər"); // ⟨к⟩→[ɡ] intervocalic
        expect(phonemizeWord("эпир")).toBe("eˈbir"); // ⟨п⟩→[b]
        expect(phonemizeWord("манпа")).toBe("manˈba"); // ⟨п⟩→[b] AFTER A NASAL (not just intervocalic)
        expect(phonemizeWord("чухӑнлӑх")).toBe("ˈt͡ɕuɣənləχ"); // ⟨х⟩→[ɣ] intervocalic; final ⟨х⟩ stays [χ]
        expect(phonemizeWord("вӑлсем")).toBe("ʋəlˈzem"); // ⟨с⟩→[z] after a LIQUID before a FULL vowel
        expect(phonemizeWord("чӗрпӗк")).toBe("ˈt͡ɕɘrpɘk"); // ⟨п⟩ stays [p] after a liquid before a REDUCED vowel (no voicing)
    });

    test("gemination BLOCKS voicing → single long voiceless [Cː]", () => {
        expect(phonemizeWord("иккӗ")).toBe("ˈikːɘ"); // ⟨кк⟩→[kː] (NOT voiced [ɡ])
        expect(phonemizeWord("саккӑр")).toBe("ˈsakːər"); // ⟨кк⟩→[kː]
    });

    test("HALLMARK 2 — reduced ⟨ӑ⟩→ə, ⟨ӗ⟩→ɘ never bear stress", () => {
        expect(phonemizeWord("чӑваш")).toBe("t͡ɕəˈʋaʂ"); // 'Chuvash' — stress the FULL ⟨а⟩, not the reduced ⟨ӑ⟩
        expect(phonemizeWord("сӑмах")).toBe("səˈmaχ"); // stress the last full ⟨а⟩ (⟨ӑ⟩ reduced)
        expect(phonemizeWord("вӑтӑр")).toBe("ˈʋədər"); // 'thirty' — ALL vowels reduced → stress the FIRST
        expect(phonemizeWord("мӗн")).toBe("ˈmɘn"); // ⟨ӗ⟩→[ɘ]
        expect(phonemizeWord("кӗҫнерникун")).toBe("kɘɕnerniˈɡun"); // stress the last full vowel ⟨у⟩; ⟨ӗ⟩ reduced
    });

    test("NUMBERS — the OGHUR system: two series per unit + unit-times-ten 80/90", () => {
        const chv = getPhonemizer("chv");
        // Data + provenance: src/languages/chuvash/numbers.ts (Chuvash Wikipedia "Хисеп ячĕ" for the roots AND the
        // composition rule — вун ҫиччĕ 17, ҫирĕм тăваттă 24, ҫĕр вăтăр саккăр 138 — plus Omniglot / Wiktionary cv).
        expect(chv.text("7").trim()).toBe("ˈɕit͡ɕːɘ"); // ҫиччӗ — the FULL (counting) form, with its geminate [t͡ɕː]
        expect(chv.text("11").trim()).toBe("ˈʋun pɘˈrːe"); // вун пӗрре — short ten вун + the full unit
        expect(chv.text("25").trim()).toBe("ˈɕirɘm ˈpilːɘk"); // ҫирӗм пиллӗк — the cited ҫирĕм+unit shape
        expect(chv.text("100").trim()).toBe("ˈɕɘr"); // ҫӗр — no multiplier for 1
        expect(chv.text("138").trim()).toBe("ˈɕɘr ˈʋədər ˈsakːər"); // ҫӗр вӑтӑр саккӑр — verbatim the source's own example
        expect(chv.text("555").trim()).toBe("ˈpilɘk ˈɕɘr ˈalːə ˈpilːɘk"); // пилӗк ҫӗр аллӑ пиллӗк — SHORT пилӗк before ҫӗр, FULL пиллӗк at the end
        expect(chv.text("1984").trim()).toBe("ˈpin ˈtəɣər ˈɕɘr saɡərˈʋunːə təˈʋatːə"); // пин тӑхӑр ҫӗр сакӑрвуннӑ тӑваттӑ — 80 = 8×10
        expect(chv.text("12345").trim()).toBe("ˈʋun ˈik ˈpin ˈʋiɕ ˈɕɘr ˈχɘrɘχ ˈpilːɘk"); // вун ик пин виҫ ҫӗр хӗрӗх пиллӗк — short ик/виҫ in the multiplier slots
        expect(chv.text("1000000").trim()).toBe("ˈpɘr milːiˈon"); // пӗр миллион
    });

    test("onset consonants + vowels + iotation", () => {
        expect(phonemizeWord("чул")).toBe("ˈt͡ɕul"); // ⟨ч⟩→[t͡ɕ] initial (voiceless), ⟨у⟩→[u]
        expect(phonemizeWord("хула")).toBe("χuˈla"); // ⟨х⟩→[χ] onset, ⟨л⟩→[l]
        expect(phonemizeWord("шыв")).toBe("ˈʂɯʋ"); // ⟨ш⟩→[ʂ], ⟨ы⟩→[ɯ], ⟨в⟩→[ʋ]
        expect(phonemizeWord("ҫил")).toBe("ˈɕil"); // ⟨ҫ⟩→[ɕ]
    });

    test("⟨ь⟩ PALATALIZES — the soft sign is not silent in Chuvash, and ⟨ъ⟩ keeps the glide", () => {
        // Found by the silent-deletion detector: ⟨ь⟩ ×364 in the artifact, reading as NOTHING in every word.
        // Chuvash palatalization before a front vowel is allophonic and unwritten here; ⟨ь⟩ marks it where no
        // front vowel follows, which is where the contrast lives. The referee transcribes выльӑх [ʋɯlʲəχ].
        expect(phonemizeWord("выльӑх")).toBe("ˈʋɯlʲəχ"); // the referee's own row, exactly
        expect(phonemizeWord("тӑрать")).toBe("təˈratʲ"); // 3sg present — palatalized final ⟨т⟩ against a bare stem
        expect(phonemizeWord("январь")).toBe("janˈʋarʲ");
        // ⚠ THE VOICING TABLE STILL SEES A BARE SEGMENT: [ʲ] is applied AFTER the voicing pass, so a
        // ⟨ь⟩-bearing word keeps the allophonic voicing it had (⟨ч⟩→[d͡ʑ] intervocalic here).
        expect(phonemizeWord("Перечень")).toBe("pereˈd͡ʑenʲ");
        // ⟨ъ⟩ before ⟨е⟩ is a SEPARATING sign — its whole job is the glide, which was being dropped
        // (`объектов → obekˈtoʋ`). Russian loans are the only place Chuvash writes one.
        expect(phonemizeWord("объектов")).toBe("objekˈtoʋ");
        expect(phonemizeWord("съезде")).toBe("sjezˈde");
    });
});

// ── TEXT NORMALIZATION (src/languages/chuvash/normalize.ts) ─────────────────────────────────────────
//
// The evidence for every case here is `tools/corpus/mined/chv.jsonc` (cv.wikipedia dump, 232,373
// paragraph segments) and the argument is in the normalizer's own header. Roman numerals are tested
// through `phonemize`, NOT through a constructed engine: `core/roman.ts` runs in registry.ts WRAPPING
// `text()`, so a test on `createChuvash()` never exercises the policy at all (playbook trap 16).
describe("Chuvash text normalization", () => {
    const chv = { text: (s: string) => phonemize(s, "chv") };

    test("THE LATIN LOOK-ALIKE CODEPOINTS — the defect that had to be fixed before anything else", () => {
        // cv.wikipedia writes ⟨ă ĕ ç ü⟩ (U+0103/0115/00E7/00FC) 4,936 times against 918 for the real
        // ⟨ӑ ӗ ҫ ӳ⟩. The block-range tokenizer split the word and read the stray as an English letter.
        for (const [latin, cyrillic] of [
            ["вăтам", "вӑтам"], ["Чăваш", "Чӑваш"], ["пĕрремĕш", "пӗрремӗш"],
            ["çĕр", "ҫӗр"], ["ĕмĕр", "ӗмӗр"], ["ăшă", "ӑшӑ"], ["çĕнĕ", "ҫӗнӗ"],
        ] as const)
            expect(chv.text(latin)).toBe(chv.text(cyrillic));
        // ⚠ `çĕр` is the case the MAJORITY rule could not reach — two Latin letters against one
        // Cyrillic — and it is one of the commonest words in the language.
        expect(chv.text("çĕр")).toBe("ˈɕɘr");
        // ⚠ AND A GENUINELY FOREIGN WORD IS STILL UNTOUCHED. The corpus's own `für`, `München` and
        // `göğsüm` have no Cyrillic letter at all, which is what the presence test requires.
        expect(foldCyrillicConfusables("Ку München хула", true)).toContain("München");
        expect(foldCyrillicConfusables("für", true)).toBe("für");
    });

    test("THE ATTRIBUTIVE NUMERAL — the second series the engine never asked for", () => {
        // `numbers.ts` has had both series since it was written; nothing passed the flag.
        expect(chv.text("1 км")).toBe("ˈpɘr kiloˈmetr"); // пӗр, not пӗрре
        expect(chv.text("5 км")).toBe("ˈpilɘk kiloˈmetr"); // пилӗк, not пиллӗк
        expect(chv.text("21 км")).toBe("ˈɕirɘm ˈpɘr kiloˈmetr");
        // ⚠ A DIGIT RUN STANDING ALONE KEEPS THE COUNTING FORM — that is the whole point of two series.
        expect(chv.text("5")).toBe("ˈpilːɘk"); // пиллӗк
        expect(chv.text("1")).toBe("pɘˈrːe"); // пӗрре
    });

    test("the ordinal is an INVARIANT -мӗш, which is the Oghur/Kipchak split", () => {
        // ba needs four allomorphs chosen by harmony and rounding, tt two; Chuvash needs none.
        expect(ordinalOf(1)).toBe("пӗрремӗш");
        expect(ordinalOf(4)).toBe("тӑваттӑмӗш");
        expect(ordinalOf(20)).toBe("ҫирӗммӗш");
        expect(ordinalOf(100)).toBe("ҫӗрмӗш");
        expect(ordinalOf(1000)).toBe("пинмӗш");
        // ⚠ THE STEM IS THE FULL SERIES — тӑваттӑ, not тӑват. The corpus's own "виççĕ тăваттăмĕш пайĕ".
        expect(ordinalOf(4)).not.toBe("тӑватмӗш");
        // The written suffix may run past the ordinal's own tail; splice on the overlap.
        expect(chv.text("22-мĕшĕнче")).toBe("ˈɕirɘm ikːɘmɘʐɘnˈd͡ʑe"); // ҫирӗм иккӗмӗшӗнче
        expect(chv.text("3-мĕш космонавчĕ")).toBe("ˈʋiɕːɘmɘʂ kosmoˈnaʋt͡ɕɘ");
    });

    test("the ORDINAL RANGE puts the suffix on the second endpoint and means it for both", () => {
        // Three hyphens in one token, two of which open a range and one of which introduces a suffix.
        expect(chv.text("1-5-мӗш класӗсенче"))
            .toBe("pɘˈrːemɘʂ , ˈpilːɘkmɘʂ klazɘzenˈd͡ʑe"); // пӗрремӗш, пиллӗкмӗш класӗсенче
    });

    test("DEGREES ARE TEMPERATURES HERE — and the scale letter has three encodings", () => {
        // The opposite answer to Tatar's, two rounds apart, on the same cell.
        expect(chv.text("−19 °C")).toBe("miˈnus ˈʋun ˈtəɣər t͡selʲˈzi ɡraˈduzɘ");
        expect(chv.text("-13°С")).toBe("miˈnus ˈʋun ˈʋiɕ t͡selʲˈzi ɡraˈduzɘ"); // Cyrillic ⟨С⟩
        expect(chv.text("+20°с")).toBe("plˈjus ˈɕirɘm t͡selʲˈzi ɡraˈduzɘ"); // lowercase Cyrillic ⟨с⟩
    });

    test("the FRACTION, claimed only where `пай` follows", () => {
        // The corpus spells its own reading out: "виççĕ тăваттăмĕш пайĕ (71,8%)".
        expect(chv.text("4/5 пайĕ")).toBe("təˈʋatːə ˈpilːɘkmɘʂ ˈpajɘ");
        expect(chv.text("1/2 пайĕн")).toBe("pɘˈrːe ˈikːɘmɘʂ ˈpajɘn");
        // …and six of the nine slashes in this corpus are something else entirely.
        expect(normalizeChuvash("1608/09 çулхи")).toBe("1608/09 çулхи");
        expect(normalizeChuvash("57/1 ҫурт")).toBe("57/1 ҫурт");
        expect(normalizeChuvash("3/14")).toBe("3/14");
    });

    test("ROMAN CENTURIES — through the registry seam, and in the encoding the writer used", () => {
        // ⚠ romanPass runs BEFORE the shared character folds, so the policy sees the Latin ⟨ĕ⟩.
        expect(chv.text("XVIII ĕмĕр")).toBe("ˈʋun ˈsakːərmɘʂ ˈɘmɘr");
        expect(chv.text("XVIII ӗмӗр")).toBe("ˈʋun ˈsakːərmɘʂ ˈɘmɘr");
        expect(chv.text("Екатерина II")).toBe("jeɡaderiˈna ˈikːɘ"); // a regnal number is a cardinal
    });

    test("clock, era, grouping, the decimal comma and the range's pause", () => {
        // ⚠ THE SECONDS FIELD REACHES 60 — one of the three clocks IS the leap second.
        expect(chv.text("23:59:60")).toBe("ˈɕirɘm ˈʋiɕːɘ ˈalːə ˈtəχːər ˈutməl");
        expect(normalizeChuvash("п. эрч. 2040")).toBe("пирӗн эраччен 2040");
        expect(normalizeChuvash("530 ҫ.")).toBe("530 ҫул");
        expect(chv.text("1 032 343 çын"))
            .toBe("ˈpɘr milːiˈon ˈʋədər ˈik ˈpin ˈʋiɕ ˈɕɘr ˈχɘrɘχ ˈʋiɕ ˈɕɯn");
        expect(chv.text("12,5")).toBe("ˈʋun ˈikːɘ χyreʂˈke ˈpilːɘk"); // хӳрешке — the comma's own name
        // ⚠ NOTHING MAY BE REQUIRED AFTER THE SECOND NUMBER (trap 58) — a citation ends this way.
        expect(chv.text("С. 61-63.")).toBe("s . ˈutməl pɘˈrːe , ˈutməl ˈʋiɕːɘ ."); // and both endpoints keep the COUNTING form, because no noun follows either
    });

    test("the symbol tier: percent, currency, the squared unit and the rate", () => {
        expect(chv.text("84%")).toBe("saɡərˈʋunːə təˈʋat proˈt͡sent"); // 80 is сакӑрвуннӑ, ONE word (8×10, the Oghur pattern)
        expect(chv.text("$10 000")).toBe("ˈʋun ˈpin doˈlːar");
        expect(chv.text("8 413 km²"))
            .toBe("ˈsaɡər ˈpin təˈʋat ˈɕɘr ˈʋun ˈʋiɕ təʋatˈkal kiloˈmetr");
        // ⚠ The denominator is written with the LATIN ⟨ç⟩ and stands alone as its own token, so the
        // word-scoped confusable fold cannot reach it — the tier has to declare both spellings.
        expect(chv.text("2,8 м/ç")).toBe("ˈikːɘ χyreʂˈke ˈsakːər ˈmetr ɕekːuntˈra");
    });

    test("INITIALISMS — the caps runs that reached the g2p as consonant clusters", () => {
        expect(chv.text("ЧР")).toBe("ˈt͡ɕe ˈer"); // was [t͡ɕr]
        expect(chv.text("АПШ")).toBe("ˈa ˈpe ˈʂa"); // the USA
    });
});
