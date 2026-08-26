/**
 * Build the Danish pronunciation lexicon (data/languages/danish/da-lexicon.tsv) from the en.wiktionary Danish IPA
 * referee. Danish vowel quality / soft-d,g / reduction / stress are largely UNRECOVERABLE from spelling by rule
 * (the deepest European orthography), so a word→IPA lexicon is the primary path; the rule g2p (danish.ts) is the OOV
 * fallback. Each raw narrow transcription is NORMALISED to canonical Danish IPA by stripping the suprasegmental /
 * notation layer (stress, STØD ˀ, length, aspiration, voiceless diacritics, syllable dots, optional-parens,
 * non-syllabic offglide marks) while keeping the segmental phonemes (ʁ ð ɛ ɔ ə ɐ ŋ …). The lexicon ships CANONICAL
 * IPA; it is NOT the eval referee (the referee-eval measures the RULE engine on the full set — non-circular).
 *
 *   npx tsx tools/gen/build-da-lexicon.mts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO = resolve(import.meta.dirname, "..", "..");
const SRC = resolve(REPO, "tools/referee-eval/referees/da.wiktionary-da.tsv");
const OUT = resolve(REPO, "data/languages/danish/da-lexicon.tsv");

// Strip the suprasegmental / narrow-notation layer, keep the segmental phonemes → canonical Danish IPA.
function normalize(ipa: string): string {
    return ipa
        .normalize("NFD")
        .replace(/[̀-ͯ]/gu, "") // combining diacritics (voiceless ̥, non-syllabic ̯, raised ̝, retracted ̠, tone accents)
        // KEEP ˈ/ˌ (real stress — the lexicon ships accurate stress; the eval folds it for the non-circular rule path)
        .replace(/ˀ/gu, "") // STØD (glottalisation) — suprasegmental, deferred
        .replace(/[ːˑ]/gu, "") // length / half-length
        .replace(/[ʰˢ]/gu, "") // aspiration / t-affrication
        .replace(/[.()]/gu, "") // syllable dots + optional-segment parens
        .replace(/\s+/gu, "")
        .normalize("NFC");
}

const rows = readFileSync(SRC, "utf8").split("\n").filter((l) => l.trim() && !l.startsWith("#"));
const seen = new Set<string>();
const out: string[] = [];
let skipped = 0;
for (const line of rows) {
    const [word, ipa] = line.split("\t");
    if (!word || !ipa) continue;
    const w = word.toLowerCase();
    // Only single Latin-alphabet words (skip abbreviations, apostrophes, multi-word, digits).
    if (!/^[a-zæøåéöäü]+$/u.test(w) || w.length < 2) { skipped++; continue; }
    const canon = normalize(ipa);
    if (!canon || seen.has(w)) continue; // first spelling wins (Wiktionary lists the lemma pronunciation first)
    seen.add(w);
    out.push(`${w}\t${canon}`);
}
out.sort();
writeFileSync(OUT, out.join("\n") + "\n");
console.log(`wrote ${out.length} lexicon entries → ${OUT} (skipped ${skipped} non-word/abbrev)`);
