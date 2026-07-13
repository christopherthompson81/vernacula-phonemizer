/**
 * Kanji → kana reading conversion + bunsetsu segmentation (Phase 2), ported from the espeak-ng-portable
 * Japanese front-end. Two passes drive it:
 *   - segmentText: insert spaces at bunsetsu (phrase) boundaries so a spaceless run is phonemized
 *     phrase-by-phrase (kana→kanji transition = new phrase; case particles が/を/に end a phrase; て-form +
 *     auxiliary splits; adverbs are their own bunsetsu).
 *   - applyReadings: longest-match kanji→kana over a 60k whole-word map (日本語 matches the 3-char key, so
 *     on/kun disambiguation is sidestepped), with a per-kanji on/kun/rendaku fallback for uncovered kanji.
 * The whole-word map handles reading choice; no 14MB Viterbi is needed. Data: readings.tsv / fallback.tsv /
 * adverbs.txt. See docs/ja_native_bringup_investigation.md.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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
        const dir = dirname(fileURLToPath(import.meta.url));
        const map = new Map<string, string>();
        let maxKeyLength = 0;
        for (const line of readFileSync(
            join(dir, "readings.tsv"),
            "utf8",
        ).split("\n")) {
            if (line === "") continue;
            const tab = line.indexOf("\t");
            if (tab < 0) continue;
            const key = line.slice(0, tab);
            map.set(key, line.slice(tab + 1));
            const len = [...key].length;
            if (len > maxKeyLength) maxKeyLength = len;
        }
        const fallback = new Map<string, KanjiFallback>();
        for (const line of readFileSync(
            join(dir, "fallback.tsv"),
            "utf8",
        ).split("\n")) {
            if (line === "") continue;
            const [k, on, kun, rendaku] = line.split("\t");
            if (!k) continue;
            const fb: KanjiFallback = {};
            if (on) fb.on = on;
            if (kun) fb.kun = kun;
            if (rendaku) fb.rendaku = rendaku;
            fallback.set(k, fb);
        }
        const adverbs = new Set<string>();
        let maxUnitLength = maxKeyLength;
        for (const a of readFileSync(join(dir, "adverbs.txt"), "utf8").split(
            "\n",
        )) {
            if (a === "") continue;
            adverbs.add(a);
            const l = [...a].length;
            if (l > maxUnitLength) maxUnitLength = l;
        }
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
        out += unit;
        prevParticle =
            u.length === 1 &&
            (unit === "が" || unit === "を" || unit === "に") &&
            prev !== undefined &&
            isKanji(prev);
        prev = u[u.length - 1]!;
        prevAdv = isAdv;
        i += u.length;
    }
    return out;
}
