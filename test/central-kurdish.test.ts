import { describe, expect, test } from "vitest";
import { phonemize } from "../src/index.ts";
import { normalizeCentralKurdish } from "../src/languages/central-kurdish/normalize.ts";

import { phonemizeWord, phonemizeWordRules, bizrokeLexiconHas } from "../src/languages/central-kurdish/central-kurdish.ts";

// Canonical-IPA goldens for Central Kurdish / Sorani / کوردیی ناوەندی (ckb) — Iranian, the Sorani Perso-Arabic
// alphabet (a near-FULL alphabet: writes all long vowels + short /a/, only the short /ɪ/ bizroke unwritten).
// Hand-adjudicated against wikipron ckb_arab_broad + kaikki ckb, both human. Signatures: the
// pharyngeals ح→ħ, ع→ʕ; the velarised ڵ→ɫ; the trill ڕ→r vs tap ر→ɾ; ئ→ʔ (glottal onset). Complements Kurmanji
// (kmr).
describe("Central Kurdish (Sorani) canonical IPA — Perso-Arabic alphabet", () => {
    test("long vowels + ئ glottal onset (کوردی, ئاشتی, ئاسمان)", () => {
        expect(phonemizeWord("کوردی")).toBe("kuɾdiː"); // "Kurdish" — و→u, ی→iː
        expect(phonemizeWord("ئاشتی")).toBe("ʔaːʃtiː"); // "peace" — ئ→ʔ onset, ا→aː
        expect(phonemizeWord("ئاسمان")).toBe("ʔaːsmaːn"); // "sky"
    });

    test("the PHARYNGEAL ح→ħ, the velarised ڵ→ɫ, the trill ڕ→r", () => {
        expect(phonemizeWord("حەوت")).toBe("ħawt"); // "seven" — ح → ħ (pharyngeal)
        expect(phonemizeWord("ئاڵا")).toBe("ʔaːɫaː"); // "flag" — ڵ → ɫ (velarised l)
        expect(phonemizeWord("ڕۆژ")).toBe("roːʒ"); // "sun/day" — ڕ → r (trill), ۆ → oː, ژ → ʒ
    });

    test("ۆ→oː, و/ی glide vs vowel, ە→a (گەورە, خۆشەویستی)", () => {
        expect(phonemizeWord("گەورە")).toBe("ɡawɾa"); // و → w (glide, next to vowels), ە → a
        expect(phonemizeWord("خۆشەویستی")).toBe("xoːʃawiːstiː"); // "love" — خ→x, ۆ→oː
        expect(phonemizeWord("دەست")).toBe("dast"); // "hand"
    });
});

// TEXT NORMALIZATION. Counts are measured over the FLEURS ckb_iq corpus (column 3).
describe("central kurdish normalization", () => {
    // ⚠ THE TOKENIZER'S LETTER CLASS MUST EXCLUDE THE DIGITS. [ؠ-ۿ] = U+0620–U+06FF CONTAINS the
    // Arabic-Indic digits U+0660–U+0669, so a native digit run is claimed by the LETTER branch and
    // phonemized to an EMPTY STRING. That is the majority digit system here: 2036 against 1705 ASCII.
    test("native Arabic-Indic digits are read, not swallowed", () => {
        expect(phonemize("٢٠٢٤", "ckb")).not.toBe("");
        expect(phonemize("٢٠٢٤", "ckb")).toBe(phonemize("2024", "ckb"));
        expect(phonemize("١٠٠٠٠", "ckb")).toBe(phonemize("10000", "ckb"));
    });

    // ⚠ Kurdish uses the ENGLISH numeric conventions — the comma GROUPS and the period is the DECIMAL —
    // the opposite of Danish, Romanian and Bulgarian. Reading `30,000` as a decimal makes it
    // "thirty point zero zero zero".
    test("the comma groups and the period is the decimal, unlike the European convention", () => {
        expect(normalizeCentralKurdish("30,000")).toBe("30000");
        expect(normalizeCentralKurdish("2.4")).toBe("2 خاڵ 4");
    });

    // Kurdish PREPOSES the percent phrase, and the corpus writes the sign on either side of the number.
    test("percent is preposed, and the sign is claimed in both placements", () => {
        expect(normalizeCentralKurdish("٨٨%")).toBe("لە سەدا 88");
        expect(normalizeCentralKurdish("%٨٨")).toBe("لە سەدا 88");
    });

    test("clock and ranges", () => {
        expect(normalizeCentralKurdish("11:00")).toBe("11 00");
        expect(normalizeCentralKurdish("1990-1995")).toBe("1990 بۆ 1995");
    });

    // A timezone offset is written directly against its abbreviation, so the boundary must admit a
    // letter before the sign — and the replacement needs a leading space or the word fuses on.
    test("a signed number after letters (UTC+1)", () => {
        expect(normalizeCentralKurdish("UTC+1")).toBe("UTC کۆ 1");
    });

    /** ⚠ …BUT ONLY FOR ⟨+⟩. The wide boundary was written for the timezone and applied to the minus too,
     *  where the corpus is unanimous the other way: all 20 letter-adjacent hyphens are designations
     *  (`کۆڤید-19`, `نوێ-COVID-19`, `HJR-3`, `Il-76s`, `چانداریان-1`) and not one is a subtraction, so
     *  COVID-19 read as *koːviːd kam noːzda*, "covid MINUS nineteen". A genuine leading minus still reads. */
    test("a hyphen after a LETTER is a compound mark, not a minus", () => {
        expect(normalizeCentralKurdish("کۆڤید-19")).toBe("کۆڤید-19");
        expect(normalizeCentralKurdish("HJR-3")).toBe("HJR-3");
        expect(phonemize("کۆڤید-19", "ckb")).toBe("koːviːd noːzda");
        expect(normalizeCentralKurdish("-5 پلە")).toBe(" کەم 5 پلە");
        expect(normalizeCentralKurdish("لە -5 پلە")).toBe("لە کەم 5 پلە");
        expect(normalizeCentralKurdish("UTC-5")).toBe("UTC-5"); // the minus arm declines; ⟨+⟩ above does not
    });

    test("ordinary Kurdish text is untouched", () => {
        expect(normalizeCentralKurdish("کوردی زمانێکە.")).toBe("کوردی زمانێکە.");
    });

    // LATIN unit aliases, which needed no new vocabulary: only a second key onto words this corpus
    // already spells out (کیلۆمەتر ×33, مەتر ×21). `5 km` reached the g2p as the cluster [ˈʊkm] while `5 کم`
    // read correctly. The two measure words are the corpus's own and both FOLLOW the noun — دووجا ×4 from
    // "پارکەکە 19500 کم دووجا", سێجا ×3 from "لونۆ 120-160 مەتر سێجا".
    test("Latin unit aliases and the exponent words", () => {
        // ⚠ MOVED by the bizroke lexicon: کیلۆمەتر is *kîlometir* and کاتژمێر *katjimêr* — both were
        //   missing the unwritten vowel. See the bizroke describe-block below.
        expect(phonemize("19500 km²", "ckb")).toContain("kiːloːmatɪɾ duːd͡ʒaː");
        expect(phonemize("120 m³", "ckb")).toContain("matɪɾ seːd͡ʒaː");
        expect(phonemize("5 km", "ckb")).toContain("kiːloːmatɪɾ"); // was the cluster [ˈʊkm]
        // The Perso-Arabic path is untouched, including the corpus's own already-spelled exponent.
        expect(phonemize("19500 کم دووجا", "ckb")).toContain("kiːloːmatɪɾ duːd͡ʒaː");
        expect(phonemize("12.8 کم", "ckb")).toContain("xaːɫ haʃt kiːloːmatɪɾ");
        // ORDERING: this rule must precede the decimal rule, which rewrites the dot as the word خاڵ and
        // would leave the version guard nothing to reject. `802.11m` is a designation, not 11 metres.
        expect(phonemize("802.11m", "ckb")).toContain("jak jak ˈɛm");
    });

    // RATES, in BOTH scripts. The corpus writes the rate with a Perso-Arabic denominator against a
    // slash — "480 کم لە کاتژمێر (133 مەتر/چرکە)" — and the slash was silently dropped, so four utterances lost
    // the "per" entirely. `لە` is the per, `کاتژمێر` the hour, `چرکە` the second, all from that sentence.
    // ⚠ The Perso-Arabic arm must accept the ABBREVIATION (`کم`), not just the spelled word. This block runs
    // ABOVE the decimal rule so the version dot survives — a rule that depends on a character an earlier rule
    // has already rewritten will never fire — and `کم` → `کیلۆمەتر` happens further down.
    test("the rate, in both scripts", () => {
        expect(phonemize("120 کم/کاتژمێر", "ckb")).toContain("kiːloːmatɪɾ la kaːtʒɪmeːɾ");
        expect(phonemize("120 مەتر/چرکە", "ckb")).toContain("matɪɾ la t͡ʃɾka");
        expect(phonemize("120 km/h", "ckb")).toContain("kiːloːmatɪɾ la kaːtʒɪmeːɾ");
        expect(phonemize("133 m/s", "ckb")).toContain("matɪɾ la t͡ʃɾka");
        expect(phonemize("12.8 کم", "ckb")).toContain("xaːɫ haʃt kiːloːmatɪɾ"); // decimal still intact
    });
});

/**
 * THE BIZROKE — Sorani's unwritten short /ɪ/, supplied by `lexicon.tsv` (2,517 entries built from the
 * AsoSoft G2P dataset). Without it 634 corpus tokens across 54 word types had NO nucleus at all.
 *
 * ⚠ A RULE CANNOT DO THIS, which is why the lexicon exists: مردن needs TWO vowels (*mɪɾdɪn*) and سفر is
 * *safar*, an ordinary two-vowel word written with neither. One epenthesis after the first consonant is
 * right that a vowel is missing and wrong about how many and which — measured net negative at every
 * quality against the audio (ɪ 52/500, i 133/419, e 160/392, ə 106/446).
 */
describe("Central Kurdish — the bizroke lexicon", () => {
    test("a lexicon word gets its unwritten vowel", () => {
        expect(phonemizeWord("کرد")).toBe("kɪɾd");
        expect(phonemizeWord("گشت")).toBe("ɡɪʃt");
        expect(phonemizeWord("من")).toBe("mɪn");
        expect(phonemizeWord("کوردستان")).toBe("kuɾdɪstaːn");
        expect(phonemizeWord("مردن")).toBe("mɪɾdɪn"); // TWO vowels — beyond any single-epenthesis rule
    });

    /** ⚠ THE ENTRIES CHANGE THE VOWEL AND NOTHING ELSE. Every row differs from this engine's own rule
     *  output by inserted /ɪ/ alone, so a hit can never rewrite the consonant skeleton — the builder
     *  filters on exactly that, and it is what makes an outside source safe to consume here. */
    test("the consonant skeleton is ours, not the source's", () => {
        for (const w of ["کرد", "گشت", "کوردستان", "مردن"])
            expect(phonemizeWord(w).replace(/ɪ/gu, "")).toBe(phonemizeWordRules(w));
    });

    /** ⚠ RULES-ONLY STAYS CLEAN, so the referee signal is non-circular the way bn/ps do it. */
    test("the rule engine is untouched by the lexicon", () => {
        expect(phonemizeWordRules("کرد")).toBe("kɾd");
        expect(bizrokeLexiconHas("کرد")).toBe(true);
        expect(bizrokeLexiconHas("زۆر")).toBe(false); // already has a written vowel
    });

    /** ⚠ THE FREE CONJUNCTION IS A VOWEL, and it was a bare [w] until the ASR-alignment corpus surfaced it:
     *  ⟨و⟩ stands alone 1,900 times in 3,040 FLEURS ckb sentences and both recognizers put a vowel there
     *  (median 0.2742 → 0.2663, 861 closer / 23 further). The matres-lectionis rule reads a word-initial
     *  ⟨و⟩ as the glide, which is right INSIDE a word and wrong when the word IS ⟨و⟩ — so both cases are
     *  pinned here together, or a future simplification collapses them again. numbers.ts routes around the
     *  same defect by making its connective enclitic; that workaround is now the only caller relying on it. */
    test("standalone ⟨و⟩ is the conjunction [u], not the glide", () => {
        expect(phonemizeWord("و")).toBe("u");
        expect(phonemizeWord("وتی")).toBe("wtiː");   // word-INITIAL ⟨و⟩ is still the glide
        expect(phonemizeWord("گەورە")).toBe("ɡawɾa"); // and so is intervocalic ⟨و⟩
    });

    /** ⚠ AND THE OTHER MATRES LECTIONIS HAD THE SAME HOLE. A one-letter ⟨ی⟩ is the detached IZAFE, 405
     *  instances across the corpus and one construction in all of them (`٢٤ ی ئەیلول`, `16ی ئەیلوول`,
     *  `80%ی داهات`) — it read as a bare [j], which is no more a word than the bare [w] the ⟨و⟩ rule above
     *  exists to prevent. Measured the same way: 151 rows, median 0.3575 → 0.3558, 72 closer / 1 further. */
    test("standalone ⟨ی⟩ is the izafe [iː], not the glide", () => {
        expect(phonemizeWord("ی")).toBe("iː");
        expect(phonemize("٢٤ ی ئەیلول", "ckb")).toBe("biːstu t͡ʃwaːɾ iː ʔajlul");
        expect(phonemizeWord("یەک")).toBe("jak");    // word-INITIAL ⟨ی⟩ is still the glide
        expect(phonemizeWord("کوردی")).toBe("kuɾdiː"); // and word-final after a consonant is still the vowel
    });

    test("words with written vowels are unaffected", () => {
        expect(phonemizeWord("زۆر")).toBe("zoːɾ");
        expect(phonemizeWord("ماڵ")).toBe("maːɫ");
        expect(phonemizeWord("ئێمە")).toBe("ʔeːma");
    });
});
