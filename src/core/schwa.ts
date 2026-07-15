/**
 * Medial schwa deletion for Indic-abugida IPA (Ohala 1983 VCəCV rule), extracted from the espeak-ng-portable
 * canonical path. Pure IPA-string in/out: segment into C/V/stress units, then delete a medial ə that sits in
 * a V·C·ə·C·V context (right-to-left), keeping the syllable heavy across a geminate (…ː). Word-FINAL schwa
 * deletion is handled by the caller (it depends on the monosyllable guard). Generic across Indic languages.
 */

const HI_VOWEL_BASES = new Set([..."aeiouɛɔəɪʊoɐɑɒʌæ"]);

interface Unit {
    text: string;
    isStress: boolean;
    isVowel: boolean;
}

function segmentUnits(ipa: string): Unit[] {
    const units: Unit[] = [];
    const MOD = new Set([..."ʰʱʲˠʷⁱᵊːˑ"]);
    let i = 0;
    while (i < ipa.length) {
        const c = ipa[i]!;
        if (c === "ˈ" || c === "ˌ") {
            units.push({ text: c, isStress: true, isVowel: false });
            i++;
            continue;
        }
        let unit = c;
        i++;
        while (i < ipa.length) {
            const n = ipa[i]!;
            if (n === "͡") {
                unit += n + (ipa[i + 1] ?? "");
                i += 2;
                continue;
            } // tie bar links next base
            if (/[̀-ͯ]/u.test(n) || MOD.has(n)) {
                unit += n;
                i++;
                continue;
            } // combining / modifier
            break;
        }
        units.push({
            text: unit,
            isStress: false,
            isVowel: HI_VOWEL_BASES.has(unit[0]!),
        });
    }
    return units;
}

/** Delete the medial inherent vowel in a V·C·_·C·V context (right-to-left), per word (whitespace-preserving).
 *  `schwa` is the inherent-vowel symbol to delete — /ə/ for Hindi, /ɔ/ for Bengali (both already in the vowel
 *  base set), so the same Ohala rule serves either abugida. */
export function deleteMedialSchwa(ipa: string, schwa = "ə"): string {
    return ipa
        .split(/(\s+)/u)
        .map((w) => {
            if (!/\S/.test(w)) return w;
            const units = segmentUnits(w);
            const deleted = new Array(units.length).fill(false);
            const prevPhon = (from: number): number => {
                let k = from;
                while (k >= 0 && (units[k]!.isStress || deleted[k])) k--;
                return k;
            };
            const nextPhon = (from: number): number => {
                let k = from;
                while (k < units.length && (units[k]!.isStress || deleted[k]))
                    k++;
                return k;
            };
            for (let idx = units.length - 1; idx >= 0; idx--) {
                if (
                    units[idx]!.isStress ||
                    deleted[idx] ||
                    units[idx]!.text !== schwa
                )
                    continue;
                const p = prevPhon(idx - 1); // consonant?
                const pp = prevPhon(p - 1); // vowel before it?
                const n = nextPhon(idx + 1); // consonant?
                const nn = nextPhon(n + 1); // vowel after it?
                // A GEMINATE (…ː) on either side keeps the syllable heavy → the schwa is retained.
                if (
                    p >= 0 &&
                    pp >= 0 &&
                    n < units.length &&
                    nn < units.length &&
                    !units[p]!.isVowel &&
                    units[pp]!.isVowel &&
                    !units[n]!.isVowel &&
                    units[nn]!.isVowel &&
                    !units[p]!.text.includes("ː") &&
                    !units[n]!.text.includes("ː")
                ) {
                    deleted[idx] = true;
                    if (idx - 1 >= 0 && units[idx - 1]!.isStress)
                        deleted[idx - 1] = true; // stress was on the deleted schwa
                }
            }
            return units
                .filter((_, k) => !deleted[k])
                .map((u) => u.text)
                .join("");
        })
        .join("");
}
