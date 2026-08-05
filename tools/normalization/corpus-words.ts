/**
 * TIER-2 WORD COUNTER (#654) — "is this vocabulary real in this language?", asked of the FLEURS corpus.
 *
 * ## Why this is a separate tool from `attest.ts`
 *
 * `attest.ts` asks Wikipedia whether a word EXISTS. This asks the audio-aligned corpus whether the word is
 * SPOKEN — a stronger source, and the one `review.ts` already treats as the top haystack tier. The two answer
 * different questions and the #654 pilot showed the order matters: German Wikipedia's only hit for `größer als`
 * was a film title, while the corpus had `kleiner als` seven times in ordinary prose.
 *
 * ## ⚠ THE MISTAKE THIS TOOL EXISTS TO PREVENT: SEARCHING FOR THE SIGN
 *
 * The first pass at #654 grepped the corpora for `=`, `<`, `>`, `÷` and concluded the corpus could not source
 * them. That is true and useless. Every `<` in the fleet is an HTML tag, `=` is LaTeX residue — but the READINGS
 * are ordinary comparative prose (`less than`, `divided by`), and those words are in the corpus in quantity.
 * *Search for the words, never for the notation.*
 *
 * ## ⚠ A SUBSTRING MATCH IS NOT AN ATTESTATION
 *
 * Same rule as `attest.ts`, and it has now been made and caught six times. German `gleich` has 107 raw hits and
 * 104 of them are inside `Vergleich` / `gleichzeitig`; only 3 are the standalone word. The substring column is
 * printed anyway, because `3 token / 107 substring` is what teaches you your grep was lying.
 *
 * For an unspaced script (cmn, yue, ja, th, lo, km, bo) there are no word boundaries to test, so the substring
 * count IS the hit test — flagged `*` in the output, exactly as `attest.ts` does, rather than laundered.
 *
 * ## ⚠ PHRASE-LEVEL ATTESTATION IS TOO STRICT A BAR FOR A CONSTRUCTION
 *
 * A multi-word candidate is counted three ways: the exact phrase, and each word separately. German `größer als`
 * has ZERO phrase hits while `größer` ×10 and `als` ×606 — the construction is ADJ + than, and the sibling
 * `kleiner als` ×7 proves the construction. Demanding the exact pair would reject a reading the corpus fully
 * supports, so all three counts are printed and the verdict is left to the reader.
 *
 * Usage:
 *   npx tsx tools/normalization/corpus-words.ts --lang es --words "igual a,menor que,mayor que,dividido entre"
 *   npx tsx tools/normalization/corpus-words.ts --lang de --words gleich --examples 5
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const CORPUS_ROOT = process.env["FLEURS"] ?? "/mnt/data/omnivoice_ipa/corpus/fleurs_transcripts/data";

const argv = process.argv.slice(2);
const arg = (n: string, d?: string): string | undefined => {
    const i = argv.indexOf(`--${n}`);
    return i === -1 ? d : argv[i + 1];
};

/** Scripts written without spaces, where the boundary test measures the markup rather than the language. */
const SPACELESS = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Tibetan}\p{Script=Myanmar}]/u;

/** Every utterance in this language's corpus — the normalized transcript column, one per line. */
function utterances(code: string): string[] {
    if (!existsSync(CORPUS_ROOT)) throw new Error(`no corpus at ${CORPUS_ROOT} (set $FLEURS)`);
    const dirs = readdirSync(CORPUS_ROOT).filter((c) => c === code || c.startsWith(`${code}_`));
    const out: string[] = [];
    for (const d of dirs)
        for (const f of readdirSync(join(CORPUS_ROOT, d)).filter((f) => f.endsWith(".tsv")))
            for (const line of readFileSync(join(CORPUS_ROOT, d, f), "utf8").split("\n")) {
                // Columns: id · wav · raw · normalized · character-split · samples · gender. The normalized
                // column is the one to search — the raw column carries casing and punctuation that would split
                // a token differently in each utterance.
                const cols = line.split("\t");
                if (cols.length > 3 && cols[3]! !== "") out.push(cols[3]!);
            }
    return out;
}

/**
 * `--sentence <regex>` — THE PARALLEL-CORPUS MODE, and the strongest sourcing route this issue found (#654).
 *
 * FLEURS is a PARALLEL corpus: the same source sentences, translated and recorded per language. So a sentence
 * that PERFORMS the operation you need to read gives you that reading in every language at once, spoken, in the
 * slot, with a real operand — which is tier 2 rather than a Wikipedia existence check.
 *
 * The one that matters here is the aspect-ratio sentence, present in 57 of the 67 corpora:
 *
 *   en  "the aspect ratio of this format DIVIDING BY TWELVE to obtain the simplest whole-number ratio … 3:2"
 *   de  geteilt durch zwölf     vi  chia cho mười hai      th  หารด้วย 12        ta  பன்னிரண்டால் வகுத்தல்
 *   fa  تقسیم بر دوازده          uk  поділене на дванадцять  cy  rannu â deuddeg   ur  سے تقسیم دے کر
 *
 *   npx tsx tools/normalization/corpus-words.ts --sentence '3\s?:\s?2' --all
 *
 * ⚠ A HIT IS A LEAD, NOT A READING, and two languages proved why. The verb is inflected FOR THAT SENTENCE:
 * el writes `διαιρούμενος` (a participle agreeing with `λόγος`) and es writes the infinitive `dividir`, while a
 * sign reading has to be neutral. The sentence tells you WHICH WORD the language uses for the operation; the
 * form still has to be judged per language. Read the output, do not paste it.
 */
const sentence = arg("sentence");
if (sentence !== undefined) {
    const re = new RegExp(sentence, "u");
    const only = arg("lang");
    for (const d of readdirSync(CORPUS_ROOT).sort()) {
        if (only !== undefined && d !== only && !d.startsWith(`${only}_`)) continue;
        const hits = new Set<string>();
        for (const f of readdirSync(join(CORPUS_ROOT, d)).filter((x) => x.endsWith(".tsv")))
            for (const line of readFileSync(join(CORPUS_ROOT, d, f), "utf8").split("\n")) {
                const c = line.split("\t");
                if (c.length > 3 && c[3] !== "" && re.test(c[3]!)) hits.add(c[3]!);
            }
        console.log(`${d.padEnd(14)} ${hits.size === 0 ? "— absent" : [...hits][0]!.slice(0, 220)}`);
    }
    process.exit(0);
}

const code = arg("lang");
const words = (arg("words") ?? "").split(",").map((w) => w.trim().toLowerCase()).filter((w) => w !== "");
const nExamples = Number(arg("examples", "2"));
if (code === undefined || words.length === 0) {
    console.error("usage: --lang <code> --words \"a,b c,d\" [--examples N]");
    process.exit(2);
}

const utts0 = utterances(code);
const spaceless = utts0.some((u) => SPACELESS.test(u));
/**
 * ⚠ A HAN TRANSCRIPT IS SPACED PER CHARACTER, SO A MULTI-CHARACTER WORD NEVER MATCHES AS WRITTEN. FLEURS
 * writes cmn/yue with a space between EVERY character — "此 格 式 的 長 寬 比 除 以 12" — so probing 除以
 * against the raw text returns nothing, and the tool reported Cantonese as having no word for any of the four
 * signs. It has three of them, in the corpus, with numeric operands:
 *
 *     除以 ×2   "長 寬 比 除 以 12"          小於 ×1   "不 會 小 於 50 公 頃"
 *     大於 ×1   "遠 大 於 定 焦 鏡 頭"
 *
 * Fourth manufactured negative this issue has found in its own tooling, and the same shape as the other
 * three: a confident absence with nothing behind it. For an unspaced script the whitespace is not linguistic
 * information at all, so it is removed from BOTH sides before the substring test.
 */
const utts = spaceless ? utts0.map((u) => u.replace(/[ \t]+/gu, "")) : utts0;
// One flat token set for the boundary test, and the joined text for the substring count.
const toks = new Map<string, number>();
// ⚠ U+200C ZWNJ IS WORD-INTERNAL, NOT A SEPARATOR. Persian writes compounds with a zero-width non-joiner —
// سانتی‌گراد (Celsius), می‌شود — and splitting on it reported `سانتی‌گراد` as `substring-only`, i.e. as a
// NEGATIVE, while the corpus contains it twice in exactly the slot being probed (`۳۰ درجه سانتی‌گراد`). The
// phrase count is what exposed it: 0 token / 2 phrase is incoherent unless the tokenizer is wrong.
for (const u of utts) for (const t of u.split(/[^\p{L}\p{M}‌'’-]+/u)) if (t !== "") toks.set(t, (toks.get(t) ?? 0) + 1);

console.log(`${code}: ${utts.length} utterances, ${toks.size} distinct tokens${spaceless ? "  ⚠ SPACELESS SCRIPT — substring IS the hit test" : ""}`);
for (const w0 of words) {
    // The probe loses its spaces too, for the same reason the corpus did.
    const w = spaceless ? w0.replace(/[ \t]+/gu, "") : w0;
    const parts = w.split(/\s+/u);
    const phrase = utts.filter((u) => u.includes(w)).length;
    const per = parts.map((p) => {
        const tok = toks.get(p) ?? 0;
        const sub = utts.reduce((n, u) => n + (u.split(p).length - 1), 0);
        return { p, tok, sub };
    });
    const verdict = spaceless
        ? (per.every((x) => x.sub > 0) ? "attested*" : "absent")
        : (per.every((x) => x.tok > 0) ? "attested" : per.some((x) => x.sub > 0) ? "substring-only" : "absent");
    const detail = per.map((x) => `${x.p} ${x.tok}t/${x.sub}s`).join("  ");
    console.log(`  ${w.padEnd(24)} ${verdict.padEnd(15)} phrase ×${String(phrase).padEnd(4)} ${detail}`);
    for (const u of utts.filter((u) => u.includes(w)).slice(0, nExamples)) console.log(`      · ${u.slice(0, 150)}`);
}
