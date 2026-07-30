/**
 * White Hmong (hmn) cardinal-number compositor — RPA words only (hmong.ts reads each syllable through the ordinary
 * RPA→IPA converter, so no IPA is authored here).
 *
 * The system is DECIMAL and analytic. Shape:
 *   • 1–9 ib ob peb plaub tsib rau xya yim cuaj; 10 kaum; 11–19 = kaum + unit.
 *   • 20 is the irregular two-word nees nkaum; 30–90 are unit + caug/caum (peb caug 30 … cuaj caum 90 — the
 *     caug/caum split is a real tone alternation, not a typo: 30/40/50 take caug, 60–90 take caum).
 *   • A magnitude ALWAYS carries its multiplier, including "one": ib puas 100, ib txhiab 1 000, ib roob 10⁶ —
 *     so 10⁴ is kaum txhiab and 10⁵ is ib puas txhiab (Western thousand-grouping, not a myriad system).
 * This is why the shared Pattern-A `westernNumberWords` composer is NOT used: it suppresses the leading "one"
 * before a bare thousand and needs a single-word `billion`, and Hmong has neither.
 *
 * Source: Wikivoyage "Hmong phrasebook" Numbers section (https://en.wikivoyage.org/wiki/Hmong_phrasebook) — the
 * full RPA table 0–21, 30–90, 100, 1 000, 10 000, 100 000, 1 000 000; cross-checked against Wiktionary
 * "Category:White Hmong numerals" (ib … kaum, nees nkaum, pua/puas). ZERO: the phrasebook gives ntxaiv, a
 * Caub-Fab regionalism; the widely dictionaried White Hmong form xoom is used here instead.
 * JUDGMENT CALL: 10⁹ has no dedicated word — it composes as ib txhiab roob ("a thousand million").
 */

const UNITS = ["xoom", "ib", "ob", "peb", "plaub", "tsib", "rau", "xya", "yim", "cuaj"];
// Round tens 30–90 (20 is the irregular "nees nkaum", 10 is "kaum" — both handled below).
const TENS: Record<number, string[]> = {
    3: ["peb", "caug"], 4: ["plaub", "caug"], 5: ["tsib", "caug"],
    6: ["rau", "caum"], 7: ["xya", "caum"], 8: ["yim", "caum"], 9: ["cuaj", "caum"],
};
const MAG: [number, string][] = [[1e6, "roob"], [1e3, "txhiab"], [100, "puas"]];

/** An integer → the ordered White Hmong (RPA) number words that speak it. */
export function numberToHmongWords(n: number): string[] {
    if (!Number.isSafeInteger(n) || n < 0) {
        return [...String(Math.abs(n))].filter((c) => c >= "0" && c <= "9").map((d) => UNITS[Number(d)]!);
    }
    if (n === 0) return [UNITS[0]!];
    const out: string[] = [];
    let r = n;
    for (const [v, w] of MAG) {
        if (r >= v) {
            out.push(...numberToHmongWords(Math.floor(r / v)), w); // multiplier always spoken: ib puas, ib txhiab
            r %= v;
        }
    }
    if (r >= 20) {
        const t = Math.floor(r / 10);
        out.push(...(t === 2 ? ["nees", "nkaum"] : TENS[t]!));
        r %= 10;
    } else if (r >= 10) {
        out.push("kaum"); // 10–19 = kaum (+ unit)
        r %= 10;
    }
    if (r > 0) out.push(UNITS[r]!);
    return out;
}
