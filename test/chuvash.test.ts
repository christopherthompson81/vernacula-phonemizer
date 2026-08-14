import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/chuvash/chuvash.ts";
import { getPhonemizer } from "../src/registry.ts";

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
