/**
 * Khmer (km) cardinal-number compositor — KHMER-SCRIPT words only (khmer.ts reads them through the ordinary
 * two-series abugida engine, so no IPA is authored here).
 *
 * Khmer is the fleet's BI-QUINARY case: 1–5 are simple roots, but 6–9 are overtly 5+n —
 *   ៦ ប្រាំមួយ = ប្រាំ (5) + មួយ (1), ៧ ប្រាំពីរ = 5+2, ៨ ប្រាំបី = 5+3, ៩ ប្រាំបួន = 5+4.
 * Above that the system is DECIMAL, and the round tens 30–90 are a Thai-derived overlay
 * (សាមសិប, សែសិប … កៅសិប — Thai สามสิบ etc.) sitting on top of the native ដប់ (10) and ម្ភៃ (20, a contraction of
 * "one twenty"). 11–19 are ដប់ + unit, so 16 is ដប់ប្រាំមួយ (10 + (5+1)) — the bi-quinary unit is reused whole.
 * Unlike Thai, a magnitude ALWAYS carries its multiplier, including 1: មួយរយ "one hundred", មួយពាន់, មួយលាន.
 *
 * Source: Wikipedia "Khmer numerals" (https://en.wikipedia.org/wiki/Khmer_numerals) — the full cardinal table
 * 0–20, 21, 30–90, 100, 1 000, 10 000 ម៉ឺន, 100 000 សែន, 1 000 000 លាន, and the biquinary/Thai-borrowing notes.
 * JUDGMENT CALL: that table gives 10⁹ as the Sanskritic មួយរយកោដិ ("one hundred koti"); this compositor instead
 * lets 10⁹ fall out as ពាន់លាន (thousand-million), the ordinary modern reading, so the whole range stays
 * compositional from the 10⁶ ladder.
 */

// 0–9. 6–9 are the bi-quinary compounds; each is emitted as ONE orthographic word (that is how it is written),
// and the sesquisyllabic engine reads ប្រាំមួយ as pram + muəj.
const UNITS = [
    "សូន្យ", "មួយ", "ពីរ", "បី", "បួន", "ប្រាំ",
    "ប្រាំមួយ", "ប្រាំពីរ", "ប្រាំបី", "ប្រាំបួន", // 6–9 = 5+1 … 5+4
];
// Round tens 30–90 (Thai-derived); 10 ដប់ and 20 ម្ភៃ are handled separately (they are not unit+សិប).
const TENS: Record<number, string> = {
    3: "សាមសិប", 4: "សែសិប", 5: "ហាសិប", 6: "ហុកសិប", 7: "ចិតសិប", 8: "ប៉ែតសិប", 9: "កៅសិប",
};
// Magnitudes, largest first. 10⁴ ម៉ឺន and 10⁵ សែន are their own words (the Tai/Chinese myriad layer).
const MAG: [number, string][] = [[1e6, "លាន"], [1e5, "សែន"], [1e4, "ម៉ឺន"], [1e3, "ពាន់"], [100, "រយ"]];

/** An integer → the ordered Khmer number words that speak it. */
export function numberToKhmerWords(n: number): string[] {
    if (!Number.isSafeInteger(n) || n < 0) {
        return [...String(Math.abs(n))].filter((c) => c >= "0" && c <= "9").map((d) => UNITS[Number(d)]!);
    }
    if (n === 0) return [UNITS[0]!];
    const out: string[] = [];
    let r = n;
    for (const [v, w] of MAG) {
        if (r >= v) {
            out.push(...numberToKhmerWords(Math.floor(r / v)), w); // multiplier always spoken, incl. មួយ
            r %= v;
        }
    }
    if (r >= 20) {
        const t = Math.floor(r / 10);
        out.push(t === 2 ? "ម្ភៃ" : TENS[t]!);
        r %= 10;
    } else if (r >= 10) {
        out.push("ដប់"); // 10–19 = ដប់ (+ unit, incl. the bi-quinary 6–9 whole: ដប់ប្រាំមួយ = 16)
        r %= 10;
    }
    if (r > 0) out.push(UNITS[r]!);
    return out;
}
