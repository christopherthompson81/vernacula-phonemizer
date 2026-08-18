/**
 * Measure the EMITTED stress placement for sr/hr/bs against the committed wikipron referee.
 *
 * ⚠ THE REFEREE HAS CARRIED THIS ALL ALONG. sr.wikipron-hbs-latn.tsv marks the lexical pitch accent on its own
 * vowels (â ǎ ê ô — its header says so), and referee-eval's BACKBONE strips exactly those marks, so the ordinary
 * eval is blind to stress by construction and nothing else in the repo looks at them. This tool reads them.
 *
 * ⚠ CORRELATED, NOT INDEPENDENT. wikipron and kaikki are two extractions of the same Wiktionary tradition, so
 * this measures whether we USE the source correctly (parse, index, place, script-map), not whether the source is
 * right about the language. It is a build-correctness check, not a linguistic one — worth having, worth not
 * overselling.
 *
 * ⚠ THE ⟨ije⟩ NUCLEUS COUNT DIFFERS ON THE TWO SIDES and is reported separately rather than folded silently:
 * the referee writes Ijekavian ⟨ije⟩ as the glide /j/ (rijeka → r j ěː k a, 2 nuclei) while this g2p, being
 * one-grapheme-one-phoneme, emits /i/ (rijˈeka, 3 nuclei). Our ordinal 1 and its ordinal 0 are the SAME VOWEL;
 * every such word reads as off-by-one and none of them is an error.
 *
 *   npx tsx tools/serbian/eval_stress_placement.mts
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { phonemizeWord } from "../../src/languages/serbian/serbian.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const REF = join(HERE, "..", "referee-eval", "referees", "sr.wikipron-hbs-latn.tsv");
const LEX = join(HERE, "..", "..", "src", "languages", "serbian", "stress.tsv");

const ACC = new Set([0x300, 0x301, 0x30f, 0x311, 0x30c, 0x302]);
const V = new Set([..."aeiou"]);
const hasAcc = (s: string) => [...s].some((c) => ACC.has(c.codePointAt(0)!));

const lex = new Map<string, number>();
for (const l of readFileSync(LEX, "utf8").split("\n")) {
    if (!l || l.startsWith("#")) continue;
    const [w, n] = l.split("\t");
    if (w) lex.set(w, Number(n));
}

let inLex = 0, covOk = 0, oov = 0, oovOk = 0, mono = 0, noAcc = 0;
// TONE. The referee writes the accent as caron = RISING / circumflex = FALLING on the nucleus, with ː for
// length — the same four-way system the lexicon carries and we now emit as a Chao letter (˩˥ / ˥˩) plus ː.
let toneN = 0, toneOk = 0, lenOk = 0;
const toneMiss: string[] = [];
const misses: { w: string; ours: number; ref: number }[] = [];
for (const line of readFileSync(REF, "utf8").split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const [word, ipa] = line.split("\t");
    if (!word || !ipa) continue;
    // referee side: which vowel / syllabic-r segment carries the accent
    let k = -1, n = 0;
    for (const seg of ipa.split(" ").filter(Boolean)) {
        const d = seg.normalize("NFD");
        const base = [...d].filter((c) => !ACC.has(c.codePointAt(0)!) && c !== "ː" && c !== "̩" && c !== "̍");
        const isNuc = V.has(base[0] ?? "") || (base[0] === "r" && (d.includes("̩") || d.includes("̍")));
        if (!isNuc) continue;
        if (hasAcc(d)) k = n;
        n++;
    }
    // referee tone/length on the accented nucleus, read before the monosyllable skip (a monosyllable's
    // falling accent is phonemic here: grâd "city" vs grȁd "hail")
    let refTone = "", refLong = false;
    {
        let m = 0;
        for (const seg of ipa.split(" ").filter(Boolean)) {
            const d = seg.normalize("NFD");
            const base = [...d].filter((c) => !ACC.has(c.codePointAt(0)!) && c !== "ː" && c !== "̩" && c !== "̍");
            const isNuc = V.has(base[0] ?? "") || (base[0] === "r" && (d.includes("̩") || d.includes("̍")));
            if (!isNuc) continue;
            if (hasAcc(d)) {
                refTone = d.includes("\u030c") || d.includes("\u0306") ? "rising" : "falling";
                refLong = seg.includes("ː");
            }
            m++;
        }
    }
    if (refTone) {
        const out2 = phonemizeWord(word);
        if (out2.includes("˩˥") || out2.includes("˥˩")) {
            toneN++;
            const ours = out2.includes("˩˥") ? "rising" : "falling";
            if (ours === refTone) toneOk++; else if (toneMiss.length < 10) toneMiss.push(`${word}: ours ${ours}, ref ${refTone}`);
            if (out2.includes("ː") === refLong) lenOk++;
        }
    }
    if (n < 2) { mono++; continue; }
    if (k < 0) { noAcc++; continue; }
    const out = phonemizeWord(word);
    const at = out.indexOf("ˈ");
    if (at < 0) continue;
    // ⚠ COUNT ON THE MARKLESS STRING: the mark sits between onset and nucleus, so leaving it in makes the
    // syllabic-r test see "r" followed by "ˈ" rather than by its vowel, and brˈadarit͡ɕ reads as off-by-one.
    const bare = out.replace("ˈ", "");
    let ours = 0;
    for (let i = 0; i < at; i++) {
        const c = bare[i]!;
        if (V.has(c)) ours++;
        else if (c === "r" && !V.has(bare[i - 1] ?? "") && !V.has(bare[i + 1] ?? "")) ours++;
    }
    if (lex.has(word.toLowerCase())) {
        inLex++;
        if (ours === k) covOk++; else misses.push({ w: word, ours, ref: k });
    } else {
        oov++;
        if (ours === k) oovOk++;
    }
}
const ije = misses.filter((m) => m.ours === m.ref + 1 && /ij[eo]|je/.test(m.w.toLowerCase())).length;
const real = misses.length - ije;
console.log(`comparable ${inLex + oov}  (skipped ${mono} monosyllabic, ${noAcc} with no referee accent)`);
console.log(`  lexicon-covered      ${covOk}/${inLex} = ${((100 * covOk) / inLex).toFixed(1)}%`);
console.log(`    of ${misses.length} misses, ${ije} are the ⟨ije⟩ counting convention (same vowel, different ordinal)`);
console.log(`    genuine disagreement ${real}/${inLex} = ${((100 * real) / inLex).toFixed(1)}%  → agreement ${(100 - (100 * real) / inLex).toFixed(1)}%`);
console.log(`  OOV first-nucleus    ${oovOk}/${oov} = ${((100 * oovOk) / oov).toFixed(1)}%`);
console.log(`  TONE  (rising vs falling, where we emit one and the referee marks one)`);
console.log(`    contour ${toneOk}/${toneN} = ${((100 * toneOk) / toneN).toFixed(1)}%`);
console.log(`    length  ${lenOk}/${toneN} = ${((100 * lenOk) / toneN).toFixed(1)}%`);
toneMiss.forEach((m) => console.log(`      ${m}`));
console.log(`    ⚠ only ${oov} rows — the referee and the lexicon are both Wiktionary, so almost nothing is OOV here`);
console.log(`    and what IS left is the long rare tail, where first-nucleus is weakest. The corpus-weighted`);
console.log(`    figure (FLEURS, frequency-weighted) is the one that describes running text.`);
for (const m of misses.filter((x) => !(x.ours === x.ref + 1 && /ij[eo]|je/.test(x.w.toLowerCase()))).slice(0, 12))
    console.log(`    ${m.w}: ours ${m.ours}, referee ${m.ref}`);
