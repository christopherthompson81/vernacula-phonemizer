/**
 * Kinyarwanda cardinal number → words (space-separated; each runs through the g2p). This module holds the shared
 * RWANDA-RUNDI compositor: Kirundi (rn) is a near-clone of Kinyarwanda (rw) in its numeral morphology too, so
 * kirundi/numbers.ts imports `composeRwandaRundi` from here and passes its own (slightly different) word table
 * rather than duplicating the algorithm.
 *
 * Sources: languagesandnumbers.com/how-to-count-in-kinyarwanda (kin) — the rule text for each magnitude series;
 * Omniglot "Numbers in Kinyarwanda" and kinyarwanda.mofeko.com/numbers.html (independent agreement on 20–90);
 * Harvard ELIAS "Grammar: Cardinal and ordinal numbers" (elias.fas.harvard.edu) for the concord statement.
 *
 * NOUN-CLASS CONCORD. Kinyarwanda numerals 1–7 are bound stems taking the concord of the counted noun; 8 (umunani),
 * 9 (icyenda) and 10 (icumi) are invariable. So each magnitude carries its OWN multiplier series:
 *   • tens   — mirongo (class 4) + the i- series: mirongo itatu 30, ine 40, itanu 50, itandatu 60, irindwi 70,
 *              inani 80, icyenda 90. 20 is the fused irregular makumyabiri.
 *   • hundreds — ijana 100; magana (class 6) + the a- series: magana abiri 200 … magana arindwi 700,
 *              magana inani 800, magana cyenda 900.
 *   • thousands — igihumbi 1000; ibihumbi (class 8) + the bi- series: ibihumbi bibiri 2000 … birindwi 7000,
 *              munani 8000, cyenda 9000.
 * A BARE numeral (a lone digit, which is what a TTS actually has to speak) is given in its citation form —
 * `units`: rimwe, kabiri, gatatu … — and that series is also what is reused for the 11–19 and 21–99 remainders
 * and for thousand-multipliers ≥ 10, where the full concord would be contextual. Deliberate simplification.
 *
 * ── THE CEILING IS PER-LANGUAGE, AND IT IS EVIDENCE, NOT ARITHMETIC ───────────────────────────────────
 * This compositor used to stop at 10⁹ for BOTH languages because only `million` was authored. `billion` is
 * now OPTIONAL in the table, and that optionality is the whole point: rw has an attested milliard word and
 * rn does not, so the shared algorithm must be able to reach 10¹² for one language and stop at 10⁹ for the
 * other. Above whichever ceiling applies the number is still SPOKEN — digit-at-a-time out of `units`, never
 * dropped and never leaked as ASCII (see test/bignum-fallback.test.ts and the `ln`/`ha` defects behind it).
 *
 * rw — 10⁹ = `miriyari`, AUTHORED. Evidence, all of it Kinyarwanda:
 *   • rw.wikipedia's own prose, `insource:` token hits — `miriyari` ×8, and the hits are real numerals
 *     ("miriyari 55 m3", "miriyari 1", "babarirwa muri za miriyari");
 *   • ⚠ THE DECIDING HIT — "akayabo ka **miriyari 53 na miriyoni 910**" is this compositor's exact output
 *     shape (billion + multiplier, `na`, million + multiplier) written by a Kinyarwanda hand, and it uses
 *     THIS TABLE'S `miriyoni` and `na`;
 *   • en.wiktionary `miliyari` — the only sense line is "(Kinyarwanda) billion", i.e. the dictionary marks
 *     the word for Kinyarwanda and declines to claim it for Rundi;
 *   • languagesandnumbers.com/how-to-count-in-kinyarwanda (kin) gives "miliyaridi imwe [1 billion]".
 *   THE l/r SPELLING, recorded rather than glossed over: the corpus-dominant spelling is `miliyari` (×257)
 *   against `miriyari` (×8), and `miliyaridi` is ×1. Kinyarwanda l~r is allophonic, so these are one word in
 *   two orthographies; the r-form is authored because it is what the ONE attested billion+million compound
 *   uses and it is the orthography the rest of this table is already in (`miriyoni`, itself ×55 against
 *   `miliyoni` ×757 — the same split, settled the same way when this table was written).
 * rn — 10⁹ DECLINED, left unauthored. rn.wikipedia has ZERO hits for `miliyari`, `miriyari`, `miliyaridi`,
 *   `miriyaridi`, `umuliyaridi`, `umuriyaridi` or `miliaridi`, while the same corpus writes the MILLION word
 *   freely (`imiliyoni` ×19, `miliyoni` ×7, `umuliyoni` ×3, `umuriyoni` ×1) — so the silence is about this
 *   magnitude, not about the corpus's size. The only Kirundi attestation found anywhere is one igihe.bi news
 *   article, which writes the PLURAL `imiliyaridi 4` and, one sentence later, `miliaridi` — two spellings in
 *   one article and no singular. `N.million` is a SINGULAR (`umuriyoni`), so authoring a matching singular
 *   would mean coining `*umuliyaridi` from a bare plural: the Fula `tere` move, trap 37. Declined. rw's word
 *   is NOT rn's word by inheritance — the rn bring-up already found seven rw rules that were wrong for
 *   Kirundi, one of them a word meaning "early" rather than "squared".
 * 10¹² DECLINED FOR BOTH. rw.wikipedia does write `tiriyoni` ×2 ("tiriyoni 1.53 z'amadolari", "tiriyoni 1,9
 *   cu ft") so the word is not imaginary — but two hits, both inside converted foreign units, with no
 *   dictionary or grammar corroboration, is under this project's bar when the neighbouring magnitude already
 *   has three competing spellings. Recorded so the next reader does not re-derive it. rn: not probed as a
 *   separate question, since rn has no 10⁹ to build on.
 *
 * Covers 0 … <10¹² for rw (miriyoni 10⁶, miriyari 10⁹) and 0 … <10⁹ for rn (umuriyoni 10⁶); above that, and
 * for a non-finite or unsafe integer, digit-by-digit.
 */
import { MANIFEST, type RwandaRundiNumbers } from "./manifest.ts";

/** Compose `n` in a Rwanda-Rundi language from its own word table. */
export function composeRwandaRundi(n: number, N: RwandaRundiNumbers, raw?: string): string {
    /** 1 ≤ n < 100. */
    const below100 = (v: number): string => {
        if (v < 10) return N.units[v]!;
        if (v === 10) return N.ten;
        const t = Math.floor(v / 10);
        const u = v % 10;
        const tens = t === 1 ? N.ten : N.tens[t]!;
        return u ? `${tens} ${N.and} ${N.units[u]}` : tens;
    };
    /** 1 ≤ n < 1000. */
    const below1000 = (v: number): string => {
        if (v < 100) return below100(v);
        const h = Math.floor(v / 100);
        const r = v % 100;
        const hundred = h === 1 ? N.hundred : `${N.hundreds} ${N.hundredsMul[h]}`;
        return r ? `${hundred} ${N.and} ${below100(r)}` : hundred;
    };
    /** 1 ≤ n < 10⁶. */
    const below1e6 = (v: number): string => {
        if (v < 1000) return below1000(v);
        const th = Math.floor(v / 1000);
        const r = v % 1000;
        // 2–9 thousand take the class-8 bi- multiplier; ≥10 thousand fall back to the citation series.
        const thousand =
            th === 1 ? N.thousand : th < 10 ? `${N.thousands} ${N.thousandsMul[th]}` : `${N.thousands} ${below1000(th)}`;
        return r ? `${thousand} ${N.and} ${below1e6(r)}` : thousand;
    };

    /** 1 ≤ n < 10⁹. */
    const below1e9 = (v: number): string => {
        if (v < 1e6) return below1e6(v);
        const m = Math.floor(v / 1e6);
        const r = v % 1e6;
        const million = m === 1 ? N.million : `${N.million} ${below1000(m)}`;
        return r ? `${million} ${N.and} ${below1e6(r)}` : million;
    };

    // ⚠ THE CEILING IS WHAT THE TABLE CAN SAY, not a constant: 10¹² where a `billion` word is authored (rw),
    // 10⁹ where it is not (rn). Above it the digits are still read one at a time out of `units` — a magnitude
    // this language has no word for is a refusal to COMPOSE, never a licence to go silent.
    const ceiling = N.billion ? 1e12 : 1e9;
    if (!Number.isSafeInteger(n) || n < 0 || n >= ceiling)
        return [...(raw ?? String(Math.abs(n)))].map((d) => N.units[Number(d)] ?? d).join(" ");
    if (n === 0) return N.units[0]!;
    if (n < 1e9) return below1e9(n);
    const b = Math.floor(n / 1e9);
    const r = n % 1e9;
    const billion = b === 1 ? N.billion! : `${N.billion!} ${below1000(b)}`;
    return r ? `${billion} ${N.and} ${below1e9(r)}` : billion;
}

/** Non-negative integer (< 10⁹) → Kinyarwanda words; larger / non-finite → digit-by-digit. */
export function numberToWords(n: number): string {
    return composeRwandaRundi(n, MANIFEST.numbers);
}
