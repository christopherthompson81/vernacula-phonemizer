/**
 * Standard Albanian (Tosk) number → words, for 0–999,999,999,999. Without it a digit string passes straight
 * through and leaks into the IPA.
 *
 * SOURCE: Newmark, Hubbard & Prifti, *Standard Albanian: A Reference Grammar for Students* (Stanford, 1982),
 * the cardinal-numeral section; cross-checked against Wiktionary's Albanian numeral entries. The word list
 * lives in albanian.jsonc (`numbers`).
 *
 * ⚠ ALBANIAN IS DECIMAL AND REGULAR, so the only reason this is not a `westernNumberWords` data block is the
 * OBLIGATORY ⟨e⟩ "and" CONNECTOR between the groups of a composed numeral — njëzet **e** një "21",
 * njëqind **e** një "101", një mijë **e** dyqind **e** tridhjetë **e** katër "1234". The connector is a
 * separate word (it must reach the g2p as its own token, [ˈɛ], not fused into the neighbouring numeral), which
 * the shared Western composer has no slot for. Everything else is plain: fused round hundreds (njëqind,
 * dyqind, treqind…), unit + ⟨mbë⟩ + dhjetë teens, unit + ⟨dhjetë⟩ tens.
 *
 * CITATION FORM for the inflecting numeral: ⟨tre⟩. Albanian 3 has a masculine ⟨tre⟩ and a feminine ⟨tri⟩; the
 * MASCULINE is chosen as the citation form (the dictionary headword, and the form used when counting with no
 * noun in sight — which is exactly the digit-string case). ⟨tri⟩ is never emitted. The compounds built on 3 are
 * already fixed regardless of gender (trembëdhjetë "13", tridhjetë "30", treqind "300").
 *
 * NOTE on ⟨njëzet⟩ "20" / ⟨dyzet⟩ "40": etymologically "one twenty" / "two twenties", a vigesimal fossil. They
 * are treated as plain round-ten words — the system around them is decimal (tridhjetë, pesëdhjetë, …), so
 * there is no base change to model.
 */

export interface AlbanianNumbers {
    units: string[]; // 0..9
    teens: string[]; // 10..19
    tens: Record<string, string>; // round tens, keyed by VALUE ("20".."90")
    hundreds: string[]; // 0..9 → fused round hundreds (index 0 unused)
    magnitudes: {
        thousand: string;
        million: string; millionPlural: string;
        billion: string; billionPlural: string;
    };
    connector: string; // e
}

/** Build the sq integer→words renderer over one numeral table (albanian.jsonc `numbers`). */
export function makeNumberToWords(N: AlbanianNumbers): (n: number) => string {
    const E = ` ${N.connector} `; // the obligatory group connector

    /** 1–99. */
    const underHundred = (n: number): string => {
        if (n < 10) return N.units[n]!;
        if (n < 20) return N.teens[n - 10]!;
        const t = Math.floor(n / 10) * 10, u = n % 10;
        return N.tens[String(t)]! + (u ? E + N.units[u]! : "");
    };

    /** A magnitude group: `një mijë` / `dy mijë`, `një milion` / `dy milionë`. The "one" is KEPT (Albanian says
     *  një mijë, një milion — there is no bare *mijë the way Latin has bare mīlle). */
    const magnitude = (count: number, singular: string, plural: string): string =>
        `${compose(count)} ${count === 1 ? singular : plural}`;

    function compose(n: number): string {
        if (n < 100) return underHundred(n);
        if (n < 1000) {
            const h = Math.floor(n / 100), r = n % 100;
            return N.hundreds[h]! + (r ? E + compose(r) : "");
        }
        if (n < 1_000_000) {
            const th = Math.floor(n / 1000), r = n % 1000;
            return magnitude(th, N.magnitudes.thousand, N.magnitudes.thousand) + (r ? E + compose(r) : "");
        }
        if (n < 1_000_000_000) {
            const m = Math.floor(n / 1_000_000), r = n % 1_000_000;
            return magnitude(m, N.magnitudes.million, N.magnitudes.millionPlural) + (r ? E + compose(r) : "");
        }
        const b = Math.floor(n / 1_000_000_000), r = n % 1_000_000_000;
        return magnitude(b, N.magnitudes.billion, N.magnitudes.billionPlural) + (r ? E + compose(r) : "");
    }

    /** Non-negative integer → Standard Albanian words. Out-of-range input falls back to digit-by-digit. */
    return function numberToWords(n: number): string {
        if (!Number.isSafeInteger(n) || n < 0) {
            return [...String(n)].filter((c) => c >= "0" && c <= "9").map((d) => N.units[Number(d)]!).join(" ");
        }
        if (n === 0) return N.units[0]!; // zero
        return compose(n).replace(/\s+/gu, " ").trim();
    };
}
