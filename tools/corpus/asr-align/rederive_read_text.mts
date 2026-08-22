/**
 * Re-derive `ipa` from `read_text` — the missing half of that column's contract.
 *
 * ⚠ THE CONTRACT WAS DOCUMENTED AND UNIMPLEMENTED. `read_text.py` says "ipa is derived from read_text",
 * `--set` clears `ipa` so the gap is visible, and `--stale` LISTS the rows awaiting re-derivation — but
 * nothing re-derived them. A hand correction therefore parked its row outside scoring indefinitely
 * (every scorer filters `ipa IS NOT NULL`), which is safe but permanent. This closes it.
 *
 * ⚠ IT IS NOT `phonemize-fleurs.mts`. That pass reads the FLEURS TSV and re-derives the auto repair from
 * scratch, so it cannot see a hand `read_text` at all. This one reads the stored text and nothing else —
 * which is the only way a human edit survives a re-run.
 *
 * The text transform is here and the database is Python's, matching read_text.mts / read_text.py:
 *
 *   python3 read_text.py --export-pending /tmp/pending.tsv
 *   npx tsx rederive_read_text.mts /tmp/pending.tsv /tmp/ipa.tsv
 *   python3 read_text.py --import-ipa /tmp/ipa.tsv
 */
import { readFileSync, writeFileSync } from "node:fs";

import { getPhonemizer } from "../../../src/registry.ts";
import { phonemizeAsync } from "../../../src/index.ts";
import { codeSwitchSegments, stripCodeSwitch } from "../code_switch.mts";
import { registryCode } from "./read_text.mts";

/**
 * Hosts whose ˈ marks a PHRASE, not a word — so a mid-sentence segment boundary must not create one.
 * ⚠ Established by measurement, not by reading grammars: for every language with code-switch rows,
 * phonemize a fragment and the same words inside a longer utterance and compare the ˈ count. Only
 * French differs. Re-run that check before adding an entry.
 */
const PHRASE_FINAL_STRESS = new Set(["fr"]);

/** Does the registry own this code? The switch has no exported key set, so resolution IS the test. */
const KNOWN = new Map<string, boolean>();
function isKnownLang(code: string): boolean {
    const hit = KNOWN.get(code);
    if (hit !== undefined) return hit;
    let ok = true;
    try { getPhonemizer(code); } catch { ok = false; }
    KNOWN.set(code, ok);
    return ok;
}

const [, , inPath, outPath] = process.argv;
if (!inPath || !outPath) {
    console.error("usage: rederive_read_text.mts <pending.tsv> <ipa.tsv>   # cols: lang<TAB>wav<TAB>read_text");
    process.exit(2);
}

const out: string[] = [];
const errs: string[] = [];
let n = 0;
for (const line of readFileSync(inPath, "utf8").split("\n")) {
    if (!line.trim()) continue;
    const [lang, wav, text] = line.split("\t");
    if (!lang || !wav || !text) continue;
    n++;
    // ⚠ THE DB HOLDS FLEURS CODES (`ceb_ph`), THE REGISTRY HOLDS `ceb` — and four of them are not a prefix
    //   split (ar_eg→arz, fil_ph→tl, ny_mw→nya, es_419→es-419). Shared with read_text.mts, not re-declared.
    const reg = registryCode(lang);
    try {
        // ⚠ SEGMENTS, NOT A STRING. A `{en:…}` span must reach the ENGLISH engine; handing the host its
        //   spelling is a misreading and handing it IPA is destroyed on re-parse. See code_switch.mts.
        const segs = codeSwitchSegments(text, reg, isKnownLang);
        const parts = await Promise.all(segs.map((s) => phonemizeAsync(s.text, s.lang ?? reg)));
        // ⚠ A HOST SEGMENT IS A FRAGMENT, NOT AN UTTERANCE, and a language that marks PHRASE-final
        // prominence stresses the end of every fragment. Measured across all ten languages that have
        // code-switch rows, exactly one does: French puts one ˈ on the last syllable of each prosodic
        // phrase, so `à la {en:crown court}` gave `a lˈa …` where the whole sentence gives `a la …` —
        // the phrase does not end at "la", it continues into the span. ha/ceb/hr/ff mark LEXICAL stress
        // (same marks on the same words either way) and umb/ig/mi/sn mark none, so none of them is
        // touched. ⚠ `fold()` STRIPS ˈ, so no QC metric could ever see this; it surfaces only in the
        // training corpus, where prosody is the product.
        for (let i = 0; i < segs.length; i++) {
            if (segs[i]!.lang || !PHRASE_FINAL_STRESS.has(reg)) continue;   // spans keep their own
            if (i === segs.length - 1) continue;                            // really is utterance-final
            // ⚠ Punctuation ends a phrase for real — "il mange, {en:then}" keeps its stress on mange.
            if (/[,;:.!?…»)\]]\s*$/u.test(segs[i]!.text)) continue;
            const k = parts[i]!.lastIndexOf("\u02C8");
            if (k >= 0) parts[i] = parts[i]!.slice(0, k) + parts[i]!.slice(k + 1);
        }
        // ⚠ `tight` segments join with NO space — a span inside a word (Shona `ma{en:neutron}`) must not
        //   invent a word break. See CodeSwitchSegment.tight.
        const ipa = parts.reduce((acc, p, i) =>
            p ? (acc === "" ? p : acc + (segs[i]!.tight ? "" : " ") + p) : acc, "")
            .replace(/\s+/gu, " ").trim();
        if (ipa) out.push(`${lang}\t${wav}\t${ipa}`);
        else errs.push(`${lang}\t${wav}\tEMPTY`);
    } catch (e) {
        // Report the READING, not the markup: an operator fixing this needs to see what was attempted.
        errs.push(`${lang}\t${wav}\t${(e as Error).message.replace(/[\r\n\t]+/gu, " ").slice(0, 160)}` +
            `\t${stripCodeSwitch(text).slice(0, 80)}`);
    }
}
writeFileSync(outPath, out.join("\n") + (out.length ? "\n" : ""), "utf8");
console.error(`# ${out.length}/${n} re-derived → ${outPath}`);
if (errs.length) {
    console.error(`# ⚠ ${errs.length} FAILED — these rows keep ipa NULL and stay out of scoring:`);
    for (const e of errs.slice(0, 10)) console.error(`#   ${e}`);
}
