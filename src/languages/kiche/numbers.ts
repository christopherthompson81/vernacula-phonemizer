/**
 * K'iche' (quc) cardinal number → words. VIGESIMAL (base 20) — hence Pattern B: there is no decimal tens
 * series at all, so `NumbersDef` cannot express it. Numerals are in the ALMG Latin orthography, which
 * kiche.ts phonemizes directly.
 *
 * SOURCE: ALMG (Academia de Lenguas Mayas de Guatemala), *Gramática Normativa del Idioma K'iche'*, §1.7.4
 * "Números cardinales", pp. 42–44 — the normative reference for the language
 * (almg.org.gt/wp-content/uploads/2026/03/Gramatica-Normativa-Idioma-Kiche.pdf). Corroborated for the
 * ⟨much'⟩ and ⟨k'al⟩ series by Christenson's *K'iche'–English Dictionary* and by ALMG's *Vocabulario K'iche'*
 * (2004). The 400+ template is from ALMG's *Numeración Maya* (2004), whose author writes TZ'UTUJIL — used
 * for STRUCTURE only, never for spelling.
 *
 * ⚠ THE SCORE SERIES IS NOT UNIFORM. The multiples of 20 use three different bases:
 *     20 juwinaq, 40 kawinaq            (⟨winaq⟩ 'person' = 20)
 *     60 oxk'al                          (⟨k'al⟩ = 20)
 *     80 jumuch'                         (⟨much'⟩ = 80 — NOT 400; a common error)
 *     100 jok'al … 380 b'elejlajk'al     (⟨k'al⟩ again, multiplier 5…19)
 *     400 juq'o                          (⟨q'o⟩ = 400)
 *   100 is the NATIVE 5×20 ⟨jok'al⟩, not a Spanish loan.
 *
 * ⚠ ADDITIVE ONLY — a deliberate, sourced simplification. Classical K'iche' also had the Mayan
 * OVERCOUNTING construction ("n toward the next score"), which applied FROM 41 UP (21–39 were already
 * additive; Dékány 2025:132, Yasugi 1995:104–105). This file does not generate it, following ALMG, which
 * norms the additive form because its consulted elders did not recognise the subtractive one — §1.7.4,
 * verbatim: "ellos no lo conocen tampoco el conteo en forma sustractiva, por eso se norma que el conteo es
 * sumativa". So: modern/normative counting is implemented; Classical overcounting is NOT.
 *
 * ATTESTED RANGE:
 *   0–399   high confidence — every form below is verbatim ALMG §1.7.4, and the additive joins are attested
 *           there too (21 juwinaq jun, 41 kawinaq jun, 61 oxk'al jun, 81 jumuch' jun, 101 jok'al jun).
 *   400–3999 on the documented N-q'o' + M-k'al + unit template. Only ⟨juq'o⟩ (400) and ⟨kaq'o'⟩ (800) are
 *           attested multiples; 1000 = "kaq'o' lajk'al" (800+200) is attested and is what this emits. The
 *           multipliers 3–9 (oxq'o' … b'elejq'o') are EXTRAPOLATED from the k'al/much' prefix pattern.
 *   ≥ 4000  NO documented K'iche' numeral exists (⟨juchuy⟩ 8000 is KAQCHIKEL, not K'iche'; Christenson's
 *           ⟨chuy⟩ = 1000 is a modern decimal reanalysis), so this falls back to DIGIT-BY-DIGIT.
 *
 * ZERO IS NOT NORMATIVE. ALMG §1.7.4 gives no word for zero. ⟨majb'al⟩ (from ⟨maj⟩ 'nothing') is a popular /
 * school neologism; it is used here because the engine must render "0" as *something*, and it is flagged as
 * non-normative rather than presented as attested.
 *
 * Also noted: 15 is ⟨jolajuj⟩ per ALMG; Christenson has ⟨o'lajuj⟩. ALMG wins (normative).
 */

const ZERO = "majb'al"; // NON-NORMATIVE neologism — see the header
// 1..10, verbatim ALMG §1.7.4.
const UNITS = ["", "jun", "keb'", "oxib'", "kajib'", "job'", "waqib'", "wuqub'", "wajxaqib'", "b'elejeb'", "lajuj"];
// 11..19 (index 0 = 11): the ⟨-lajuj⟩ series, verbatim ALMG §1.7.4.
const TEENS = ["julajuj", "kab'lajuj", "oxlajuj", "kajlajuj", "jolajuj", "waqlajuj", "wuqlajuj", "wajxaqlajuj", "b'elejlajuj"];
// The multiples of TWENTY, index 1..19 → 20…380. Verbatim ALMG §1.7.4 (three different bases — see header).
const SCORES = [
    "", "juwinaq", "kawinaq", "oxk'al", "jumuch'", "jok'al", "waqk'al", "wuqk'al", "wajxaqk'al", "b'elejk'al",
    "lajk'al", "julajujk'al", "kab'lajk'al", "oxlajk'al", "kajlajk'al", "jolajk'al", "waqlajk'al", "wuqlajk'al",
    "wajxaqlajk'al", "b'elejlajk'al",
];
// The numeral-prefix combining forms (extracted from the k'al/much' series above), used to build the ⟨q'o⟩
// multiples. Only ju- (400) and ka- (800) are ATTESTED with q'o; 3–9 are extrapolated (see header).
const PREFIX = ["", "ju", "ka", "ox", "kaj", "jo", "waq", "wuq", "wajxaq", "b'elej"];
const FOUR_HUNDRED = "juq'o"; // attested spelling for 1×400 (no final glottal)

/** 1 ≤ n ≤ 19. */
function below20(n: number): string {
    return n <= 10 ? UNITS[n]! : TEENS[n - 11]!;
}

/** 1 ≤ n < 400: a score word plus an ADDITIVE remainder (101 → "jok'al jun"). */
function below400(n: number): string {
    if (n < 20) return below20(n);
    const s = Math.floor(n / 20), r = n % 20;
    return r === 0 ? SCORES[s]! : `${SCORES[s]} ${below20(r)}`;
}

/** Non-negative integer → K'iche' words. ≥ 4000 (nothing documented) → digit-by-digit. */
export function numberToWords(n: number): string {
    if (!Number.isSafeInteger(n) || n < 0 || n >= 4000) {
        return [...String(Math.abs(n))].filter((c) => c >= "0" && c <= "9")
            .map((d) => (d === "0" ? ZERO : UNITS[Number(d)]!)).join(" ");
    }
    if (n === 0) return ZERO;
    if (n < 400) return below400(n);
    const q = Math.floor(n / 400), r = n % 400;
    const head = q === 1 ? FOUR_HUNDRED : `${PREFIX[q]}q'o'`; // kaq'o' (800) attested; 3–9 extrapolated
    return r === 0 ? head : `${head} ${below400(r)}`;
}
