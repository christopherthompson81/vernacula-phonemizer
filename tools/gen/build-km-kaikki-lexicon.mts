/**
 * Build data/languages/khmer/km-lexicon-kaikki.tsv — the THIRD-TIER Khmer lexicon, from the kaikki.org
 * extraction of en.wiktionary's Khmer entries.
 *
 * Run: npx tsx tools/gen/build-km-kaikki-lexicon.mts <kaikki.org-dictionary-Khmer.jsonl>
 *   source: https://kaikki.org/dictionary/Khmer/ — en.wiktionary content, CC BY-SA 4.0 (§3 fence).
 *
 * ## What this tier is, and is not
 *
 * kaikki is the SAME Wiktionary lineage as the wikipron referee — a different scrape of the same tradition,
 * NOT an independent source. That is exactly why it is safe as a lexicon and useless as a referee: its value
 * is COVERAGE (words our wikipron file lacks — newer entries, compounds written solid), and every word it
 * shares with wikipron is already settled there. Three gates keep the tiers disjoint and honest:
 *
 *   · ONLY words absent from the wikipron referee (a wikipron word is either in km-lexicon.tsv because the
 *     rules disagree, or the rules already match — either way adding it here is dead weight or a regression)
 *   · ONLY words where the RULES disagree with the converted reading (the exceptions principle: a row that
 *     restates what the rules derive is dead weight)
 *   · ONLY rows whose conversion is CLEAN (leftover Latin letters → the romanization was malformed → reject)
 *
 * ## The romanization, its artifact, and the conversion
 *
 * kaikki's wiktextract does NOT expand {{km-IPA}} (2 of 11,257 entries carry `sounds` IPA), but the headword
 * carries the human-curated phonemic romanization ("kampuciə"). ⚠ MANY FORMS ARRIVE FUSED WITH THE INITIAL
 * LETTER'S NAME — "kɑɑkɑkɑɑ" is kɑɑ (the name of ក) + kɑkɑɑ, an upstream template-expansion artifact — so a
 * leading C+ɑɑ/ɔɔ is stripped when the remainder repeats the onset consonant.
 *
 * The mapping below was derived by ITERATION AGAINST WIKIPRON on the 6,564-word overlap (the method every km
 * conversion in this repo used): 88.5% raw → 96.0% after the letter-name de-fusion → **97.7%** after
 * oy→oj, ɔə→oə and gemination variance. The residual is the lexical ə~e / ɨ~i zone wikipron itself varies on
 * — NOT unclosed notation, and far above the dict tier's 78% inter-source bar.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** en.wiktionary Khmer romanization → this project's IPA. Order is load-bearing (digraphs before letters,
 *  diphthongs before doubling, the vowel-context ʋ before the coda w fallback). */
const PAIRS: [RegExp, string][] = [
    // breve short-vowel notation → plain FIRST: the shipped tiers (km-lexicon.tsv, km-lexicon-dict.tsv)
    // carry none, so this tier must not either — the eval folds them anyway, this is output consistency.
    [/ŏ/gu, "o"], [/ŭ/gu, "u"], [/ĕ/gu, "e"],
    [/ngh/gu, "ŋh"], [/ng/gu, "ŋ"], [/ñ/gu, "ɲ"],
    [/chh/gu, "cʰ"], [/ch/gu, "c"],
    [/th/gu, "tʰ"], [/ph/gu, "pʰ"], [/kh/gu, "kʰ"],
    [/aa/gu, "aː"], [/ɑɑ/gu, "ɑː"], [/ee/gu, "eː"], [/əə/gu, "əː"], [/ii/gu, "iː"],
    [/oo/gu, "oː"], [/uu/gu, "uː"], [/ɛɛ/gu, "ɛː"], [/ɔɔ/gu, "ɔː"], [/ɨɨ/gu, "ɨː"],
    [/ei/gu, "ei"], [/ae/gu, "ae"], [/ao/gu, "ao"], [/au/gu, "aw"], [/ɔə/gu, "oə"],
    [/ay/gu, "aj"], [/oy/gu, "oj"], [/uy/gu, "uj"],
    [/[']/gu, "ʔ"], [/ʼ/gu, "ʔ"],
    [/y/gu, "j"], [/d/gu, "ɗ"], [/b(?!ʰ)/gu, "ɓ"], [/g/gu, "ɡ"],
    [/v(?=[aeiouəɑɨɔɛ])/gu, "ʋ"], [/v/gu, "w"],
];
export function convertKaikki(s: string): string {
    let x = s.replace(/\s+/gu, "");
    for (const [re, rep] of PAIRS) x = x.replace(re, rep);
    return x.normalize("NFC");
}
/** Strip the fused letter-name prefix when present ("kɑɑkɑkɑɑ" → "kɑkɑɑ"). */
export function defuse(r: string): string {
    const m = /^([kctnpmjrlvshdbñ]h?|ng|ch|th|ph|kh|ʼ)(?:ɑɑ|ɔɔ)(.+)$/u.exec(r);
    return m && m[2]!.startsWith(m[1]!) ? m[2]! : r;
}

const src = process.argv[2];
const isEntryPoint = process.argv[1] !== undefined
    && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isEntryPoint && src === undefined) {
    console.error("usage: build-km-kaikki-lexicon.mts <kaikki.org-dictionary-Khmer.jsonl>");
    process.exit(2);
}
if (isEntryPoint && src !== undefined) main(src);

function main(src: string): void {
    const here = dirname(fileURLToPath(import.meta.url));
    const KHMER_WORD = /^[ក-៓ៜ-៝]+$/u;

    /** Every wikipron word is settled — either in km-lexicon.tsv or rules-correct by construction. */
    const settled = new Set<string>();
    for (const l of readFileSync(join(here, "../referee-eval/referees/km.wikipron-khm-broad.tsv"), "utf8").split("\n"))
        if (!l.startsWith("#") && l.includes("\t")) settled.add(l.split("\t")[0]!);

    const roms = new Map<string, string[]>();
    for (const line of readFileSync(src, "utf8").split("\n")) {
        if (!line.trim()) continue;
        const e = JSON.parse(line) as { word?: string; forms?: { form: string; tags?: string[] }[] };
        const w = e.word ?? "";
        if (!KHMER_WORD.test(w) || settled.has(w)) continue;
        for (const f of e.forms ?? [])
            if (f.tags?.includes("romanization") && !roms.get(w)?.includes(f.form))
                roms.set(w, [...(roms.get(w) ?? []), f.form]);
    }

    // The rules, imported lazily so `convertKaikki` stays importable without dragging the engine in.
    void (async () => {
        const { phonemizeWordRules } = await import("../../src/languages/khmer/khmer.ts");
        const { makeFold } = await import("../referee-eval/eval.ts");
        const { CONFIG } = await import("../referee-eval/config.ts");
        const fold = makeFold(CONFIG.km!);

        const rows: [string, string][] = [];
        let skippedAgree = 0, skippedDirty = 0;
        for (const [w, rs] of roms) {
            const ipa = convertKaikki(defuse(rs[0]!));
            // The mapping consumes every b/d/g/v/y and can never emit f/q/x/z — any survivor means the
            // romanization was malformed (truncated template, stray English), so the row is rejected.
            if (/[bdfgqvxyz]/u.test(ipa)) { skippedDirty++; continue; }
            if (fold(phonemizeWordRules(w)) === fold(ipa)) { skippedAgree++; continue; } // rules already right
            rows.push([w, ipa]);
        }
        rows.sort((a, b) => a[0].localeCompare(b[0]));

        const out = join(here, "../../data/languages/khmer/km-lexicon-kaikki.tsv");
        writeFileSync(out, `# Khmer THIRD-TIER lexicon — word → IPA, from en.wiktionary via kaikki.org.
#
# SOURCE:  https://kaikki.org/dictionary/Khmer/ (wiktextract of en.wiktionary)
# LICENSE: CC BY-SA 4.0 — Wiktionary content; see LICENSES/PROVENANCE.md §3 (share-alike fence).
#
# ⚠ SAME LINEAGE AS THE WIKIPRON REFEREE (both are en.wiktionary), which is why it is a LEXICON and can never
#   be a referee. Its value is coverage: words the wikipron scrape lacks — newer entries and compounds written
#   solid. It contains NO word the referee covers (those are settled: km-lexicon.tsv or rules-correct), and
#   ONLY words where the rules disagree with the converted reading (the exceptions principle).
# ⚠ CONSULTED AFTER km-lexicon.tsv AND BEFORE km-lexicon-dict.tsv: wikipron-verified wins, then same-lineage
#   human readings, then the converted Google dictionary, then rules.
# ⚠ NOT IPA from {{km-IPA}} — wiktextract does not expand it — but the human-curated headword romanization,
#   converted by tools/gen/build-km-kaikki-lexicon.mts (validated 97.7% against wikipron on 6,564 shared words).
#
# Regenerate: npx tsx tools/gen/build-km-kaikki-lexicon.mts <kaikki.org-dictionary-Khmer.jsonl>
# ENTRIES: ${rows.length}
${rows.map(([w, p]) => `${w}\t${p}`).join("\n")}\n`, "utf8");
        console.log(`  kept ${rows.length} entries (rules disagree, non-referee, clean)`);
        console.log(`  skipped ${skippedAgree} where the rules already match, ${skippedDirty} malformed romanizations`);
        console.log(`  → ${out}`);
    })();
}
