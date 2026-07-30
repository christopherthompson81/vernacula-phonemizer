/**
 * Lithuanian (lt) cardinal number compositor. Returns composed Lithuanian TEXT (space-separated) that
 * lithuanian.ts runs through the g2p, so the IPA stays consistent with the word engine.
 *
 * SOURCE for the numeral words: lt.wikipedia's per-number articles — "0 (skaičius)" → nulis, "1 (skaičius)" →
 * vienas, "3 (skaičius)" → trys, "11 (skaičius)" → vienuolika, "15 (skaičius)" → penkiolika, "20 (skaičius)" →
 * dvidešimt, "60 (skaičius)" → šešiasdešimt, "80 (skaičius)" → aštuoniasdešimt, "90 (skaičius)" →
 * devyniasdešimt; the table itself lives in lithuanian.jsonc.
 *
 * ★ WHY THIS IS NOT `westernNumberWords`: (a) Lithuanian has NO irregular round-hundred words — the hundreds are
 *   a COUNTED NOUN (šimtas / du šimtai), so there is nothing to put in the shared `hundreds` array; and (b) every
 *   magnitude noun agrees with its count, which the shared composer's one-string-per-magnitude schema cannot
 *   express. The concord is the Lithuanian THREE-WAY split (= the CLDR lt one/few/other categories):
 *
 *     count ends in 1, but not 11        → nom SG   dvidešimt vienas tūkstantis
 *     count ends in 2–9, not 12–19       → nom PL   du tūkstančiai · penki šimtai
 *     count ends in 0, or is 11–19       → gen PL   dvidešimt tūkstančių · šimtas tūkstančių · vienuolika tūkstančių
 *
 *   "dvidešimt tūkstančių", "šimtas tūkstančių", "du tūkstančiai" and "penki šimtai" are all attested in running
 *   lt.wikipedia text. This differs from the Slavic paucal rule (cs/pl 2–4 vs 5+) — hence a Baltic-specific
 *   `agree()` here rather than the shared `slavicCountForm`.
 */

import { MANIFEST, type LithuanianAgreement } from "./manifest.ts";

const N = MANIFEST.numbers;
const { units: UNITS, teens: TEENS, tens: TENS } = N;
const MAG = N.magnitudes;

/** The Lithuanian concord form of a counted noun for `count`. See the header table. */
function agree(count: number, forms: LithuanianAgreement): string {
    const m100 = count % 100,
        m10 = count % 10;
    if (m100 >= 11 && m100 <= 19) return forms.gen; // vienuolika tūkstančių … devyniolika tūkstančių
    if (m10 === 1) return forms.sg; // …1 → nom sg (dvidešimt vienas tūkstantis)
    if (m10 === 0) return forms.gen; // …0 → gen pl (dvidešimt / šimtas tūkstančių)
    return forms.pl; // …2–9 → nom pl (du tūkstančiai)
}

/** 0–99 → Lithuanian text (teens are one -lika word; tens + units are space-separated). */
function sub100(n: number): string {
    if (n < 10) return UNITS[n]!;
    if (n < 20) return TEENS[n - 10]!;
    const t = Math.floor(n / 10),
        u = n % 10;
    return u === 0 ? TENS[t]! : `${TENS[t]} ${UNITS[u]}`;
}

/** 0–999 → Lithuanian text. The hundred is a counted noun: 1 → šimtas, 2–9 → (count) šimtai. */
function sub1000(n: number): string {
    const h = Math.floor(n / 100),
        r = n % 100;
    if (h === 0) return sub100(r);
    const hw = h === 1 ? MAG.hundred.sg : `${UNITS[h]} ${agree(h, MAG.hundred)}`;
    return r ? `${hw} ${sub100(r)}` : hw;
}

/** One magnitude group. `keepOne` = whether a count of exactly 1 keeps the numeral: 1000 is read as the bare
 *  noun "tūkstantis" (as the bare hundred "šimtas" is), while 1 000 000 keeps it — "vienas milijonas" (the same
 *  split the sibling Latvian engine makes for tūkstotis vs viens miljons). */
function magnitude(count: number, forms: LithuanianAgreement, keepOne: boolean): string {
    if (count === 1) return keepOne ? `${UNITS[1]} ${forms.sg}` : forms.sg;
    return `${sub1000(count)} ${agree(count, forms)}`;
}

/** Read a raw digit STRING digit-by-digit — the fallback beyond the milijardas group (n ≥ 10^12). */
export function readDigits(digits: string): string {
    return digits
        .split("")
        .map((d) => UNITS[Number(d)] ?? d)
        .join(" ");
}

/** A non-negative integer (< 10^12) → space-separated Lithuanian cardinal words. */
export function numberToWords(n: number): string {
    if (n < 0 || !Number.isFinite(n)) return "";
    n = Math.floor(n);
    if (n === 0) return UNITS[0]!; // nulis
    if (n >= 1e12) return readDigits(String(n));
    const parts: string[] = [];
    const bil = Math.floor(n / 1e9);
    n %= 1e9;
    if (bil) parts.push(magnitude(bil, MAG.billion, true));
    const mil = Math.floor(n / 1e6);
    n %= 1e6;
    if (mil) parts.push(magnitude(mil, MAG.million, true));
    const th = Math.floor(n / 1000);
    n %= 1000;
    if (th) parts.push(magnitude(th, MAG.thousand, false)); // 1000 → bare "tūkstantis"
    if (n) parts.push(sub1000(n));
    return parts.join(" ");
}
