/**
 * Japanese (ja) phonemizer — Standard/Tokyo, canonical IPA, espeak-independent.
 *   text → segmentText (bunsetsu spaces) → per run: applyReadings (kanji→kana) → kanaToIpa.
 * PHASE 1: native kana/katakana → IPA (kana.ts) + Sino-Japanese numbers. PHASE 2: kanji → kana via a 60k
 * whole-word reading map + per-kanji on/kun/rendaku fallback (kanji.ts), and orthographic bunsetsu
 * segmentation of spaceless text. Pitch accent (ꜜ) is Phase 3. See docs/investigations/ja_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { kanaToIpa, kanaToMorae, segmentsToMorae } from "./kana.ts";
import { applyReadingSegments, applyReadings, segmentText, headsCompound } from "./kanji.ts";
import { numberToKana } from "./numbers.ts";
import { readCounter } from "./counters.ts";
import { normalizeJapanese } from "./normalize.ts";

// Fold hiragana → katakana (kanaToIpa treats them identically). Counter readings are injected as katakana so
// segmentText's hiragana-specific は→わ / を particle heuristic can't corrupt an internal は/へ (2泊→にはく → にわく).
const toKatakana = (s: string): string =>
    s.replace(/[ぁ-ゖ]/gu, (c) => String.fromCodePoint(c.codePointAt(0)! + 0x60));
import { accentNucleus, placeDownstep } from "./pitch.ts";
import { MANIFEST } from "./manifest.ts";

// Japanese clause punctuation → canonical pause marks (from japanese.jsonc).
const CLAUSE_MARK = MANIFEST.clausePunctuation;
// A Japanese-script run (kanji incl. Ext-A/B + iteration marks + hiragana + katakana + long mark), a digit
// run, or clause punctuation. Bunsetsu spaces inserted by segmentText split runs into phrase-sized tokens.
const TOKEN =
    /([㐀-鿿\u{20000}-\u{2a6df}々〻ぁ-ゖァ-ヺー゛゜]+)|(\d+)|([。．.！!？?、，,])/gu;
const KANA_ONLY = /[^ぁ-ゖァ-ヺー]/gu; // strip anything the reading pass left un-converted (unresolved kanji)

// #562 symbol normalization — Japanese: katakana loans, read by the ordinary kana engine.
// UNITS moved to normalize.ts, which must resolve them before its decimal and exponent rules break the
// number-adjacency this tier matches on; see UNIT_KANA there. Percent stays, because nothing reorders it.
// Currency closes the CUR-DROP that tools/normalization/audit.ts flags for ja: the sign was dropped
// outright, so "$5" and "5" read identically. No sign occurs in this corpus (it writes 円 and ドル as
// words), but the reading is not in doubt, and a dropped sign is silent content loss wherever one does.
const SYMBOLS = makeSymbolNormalizer({
    percent: ["パーセント"],
    // MIGRATION TEST (#562): units + exponent from the shared tier instead of normalize.ts's local table.
    units: {
        km: ["キロメートル"], cm: ["センチメートル"], mm: ["ミリメートル"], nm: ["ナノメートル"], m: ["メートル"],
        kg: ["キログラム"], mg: ["ミリグラム"], g: ["グラム"], t: ["トン"], ha: ["ヘクタール"],
        ml: ["ミリリットル"], l: ["リットル"],
    },
    exponentWords: { squared: ["平方"], cubed: ["立方"], position: "compound" },
    currency: { $: ["ドル"], "€": ["ユーロ"], "£": ["ポンド"], "¥": ["円"], "₩": ["ウォン"] },
    // Japanese has no spaces either, so the tier's letter-boundary guards were rejecting its ordinary case
    // the same way they were Chinese's: `20℃は暑い` dropped the ℃ and `50 km²の` lost the exponent, while their
    // punctuation-adjacent twins worked. Found by extending the cmn measurement (#586) to the other unspaced
    // scripts. yue and th show the same readings but declare only `percent` through this tier, so theirs is a
    // missing DECLARATION rather than a guard problem — recorded for the sweep, not fixed here.
    unspacedScript: true,
});

class JapanesePhonemizer implements Phonemizer {
    text(input: string): string {
        // #562 — SYMBOLS first, because its % rule matches a NUMBER directly before the sign and
        // normalization's decimal rewrite (1.5 → 1点ゴ) removes that adjacency. Normalization then folds
        // the widths, resolves the remaining numeric surface forms, and nativizes embedded Latin so it
        // never reaches the English fallback in core/foreign.ts.
        input = normalizeJapanese(SYMBOLS(input));
        // Normalise full-width digits ０-９ → ASCII so the number path fires (３個 → さんこ, ２０２４年 → …); the \d
        // token and numberToKana are ASCII-only.
        input = input.replace(/[０-９]/gu, (d) => String.fromCodePoint(d.codePointAt(0)! - 0xfee0));
        // Number + counter (助数詞): fuse a digit run + following counter kanji into its euphonic kana reading
        // (1本→いっぽん, 3個→さんこ, 2024年→にせんにじゅうよねん) BEFORE segmentation, so it flows through the kana path.
        // readCounter returns null for a non-counter kanji (or out-of-range n) → the digits pass through unchanged.
        // Suppress the fusion when the counter kanji HEADS a dictionary compound (3時間, 3年生): splitting it off
        // would orphan the trailing kanji into a wrong isolated reading (間→あいだ, 生→なま). See headsCompound.
        input = input.replace(
            /(\d+)(\p{Script=Han})/gu,
            (m0, num, ctr, offset: number, str: string) => {
                if (headsCompound(str.slice(offset + num.length))) return m0;
                const reading = readCounter(Number(num), ctr);
                return reading === null ? m0 : toKatakana(reading);
            },
        );
        // segmentText inserts bunsetsu spaces first, then assembleClauses runs the standard clause skeleton.
        return assembleClauses(segmentText(input), TOKEN, (m, sink) => {
            if (m[1]) {
                const segments = readingSegments(m[1]); // kanji → kana per morpheme (boundaries kept, #552)
                const reading = segments.join("");
                const morae = segmentsToMorae(segments);
                if (morae)
                    sink.emit(
                        placeDownstep(morae, accentNucleus(m[1], reading)),
                    ); // pitch: surface m[1] disambiguates
            } else if (m[2]) {
                const ipa = kanaToIpa(numberToKana(Number(m[2])));
                if (ipa) sink.emit(ipa);
            } else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** One Japanese word/token → canonical IPA (kanji readings + pitch downstep, so kanji tokens work too). */
export function phonemizeWord(word: string): string {
    const segments = readingSegments(word);
    const reading = segments.join("");
    const morae = segmentsToMorae(segments);
    return morae === null
        ? ""
        : placeDownstep(morae, accentNucleus(word, reading));
}

/** Reading segments for a word, with the unresolvable tail dropped from each.
 *
 *  No exception list is needed for compounds that legitimately DO coalesce across the boundary: those are
 *  exactly the ones whose stored reading is NOT the sum of their characters' readings, so
 *  `alignCompoundReading` finds no split and leaves them as a single segment. 小売 こうり stays koːri because
 *  売 has no reading うり; 子牛 こうし splits こ|うし because both parts are attested readings. The mechanism
 *  decides it from the data instead of a hand-maintained list. */
function readingSegments(word: string): string[] {
    return applyReadingSegments(word)
        .map((s) => s.replace(KANA_ONLY, ""))
        .filter((s) => s !== "");
}

/** One Japanese word/token → canonical IPA, SEGMENTAL only (no pitch downstep) — for segmental validation. */
export function phonemizeWordSegmental(word: string): string {
    return kanaToIpa(applyReadings(word).replace(KANA_ONLY, "")) ?? "";
}

/** Build the Japanese phonemizer (kana + numbers + kanji readings + bunsetsu segmentation). */
export function createJapanese(): Phonemizer {
    return new JapanesePhonemizer();
}
