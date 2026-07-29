/**
 * Persian (fa) short-vowel RESTORATION baseline — the grounding measurement for the abjad→IPA restoration work.
 *
 * fa's referee-eval FOLDS the short vowels away ([eo]→a, short i/u→a) because the current g2p can't restore them
 * (it defaults omitted short vowels to [a]). That folded number (~42%) measures only the CONSONANT + long-vowel
 * skeleton. This tool measures the SAME normalization pipeline TWICE — once WITHOUT the short-vowel folds
 * (UNFOLDED: the real pronunciation, short vowels counted) and once WITH them (FOLDED: the current basis) — so the
 * gap between them is the exact short-vowel restoration HEADROOM on the human abjad→IPA gold.
 *
 *   npx tsx tools/persian/measure.ts
 *
 * Gold: tools/persian/fa-abjad-ipa-gold.tsv (wikipron fas_arab broad, deduped, variants kept). See
 * docs/investigations/fa_shortvowel_restoration_investigation.md.
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { getPhonemizer } from "../../src/registry.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const fa = getPhonemizer("fa");

// Replicate fa.jsonc's normalization: preFolds → shared backbone strip → folds. The SHORT-VOWEL folds
// (i/u/[eo]→a) are applied only in `folded` mode; everything else is notation the referee and we both need.
function norm(s: string, folded: boolean): string {
    let x = s.replace(/[ˈˌ]/gu, ""); // stress
    x = x.replace(/oː/gu, "uː").replace(/eː/gu, "iː"); // long و=uː~oː, ی=iː~eː: unrecoverable long quality (notation)
    if (folded) x = x.replace(/i(?!ː)/gu, "a").replace(/u(?!ː)/gu, "a"); // classical short i/u → a (SHORT-VOWEL fold)
    x = x.replace(/ː/gu, "").replace(/[̀-͢]/gu, ""); // backbone: length + combining diacritics (incl. tie)
    x = x.replace(/(.)\1/gu, "$1").replace(/ɾ/gu, "r").replace(/ɒ/gu, "a"); // geminate, tap, â — notation
    if (folded) x = x.replace(/[eo]/gu, "a"); // short-vowel QUALITY a~e~o (SHORT-VOWEL fold)
    return x;
}

const rows = readFileSync(join(HERE, "fa-abjad-ipa-gold.tsv"), "utf8")
    .split("\n")
    .filter((l) => l.trim() && !l.startsWith("#"))
    .map((l) => l.split("\t"));

let tot = 0;
let unfolded = 0;
let folded = 0;
for (const [w, ...refs] of rows) {
    let ours = "";
    try {
        ours = fa.text(w!);
    } catch {
        /* skip */
    }
    if (!ours) continue;
    tot++;
    const ourU = norm(ours, false);
    const ourF = norm(ours, true);
    if (refs.some((r) => norm(r, false) === ourU)) unfolded++;
    if (refs.some((r) => norm(r, true) === ourF)) folded++;
}

const pct = (n: number): string => ((100 * n) / tot).toFixed(1) + "%";
console.log(`fa abjad→IPA gold: ${tot} words (wikipron fas broad)`);
console.log(`  FOLDED   (short vowels ignored — current eval basis): ${folded} (${pct(folded)})`);
console.log(`  UNFOLDED (short vowels counted — real pronunciation): ${unfolded} (${pct(unfolded)})`);
console.log(`  => short-vowel restoration HEADROOM: ${((100 * (folded - unfolded)) / tot).toFixed(1)} pp`);
