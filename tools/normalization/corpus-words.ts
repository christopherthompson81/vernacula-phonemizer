/**
 * TIER-2 WORD COUNTER — "is this vocabulary real in this language?", asked of the FLEURS corpus.
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
import { parseJsonc } from "../../src/core/jsonc.ts";
import { dominantScript } from "./scripts.ts";
import { join } from "node:path";

const CORPUS_ROOT = process.env["FLEURS"] ?? "";

const argv = process.argv.slice(2);
const arg = (n: string, d?: string): string | undefined => {
    const i = argv.indexOf(`--${n}`);
    return i === -1 ? d : argv[i + 1];
};

/** Scripts written without spaces, where the boundary test measures the markup rather than the language. */
/** The scripts that write no word space — named as `scripts.ts` names them, so the two cannot drift. */
const SPACELESS_SCRIPTS = new Set(["Han", "Hiragana", "Katakana", "Thai", "Lao", "Khmer", "Tibetan", "Myanmar"]);

/** Every utterance in this language's corpus — the normalized transcript column, one per line. */
/**
 * ⚠ "ABSENT" MUST MEAN "LOOKED AND DID NOT FIND", NOT "HAD NOWHERE TO LOOK. This tool is the tier-2 gate — the
 * one #654 treats as the strongest text source and uses to decide whether a language's vocabulary is real — and
 * for a language with no FLEURS corpus it reported, verbatim:
 *
 *     km: 0 utterances, 0 distinct tokens
 *       ភាគរយ      absent      phrase ×0
 *
 * about words whose true counts in that language's own mined corpus are 445 (percent), 712 (dollar) and 172
 * (degree). The verdict said ABSENT, not "no corpus", so it is indistinguishable from a real negative — and a
 * real negative here is what drives an "attested nowhere" conclusion for a whole sign class.
 *
 * ⚠ AND THE ARTIFACT IS NOT A SUBSTITUTE FOR A CORPUS ON COUNTS. It holds a few hundred lines — an adversarial
 * hard-set plus a strided sample — against a mined corpus of a hundred thousand segments. So it answers
 * ATTESTATION ("this word is real in this language") and must never be read as frequency: a count of 2 here is
 * not evidence of rarity. `--text <file>` points at a full extracted corpus when one is on disk, which is the
 * only way to get a trustworthy count for these languages.
 */
function minedUtterances(code: string): string[] {
    const art = new URL(`../corpus/mined/${code}.jsonc`, import.meta.url).pathname;
    if (!existsSync(art)) return [];
    const doc = parseJsonc(readFileSync(art, "utf8")) as { hard?: { text: string }[]; sample?: string[] };
    return [...(doc.hard ?? []).map((h) => h.text), ...(doc.sample ?? [])];
}

function utterances(code: string): string[] {
    const local = arg("text");
    if (local !== undefined) return readFileSync(local, "utf8").split("\n").filter((l) => l !== "");
    if (!existsSync(CORPUS_ROOT)) return minedUtterances(code);
    const dirs = readdirSync(CORPUS_ROOT).filter((c) => c === code || c.startsWith(`${code}_`));
    if (dirs.length === 0) return minedUtterances(code);
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
 * `--sentence <regex>` — THE PARALLEL-CORPUS MODE, and the strongest sourcing route this issue found.
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
/**
 * ⚠ IS THIS CORPUS DOMINANTLY A SPACELESS SCRIPT — not "does it contain one such character anywhere".
 *
 * This was `utts0.some((u) => SPACELESS.test(u))`, and `some` is catastrophically the wrong quantifier: ONE
 * katakana character anywhere in the corpus flipped the whole language into spaceless mode, stripping every space
 * and switching the hit test to substring matching. Igbo — Latin script, spaces and all — tripped it on 2,472 of
 * 558,991 lines (0.44%), all from a Digimon article quoting デジモン. Its token counts then collapsed (otu 294
 * tokens instead of thousands) while substring counts inflated to 129,808, and every numeral probe came back
 * "attested, only 0.2% whole word" — meaningless.
 *
 * 69 of the fleet's 154 mined artifacts contain at least one CJK/SEA character, so 69 languages were being measured
 * this way. Any Wikipedia that mentions a Japanese name qualifies.
 *
 * `dominantScript` (scripts.ts) already answers the right question, and answers it from the corpus rather than a
 * language→script table. Reused here rather than re-deriving it.
 */
const dominant = dominantScript(utts0.join("\n").slice(0, 400_000));
const spaceless = dominant !== undefined && SPACELESS_SCRIPTS.has(dominant);
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
/**
 * ⚠ THE STRIPPED TEXT MUST NOT BE WHAT THE READER IS SHOWN. Space-removal is right for the substring TEST (see
 * above) and wrong for the EXAMPLES, because it hides the one thing the reader needs to judge the hit: whether the
 * match spanned a space that was really there.
 *
 * Measured cost of getting this wrong. Probing km for `បូកដក` ("plus-minus") reported `attested* phrase ×4`, and
 * the three examples it printed read `ប្រមាណវិធីបូកដកគុណចែក` — which looks like a compound. The corpus actually
 * says `ប្រមាណវិធីបូក ដក គុណ ចែក`: "operations: add, subtract, multiply, divide", a LIST of four operations. All
 * four hits were space-spanning, the compound does not occur, and a reading was declared on that evidence and
 * shipped. Reading the examples could not have caught it, because the examples were stripped too.
 */
const origOf = new Map<string, string>();
if (spaceless) for (let i = 0; i < utts.length; i++) origOf.set(utts[i]!, utts0[i]!);
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
    // How many phrase hits exist ONLY because the spaces were removed? Those are the weakest possible evidence:
    // the characters are adjacent in the corpus but a writer put a boundary between them.
    const hitsAll = utts.filter((u) => u.includes(w));
    const spanning = spaceless ? hitsAll.filter((u) => !(origOf.get(u) ?? u).includes(w)).length : 0;

    /**
     * ⚠ A SUBSTRING HIT IN A SPACELESS SCRIPT IS THE WEAKEST EVIDENCE THERE IS, AND USED TO GET THE STRONGEST
     * LABEL. This branch printed `attested*` while the SPACED branch, on identical evidence, printed the honest
     * `substring-only` — inverted, because in a spaceless script every real word is a substring of running text,
     * so the test discriminates less, not more. The asterisk carried the entire warning and an asterisk is easy to
     * skip: `យ័ន` scored `attested* ×521` (every hit inside បាយ័ន/អារ្យ័ន) and `បូកដក` `attested* ×4` (every hit
     * a space-spanning list), and both were written into shipped code as attestations. The playbook's own index
     * says "a count is a lead, never a finding — read the instances"; the label was arguing the opposite.
     */
    // ⚠ TOKEN HITS COUNT EVEN IN A SPACELESS SCRIPT, and the first version of this fix forgot that — it labelled
    // `ស្មើ` (283 TOKEN hits, the equals word this layer ships) as `substring-only?`. Khmer does have boundaries:
    // writers type U+200B and spaces, so the token set is real evidence, just sparser. A gate that flags a
    // genuinely attested word is a gate that gets ignored, which would trade one failure mode for a worse one.
    const verdict = spaceless
        ? (per.every((x) => x.tok > 0) ? "attested"
            : !per.every((x) => x.sub > 0) ? "absent"
            : spanning === hitsAll.length && hitsAll.length > 0 ? "SPACE-SPANNING"
            : "substring-only?")
        : (per.every((x) => x.tok > 0) ? "attested" : per.some((x) => x.sub > 0) ? "substring-only" : "absent");
    const detail = per.map((x) => `${x.p} ${x.tok}t/${x.sub}s`).join("  ");
    const span = spanning > 0 ? `  ⚠ ${spanning}/${hitsAll.length} span a space` : "";
    /**
     * ⚠ A WORD CAN BE "ATTESTED" AND STILL BE MOSTLY SOMETHING ELSE. `យ័ន` has 7 token hits against 543 substring
     * hits — 1.3% — because almost every occurrence is inside បាយ័ន (the Bayon temple) or អារ្យ័ន (Aryan). The
     * token count alone said attested and it was read as evidence for a currency word it is not.
     *
     * ⚠ AND THE THRESHOLD IS CALIBRATED, NOT GUESSED. A first attempt used 10% and fired on `គុណ` — 8.1%, but 354
     * token hits and the word this layer ships for `×`. The ratio is CONFOUNDED: a token hit needs a writer to have
     * marked BOTH boundaries, which happens for only ~15% of boundaries in this corpus, so a real word's ratio is
     * depressed by annotation habit rather than by usage. A gate that flags real words is a gate that gets ignored.
     *
     * Measured over nine words this layer actually ships, against the known-bad case:
     *     គីឡូម៉ែត្រ 28.3%  អឺរ៉ូ 18.5%  ភាគរយ 18.4%  ដុល្លារ 16.7%  ស្មើ 10.9%  ចែក 10.7%
     *     គុណ 8.1%  បូក 5.4%  ដក 5.3%          ← real words, floor 5.3%
     *     យ័ន 1.3%                              ← the one that was wrong
     * 3% sits between them with margin on both sides.
     */
    const BURIED_RATIO = 0.03;
    const tokSum = per.reduce((n, x) => n + x.tok, 0), subSum = per.reduce((n, x) => n + x.sub, 0);
    const buried = tokSum > 0 && subSum >= 20 && tokSum / subSum < BURIED_RATIO
        ? `  ⚠ only ${(100 * tokSum / subSum).toFixed(1)}% of occurrences are the whole word — mostly inside others`
        : "";
    console.log(`  ${w.padEnd(24)} ${verdict.padEnd(15)} phrase ×${String(phrase).padEnd(4)} ${detail}${span}${buried}`);
    // Examples come from the ORIGINAL text — spaces intact — so a space-spanning hit is visible as one.
    for (const u of hitsAll.slice(0, nExamples)) console.log(`      · ${(origOf.get(u) ?? u).slice(0, 150)}`);
}
