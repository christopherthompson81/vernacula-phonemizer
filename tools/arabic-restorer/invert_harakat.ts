/**
 * g2p-inversion silver-labeler — mine harakat (short-vowel) labels for a rider language that has a deterministic
 * g2p but no diacritized corpus. For each wikipron (skeleton, IPA) pair we SEARCH the harakat vocalization of the
 * skeleton whose full phonemizer output reproduces the reference IPA (under the referee-eval fold). That winning
 * vocalization is the silver harakat label — training data the restorer otherwise could not get for the riders.
 *
 * The fold preserves vowel QUALITY (it only strips stress/tone/length + folds ɾ→r ʋ→w degemination final-ə), so a
 * fold-match pins down the correct short vowel; gemination is fold-neutralized, so shadda is not searched. Proven
 * here on Punjabi Shahmukhi (pa) against the 1,360-word pan_arab reference. Run: npx tsx invert_harakat.ts pa
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { phonemizeWord as pa } from "../../src/languages/punjabi/punjabi.ts";
import { makeFold } from "../referee-eval/eval.ts";
import { CONFIG } from "../referee-eval/config.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

// Per-language config: the phonemizer, and the Perso-Arabic letter classes for slot-finding. Only pa is wired now;
// ur/ps/fa/ar slot in the same way once their bare phonemizeWord is exported.
const LANGS: Record<
    string,
    { phon: (w: string) => string; silverCode: string; cons: string; vowelLetters: string }
> = {
    pa: {
        phon: pa,
        silverCode: "pan", // wikipron ISO 639-3 tag in silver.tsv
        cons: "بپتٹثجچحخدڈذرڑزژسشصضطظغفقکگلمنہھءعݨࣇ",
        vowelLetters: "اآویےئؤ",
    },
};

const FATHA = "َ", KASRA = "ِ", DAMMA = "ُ", SUKUN = "ْ";
const HARAKAT = [FATHA, KASRA, DAMMA, SUKUN]; // a / i / u / no-vowel — the search options per slot
const MAX_SLOTS = 7; // 4^7 = 16384 candidates; longer words are reported as capped

/** Indices of consonants that take a harakat slot: a consonant NOT immediately followed by a written vowel letter
 *  (word-final, or before another consonant/nasalizer) has an ambiguous short vowel. */
function slots(chars: string[], cfg: { cons: string; vowelLetters: string }): number[] {
    const out: number[] = [];
    for (let i = 0; i < chars.length; i++) {
        if (!cfg.cons.includes(chars[i]!)) continue;
        const next = chars[i + 1];
        if (next === undefined || !cfg.vowelLetters.includes(next)) out.push(i);
    }
    return out;
}

/** Build the vocalized skeleton for one assignment of harakat to the slots. */
function vocalize(chars: string[], slotIdx: number[], choice: number[]): string {
    const ins = new Map<number, string>();
    slotIdx.forEach((pos, k) => ins.set(pos, HARAKAT[choice[k]!]!));
    let out = "";
    for (let i = 0; i < chars.length; i++) {
        out += chars[i];
        const h = ins.get(i);
        if (h) out += h;
    }
    return out;
}

function main(): void {
    const lang = process.argv[2] ?? "pa";
    const cfg = LANGS[lang];
    if (!cfg) throw new Error(`no inversion config for "${lang}"`);
    const fold = makeFold(CONFIG[lang]!);

    const rows = readFileSync(join(HERE, "silver.tsv"), "utf8")
        .split("\n")
        .map((l) => l.split("\t"))
        .filter((a) => a.length >= 3 && a[1] === cfg.silverCode);

    const labeled: string[] = [];
    let ok = 0, capped = 0, miss = 0;
    for (const [skel, , ipa] of rows) {
        const chars = [...skel!.normalize("NFC")];
        const sl = slots(chars, cfg);
        if (sl.length > MAX_SLOTS) { capped++; continue; }
        const target = fold(ipa!);
        let found: string | null = null;
        const total = 4 ** sl.length;
        for (let n = 0; n < total && !found; n++) {
            // n → base-4 digits = the harakat choice per slot
            const choice: number[] = [];
            let x = n;
            for (let k = 0; k < sl.length; k++) { choice.push(x & 3); x >>= 2; }
            const voc = vocalize(chars, sl, choice);
            if (fold(cfg.phon(voc)) === target) found = voc;
        }
        if (found) { ok++; labeled.push(`${skel}\t${lang}\t${found}`); }
        else miss++;
    }

    const out = join(HERE, `harakat.${lang}.silver.tsv`);
    writeFileSync(out, labeled.join("\n") + (labeled.length ? "\n" : ""));
    const tot = rows.length;
    console.log(`${lang}: ${tot} reference words`);
    console.log(`  labeled (g2p reproduces the reference IPA): ${ok}  (${(100 * ok / tot).toFixed(1)}%)`);
    console.log(`  no vocalization matched:                    ${miss}  (${(100 * miss / tot).toFixed(1)}%)`);
    console.log(`  skipped (>${MAX_SLOTS} ambiguous slots):             ${capped}`);
    console.log(`  wrote ${labeled.length} silver harakat pairs -> ${out.replace(HERE + "/", "")}`);
}

main();
