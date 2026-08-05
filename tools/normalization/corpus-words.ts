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

const code = arg("lang");
const words = (arg("words") ?? "").split(",").map((w) => w.trim().toLowerCase()).filter((w) => w !== "");
const nExamples = Number(arg("examples", "2"));
if (code === undefined || words.length === 0) {
    console.error("usage: --lang <code> --words \"a,b c,d\" [--examples N]");
    process.exit(2);
}

const utts = utterances(code);
const spaceless = utts.some((u) => SPACELESS.test(u));
// One flat token set for the boundary test, and the joined text for the substring count.
const toks = new Map<string, number>();
// ⚠ U+200C ZWNJ IS WORD-INTERNAL, NOT A SEPARATOR. Persian writes compounds with a zero-width non-joiner —
// سانتی‌گراد (Celsius), می‌شود — and splitting on it reported `سانتی‌گراد` as `substring-only`, i.e. as a
// NEGATIVE, while the corpus contains it twice in exactly the slot being probed (`۳۰ درجه سانتی‌گراد`). The
// phrase count is what exposed it: 0 token / 2 phrase is incoherent unless the tokenizer is wrong.
for (const u of utts) for (const t of u.split(/[^\p{L}\p{M}‌'’-]+/u)) if (t !== "") toks.set(t, (toks.get(t) ?? 0) + 1);

console.log(`${code}: ${utts.length} utterances, ${toks.size} distinct tokens${spaceless ? "  ⚠ SPACELESS SCRIPT — substring IS the hit test" : ""}`);
for (const w of words) {
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
