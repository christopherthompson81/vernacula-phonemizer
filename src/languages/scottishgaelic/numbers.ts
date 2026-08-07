/**
 * Scottish Gaelic number → words. A real compositor for 0–999,999,999 (before this the gd engine passed digit
 * strings straight through, so `phonemize("25", "gd")` leaked "25" into the IPA).
 *
 * SOURCE: Colin Mark, *The Gaelic-English Dictionary* (Routledge, 2003) — the numeral headwords and the
 * decimal-tens series; cross-checked against the LearnGaelic Dictionary (learngaelic.scot) and Wiktionary's
 * Scottish Gaelic numeral entries. The word list itself lives in scottishgaelic.jsonc (`numbers`).
 *
 * Goidelic, so this follows the same shape as `src/languages/irish/numbers.ts` — but with Gaelic's own forms
 * and, crucially, Gaelic's own MUTATION rules:
 *
 *  1. **Two numeral series.** COUNTING (standalone / after the particle ⟨a⟩): a h-aon, a dhà, a trì.
 *     ATTRIBUTIVE (before a counted noun, and magnitude words are counted attributively): aon, dà, trì.
 *  2. **The particle ⟨a⟩** introduces a bare counting numeral: a h-aon, fichead agus a còig, ceud agus a h-ochd.
 *  3. **h- before a vowel-initial counting form** after ⟨a⟩: aon → `a h-aon`, ochd → `a h-ochd`. Gaelic writes
 *     the hyphen (Irish writes `a haon`); phonemizeWord strips it, so both reach the g2p as h + vowel.
 *  4. **⚠ LENITION ONLY — no eclipsis.** This is the headline divergence from Irish. Irish eclipses a magnitude
 *     after 7–10 (seacht gcéad); Gaelic has no eclipsis at all. Only ⟨dà⟩ lenites the magnitude it counts
 *     (dà cheud "200", dà mhìle "2000"); 3–10 leave it bare (trì ceud, seachd ceud, naoi mìle).
 *  5. **⟨deug⟩ lenites after dhà** only: a h-aon deug "11", `a dhà dheug` "12", a trì deug "13".
 *
 * DECIMAL, NOT VIGESIMAL — the judgment call. Gaelic keeps a live traditional vigesimal series (dà fhichead
 * "40", trì fichead "60", ceithir fichead 's a deich "90") alongside the modern decimal one (ceathrad,
 * seasgad, naochad). For a TTS reading a bare digit string the DECIMAL series is chosen: it is what school and
 * modern written Gaelic use for figures, it maps one round ten to one word (so 40 ≠ "two twenties" needing a
 * base change mid-number), and it is the series a reader hearing "ceathrad" reconstructs as 40 unambiguously.
 * The vigesimal option is not emitted anywhere.
 *
 * KNOWN LIMITATION (inherited from the Irish compositor, same cause): a magnitude count in the TEENS. Idiomatic
 * Gaelic puts ⟨deug⟩ after the counted noun — 11,000 is `aon mhìle deug`, not the `a h-aon deug mìle` emitted
 * here. Getting that right needs the lenition rule for a magnitude between the numeral and ⟨deug⟩, which the
 * multi-dialect wikipron gla referee cannot corroborate (it has no multi-word numerals). The composed-count
 * form is unambiguous and understandable, just not idiomatic.
 *
 * NOT handled, deliberately: YEAR reading (1745 as `seachd ceud deug ceathrad 's a còig`). Nothing in a bare
 * digit string distinguishes a year from a quantity, so the plain cardinal is always emitted.
 */

export interface GaelicNumbers {
    ones: string[]; // counting series 0..10
    attributive: string[]; // attributive series (index 0 unused) 1..10
    tens: Record<string, string>; // round tens, keyed by VALUE ("20".."90")
    teenWord: string; // deug
    connector: string; // agus
    magnitudes: { hundred: string; thousand: string; million: string; billion: string };
}

/** Gaelic lenition (sèimheachadh): insert ⟨h⟩ after the initial consonant — ceud → cheud, mìle → mhìle. */
function lenite(w: string): string {
    return /^[bcdfgmpst]/i.test(w) ? w[0] + "h" + w.slice(1) : w;
}

/** Build the gd integer→words renderer over one numeral table (scottishgaelic.jsonc `numbers`). */
export function makeNumberToWords(N: GaelicNumbers): (n: number) => string {
    const ONES = N.ones, ATTR = N.attributive;

    /** The counting form with its ⟨a⟩ particle, h- before a vowel: aon → "a h-aon", ochd → "a h-ochd". */
    const counting = (u: number): string => {
        const w = ONES[u]!;
        return "a " + (/^[aeiouàèìòùáéíóú]/i.test(w) ? "h-" + w : w);
    };

    /** 1–99 in the counting series. */
    const underHundred = (n: number): string => {
        if (n <= 10) return counting(n);
        if (n < 20) {
            const u = n - 10;
            // deug lenites after dhà ONLY (a dhà dheug); every other teen keeps it bare.
            return `${counting(u)} ${u === 2 ? lenite(N.teenWord) : N.teenWord}`;
        }
        const t = Math.floor(n / 10) * 10, u = n % 10;
        return N.tens[String(t)]! + (u ? ` ${N.connector} ${counting(u)}` : "");
    };

    /** A magnitude group: `count` × `word` — 2 × ceud → "dà cheud"; 9 × ceud → bare "naoi ceud" (NO eclipsis). */
    const magnitude = (count: number, word: string): string => {
        if (count === 1) return word; // bare magnitude: ceud, mìle — no "aon"
        if (count <= 10) return `${ATTR[count]!} ${count === 2 ? lenite(word) : word}`;
        // A count above ten is itself composed (12,345 needs "a dhà dheug mìle"); a PHRASE does not mutate the
        // magnitude — Gaelic mutation is triggered by the simple numeral ⟨dà⟩, not by a numeral phrase.
        return `${compose(count)} ${word}`;
    };

    /** Attach a remainder to a magnitude. The ⟨agus⟩ connector appears whenever the remainder is a BARE counting
     *  numeral (it starts with the ⟨a⟩ particle) — ceud agus a h-aon "101", mìle agus a naoi "1009" — and is
     *  absent when the remainder opens with its own tens/hundreds word (mìle naoi ceud … "1900+"). */
    const attach = (head: string, r: number): string => {
        if (!r) return head;
        const tail = compose(r);
        return `${head} ${tail.startsWith("a ") ? `${N.connector} ` : ""}${tail}`;
    };

    function compose(n: number): string {
        if (n < 100) return underHundred(n);
        if (n < 1000) return attach(magnitude(Math.floor(n / 100), N.magnitudes.hundred), n % 100);
        if (n < 1_000_000) return attach(magnitude(Math.floor(n / 1000), N.magnitudes.thousand), n % 1000);
        if (n < 1_000_000_000) return attach(magnitude(Math.floor(n / 1_000_000), N.magnitudes.million), n % 1_000_000);
        return attach(magnitude(Math.floor(n / 1_000_000_000), N.magnitudes.billion), n % 1_000_000_000);
    }

    /** Non-negative integer → Scottish Gaelic words. Out-of-range input falls back to digit-by-digit. */
    return function numberToWords(n: number): string {
        if (!Number.isSafeInteger(n) || n < 0) {
            return [...String(n)].filter((c) => c >= "0" && c <= "9").map((d) => ONES[Number(d)]!).join(" ");
        }
        if (n === 0) return ONES[0]!; // neoni — a bare zero takes no ⟨a⟩ particle
        return compose(n).replace(/\s+/gu, " ").trim();
    };
}
