/**
 * Zhuang cardinal number → words (space-separated; each runs through the g2p).
 *
 * ⚠ ZHUANG COUNTS THE WAY CHINESE DOES, NOT THE WAY ENGLISH DOES, and the first version of this file
 * assumed English. Three consequences, each of which was producing a WRONG NUMBER rather than merely an
 * unidiomatic one:
 *
 *  1. **The series is myriad-grouped.** `cib` 10 · `bak` 10² · `cien` 10³ · **`fanh` 10⁴** · **`ik` 10⁸**.
 *     There is no thousand-of-thousands step and no "million" lexeme. 43 000 is *seiq fanh sam cien*
 *     (四万三千), not *seiq cib sam cien*. The corpus writes the composition out in full:
 *     `1 ik 3 cien fanh boux sawjyungh` = 一億三千萬 = 130 000 000 (Japanese speakers), `1 ik 6 cien fanh
 *     nienz`, `13 ik` (China), `14 ik` (India), `1.4 ik km²` — ×35, every one of them 10⁸ for `ik`.
 *     `fanh` is glossed *ten thousand* by Wiktionary (za `fanh`, ← 萬); the corpus's `bakfanh`
 *     (`5.4 bakfanh sq mi`) is a COMPOSED hundred-of-myriads = 10⁶, which only a 万-based system can form.
 *
 *  2. **A trailing bare unit abbreviates the NEXT magnitude down**, so a zero gap must be spoken.
 *     Wiktionary's own usage examples on za `it`: `song bak it` = "two hundred and **ten**" (二百一),
 *     `song cien ngeih` = "two thousand two **hundred**" (二千二). Therefore the old output for 101,
 *     `it bak it`, does not mean 101 — it means 110. The filler is `lingz` (← 零), whose entry carries the
 *     construction as its usex: `bak lingz sam` = "one hundred and three"; za.wikipedia's number stubs
 *     write `Bak lingz it(101)` … `Bak lingz gouj(109)` ×9.
 *
 *  3. **A ten under a higher magnitude keeps its own leading `it`.** In the Zhuang subset of the corpus
 *     `bak cib` occurs **0** times and `bak it cib` occurs **30** — `Bak it cib ngeih(112)`. The old
 *     output for 112 was `it bak cib ngeih`.
 *
 * ⚠ WHAT WAS DELIBERATELY *NOT* CHANGED, although the corpus counts favour it — the counts were one
 * author. za.wikipedia's 172 self-glossing stubs (`… (n) dwg aen swhyienzsoq`) are a single hand-typed
 * series with copy errors in it (110 and 111 carry the SAME title; 115 is titled as 113), and the whole
 * of their apparent majority for `loeg`/`bat` lives inside them: with the series removed the corpus reads
 * `roek` 58 : `loeg` 9 and `bet` 26 : `bat` 4.
 *   • **6 stays `roek`.** `roek` and `loeg` are alternative forms of ONE lemma (Wiktionary lists each
 *     under the other's `Alternative forms`, same Proto-Tai \*krokᴰ etymology); the split is the r-/l-
 *     initial, NOT the 1957→1982 respelling — `loeg`'s own 1957 spelling is given as `lɵg`, so both words
 *     already existed in the old orthography. Omniglot's Yongbei (Wuming-based standard) table gives `roek`.
 *   • **8 stays `bet`.** Wiktionary gives `bet` the cardinalbox (7 · 8 · 9) and glosses `bat` as
 *     "eight — *used in compounds*", `{{syn|za|bet}}`. The corpus agrees: `bat`'s prose hits are
 *     `bat hangh gvidingh` (八项规定), `daih bat`, `bat ciep raemxfwn` — all bound.
 *   • **100 stays `it bak`.** The stub series writes a bare `Bak …`, but Wiktionary glosses 1000 as
 *     `it cien` — the leading unit IS written — and the corpus's own prose has `it bak` ×3
 *     (`it bak haj cib manq hunz`, `laebbaenz it bak hopbi`, `song aen it bak bi`).
 *   • **2 before a magnitude stays `ngeih`.** Wiktionary's usexes use `song` there (`song bak it`), but
 *     `song`/`ndeu` and `ngeih`/`it` are two parallel series and this compositor is committed to the
 *     `it`-series (`ngeih`'s usage note: "used with `it` rather than `ndeu`"). Corpus evidence is three
 *     tokens total (`ngeih bak` ×2 — `boux ngeih bak roek cib roek gyauqvuengz`, the 266th pope —
 *     `song bak` ×1), which is not enough to move a series choice.
 *
 * Covers 0 … <10¹²; above that, digit-by-digit. Full sourcing: docs/investigations/za_normalization_investigation.md.
 */
import { MANIFEST } from "./manifest.ts";

const N = MANIFEST.numbers;

/** The four places of one myriad group, largest first. `""` is the bare units place. */
const PLACES: [number, string][] = [
    [1000, N.thousand],
    [100, N.hundred],
    [10, N.ten],
    [1, ""],
];

/**
 * 1 ≤ n < 10⁴ → the words of one myriad group.
 *
 * `bound` = a higher magnitude has already been spoken, which changes two things: a leading zero inside
 * the group must be filled (`it ik lingz haj`, 一億零五), and the group can no longer begin with the
 * bare `cib` of a standalone teen.
 */
function group(n: number, bound: boolean): string {
    const out: string[] = [];
    let started = false; // a digit of this group has been spoken
    // A zero stands between the last spoken digit and the next one. Starts false even when `bound`: the
    // group only takes a filler if it actually BEGINS with a zero, which the loop below detects.
    let gap = false;
    for (const [place, scale] of PLACES) {
        const d = Math.floor(n / place) % 10;
        if (d === 0) {
            if (started || bound) gap = true;
            continue;
        }
        if (gap) out.push(N.units[0]!); // `lingz` — ONE filler however wide the gap, as in Chinese
        gap = false;
        // 10…19 standing on their own are `cib …`; under a higher magnitude the ten takes its `it`
        // (`bak it cib` ×30 in the corpus, `bak cib` ×0).
        if (place === 10 && d === 1 && !started && !bound) out.push(N.ten);
        else out.push(scale ? `${N.units[d]} ${scale}` : N.units[d]!);
        started = true;
    }
    return out.join(" ");
}

/** Non-negative integer (< 10¹²) → Zhuang words; larger / non-finite → digit-by-digit. */
export function numberToWords(n: number, raw?: string): string {
    if (!Number.isSafeInteger(n) || n < 0 || n >= 1e12)
        return [...(raw ?? String(Math.abs(n)))].map((d) => N.units[Number(d)] ?? d).join(" ");
    if (n === 0) return N.units[0]!; // lingz

    const yi = Math.floor(n / 1e8), // 億 groups
        wan = Math.floor((n % 1e8) / 1e4), // 萬 groups
        lo = n % 1e4;
    const out: string[] = [];
    let bound = false;
    if (yi) {
        out.push(`${group(yi, false)} ${N.hundredMillion}`);
        bound = true;
    }
    if (wan) {
        out.push(`${group(wan, bound)} ${N.myriad}`);
        bound = true;
    }
    // A wholly-empty 萬 group is not spoken; `bound` alone makes the next group supply the `lingz`.
    if (lo) out.push(group(lo, bound));
    return out.join(" ");
}
