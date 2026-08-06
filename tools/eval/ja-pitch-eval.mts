/**
 * Japanese PITCH-ACCENT validation (downstep ꜜ) against OpenJTalk, the de-facto standard JA accent engine.
 * For each complete content word the committed gold (tools/eval/ja_pitch_reference.tsv) carries OpenJTalk's accent
 * NUCLEUS (0 = heiban), mora count, and kana reading; this eval computes OUR nucleus (accentNucleus) + morae
 * (kanaToMorae) for the word and compares.
 *
 * To measure ACCENT and not READING, comparison is restricted to words where our reading matches OpenJTalk's and
 * the mora counts align (reading/segmentation mismatches are reported separately, not scored as accent errors).
 * An out-of-lexicon word renders heiban (0), which is indistinguishable from a real heiban hit — those OOV-heiban
 * coincidences are counted and discounted so a future lexicon-coverage regression can't silently inflate the score.
 *
 * CAVEAT (honest): OpenJTalk is one of the three voters behind our merged pitch lexicon (kanjium/OpenJTalk/UniDic),
 * so this is a conservative-but-not-fully-independent referee. No larger free Tokyo-accent source exists outside
 * those three (kaikki/Wiktionary carries ~3 Tokyo-accent words). Japanese accent is an inherent ~90-95% task —
 * dictionaries themselves disagree (映画 0/1, 毎日 0/1, 期間 1/2) — so ~95% is near the achievable ceiling, and the
 * residual is dominated by genuinely-contested accents, not systematic error.
 *
 *   npx tsx tools/eval/ja-pitch-eval.mts            # score
 *   npx tsx tools/eval/ja-pitch-eval.mts --list     # + list accent disagreements
 */
import { readFileSync } from "node:fs";
import { applyReadings, segmentText } from "../../src/languages/japanese/kanji.ts";
import { kanaToMorae } from "../../src/languages/japanese/kana.ts";
import { accentNucleus, pitchLexiconHas } from "../../src/languages/japanese/pitch.ts";

const GOLD = new URL("./ja_pitch_reference.tsv", import.meta.url).pathname;
const KANA_ONLY = /[^ぁ-ゖァ-ヺー]/gu;
const HIRA: Record<string, string> = { ぁ: "あ", ぃ: "い", ぅ: "う", ぇ: "え", ぉ: "お" };
const kata2hira = (k: string): string =>
    k.replace(/[ァ-ヶ]/gu, (c) => String.fromCodePoint(c.codePointAt(0)! - 0x60));

/** Reading skeleton for a regression-tolerant match: katakana→hiragana, drop sokuon/small kana, fold long-vowel
 *  notation (OpenJTalk ー vs our おう digraph). Genuine homograph differences (分 ぶん/わけ) still differ → excluded. */
function readingSkel(s: string): string {
    return kata2hira(s)
        .replace(/[っッ ー]/gu, "")
        .replace(/[ぁぃぅぇぉ]/gu, (c) => HIRA[c]!)
        .replace(/([おこそとのほもよろごぞどぼぽ])う/gu, "$1")
        .replace(/([えけせてねへめれげぜでべぺ])い/gu, "$1")
        .replace(/([あいうえお])\1/gu, "$1");
}

export interface PitchEvalResult {
    total: number;
    compared: number;
    agree: number;
    oovHeibanAgree: number;
    readingMismatch: number;
    moraMismatch: number;
    diffs: Array<{ w: string; r: string; ours: number; ojt: number }>;
}

/** Score OUR accent nucleus against the committed OpenJTalk gold (reading-matched, mora-aligned). */
export function evaluatePitch(): PitchEvalResult {
    const rows = readFileSync(GOLD, "utf8")
        .split("\n")
        .filter((l) => l && !l.startsWith("#"));
    let agree = 0,
        compared = 0,
        readingMismatch = 0,
        moraMismatch = 0,
        oovHeibanAgree = 0;
    const diffs: PitchEvalResult["diffs"] = [];
    for (const line of rows) {
        const [w, nucStr, moraStr, reading] = line.split("\t");
        if (!w || nucStr === undefined || reading === undefined) continue;
        const ojtNuc = Number(nucStr),
            ojtMora = Number(moraStr);
        const ourReading = applyReadings(segmentText(w))
            .replace(/\s+/gu, "")
            .replace(KANA_ONLY, "");
        if (readingSkel(ourReading) !== readingSkel(reading)) {
            readingMismatch++;
            continue;
        }
        const morae = kanaToMorae(ourReading);
        if (!morae || morae.length !== ojtMora) {
            moraMismatch++;
            continue;
        }
        compared++;
        const nucleus = accentNucleus(w, ourReading);
        if (nucleus === ojtNuc) {
            agree++;
            if (
                nucleus === 0 &&
                !(pitchLexiconHas(w) || pitchLexiconHas(ourReading))
            )
                oovHeibanAgree++; // heiban-by-default, not a real lexicon hit
        } else diffs.push({ w, r: reading, ours: nucleus, ojt: ojtNuc });
    }
    return {
        total: rows.length,
        compared,
        agree,
        oovHeibanAgree,
        readingMismatch,
        moraMismatch,
        diffs,
    };
}

// CLI: print the scorecard (skipped when imported by the test).
const invokedDirectly =
    process.argv[1] !== undefined &&
    import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (invokedDirectly) {
    const r = evaluatePitch();
    const pct = (a: number, b: number): string => ((100 * a) / b).toFixed(1);
    const discounted = r.agree - r.oovHeibanAgree;
    console.log(`\n=== ja pitch-accent vs OpenJTalk (${r.total} complete content words) ===`);
    console.log(`accent nucleus AGREE (reading-matched, mora-aligned): ${r.agree}/${r.compared} (${pct(r.agree, r.compared)}%)`);
    console.log(`  of which OOV-heiban coincidences (word absent from pitch lexicon, defaulted flat): ${r.oovHeibanAgree}`);
    console.log(`  → agreement discounting OOV-heiban: ${discounted}/${r.compared} (${pct(discounted, r.compared)}%)`);
    console.log(`  reading mismatch (not an accent test): ${r.readingMismatch}`);
    console.log(`  mora-count mismatch (segmentation — not comparable): ${r.moraMismatch}\n`);
    if (process.argv.includes("--list"))
        for (const d of r.diffs) console.log(`  ${d.w}(${d.r}) ours:${d.ours} ojt:${d.ojt}`);
}
