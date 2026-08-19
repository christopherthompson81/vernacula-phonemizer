/**
 * `read_text` — the text the phonemizer ACTUALLY READ, stored beside the FLEURS transcript.
 *
 * ⚠ WHY THIS COLUMN EXISTS. `utt.text` is the FLEURS transcript and its schema comment called it "the
 * phonemizer's input". That stopped being true once the corpus pass began repairing the text first:
 * `phonemize-fleurs.mts` applies `restoreInitialismCasing` → `restoreAbbreviationDots` →
 * `restoreNguniConcordAcronyms`, then the numeral register, and phonemizes THAT — but the repaired string
 * was transient. So the corpus held `text` beside an `ipa` derived from a DIFFERENT string, nothing recorded
 * which, and no single row could be corrected by hand. Three consequences, all of them real:
 *
 *   · the (text, ipa) pair a trainer reads is internally inconsistent for every repaired row
 *   · a reviewer cannot see WHY a row's IPA has capitals the transcript does not
 *   · a reader divergence that is not derivable — see below — has nowhere to live
 *
 * ⚠ AND THE UNDERIVABLE CASES ARE THE POINT. A phonemizer reads the text it is given; it cannot make the
 * judgements a reader makes. Maltese `8:46 ta' filgħodu` is read *fid-disgħa nieqes kwart* — quarter TO
 * nine, which means rounding :46 to :45 AND incrementing the hour. No rule should invent that, and the
 * Maltese clock reader deliberately does not (see `maltese/normalize.ts`). The correct home for it is a
 * hand-authored `read_text` on that row: the text says 8:46, the reader said quarter to nine, and the
 * training pair should carry what was said.
 *
 * ⚠ A HAND CORRECTION IS NEVER CLOBBERED. `read_text_src` is `auto` for the derived repair and `hand` for a
 * human edit; the auto pass skips `hand` rows, exactly as `asr_align_label.py`'s `apply_auto` skips a hand
 * verdict in `status`. Re-running this tool is therefore always safe.
 *
 * ⚠ THIS FILE IS THE TEXT TRANSFORM ONLY; `read_text.py` owns the database. Node has no SQLite here
 * (`node:sqlite` is absent on this runtime and nothing in node_modules provides one), and every other
 * DB-touching tool in this directory is Python already — so the split follows the one
 * `phonemize-fleurs.mts` + `asr_align_corpus.py` already use: TypeScript computes, Python persists.
 *
 *   read_text.py --apply [lang…]                      derive and store `auto` read_text
 *   read_text.py --set <lang> <wav> "<text>"          record a hand correction
 *   read_text.py --stats
 */
import { restoreAbbreviationDots, restoreInitialismCasing, restoreNguniConcordAcronyms }
    from "./initialism_casing.mts";
import { numeralSegments } from "../numeral_register.mts";
import { readFileSync, writeFileSync } from "node:fs";

/** FLEURS code → registry code. ⚠ MUST match phonemize-fleurs.mts's VARIETY, or the two passes disagree
 *  about which engine read a language and `read_text` stops describing `ipa`. */
const VARIETY: Record<string, string> = {
    ar_eg: "arz", es_419: "es-419", pt_br: "pt-BR", fil_ph: "tl", ny_mw: "nya",
};
const code = (lang: string): string => VARIETY[lang] ?? lang.split("_")[0]!;

/** The text the phonemizer actually reads: the three repairs in `phonemize-fleurs.mts`'s order, then the
 *  numeral register's segments rejoined.
 *
 *  ⚠ THE REGISTER IS PART OF WHAT WAS READ. `numeralSegments` rewrites a digit run into the register
 *  language's WORDS for the five wired languages, and that rewrite is exactly what this column exists to
 *  record — without it `read_text` still would not describe `ipa`. */
export function readText(text: string, lang: string): string {
    const repaired = restoreNguniConcordAcronyms(
        restoreAbbreviationDots(restoreInitialismCasing(text, lang), lang), lang);
    return numeralSegments(repaired, code(lang)).map((s) => s.text).join("").trim();
}

if (import.meta.url === `file://${process.argv[1]}`) {
    // stdin/stdout would be simpler but the corpus rows contain every kind of quoting; files are safer.
    const rows = JSON.parse(readFileSync(process.argv[2]!, "utf8")) as
        { lang: string; wav: string; text: string }[];
    writeFileSync(process.argv[3]!, JSON.stringify(
        rows.map((r) => [r.lang, r.wav, readText(r.text, r.lang)])));
    console.error(`read_text: derived ${rows.length}`);
}
