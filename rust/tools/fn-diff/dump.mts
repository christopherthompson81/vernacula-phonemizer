// Dump TypeScript outputs for one module-level function over a probe set, as JSONL, for the Rust replay
// in src/main.rs. Strings are encoded as arrays of UTF-16 code units so a lone surrogate survives.
//
//   npx tsx rust/tools/fn-diff/dump.mts <name> > .probe/rust/<name>.jsonl
import { readFileSync } from "node:fs";
import { MANIFEST } from "../../../src/languages/english/manifest.ts";
import { makeArpabetToIpa } from "../../../src/languages/english/englishArpabet.ts";
import { loadTsvMap, loadLines } from "../../../src/core/loadTsv.ts";
import { loadJson } from "../../../src/core/loadManifest.ts";
import { PosTagger, type PosModel } from "../../../src/languages/english/posTagger.ts";
import { americanSpelling } from "../../../src/languages/english/spellingVariants.ts";
import { numberToWords, ordinalToWords } from "../../../src/languages/english/numbers.ts";
import { rpWordTransform, toRP } from "../../../src/languages/english-gb/english-gb.ts";
import { createEnglish } from "../../../src/languages/english/english.ts";
import { createEnglishG2p, type EnglishG2pModel } from "../../../src/languages/english/englishG2p.ts";

import { normalizeEnglish, normalizeEnglishInitialisms } from "../../../src/languages/english/normalize.ts";

const units = (s: string): number[] => Array.from({ length: s.length }, (_, i) => s.charCodeAt(i));

// The English normalizer's inputs, deduplicated, each tagged with the first source it came from: every golden
// sentence, every FLEURS en_us utterance (⚠ COLUMNS 3 AND 4 — column 2 is a WAV filename), and the
// off-golden probes in probes/en-normalize.txt (`\n` and `\u{XXXX}` escapes decoded).
const FLEURS = "/mnt/data/omnivoice_ipa/corpus/fleurs_transcripts/data/en_us";
function englishTexts(): Map<string, string> {
    const out = new Map<string, string>();
    const add = (t: string, src: string): void => { if (t !== "" && !out.has(t)) out.set(t, src); };
    for (const g of ["en", "en-GB", "en-IN"])
        for (const row of readFileSync(new URL(`../../../csharp/goldens/${g}.tsv`, import.meta.url), "utf8").split("\n"))
            add(row.split("\t")[0] ?? "", "golden");
    for (const split of ["train", "dev", "test"])
        for (const row of readFileSync(`${FLEURS}/${split}.tsv`, "utf8").split("\n")) {
            const cols = row.split("\t");
            add(cols[2] ?? "", "fleurs");
            add(cols[3] ?? "", "fleurs");
        }
    for (const line of readFileSync(new URL("./probes/en-normalize.txt", import.meta.url), "utf8").split("\n")) {
        if (line === "" || line.startsWith("#")) continue;
        add(line.replace(/\\n/g, "\n").replace(/\\u\{([0-9a-fA-F]+)\}/g, (_m, h: string) => String.fromCodePoint(parseInt(h, 16))), "probe");
    }
    return out;
}
const emit = (input: unknown, output: string): void => {
    process.stdout.write(JSON.stringify({ input, output: units(output) }) + "\n");
};
const ENGLISH = new URL("../../../src/languages/english/english.ts", import.meta.url).href;

const dumps: Record<string, () => void | Promise<void>> = {
    // Every g2p-dict row through the arpabet converter with the shipped syllabic / nasal-seam tables.
    arpabet() {
        const slots = (v: string): number[] => v.split(",").map(Number).filter((n) => Number.isInteger(n));
        const syllabic = loadTsvMap(ENGLISH, "en-syllabic.tsv", slots);
        const nasalSeam = loadTsvMap(ENGLISH, "en-nasal-seam.tsv", slots);
        const conv = makeArpabetToIpa(MANIFEST.arpabet, syllabic, nasalSeam);
        const dict = loadTsvMap(ENGLISH, "g2p-dict.tsv", (v) => v.split(" "));
        for (const [word, phones] of dict) emit({ word: units(word), phones }, conv(phones, word));
        // Also with no word (the tagger's call shape: makeArpabetToIpa(MANIFEST.arpabet)(phones)).
        const bare = makeArpabetToIpa(MANIFEST.arpabet);
        for (const [, phones] of [...dict].slice(0, 5000)) emit({ word: [], phones, bare: true }, bare(phones));
    },
    // Whitespace-split sentences of every English golden, through the POS tagger (tags joined by spaces).
    pos() {
        const tagger = new PosTagger(loadJson<PosModel>(ENGLISH, "pos-model.json"));
        for (const g of ["en", "en-GB", "en-IN"]) {
            const rows = readFileSync(new URL(`../../../csharp/goldens/${g}.tsv`, import.meta.url), "utf8").split("\n");
            for (const row of rows) {
                const text = row.split("\t")[0] ?? "";
                if (text === "") continue;
                const words = text.split(/\s+/u).filter((w) => w !== "");
                emit({ words: words.map(units) }, tagger.tag(words).join(" "));
            }
        }
    },
    // Every word of the en-GB lexical-set tables and the lexicon, against lexicon membership as `known`.
    spelling() {
        const dict = loadTsvMap(ENGLISH, "g2p-dict.tsv", (v) => v);
        const known = (w: string): boolean => dict.has(w);
        const words = new Set<string>();
        const GB = new URL("../../../src/languages/english-gb/english-gb.ts", import.meta.url).href;
        for (const f of ["en-gb-lexical.tsv", "en-gb-bath.tsv", "en-gb-trap.tsv", "en-gb-lotr.tsv", "en-gb-cloth.tsv", "en-gb-palm.tsv", "en-gb-marry.tsv", "en-gb-yod.tsv"])
            for (const l of loadLines(GB, f)) words.add(l.split("\t")[0]!);
        for (const k of dict.keys()) words.add(k);
        for (const w of ["colour", "honourable", "favourite", "centre", "theatre", "realise", "organisations", "analyse", "travelled", "jewellery", "fulfilment", "anaesthetic", "manoeuvre", "catalogue", "programme", "sulphur", "connexion", "hourly", "ourselves", "flavourful", "labourer", "neighbourhoods", "paediatrician", "oestrogen", "haemorrhage", "cancelled", "modelling"]) words.add(w);
        for (const w of words) emit({ word: units(w) }, americanSpelling(w, known) ?? "\u0000none");
    },
    // The OOV G2P, built exactly as createEnglish() builds it, over every accent-lexicon word plus
    // lexicon words with OOV-making edits (doubled letters, suffixes, glued pairs).
    g2p() {
        const slots = (v: string): number[] => v.split(",").map(Number).filter((n) => Number.isInteger(n));
        const conv = makeArpabetToIpa(MANIFEST.arpabet, loadTsvMap(ENGLISH, "en-syllabic.tsv", slots), loadTsvMap(ENGLISH, "en-nasal-seam.tsv", slots));
        const dict = loadTsvMap(ENGLISH, "g2p-dict.tsv", (v) => v.split(" "));
        const g2p = createEnglishG2p(loadJson<EnglishG2pModel>(ENGLISH, "g2p-model.json"), dict,
            new Set(loadLines(ENGLISH, "g2p-common.txt")), conv,
            { ...MANIFEST.g2pClasses, vowels: MANIFEST.arpabet.vowels, letterNameExceptions: MANIFEST.letterNameExceptions });
        const words = new Set<string>();
        for (const l of loadLines(ENGLISH, "accent-lexicon.tsv")) words.add(l.split("\t")[0]!);
        const base = [...words].filter((w) => /^[a-z]+$/u.test(w));
        for (let i = 0; i + 1 < base.length; i += 97) {
            words.add(base[i]! + base[i + 1]!);
            words.add(base[i]! + "ishness");
            words.add(base[i]! + "ings");
            words.add(base[i]!.replace(/([aeiou])/u, "$1$1"));
        }
        for (const w of ["xkcd", "brrr", "zzzz", "mmmhmm", "tsktsk", "pfft", "hmms", "crwth", "nth", "cwm", "q", "zz", "bbc", "cnn", "llms"]) words.add(w);
        const take = process.env.G2P_LIMIT ? Number(process.env.G2P_LIMIT) : Infinity;
        let n = 0;
        for (const w of words) { if (n++ >= take) break; emit({ word: units(w) }, g2p.g2p(w)); }
    },
    // The engine on PRE-NORMALIZED text (normalize.ts runs on the TS side only): every golden sentence and
    // every FLEURS en_us utterance (column 3 is the text; column 2 is a WAV filename).
    "english-pre"() {
        const E = createEnglish();
        for (const text of englishTexts().keys()) {
            const normalized = E.normalizedFor(text);
            emit({ normalized: units(normalized) }, E.text(normalized, undefined, undefined, true));
        }
    },
    "english-gb-pre"() {
        const E = createEnglish();
        for (const text of englishTexts().keys()) {
            const normalized = E.normalizedFor(text);
            emit({ normalized: units(normalized) }, E.text(normalized, rpWordTransform(), undefined, true));
        }
    },
    // toRP alone over every lexicon reading (word + GenAm IPA), with and without the lexical sets.
    torp() {
        const lex = loadTsvMap(ENGLISH, "accent-lexicon.tsv", (rest) => { const f = rest.split("\t"); const ipa = f[1]?.trim(); return f.length >= 2 && ipa ? ipa : undefined; });
        const T = rpWordTransform();
        let i = 0;
        for (const [w, ipa] of lex) {
            emit({ word: units(w), ipa: units(ipa) }, T(ipa, w));
            if (i++ % 7 === 0) emit({ word: units(w), ipa: units(ipa), bare: true }, toRP(ipa, w));
        }
    },
    normalize() {
        for (const [t, src] of englishTexts()) emit({ text: units(t), src }, normalizeEnglish(t));
    },
    // normalizeEnglishInitialisms(normalizeEnglish(t), lexicon.has), the lexicon parsed as createEnglish() does.
    initialisms() {
        const lexicon = loadTsvMap(ENGLISH, "accent-lexicon.tsv", (rest) => {
            const fields = rest.split("\t");
            const ipa = fields[1]?.trim();
            return fields.length >= 2 && ipa ? ipa : undefined;
        });
        for (const [t, src] of englishTexts())
            emit({ text: units(t), src }, normalizeEnglishInitialisms(normalizeEnglish(t), (w) => lexicon.has(w)));
    },
    // The public sync entry, end to end (registry pre-passes + normalize + engine), for en and en-GB.
    async "phonemize-sync"() {
        const { phonemize } = await import("../../../src/index.ts");
        for (const lang of ["en", "en-GB"])
            for (const text of englishTexts().keys()) emit({ text: units(text), lang }, phonemize(text, lang));
    },
    numbers() {
        const ns: bigint[] = [];
        for (let i = 0n; i <= 20000n; i++) ns.push(i);
        for (let e = 3n; e <= 36n; e++) { ns.push(10n ** e); ns.push(10n ** e - 1n); ns.push(10n ** e + 7n); ns.push(123456789n * 10n ** (e - 3n) + 42n); }
        for (const n of ns) {
            emit({ n: n.toString(), ordinal: false }, numberToWords(n).join(" "));
            emit({ n: n.toString(), ordinal: true }, ordinalToWords(n).join(" "));
        }
    },
};


const name = process.argv[2] ?? "";
const run = dumps[name];
if (run === undefined) {
    console.error(`unknown dump "${name}"; known: ${Object.keys(dumps).join(", ")}`);
    process.exit(2);
}
await run();
