/**
 * THE REDUCED SLOT — misaki writes `ᵊ` (Kokoro vocab id 42) where we wrote a plain schwa, in 7,778 of
 * its 80,222 gold entries. We emitted it zero times. This is the import that closes that.
 *
 * ⚠ IT IS A CONVENTION IMPORT, NOT A DERIVATION, and the file says so because the numbers say so:
 * the best ARPABET context (`AH0 L` word-final) is 76% syllabic and every other is a coin flip, and
 * the one shipped English referee (wikipron, human) marks a syllabic consonant on 60 of 4,558 rows
 * and agrees with misaki on only 66% of the 35 they share — disagreeing SYSTEMATICALLY on `-tion`
 * and `-ism`. Whether `-tion` is written `ʃn̩` or `ʃən` is a transcription convention, not a fact,
 * and Kokoro learned misaki's. See docs/investigations/kokoro_vphon_investigation.md Run 15.
 */
import { describe, expect, test } from "vitest";
import { phonemize } from "../src/index.ts";

describe("reduced slots: syllabic consonants and the extra-short schwa", () => {
    // ⚠ `ᵊ` IS NOT ONE PHONOLOGICAL FACT, which is why there are two spellings. Over the 3,264 slots
    // the table marks, 2,647 (81%) have the sonorant in the CODA, genuinely carrying the syllable;
    // 617 (19%) have it as the ONSET of the next syllable, where it cannot be syllabic at all.
    // Writing `n̩` for the second kind would put a false claim in the canonical IPA to win a true
    // token downstream. Canonical IPA has both, and KokoroFormat maps each to `ᵊ`.
    test("a coda sonorant carries the syllable — the syllabic diacritic", () => {
        expect(phonemize("the able one", "en")).toContain("ˈeᶦbɫ̩");      // EY1 B AH0 L
        expect(phonemize("a normal day", "en")).toContain("nˈɔːɹmɫ̩");
        expect(phonemize("two thousand", "en")).toContain("θˈaᶷzn̩d");
    });

    test("an onset sonorant cannot be syllabic — the extra-short schwa instead", () => {
        // `accompany` is AH0 K AH1 M P AH0 N IY0: the N starts `ni`, so it is an onset. misaki still
        // writes ᵊ there (əkˈʌmpᵊni), which is what says its ᵊ means REDUCED, not SYLLABIC.
        expect(phonemize("they accompany us", "en")).toContain("əkʰˈʌmpə̆ni");
        expect(phonemize("we analyze it", "en")).toContain("ˈænə̆lˌaᶦz");
    });

    test("one word can need both", () => {
        // abominable: AH0 B AA1 M AH0 N AH0 B AH0 L — the first N is an onset, the final L a coda.
        expect(phonemize("the abominable one", "en")).toContain("əbˈɑːmə̆nəbɫ̩");
    });

    // ⚠ THE TABLE IS THE ORACLE, INCLUDING ITS QUIRKS. `little` and `bottle` are the same shape and
    // misaki marks only the first (lˈɪɾᵊl vs bˈɑɾəl). We reproduce that, because matching the
    // convention is the whole point — a "corrected" reading would be a reading Kokoro never heard.
    test("words the table does not mark are untouched", () => {
        expect(phonemize("a little bottle", "en")).toContain("lˈɪt̬ɫ̩");
        expect(phonemize("a little bottle", "en")).toContain("bˈɑːt̬əɫ");
        expect(phonemize("seven", "en")).toContain("sˈɛvən");   // gold: sˈɛvən, not sˈɛvᵊn
    });

    // ⚠ CREOLES MUST NOT INHERIT THIS. Naija nativises English words through the English dict and
    // already strips aspiration and flapping, because those are facts about General American rather
    // than Nigerian Pidgin; the reduced-slot marks are the same kind of fact. Without the strip at
    // that boundary this quietly rewrote Naija — `people` → *pipl̩*, `analyze` → *anălaiz*.
    test("the creole citation form has the marks undone", () => {
        const naija = phonemize("people analyze", "pcm");
        expect(naija).not.toContain("̩");
        expect(naija).not.toContain("̆");
    });
});
