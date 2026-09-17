import { describe, expect, test } from "vitest";

import { phonemize, phonemizeAsync } from "../src/index.ts";
import { americanSpelling } from "../src/languages/english/spellingVariants.ts";

// The `en` lexicon is CMUdict-derived, so its headwords are American spellings and its coverage of
// Commonwealth ones is accidental — it has `colour`, `honour` and `labour` but not `vapour`, and
// before spellingVariants.ts that meant `vapour` was OOV and read as `vəpʰˈʊɹ`. These tests pin
// BOTH halves: the fold fires for a Commonwealth spelling, and the guards keep it from firing on a
// word that merely looks like one.
describe("commonwealth spellings fold to the lexicon's spelling", () => {
    test("-our → -or, including compounds and suffixed forms", () => {
        expect(phonemize("vapour", "en")).toBe("vˈeᶦpɚ"); // the reported word
        expect(phonemize("savour", "en")).toBe("sˈeᶦvɚ");
        expect(phonemize("vigour", "en")).toBe("vˈɪɡɚ");
        expect(phonemize("valour", "en")).toBe("vˈælɚ");
        expect(phonemize("succour", "en")).toBe("sˈʌkɚ");
        expect(phonemize("watercolour", "en")).toBe("wˈɔːt̬ɚkʰˌʌlɚ"); // compound, `our` mid-word
        expect(phonemize("behavioural", "en")).toBe("bᵻhˈeᶦvjɚəɫ"); // stem + -al
    });

    test("-ise/-yse, -re, -ce", () => {
        expect(phonemize("analyse", "en")).toBe("ˈænə̆lˌaᶦz");
        expect(phonemize("organisation", "en")).toBe("ˌɔːɹɡənɪzˈeᶦʃən");
        expect(phonemize("centre", "en")).toBe("sˈɛntɚ");
        expect(phonemize("calibre", "en")).toBe("kʰˈæləbɚ");
        expect(phonemize("defence", "en")).toBe("dᵻfˈɛns");
    });

    test("the l that British doubles, and the one it does not", () => {
        expect(phonemize("travelled", "en")).toBe("tɹˈævəɫd");
        expect(phonemize("marvellous", "en")).toBe("mˈɑːɹvə̆ləs");
        expect(phonemize("counsellor", "en")).toBe("kʰˈaᶷnsə̆lɚ");
        expect(phonemize("unrivalled", "en")).toBe("ənɹˈaᶦvəɫd"); // stem only known under a prefix
        // …and the other direction. ⚠ `ɪn-`, not `ɛn-`: the unstressed prefix was corrected in #1334 (misaki
        // gold, and our own dict could not have `embark` EH0 beside `embarks` IH0). The vowel is incidental
        // to what this test is about — that `enrolment` folds to the `enrollment` row.
        expect(phonemize("enrolment", "en")).toBe("ɪnɹˈoᶷɫmənt");
        expect(phonemize("skilful", "en")).toBe("skˈɪɫfɫ̩");
    });

    test("the ae/oe digraph stems", () => {
        expect(phonemize("anaemia", "en")).toBe("ənˈiːmiʲə");
        expect(phonemize("foetus", "en")).toBe("fˈiːt̬əs");
        expect(phonemize("oesophagus", "en")).toBe("ɪsˈɑːfəɡəs");
        expect(phonemize("paediatric", "en")).toBe("pʰˌiːd̬iʲˈætɹɪk");
        expect(phonemize("manoeuvre", "en")).toBe("mənˈuːvɚ"); // needs the stem AND -re → -er
    });

    test("the one-off families", () => {
        expect(phonemize("catalogue", "en")).toBe("kʰˈæt̬ə̆lˌɔːɡ");
        expect(phonemize("programme", "en")).toBe("pɹˈoᶷɡɹˌæm");
        expect(phonemize("sulphur", "en")).toBe("sˈʌɫfɚ");
        expect(phonemize("inflexion", "en")).toBe("ɪnflˈɛkʃən");
    });

    // Each of these lands on a real lexicon headword under a naive rule, and each is the WRONG word.
    // They are the reason for the NOT_OUR deny-list and the doubled-l stem guard.
    test("words that only look like Commonwealth spellings are left alone", () => {
        expect(phonemize("flour", "en")).toBe("flˈaᶷɚ");
        expect(phonemize("scouring", "en")).toBe("skˈaᶷɚɪŋ"); // not `scoring`
        expect(phonemize("our", "en")).toBe("ˈaᶷɚ");
        expect(phonemize("hour", "en")).toBe("ˈaᶷɚ");
        expect(phonemize("devour", "en")).toBe("dᵻvˈaᶷɚ");
        expect(phonemize("dolling", "en")).toBe("dˈɑːlɪŋ"); // not `doling` — dˈoᶷlɪŋ
        // ⚠ `ɔː` not `ɑː`: `palled` is OOV and decodes from `pall`, whose row #1334 corrected AA1 → AO1
        // (a pall is /pɔːl/). What this line is actually pinning is unaffected — the doubled ⟨ll⟩ blocks the
        // Commonwealth fold, so it is not read as `paled` pʰˈeᶦɫd.
        expect(phonemize("palled", "en")).toBe("pʰˈɔːɫd");
        expect(phonemize("tilled", "en")).toBe("tʰˈɪɫd");
        expect(phonemize("pilled", "en")).toBe("pʰˈɪɫd");
    });

    // `floury` is OOV on both spellings and stays OOV — the deny-list stops the fold, it does not
    // invent a reading. Pinned so that a future widening of the rules has to notice it.
    test("a blocked fold leaves the word to the OOV reader, it does not guess", () => {
        expect(americanSpelling("floury", () => true)).toBeUndefined();
    });

    test("the fold resolves before the OOV split, so sync and async now agree", async () => {
        for (const w of ["vapour", "analyse", "manoeuvre", "counsellor"])
            expect(phonemize(w, "en")).toBe(await phonemizeAsync(w, "en"));
    });

    // The fold is orthographic. en-GB reuses this lexicon and applies its lexical-set delta on top,
    // so a Commonwealth spelling now reaches the GB reader as the word it is.
    test("en-GB gets the fold too, then its own non-rhotic delta", () => {
        expect(phonemize("vapour", "en-GB")).toBe("vˈeᶦpə");
        expect(phonemize("manoeuvre", "en-GB")).toBe("mənˈuːvə");
    });

    // ⚠ NOT rules: these pairs differ in PRONUNCIATION, not just spelling. A fold would be wrong.
    test("pairs that are different words are not folded", () => {
        expect(phonemize("aluminium", "en")).not.toBe(phonemize("aluminum", "en"));
        expect(phonemize("learnt", "en")).not.toBe(phonemize("learned", "en"));
    });

    // `knownWord` is the DICT-ONLY entry point, and it folds too. Naija writes Nigerian English, so
    // a Commonwealth spelling there is a known-English word to nativise — without the fold it looked
    // like a substrate loan and came out untouched. englishNeural.ts uses the same call as its
    // "already known" test, so this also stops the BiLSTM being handed words the lexicon can answer.
    test("the dict-only lookup folds, so creoles nativise a Commonwealth spelling", () => {
        expect(phonemize("vapour", "pcm")).toBe("vepa"); // as `colour` → kɔla already did
        expect(phonemize("analyse", "pcm")).toBe("analaiz");
    });
});
