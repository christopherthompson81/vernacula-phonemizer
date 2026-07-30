/**
 * Faroese cardinal number → words. Like Danish, Faroese is UNITS-FIRST with "og" fused into a single word
 * (einogtjúgu = 21, fimmogsjeyti = 75); magnitude groups above 100 are written open and chained with "og". The
 * composition itself is the shared units-first Germanic algorithm — see ../danish/unitsFirstNumbers.ts (housed in
 * the Danish dir only because src/core/ was locked during the number fan-out; it is language-neutral). Covers
 * 0 … <10¹².
 *
 * SOURCES for the number words:
 *   • omniglot.com/language/numbers/faroese.htm — the 0–20 / tens / hundrað / túsund / millión table and the
 *     units-first "… og tjúgu" order.
 *   • faroeseonline.com/vocabulary/numbers/ — corroborates the table, gives the CLOSED spelling "einogtjúgu"
 *     (one word, Danish-style) and lists eitt / tvey / trý as the plain-counting forms.
 *   • The two competing tens series are noted in the languagesandnumbers.com Faroese page: the modern decimal
 *     tríati / fýrati / fimmti / seksti / sjeyti / áttati / níti and the older DANISH-STYLE VIGESIMAL borrowings
 *     hálvtrýss (50) / trýss (60) / hálvfjerðs (70) / fýrs (80) / hálvfems (90).
 *
 * JUDGMENT CALLS
 *   1. **Decimal tens, not the vigesimal ones.** The vigesimal hálvtrýss/trýss/hálvfjerðs/fýrs/hálvfems series is
 *      a Danish loan layer that survives in colloquial/older usage; the decimal fimmti/seksti/sjeyti/áttati/níti
 *      series is what modern written Faroese and figure-reading use. Only one can be spoken for a bare numeral, so
 *      the decimal series is chosen (the same call Irish makes for its decimal-vs-vigesimal split).
 *   2. **Citation gender = NEUTER.** Faroese 1–3 inflect (ein/ein/eitt, tveir/tvær/tvey, tríggir/tríggjar/trý) and
 *      a bare numeral has no noun to agree with. Faroese counts aloud in the neuter — eitt, tvey, trý — so the
 *      neuter is the citation form here, and the neuter also happens to be right before the neuter magnitude nouns
 *      hundrað and túsund (tvey hundrað, tvey túsund). The one exception the sources are explicit about is the
 *      COMPOUND unit, which is the base "ein-": einogtjúgu, not *eittogtjúgu — hence `compoundOnes`.
 *   3. **millión / milliard are FEMININE** (ein millión, tvær milliónir) — but a multiplier ≥2 for these is beyond
 *      what the composer varies, so the plural spellings are used and the "one" spellings are stored whole. A
 *      2-million-scale reading therefore says "tvey milliónir" (neuter multiplier) where careful Faroese would say
 *      "tvær milliónir"; noted as a known simplification, out of reach of a gender-blind composer.
 */
import { unitsFirstNumberToWords, type UnitsFirstDef } from "../danish/unitsFirstNumbers.ts";

// Faroese has no data manifest (all faroese.ts tables are inline in code), so the number words live here, inline,
// matching the language's own convention.
const DEF: UnitsFirstDef = {
    // 0–19 in the NEUTER counting series (eitt, tvey, trý; fýra upward is invariant).
    ones: [
        "null", "eitt", "tvey", "trý", "fýra", "fimm", "seks", "sjey", "átta", "níggju",
        "tíggju", "ellivu", "tólv", "trettan", "fjúrtan", "fimtan", "sekstan", "seytjan", "átjan", "nítjan",
    ],
    // The modern DECIMAL tens (see judgment call 1).
    tens: ["", "", "tjúgu", "tríati", "fýrati", "fimmti", "seksti", "sjeyti", "áttati", "níti"],
    // In a tens compound the unit "one" is the base "ein-" (einogtjúgu), not the neuter "eitt".
    compoundOnes: ["", "ein"],
    connector: () => "og", // einogtjúgu — invariant
    hundred: { one: "eitt hundrað", word: "hundrað" },
    thousand: { one: "eitt túsund", word: "túsund" },
    million: { one: "ein millión", plural: "milliónir" },
    billion: { one: "ein milliard", plural: "milliardir" },
    mulJoin: " ", // "tvey hundrað", "tólv túsund" — written open
    hundredRemJoin: " og ", // "fimm hundrað og fimmogfimmti"
    groupJoin: " og ",
};

/** Non-negative integer (< 10¹²) → Faroese words; larger / non-finite → digit-by-digit. */
export function numberToWords(n: number): string {
    return unitsFirstNumberToWords(n, DEF);
}
