/**
 * The shared currency arm must not FUSE its emitted noun with whatever follows the number.
 *
 * ⚠ WHY THIS EXISTS. `$110m` is a number glued to a magnitude abbreviation, and the tier's match ends at the
 * digits — so the currency noun landed directly against the `m` and the tokenizer read ONE word. Probed
 * across eleven languages, TEN fused: et *dˈolːɑritm*, fi *dolːɑriɑm*, de *dˈɔlaɐ̯m*, es *dˈolaɾesm*, nl, sv,
 * pt, it, pl, da. Only English escaped, because its own layer reads `m` as *million* before the tier runs.
 *
 * That is playbook trap 56 — a defect that produces a READING rather than garbage. `dollaritm` is a
 * plausible word in every one of those orthographies, so no leak class, no DROP and no referee can see it;
 * a bare `m` is visible to the RAW-LATIN gate the moment it appears.
 *
 * ⚠ SEPARATE, DO NOT REFUSE. Refusing the match would drop the sign too and lose the currency; separating
 * keeps *110 dollars* — right as far as it goes — and leaves the unread magnitude letter where a gate can
 * find it. Reading the magnitude is a language's own job (`magnitudes`), not something the tier can invent
 * from one letter.
 *
 * Every fixture below is a line from a mined corpus, and these are the complete set of readings the change
 * moves across the sixteen languages diffed: 9 lines, 0 regressions.
 */
import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";

describe("a currency noun does not fuse with the token after the number", () => {
    test("a magnitude abbreviation stays its own token", () => {
        // the reported case, and the corpus line behind it
        expect(phonemize("$110m", "et").trim()).toBe("sˈɑdɑ kˈymːe dˈolːɑrit m");
        // ⚠ the CONTROL: with nothing glued, the reading is unchanged — the fix must not add a stray space
        expect(phonemize("$110", "et").trim()).toBe("sˈɑdɑ kˈymːe dˈolːɑrit");
    });

    test("the same defect in four more scripts, each from its own corpus", () => {
        // gu: the postposition ન fused AND the fused form was mis-stressed as one long word
        // (`ɖolˈəɾna`, stress on the second syllable of a word that does not exist). Assert the INVARIANT —
        // the noun and what follows are two tokens — rather than a vowel that varies with the frame.
        const gu = phonemize("$1,000ન", "gu").trim();
        expect(gu).toContain("ɖˈoləɾ ");
        expect(gu).not.toContain("ɖolˈəɾn");
        // ig: English `million` was fusing onto the Igbo dollar word
        expect(phonemize("$3million", "ig").trim()).toContain("dollaɾ million");
        // de / es — Latin scripts, same shape
        expect(phonemize("$110m", "de").trim()).toBe("ˈaɪ̯nhʊndɐtt͡seːn dˈɔlaɐ̯ m");
        expect(phonemize("$110m", "es").trim()).toBe("θjˈento ðjˈeθ ðˈolaɾes m");
    });

    test("English is unaffected — its own layer reads the magnitude before the tier", () => {
        expect(phonemize("$110m", "en").trim()).toBe("wˈʌn hˈʌndɹəd tʰˈɛn mˈɪɫjən dˈɑːlɚz");
    });

    /**
     * ⚠ `it` AND `da` NEEDED THE SAME REPAIR IN THEIR OWN FILES, because both claim `$` in `normalize.ts`
     * rather than through the tier — Italian for the partitive *di* its magnitude hop needs, Danish because
     * it reads the noun from its lexicon. The core fix did not reach them.
     *
     * ⚠ AND BOTH ARE ROBUSTNESS, NOT A MEASURED REPAIR — said rather than implied (trap 22). The glued shape
     * is ×0 in both corpora and the corpus diff is 0/114 and 0/109. What justifies the change is that the
     * defect is identical, was live in ten sibling languages, and is invisible to every gate when it fires.
     */
    test("the two languages that own their currency rule locally", () => {
        expect(phonemize("$110m", "it").trim()).toBe("t͡ʃentodjˈet͡ʃi dollˈari m");
        expect(phonemize("$110", "it").trim()).toBe("t͡ʃentodjˈet͡ʃi dollˈari");
        expect(phonemize("$110m", "da").trim()).toBe("ˈɛd ˈhunʁɐðə ˈɐw ˈtiːˀ ˈdɐlɑ ˈɛm");
        expect(phonemize("$110", "da").trim()).toBe("ˈɛd ˈhunʁɐðə ˈɐw ˈtiːˀ ˈdɐlɑ");
    });
});
