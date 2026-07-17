/**
 * Kanji → kana reading conversion + bunsetsu segmentation (Phase 2), ported from the espeak-ng-portable
 * Japanese front-end. Two passes drive it:
 *   - segmentText: insert spaces at bunsetsu (phrase) boundaries so a spaceless run is phonemized
 *     phrase-by-phrase (kana→kanji transition = new phrase; case particles が/を/に end a phrase; て-form +
 *     auxiliary splits; adverbs are their own bunsetsu).
 *   - applyReadings: longest-match kanji→kana over a 60k whole-word map (日本語 matches the 3-char key, so
 *     on/kun disambiguation is sidestepped), with a per-kanji on/kun/rendaku fallback for uncovered kanji.
 * The whole-word map handles reading choice; no 14MB Viterbi is needed. Data: readings.tsv / fallback.tsv /
 * adverbs.txt. See docs/investigations/ja_native_bringup_investigation.md.
 */
import { loadTsvMap, loadLines } from "../../core/loadTsv.ts";

interface KanjiFallback {
    on?: string;
    kun?: string;
    rendaku?: string;
}

interface Readings {
    map: Map<string, string>;
    maxKeyLength: number; // longest word-key, code points
    fallback: Map<string, KanjiFallback>;
    adverbs: Set<string>;
    maxUnitLength: number; // longest of (map keys ∪ adverbs), scan bound for segmentation
}

let READINGS: Readings | undefined;
function readings(): Readings {
    if (READINGS === undefined) {
        // 60k whole-word map (kanji-run → kana); a per-kanji on/kun/rendaku fallback (4-column); kana adverbs.
        const map = loadTsvMap(import.meta.url, "readings.tsv");
        const fallback = loadTsvMap(import.meta.url, "fallback.tsv", (rest) => {
            const [on, kun, rendaku] = rest.split("\t");
            const fb: KanjiFallback = {};
            if (on) fb.on = on;
            if (kun) fb.kun = kun;
            if (rendaku) fb.rendaku = rendaku;
            return fb;
        });
        const adverbs = new Set(loadLines(import.meta.url, "adverbs.txt"));
        // Longest key (code points) — the segmentation scan bounds. reduce (not Math.max(...spread)) so the
        // ~60k-key readings map can't blow the call-argument limit.
        const maxKeyLength = [...map.keys()].reduce(
            (m, k) => Math.max(m, [...k].length),
            0,
        );
        const maxUnitLength = [...adverbs].reduce(
            (m, a) => Math.max(m, [...a].length),
            maxKeyLength,
        );
        READINGS = { map, maxKeyLength, fallback, adverbs, maxUnitLength };
    }
    return READINGS;
}

const isHiragana = (ch: string): boolean => /[ぁ-ゖ]/u.test(ch);
const isKanji = (ch: string): boolean =>
    /[㐀-鿿\u{20000}-\u{2a6df}々]/u.test(ch);
const isKana = (ch: string): boolean => /[ぁ-ゖァ-ヿー]/u.test(ch);

/** The longest key matching at chars[i], scanning from min(maxKeyLength, remaining) down to minLen. */
function longestKeyMatch(
    chars: readonly string[],
    i: number,
    maxKeyLength: number,
    minLen: number,
    inKeyset: (k: string) => boolean,
): { unit: string; len: number } | null {
    const maxLen = Math.min(maxKeyLength, chars.length - i);
    for (let len = maxLen; len >= minLen; len--) {
        const sub = chars.slice(i, i + len).join("");
        if (inKeyset(sub)) return { unit: sub, len };
    }
    return null;
}

/** Longest-match kanji→kana substitution over a single token. Kana passes through; an uncovered kanji falls
 *  back to its on/kun reading (kun when okurigana follows, else on), with rendaku when non-initial in a compound. */
export function applyReadings(word: string): string {
    const { map, maxKeyLength, fallback } = readings();
    const chars = [...word];
    let out = "",
        i = 0,
        prevKanjiReading = "",
        prevWasKanji = false;
    while (i < chars.length) {
        // 々/〻 iteration mark: repeat the preceding single-kanji reading (奈々→なな).
        if (
            (chars[i] === "々" || chars[i] === "〻") &&
            prevKanjiReading !== ""
        ) {
            out += prevKanjiReading;
            i++;
            continue;
        }
        const m = longestKeyMatch(chars, i, maxKeyLength, 1, (k) => map.has(k));
        if (m !== null) {
            let reading = map.get(m.unit)!;
            const single = m.len === 1 && isKanji(m.unit);
            if (single && prevWasKanji) {
                const fb = fallback.get(m.unit);
                if (fb?.rendaku !== undefined && reading === fb.kun)
                    reading = fb.rendaku;
            }
            out += reading;
            prevKanjiReading = single ? reading : "";
            prevWasKanji = [...m.unit].some(isKanji);
            i += m.len;
            continue;
        }
        const fb = fallback.get(chars[i]!);
        if (fb !== undefined) {
            let reading: string;
            if (prevWasKanji && fb.rendaku !== undefined) reading = fb.rendaku;
            else {
                const next = chars[i + 1];
                const wantKun = next !== undefined && isHiragana(next);
                reading =
                    (wantKun ? (fb.kun ?? fb.on) : (fb.on ?? fb.kun)) ??
                    chars[i]!;
            }
            out += reading;
            prevKanjiReading = reading;
            prevWasKanji = true;
            i++;
            continue;
        }
        out += chars[i];
        prevKanjiReading = "";
        prevWasKanji = false;
        i++;
    }
    return out;
}

/** True if a whole-word reading entry of length ≥2 starts at the head of `text` — i.e. the leading kanji heads a
 *  dictionary compound (時間, 年生, 日中, 年間, 分間). Used by the number+counter fusion to avoid splitting a compound
 *  whose first kanji happens to be a counter (3時間 must stay さんじかん, not become さんじ + 間). A standalone counter
 *  before a particle/verb/punctuation does NOT head a compound (冊読 is no word), so its euphonic reading still fires. */
export function headsCompound(text: string): boolean {
    const { map, maxKeyLength } = readings();
    return (
        longestKeyMatch([...text], 0, maxKeyLength, 2, (k) => map.has(k)) !==
        null
    );
}

/** Insert spaces at bunsetsu boundaries in a spaceless Japanese run (see module header). */
export function segmentText(text: string): string {
    const { map, adverbs, maxUnitLength } = readings();
    const chars = [...text];
    let out = "",
        prev: string | undefined,
        prevAdv = false,
        prevParticle = false,
        i = 0;
    while (i < chars.length) {
        const ch = chars[i]!;
        if (!isKanji(ch) && !isKana(ch)) {
            out += ch;
            prev = ch;
            prevAdv = false;
            prevParticle = false;
            i++;
            continue;
        }
        const m = longestKeyMatch(
            chars,
            i,
            maxUnitLength,
            2,
            (k) => map.has(k) || adverbs.has(k),
        );
        const unit = m?.unit ?? ch;
        const isAdv = adverbs.has(unit);
        const u = [...unit];
        const isKanaAdverb = isAdv && u.every(isKana);
        const headKanji = isKanji(unit[0]!);
        const teFormAux = unit[0] === "い" && (prev === "て" || prev === "で");
        const boundary =
            (prev !== undefined &&
                ((isKana(prev) && headKanji) ||
                    (prevAdv && headKanji && u.length >= 2) ||
                    isKanaAdverb)) ||
            prevParticle ||
            teFormAux;
        if (boundary) out += " ";
        // Case particles: a single-mora particle after a content word ends a bunsetsu. は/へ as particles are
        // PRONOUNCED wa/e (not ha/he) — convert them here so the reading pass emits わ/え (私は→わたし わ, 東京へ→
        // とうきょう え). を is already handled in kana.ts; が/を/に pass through unchanged (unambiguous kana). は/へ
        // that START a dictionary word (はな, へや) are matched as a ≥2-mora unit above, so single-char は/へ after
        // content is the particle. が/を/に keep the stricter isKanji(prev) gate the segmenter already relied on.
        const particle =
            u.length === 1 &&
            prev !== undefined &&
            (((unit === "が" || unit === "を" || unit === "に") && isKanji(prev)) ||
                ((unit === "は" || unit === "へ") &&
                    (isKanji(prev) || isKana(prev))));
        out += particle && unit === "は"
            ? "わ"
            : particle && unit === "へ"
              ? "え"
              : unit;
        prevParticle = particle;
        prev = u[u.length - 1]!;
        prevAdv = isAdv;
        i += u.length;
    }
    return out;
}
