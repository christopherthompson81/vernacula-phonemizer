/**
 * TRIPLE-SOURCE AUDIT of the English dictionary.
 *
 * The wikipron referee covers 1,439 of the 40,000 words in `g2p-common.txt` — 3.6%. The other 96% of the
 * words that actually occur in text have never been checked against anything. This compares every word the
 * DICTIONARY carries against TWO sources with different ancestry, and flags where BOTH agree against us:
 * ⚠ IT WAS "EVERY FREQUENCY WORD" UNTIL #1374, and that was a bug, not a scope — see the population note
 * on the comparison loop below.
 *
 *   • misaki `us_gold.json` — CMUdict plus heavy hand curation; the lexicon Kokoro was trained on (Apache-2.0)
 *   • Moby Pronunciator II  — independent of both CMUdict and Wiktionary; public domain by the author's
 *                             2001 grant (Project Gutenberg #3205). See data/LICENSES/PROVENANCE.md §5.3.
 *
 * Neither is redistributed: both are read from disk and used to DECIDE, and the decisions land in this
 * repo's own CMUdict-derived files.
 *
 *   MOBY=/path/to/mobypron.unc GOLD=/path/to/us_gold.json npx tsx tools/english/en_source_compare.mts
 *
 * ⚠ THE NORMALISATION IS THE WHOLE INSTRUMENT, and three separate attempts at it gave 1,005, 663 and 609
 * candidates before it was right. Each wrong version would have generated hundreds of false "fixes":
 *
 *   1. STRESS MUST BE STRIPPED FIRST. Keeping it made the top-frequency hits almost entirely FUNCTION WORDS
 *      differing only in the digit — `of` AH1 V against AH0 V, and the same for `to`, `is`, `with`, `you`,
 *      `it`, `or`, `are`, `from`, `at`, `as`, `an`, `was`, `we`, `if`, `they`, `he`. This engine de-accents
 *      those at the PHRASE layer (english.jsonc `unstressedWords`), so the dictionary's stress-1 is the
 *      correct CITATION form and the difference is not a defect at all.
 *   2. AH AND IH THEN MERGE, because that pair IS this engine's declared weak-vowel convention: it writes
 *      AH0 where gold and Moby write IH0 (`message`, `package`, `village`, `artist`, `basis`) and renders it
 *      `ᵻ`. Leaving them apart buries the real signal under one settled axis.
 *   3. ⚠ ORDER MATTERS AND IS NOT INTERCHANGEABLE. A reduction rule applied BEFORE stripping stress is
 *      itself stress-dependent — "unstressed vowel → schwa" reintroduces exactly the function-word noise
 *      that step 1 removes. Strip first, merge second.
 *
 * ⚠ ER IS DELIBERATELY NOT MERGED with AH/IH: `ɚ` against `ə` is a real distinction, not a notation one.
 *
 * ⚠ AND MOBY IS PRE-MERGER — it keeps FORCE apart from NORTH (`aboard`, `adore`, `airport` with `oU r`
 * where GenAm merged them) and the conservative yod (`seizure` as Z Y UW R). `modernise` folds both before
 * it may vote. Its conservatism is also why it is an ARBITER and NOT a scored referee: 86% of the words in
 * `en-gb-marry.tsv` are unmerged in Moby, so a headline scored against it would punish correct
 * modernisation.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** ⚠ Derived from THIS MODULE, not from the cwd. Every other path this file reads is a parameter; the
 *  heteronym table was briefly a bare relative string, which silently ties `audit()` to being called from
 *  the repo root. */
const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

// ── source converters ────────────────────────────────────────────────────────────────────────────────

const GOLD_UNITS: [string, string][] = [
    ["ɜɹ", "ER"], ["əɹ", "ER"],
    ["A", "EY"], ["I", "AY"], ["O", "OW"], ["W", "AW"], ["Y", "OY"],
    ["i", "IY"], ["u", "UW"], ["ɑ", "AA"], ["ɔ", "AO"], ["æ", "AE"], ["ɛ", "EH"],
    ["ɪ", "IH"], ["ʊ", "UH"], ["ʌ", "AH"], ["ə", "AH"], ["ᵊ", "AH"], ["ᵻ", "AH"],
    ["ʤ", "JH"], ["ʧ", "CH"], ["ʃ", "SH"], ["ʒ", "ZH"], ["θ", "TH"], ["ð", "DH"],
    ["ŋ", "NG"], ["ɡ", "G"], ["ɹ", "R"], ["ɾ", "T"], ["j", "Y"],
    ["b", "B"], ["d", "D"], ["f", "F"], ["h", "HH"], ["k", "K"], ["l", "L"],
    ["m", "M"], ["n", "N"], ["p", "P"], ["s", "S"], ["t", "T"], ["v", "V"],
    ["w", "W"], ["z", "Z"], ["ʔ", "T"],
];
/** The ARPABET vowels. ⚠ EXPORTED so build-en-moby-referee.mts can share it rather than redeclare it. */
export const VOWELS = new Set(["EY", "AY", "OW", "AW", "OY", "IY", "UW", "AA", "AO", "AE", "EH", "IH", "UH", "AH", "ER"]);

/** misaki gold IPA → ARPABET. `undefined` when any symbol is unmappable — better no vote than a partial one. */
export function goldToArpabet(g: string): string[] | undefined {
    const out: string[] = [];
    let stress = "0";
    for (let i = 0; i < g.length; ) {
        const c = g[i]!;
        if (c === "ˈ") { stress = "1"; i++; continue; }
        if (c === "ˌ") { stress = "2"; i++; continue; }
        if (c === "ː" || c === " ") { i++; continue; }
        const hit = GOLD_UNITS.find(([s]) => g.startsWith(s, i));
        if (!hit) return undefined;
        const [sym, arp] = hit;
        i += sym.length;
        if (VOWELS.has(arp)) { out.push(arp + stress); stress = "0"; } else out.push(arp);
    }
    return out.length ? out : undefined;
}

const M_V: Record<string, string> = {
    A: "AA", "&": "AE", "@": "AH", O: "AO", AU: "AW", aI: "AY", E: "EH",
    "[@]": "ER", eI: "EY", I: "IH", i: "IY", oU: "OW", OI: "OY", U: "UH", u: "UW",
    "(@)": "EH", // the `Aaron` vowel: variable æ~ɛ before intervocalic r
};
const M_C: Record<string, string> = {
    T: "TH", D: "DH", S: "SH", Z: "ZH", dZ: "JH", tS: "CH", N: "NG", j: "Y", x: "K", z: "Z", hw: "W",
};
const M_RAW: Record<string, string> = {
    b: "B", d: "D", f: "F", g: "G", h: "HH", k: "K", l: "L", m: "M",
    n: "N", p: "P", r: "R", s: "S", t: "T", v: "V", w: "W", z: "Z",
};

/**
 * Moby notation → ARPABET. `undefined` for multi-word entries and for its French sub-scheme (raw capitals).
 *
 * ⚠ `w` IS THE LOWERCASED HEADWORD AND IT IS REQUIRED, not a convenience. One rule below — bare `gh` —
 * cannot be decided from the body alone, and a default would let a new call site silently pick the
 * wrong branch for it. Same reason `fold` in build-en-moby-referee.mts takes the headword.
 */
export function mobyToArpabet(p: string, w: string): string[] | undefined {
    // ⚠ OY is written `//Oi//` throughout the file, never `/OI/`. Un-normalised it tokenises as two empty
    // slash-pairs plus a raw `Oi`, which is where the file's 5,389 stray `//` come from.
    const s = p.replace(/\/\/Oi\/\//gu, "/OI/");
    if (/_/u.test(s)) return undefined;
    if (/[AONYWVSZR]/u.test(s.replace(/\/[^/]*\//gu, ""))) return undefined;
    const out: string[] = [];
    let stress = "0";
    for (let i = 0; i < s.length; ) {
        const c = s[i]!;
        if (c === "'") { stress = "1"; i++; continue; }
        if (c === ",") { stress = "2"; i++; continue; }
        if (c === "/") {
            const j = s.indexOf("/", i + 1);
            if (j < 0) return undefined;
            const sym = s.slice(i + 1, j);
            i = j + 1;
            if (sym === "") continue;
            if (sym === "-") { out.push("AH0"); continue; }        // syllabic consonant: /-/n = ə + n
            if (M_V[sym] !== undefined) {
                out.push(M_V[sym]! + stress); stress = "0";
                // ⚠ `/[@]/` IS THE NURSE *VOWEL* ALONE and Moby writes its /r/ SEPARATELY — `person` is
                // 'p/[@]/rs/@/n, `bird` is b/[@]/rd. Without consuming that `r`, every NURSE word came out
                // with a DOUBLED rhotic (`P ER1 R S AH0 N`), which silently pushed the whole class out of
                // the candidate set and into "split". Caught by the converter test, not by the audit.
                if (sym === "[@]" && s[i] === "r") i++;
                continue;
            }
            if (M_C[sym] !== undefined) { out.push(M_C[sym]!); continue; }
            if (sym === "ju") { out.push("Y", "UW" + stress); stress = "0"; continue; }
            return undefined;
        }
        // ⚠ AN ADJACENT BARE `sh` IS MOBY WRITING ʃ AS THE LETTERS, NOT AN /s/+/h/ SEAM. The file's
        // consonants are bare letters and its ʃ is `/S/`, but it lapses into the spelling on 41 rows —
        // `Dalmatian d/&/l'm/eI//S//@/n` and `dalmatian d/&/l'm/eI/sh/@/n` sit four lines apart. Left
        // alone, `adulation`, `charades`, `oxidation`, `violation`, `reddish`, `vichy` and twelve more
        // scored as permanent false disagreements in the in-dict tier.
        // ⚠ THE DISCRIMINATOR IS THE SEPARATOR, AND IT IS EXACT — no headword, no seam test, no
        // morphology. Moby writes a genuine /s/+/h/ seam with a stress or syllable mark between them:
        // `mishap 'm/I/s,h/&/p`, `grasshopper 'gr/&/s,h/A/p/@/r`, `household 'h/AU/s,h/oU/ld`,
        // `foxhole 'f/A/ks,h/oU/l`. Measured over every in-dict row: ADJACENT `sh` is 18 lapses and 0
        // seams; SEPARATED `s,h`/`s'h` is 35 seams and 0 lapses. Not one exception either way.
        // ⚠ AND THE SEPARATOR TEST IS `sh` AND `wh` ONLY. It fails for the others, each in its own way:
        // adjacent `kh` is seams plus foreign /x/ (`back·haus`, `bank·head`, `lock·hart`, `monk·hood`,
        // `stock·holm`) with no lapses at all; `ph` runs 4 seams to 1 lapse, and that one lapse is
        // handled as a MOBY_DEFECTIVE row instead; and `th`, `ch` and `ng` have ZERO adjacent
        // occurrences, so there is nothing to scope. `gh` needs a different discriminator entirely — below.
        if (c === "s" && s[i + 1] === "h") { out.push("SH"); i += 2; continue; }
        // ⚠ AND BARE `wh` IS THE SAME LAPSE, by the file's own convention: Moby HAS a `/hw/` symbol and
        // uses it 1,088 times, so writing the spelling instead is a slip. The partition is as clean as
        // `sh` and smaller — 5 adjacent occurrences, 0 separated. It maps to `W`, exactly where `M_C`
        // already sends `hw`, because this converter follows the GenAm wine–whine merger; gold reads
        // `whippet` as `wˈɪpət`. Left alone it shipped a spurious /h/ on `guisewite` — which has no ⟨h⟩
        // in its spelling at all — plus `whap`, `whapping` and `whippet` in the OOV tier.
        if (c === "w" && s[i + 1] === "h") { out.push("W"); i += 2; continue; }
        // ⚠ AND BARE `gh` IS A THIRD CONVENTION AGAIN — not a lapse and not a seam, but Moby FORCING a
        // hard /ɡ/ where the spelling's ⟨g⟩ would otherwise read soft: `Giza 'gh/i/z/@/`, `Guillermo
        // gh/i/'/E/rm/oU/`, `Genda 'gh/@/nd/A/`. Thirty-three of its thirty-seven whole-file occurrences
        // are this.
        // ⚠ THE SEPARATOR CANNOT ARBITRATE HERE, which is why this rule is shaped differently from the
        // two above. Moby writes `Leghorn 'l/E/g,h/O/rn` and `leghorn 'l/E/gh/oU/rn` — THE SAME WORD,
        // both ways — so "adjacent means lapse" is false for `gh` by the file's own hand. Trusting the
        // separator would have broken `leghorn`, a row that is currently correct and passing.
        // ⚠ THE HEADWORD'S SPELLING DOES ARBITRATE IT, exactly. All three genuine seams spell the
        // DIGRAPH ⟨gh⟩ (`leghorn`, `lughole`, `Barghoorn`); not one of the thirty-three hard-/ɡ/ rows
        // does — `Giza`, `Guillermo`, `Jauregui`, `Heintges`. And the seventeen SEPARATED rows all
        // spell it too (`bighead`, `doghouse`, `froghopper`), so the spelling test and the separator
        // agree wherever the separator is present and only the spelling covers the rest.
        // ⚠ THE TEST IS THE ADJACENT DIGRAPH AND NOTHING WEAKER. "An ⟨h⟩ somewhere after the ⟨g⟩" is a
        // DIFFERENT AND FALSE property: `Gehrke`, `Gerhard`, `Gerhart` are hard-/ɡ/ rows with an ⟨h⟩
        // two characters on. Anyone reimplementing this as `/g.*h/` flips `Gehrke` to a seam.
        // ⚠ WHAT MAKES "ANYWHERE IN THE HEADWORD" SAFE is not that the class is small — nothing here
        // aligns the body to the spelling, so the test cannot ask about THIS position. It is safe
        // because Moby writes ORTHOGRAPHIC ⟨gh⟩=/ɡ/ as a plain `g`, without exception: `ghetto
        // 'g/E/t/oU/`, `spaghetti sp/@/'g/E/t/i/`, `Ghana 'g/A/n/@/`, `Borghese b/O/R'g/E/z/E/`. The
        // bare-`gh` convention is used ONLY where the spelling has no ⟨h⟩, so a word that spells ⟨gh⟩
        // anywhere never writes a bare `gh` for a hard /ɡ/ elsewhere. ⚠ THE MARGIN IS THINNER THAN THE
        // ENUMERATION LOOKS: several ⟨gh⟩-spelled hard-/ɡ/ names (`Ghiberti`, `Gheorghiu-Dej`) are
        // declined today for UNRELATED reasons — Moby's French-scheme capitals — so they are not
        // evidence this rule handles them. A new source needs the premise re-checked, not assumed.
        // ⚠ THE DICTIONARY CONFIRMS THE SPLIT INDEPENDENTLY, which is what took this from 16-of-19 to
        // exception-free. `data/languages/english/g2p-dict.tsv` — OUR ARPABET DICTIONARY, not misaki
        // gold — carries five of these words, and none of the five is among its 17,831 Moby-imported
        // rows, so the corroboration is not circular. `leghorn` is `L EH1 G HH AO0 R N` WITH the /h/;
        // `giza G IH1 Z AH0`, `guillermo G W IH0 L Y EH1 R M OW0`, `jauregui Y AW0 R EY1 G W IY0`,
        // `gehrke JH EH1 R K` are without it. ⚠ ONLY `leghorn` CONFIRMS A SEAM; the other four confirm
        // an ABSENCE of /h/ on rows that disagree with Moby about other phones anyway (`gehrke` reads
        // an initial /d͡ʒ/, `jauregui` inserts a /w/), so this is four absences and one positive, not
        // five independent confirmations of the split.
        // ⚠ ONE OF THE THIRTY-THREE IS A CORRUPT BODY: `Corporation 'b/U//N/gh/i/` transcribes *bungee*.
        // Its `gh` does want the hard-/ɡ/ reading for the word the body actually encodes, so it does not
        // break the count — but it is thirty-two real words plus a row that happens to agree.
        if (c === "g" && s[i + 1] === "h" && !w.includes("gh")) { out.push("G"); i += 2; continue; }
        // ⚠ AND BARE `t`+`/S/` IS THE AFFRICATE, 257 TIMES OUT OF 271. Moby has `/tS/` and uses it 7,519
        // times, so writing the two symbols instead is the same kind of lapse as bare `sh` — but this
        // one is FIFTEEN TIMES LARGER than any digraph class above it, and its seam side is real
        // enough that neither of the two rules already in this function would have got it right.
        // ⚠ THE SEPARATOR IS NECESSARY AND NOT SUFFICIENT. It is honest as far as it goes: all 38
        // separated `t,/S/` rows are genuine seams (`nightshade`, `hotshot`, `outshine`, `lightship`,
        // `assistantship`, `Dorsetshire`). But 14 more seams are written ADJACENT — `courtship`,
        // `nutshell`, `sweatshirt`, `Wiltshire` — so unlike `sh` and `wh` the adjacent side is mixed
        // and the separator alone would have folded fourteen real /t/+/ʃ/ boundaries into an affricate.
        // ⚠ THE SPELLING FINISHES IT, AND ONLY AT THE RIGHT POSITION. `sh` ANYWHERE in the headword —
        // the `gh` rule's shape — gets three of the fourteen wrong, and all three are this audit's
        // recurring error: `pushchair 'p/U//S/t/S//(@)/r`, `shakuhachi`, `chafing-dish` each spell ⟨sh⟩
        // somewhere ELSE while their `t/S/` is an ordinary affricate. The test is a ⟨t⟩ followed by the
        // ⟨sh⟩, with at most a silent ⟨e⟩ or a hyphen between — which also reaches `associateship` and
        // `Buteshire`, two real seams a plain ⟨tsh⟩ test misses. Checked, not assumed: no headword
        // spells ⟨tesh⟩ AND carries a second adjacent `t/S/` elsewhere, so "anywhere" and "at this
        // position" cannot diverge on this class today.
        // ⚠ ⟨tsch⟩ IS NOT A SEAM MARKER AND WAS IN THE FIRST DRAFT AS ONE. German spells both sounds
        // that way — `Deutsche d//Oi//t/S//@/`, `putsch p/U/t/S/` and `kaffeeklatsch` are affricates,
        // while `Festschrift 'f/E/st,/S/r/I/ft` is a seam — so it cannot arbitrate. It needs no clause:
        // the three affricates are adjacent and the seam is separated, so the separator already has them.
        if (c === "t" && s.startsWith("/S/", i + 1) && !/t[e-]?sh|ts[tp]/u.test(w)) { out.push("CH"); i += 4; continue; }
        if (M_RAW[c] !== undefined) { out.push(M_RAW[c]!); i++; continue; }
        return undefined;
    }
    return out.length ? out : undefined;
}

/**
 * MOBY ROWS WHOSE BODY IS NOT THE HEADWORD'S READING. Not a pronunciation variant, not a notation
 * difference — the pronunciation field carries a DIFFERENT WORD, or a fragment of one.
 *
 * ⚠ NOT A LINE OFFSET, WHICH WAS CHECKED FIRST because it would have been recoverable: the neighbours
 * of every row below are correct (`shrunken`/`shuck` sit either side of `shtreimel`, `soleplate`/
 * `Soleure` either side of `soleprint`). Each row is individually corrupt.
 *
 * Found three ways, and each way found rows the others missed: a first-phone plausibility test (a word
 * spelled with an initial vowel cannot begin with /d͡ʒ/, a surname cannot be read as a given name), a
 * phones-per-letter ratio (median 0.89, and these sit under 0.40 with six or more letters), and reading
 * the Moby/gold disagreements. ⚠ THE RATIO TEST NEEDS THE LENGTH GATE: `awe` AO, `eau` OW, `err` ER and
 * `aye` EY are all correct and all score low, and `thorough`, `though`, `borough`, `jacques`, `maugham`
 * are correct with silent letters.
 *
 * ⚠ THEY ARE DROPPED, NOT REPAIRED. A repair would be a guess at what Moby meant; dropping leaves the
 * word to the OOV tier, which is what happens for every other word Moby does not carry.
 */
export const MOBY_DEFECTIVE: ReadonlyMap<string, string> = new Map([
    // A surname whose body is a GIVEN name — Moby's source evidently held "Surname, Firstname" rows.
    ["carr", "body is 'Antoine'"], ["cordero", "body is 'Ángel'"], ["corrigan", "body is 'Mairead'"],
    ["dunston", "body is 'Sean'"], ["frana", "body is 'Javier'"], ["gaston", "body is 'Cieto'"],
    ["gorbachev", "body is 'Mikhail'"], ["frykowski", "body is 'Wojciech'"],
    // The body is a DIFFERENT word entirely.
    ["hodges", "body is 'canister'"], ["pathology", "body is 'pathomorphism'"],
    ["terminology", "body is 'terminological'"], ["result", "body is 'resultive'"],
    ["react", "body is 'reactor'"], ["soleprint", "body is 'solemn'"],
    ["selfward", "body is 'selfwill'"], ["samuelson", "body is a fragment, 'SH EH L'"],
    // Truncated or nonsense bodies, all six-plus letters and under 0.40 phones per letter.
    ["workbasket", "truncated — the 'work' is missing"], ["freelance", "truncated — 'F R IY'"],
    ["ninetieth", "truncated — 'N AY'"], ["shtreimel", "truncated — 'SH UW'"],
    ["neanderthaloid", "nonsense — 'N IY P'"], ["passel", "nonsense — 'P S'"],
    ["reiterate", "nonsense — 'R N'"], ["sleipnir", "nonsense — 'S N T'"],
    ["wakayama", "nonsense — 'W EH P'"],
    // ⚠ FIVE MORE, SURFACED BY THE NON-RHOTIC SWEEP rather than by the three probes above: a row whose
    // body is a different word often also loses the ⟨r⟩ the headword is spelled with, so the r-less
    // detector finds corruption the rhotic rules were not looking for.
    ["anderson", "body is 'Sulam'"], ["oder", "body is 'Odessa'"], ["piker", "body is 'pikestaff'"],
    ["millimeter", "truncated — 'mɪləmoʊ'"], ["flayer", "nonsense — 'ɛfwʌn', i.e. 'F one'"],
    // ⚠ THREE MORE THAT NO RHOTIC RULE REACHES, and the reason is instructive: their ⟨r⟩ is
    // INTERVOCALIC, which RP pronounces, so a reading carrying no ⟨r⟩ at all is corruption rather than
    // a dialect difference. The non-rhotic rules look at codas and word-final position and cannot see
    // them; they were found by reading what the sweep left behind.
    ["monosaccharide", "body is 'monoscope'"], ["missouri", "truncated — 'mɪzʊi'"],
    ["zippered", "truncated — 'zɪpi'"],
    // ⚠ A BARE `p`+`h` WHERE THE ⟨ph⟩ IS /f/, OR WHERE THERE IS NO ⟨ph⟩ AT ALL. Moby's consonants are
    // BARE LETTERS — only vowels sit inside slashes — so `p,h` is a deliberate two-sound claim, and for
    // the 29 real seams it has (`hap·hazard`, `loop·hole`, `up·heaval`, `chop·house`) it is right.
    // `geomorphological` is not a seam: `morpho-` is /f/, and the same file has `morphological` as
    // `,m/O/rf/@/'l/A//dZ//I/k/@/l` — the same word minus `geo-`, with /f/. Gold agrees.
    // ⚠ `snapped` HAS NO ⟨ph⟩ IN IT AND THE FIRST SWEEP COULD NOT SEE IT, which is the more useful half
    // of this pair. That sweep filtered on ⟨ph⟩ in the SPELLING, so it found 35 rows where 39 exist;
    // `snapped 'sn/&/p,h/E/d` is a `-ped` past tense with a stray `h`, and it reached the IN-DICT tier
    // as `snæphɛd`, single reading — a permanent false disagreement on an ordinary word.
    // ⚠ AND THE REASON THIS IS A DROP RATHER THAN A REPAIR IS NARROWER THAN THE HEADER ABOVE SAYS.
    // `repairMoby` lives in `en_import_moby.mts` and never runs in the referee builder, so it cannot
    // reach these rows at all; MOBY_DEFECTIVE is the only lever on this side. It is NOT that a repair
    // would be a guess — gold and Moby's own `morphological` make the intent unambiguous. The cost of
    // dropping is one referee row each, which is the cheaper error.
    ["geomorphological", "⟨ph⟩ as p+h where Moby's own `morphological` has /f/"],
    ["snapped", "a stray `h` in a `-ped` past tense: 'sn/&/p,h/E/d"],
    // ⚠ THREE SURFACED BY THE CODA-RHOTIC RULE IN #1370, and they are here rather than left to it
    // because being dropped as RP would be the RIGHT OUTCOME FOR THE WRONG REASON — a rhotic rule that
    // later changed would hand them back. Each body is a different word, which is this table's remit.
    ["photographer", "body is 'photograph' — f/@/'t/A/gr/@/f, and Moby carries that word separately"],
    ["quarsome", "body is 'quarrelsome' — 'kw/O/r/@/ls/@/m against its own `quarrelsome 'kw/A/r/@/ls/@/m`"],
    ["sharecropper", "nonsense — '/S//@/'r/E/t', four phones for twelve letters"],
    // ⚠ TWO MORE THE SAME RULE SURFACED AND THE FIRST TRIAGE MISSED. Neither is RP: `Nornis` is
    // 'Norris' with a phone lost, and `pardalote` transposes its ⟨rd⟩ to /dr/ — the rhotic is in the
    // wrong syllable, not absent. Both were being dropped as non-rhotic by accident of the corruption.
    ["nornis", "body is 'Norris' minus a phone — 'n/O/r/I/s"],
    ["pardalote", "⟨rd⟩ transposed to /dr/ — 'p/A/dr/@/,l/oU/t"],
]);

/**
 * MOBY ROWS WHERE ONE READING IS CORRUPT AND ANOTHER IS FINE. `MOBY_DEFECTIVE` cannot express this: it
 * drops a HEADWORD, and dropping `city` or `county` to be rid of one bad reading throws away a correct
 * one that is scoring today.
 *
 * ⚠ THE SECOND READING IS WHERE CORRUPTION HIDES, and this table exists because nothing was looking
 * there. The builder emits every reading tab-separated and the eval credits ANY of them — a deliberate
 * choice, argued in build-en-moby-referee.mts, because case does not predict which Moby row is right.
 * The cost was named at the time and is exactly this: a corrupt reading beside a correct one is
 * invisible to every all-readings test, because the row keeps passing. `corporation` shipped
 * `kɔɹpɚeɪʃən` AND `bʊŋɡi` for four blocks without a single test noticing.
 *
 * ⚠ KEYED ON THE RAW MOBY BODY, NOT ON THE IPA IT PRODUCES. The IPA is downstream of every converter
 * rule and moves when they change — `corporation`'s bad reading was `bʊŋɡhi` until the bare-`gh` rule
 * landed one block ago, so an IPA-keyed declaration would have silently stopped matching and let the
 * defect back in with no test failing. The body is source data and never moves.
 *
 * ⚠ CASE DOES NOT PREDICT WHICH READING IS THE BAD ONE, the same finding the builder records for a
 * different reason. The capitalised row is the corrupt one in most of these — and the LOWER-CASE row
 * is corrupt for `toy`, `whitehead`, `early`, `somali`, `crises` and `watergate`, where the
 * capitalised `Toy t//Oi//`, `Whitehead '/hw//aI/t,h/E/d` and `Early '/[@]/rl/i/` are right. A rule
 * that dropped capitals would fix most of the table and break six of it.
 *
 * ⚠ FOUR DETECTORS, AND EVERY ONE OF THEM MISSED SOMETHING THE OTHERS CAUGHT. Two compare within a
 * row — consonant-skeleton Jaccard between its readings, and order-sensitive edit distance ranked by
 * the GAP between them. Two compare outward — each reading against the headword's SPELLING, and each
 * body against EVERY OTHER BODY IN THE FILE. The last is the strongest and was added late: it turns a
 * guess about what a corrupt body says into a citation, and it is how `county`, `rouse`, `soufriere`
 * and `cahill` are known rather than surmised.
 * ⚠ 694 headwords carry more than one distinct raw body — 659 once the builder's `[a-z]{2,20}` filter
 * applies, which is the number to quote only when talking about what reaches the corpus. NONE carries
 * three: of 175,210 headwords, 174,516 have exactly one distinct body and 694 have exactly two, so
 * there is no deeper tier of this problem to look for.
 */
const DEFECTIVE_READINGS: readonly (readonly [string, string, string])[] = [
    // THE BODY IS A DIFFERENT WORD — the same corruption `MOBY_DEFECTIVE` collects, but on a row whose
    // other reading is sound.
    // ⚠ WHERE THE DISPLACED WORD IS ITSELF A MOBY HEADWORD, SAY SO AND GIVE THE LINE. A back-
    // transliteration from the phones is a guess; a byte-identical body elsewhere in the file is
    // evidence. Four of these were guesses in the first draft and two of the guesses were wrong.
    ["city", "'b/oU//Z//[@]/r", "body is 'Bougère', a surname"],
    ["corporation", "'b/U//N/gh/i/", "body is 'Bungee' — and NOT Moby's own `bungee 'b/@/n/dZ//i/`"],
    ["county", "b/@/'l/A/h/i/", "body is Moby's own `Bellaghy b/@/'l/A/h/i/`, byte-identical"],
    ["rouse", "r/O/ss", "body is Moby's own `Ross r/O/s` with a doubled ⟨s⟩"],
    ["soufriere", "s/AU/", "body is Moby's own `Sau s/AU/`, byte-identical — displaced, not truncated"],
    ["cahill", "k/eI/l", "body is Moby's own `kale`/`kail k/eI/l`, byte-identical"],
    ["plateau", "b/@/l'/oU/v/E/ns", "body is 'Bellovens'"],
    ["peak", "k/oU/rk/oU/'v/A/d/oU/", "body is 'Corcovado', which Moby also carries as its own headword"],
    ["vineyard", "/dZ//u/'m/A/r/A/", "body is 'Jumara'"],
    ["wellington", "'w/i/'g/j//I/n", "body is not Wellington — 'wiɡjɪn'"],
    ["college", "'k/j//u/k/U/", "body is not College — 'kjukʊ'"],
    ["junta", "'h/u/nt/&/n", "body is 'huntæn', against its own `junta 'h/U/nt/@/`"],
    ["zed", ",z/E/d/@/'k/aI//@/", "body is 'Zedekiah'"],
    // A LOST SPACE: Moby's source held a multi-word entry and the headword kept only its last word.
    ["bey", "/A/zz/@/d'd/i/nb/eI/", "body is 'Azzeddin Bey' with the space lost"],
    ["luce", "d/@/'l/u/s", "body is 'De Luce' with the space lost"],
    ["quoin", "d/u/'k/oU//j/n", "body is 'Du Coyne' with the space lost"],
    // ⚠ A DIFFERENT CLASS, AND DECLARED HERE ANYWAY. Not a displaced word but the RIGHT word
    // transcribed impossibly — a phone dropped, doubled, or plainly wrong. Worth dropping for the same
    // reason: the row goes on passing on its good reading while crediting a reading no speaker produces.
    ["toy", "t/oU//j/", "'toʊj' — Moby's own `Toy t//Oi//` is correct"],
    ["whitehead", "'w/aI//T//E/d", "'waɪθɛd' — the ⟨th⟩ read across the compound seam as θ"],
    ["early", "/i/rl/i/", "'iɹli' — Moby's own `Early '/[@]/rl/i/` is correct"],
    ["somali", "s/oU/'m/&//i/", "'soʊmæi' — the /l/ dropped"],
    ["began", "'b/i//&/n", "'biæn' — the /ɡ/ dropped"],
    ["crises", "kr/i/z", "'kɹiz' — a syllable short of its own `Crises 'kr/aI/s/i/z`"],
    ["messieurs", "m/E/'s/j//[@]/rr", "'mɛsjɚɹ' — a doubled ⟨rr⟩ coda"],
    ["swaraj", "sw/@/'r/A/r/dZ/", "'swɚɑɹd͡ʒ' — an intrusive /r/ its own `swaraj sw/@/'r/A//dZ/` lacks"],
    ["watergate", "'w/oU/rt/@/,g/eI/t", "'wɔɹtəɡeɪt' — an intrusive /r/ in a syllable spelled without one"],
    ["duralumin", "d/dZ//U//@/'r/&/l/j//U/m/I/n", "a stray `d/dZ/` onset on an otherwise sound reading"],
];

/**
 * ⚠ WHAT THIS TABLE DELIBERATELY DOES NOT COVER, because the line matters more than the entries.
 *
 * A CASE COLLISION IS NOT CORRUPTION. Moby's `UP /j//u/'p/i/` is the correct reading of the INITIALISM,
 * and `Piquet 'p/I/k/eI/` the correct reading of the surname; they merely share a lower-cased key with
 * `up` and `piquet`. Those readings CAN be their spelling — they are simply a different lexeme — and
 * the builder's header accepts that risk explicitly, having measured the alternative as worse. This
 * table is for readings that CANNOT be the headword's at all. Declaring `UP` here would be a policy
 * change to that decision dressed up as a defect fix.
 *
 * AND IT CANNOT REACH A SINGLE-READING ROW, which is the structural limit: a headword with one corrupt
 * reading and no other belongs in `MOBY_DEFECTIVE`, which drops it whole. Per-reading declarations
 * only ever apply where a sound reading survives to keep the row alive.
 */
// ⚠ A DUPLICATE PAIR COLLAPSES INTO THE SET AND IS OTHERWISE INVISIBLE — the builder's
// fired-exactly-once check counts SET members, so declaring the same pair twice keeps both the
// declared and the matched count at their old values and the build passes with a silently ignored
// row. Caught here at module load instead, where the duplicate still exists as an array element.
const dupes = DEFECTIVE_READINGS
    .map(([w, body]) => `${w}\t${body}`)
    .filter((k, i, all) => all.indexOf(k) !== i);
if (dupes.length) throw new Error(`DEFECTIVE_READINGS: duplicate declaration(s) ${dupes.join(", ")}`);

/** Lower-cased headword → the raw Moby bodies that cannot be that word's reading. See above. */
export const MOBY_DEFECTIVE_READING: ReadonlyMap<string, ReadonlySet<string>> = new Map(
    [...new Set(DEFECTIVE_READINGS.map(([w]) => w))].map((w) =>
        [w, new Set(DEFECTIVE_READINGS.filter(([x]) => x === w).map(([, body]) => body))]),
);

/** The reason each declaration was made, for the tests and for whoever audits this next. */
export const MOBY_DEFECTIVE_READING_WHY: ReadonlyMap<string, string> = new Map(
    DEFECTIVE_READINGS.map(([w, body, why]) => [`${w}\t${body}`, why]),
);

/**
 * Fold Moby's pre-merger layers AND its rhotic notation so it can vote on modern GenAm. See the header.
 *
 * ⚠ MOBY SPELLS EVERY UNSTRESSED `-ər` AS TWO SYMBOLS, `/@/r` — `ocular` is \'/A/k/j//@/l/@/r. Both this
 * repo and gold write that as the single phone ER, so without folding it back the converter returned
 * `AH0 R` and EVERY WORD ENDING IN -er/-or/-ar/-ur fell out of the audit into "split" — the two sources
 * could never be seen to agree. That is not a small class: it hid the whole `-ular`/`-ulation` family
 * (`ocular`, `mandibular`, `ventricular`, `permutation`), where Moby in fact agrees with gold exactly.
 * ⚠ THE CONSONANT LOOKAHEAD IS LOAD-BEARING. `AH R` before a VOWEL is an onset `r` in the next syllable
 * (`around` = ə-ɹaʊnd), not a coda, and folding it would rewrite that as ɚ.
 */
export function modernise(a: string[]): string[] {
    const out: string[] = [];
    for (let i = 0; i < a.length; i++) {
        const p = a[i]!, b = p.replace(/[0-2]$/u, ""), st = p.slice(b.length);
        if (b === "AH" && a[i + 1] === "R" && !VOWELS.has((a[i + 2] ?? "").replace(/[0-2]$/u, ""))) {
            out.push(`ER${st}`); i++; continue;                                 // /@/r → ɚ
        }
        // FORCE → NORTH. ⚠ THE SAME CONSONANT LOOKAHEAD AS THE RULE ABOVE, and its absence was a latent
        // bug: `OW R` before a VOWEL is a compound seam whose `r` is the ONSET of the next syllable —
        // `auto·radiography`, `photo·reconnaissance`, `oleo·resin` — not a coda to merge. Unguarded it
        // rewrote the `oʊ` of `auto-` as `ɔ`. Invisible until gold's readings began flowing through
        // `modernise` on the import path, where it moved 12 rows.
        if (b === "OW" && a[i + 1] === "R" && !VOWELS.has((a[i + 2] ?? "").replace(/[0-2]$/u, ""))) {
            out.push(`AO${st}`); continue;
        }
        if (b === "Y" && out.length > 0 && a[i + 1]?.startsWith("UW")) {
            const prev = out[out.length - 1]!;
            const co: Record<string, string> = { Z: "ZH", S: "SH", T: "CH", D: "JH" };
            if (co[prev] !== undefined) { out[out.length - 1] = co[prev]!; continue; } // yod coalescence
            if (prev === "N" || prev === "L" || prev === "TH") continue;               // yod dropping
        }
        out.push(p);
    }
    return out;
}

// ── the normalisation ────────────────────────────────────────────────────────────────────────────────

/**
 * The comparison form. Strip stress FIRST, then merge AH/IH — see the header for why the order is not
 * interchangeable and why each step is there.
 */
export function normalise(a: string[]): string {
    return a
        .map((x) => x.replace(/[0-2]$/u, ""))
        .map((b) => (b === "AH" || b === "IH" ? "ə" : b))
        .join(" ");
}

// ── the audit ────────────────────────────────────────────────────────────────────────────────────────

export interface Candidate { rank: number; word: string; ours: string[]; agreed: string[] }

/**
 * CANDIDATE SHAPES THAT ARE NEVER A DEFECT IN US, rejected in code rather than adjudicated in prose.
 *
 * ⚠ #1375 ADJUDICATED THESE IN A COMMIT MESSAGE AND NOTHING ACTED ON IT. No artifact recorded which
 * rows they were, its counts did not reproduce, and the next pass would have re-read all of them. A
 * class that is "known not to be a defect" has to be expressible, or it is not known at all.
 *
 * ⚠ THESE REJECT THE CANDIDATE, NOT THE WORD. The row still counts as a `split`, because the two
 * sources genuinely do read it differently from us — what is denied is only the claim that OUR row is
 * the wrong one.
 */
const NEVER_A_DEFECT: readonly (readonly [string, (o: string[], t: string[]) => boolean])[] = [
    // ⚠ ENGLISH HAS NO PHONEMIC GEMINATE. Both sources write one at a morpheme seam — `coolly`
    // K UW1 L L IY0, `unnerve` AH2 N N ER1 V, `headdress` HH EH1 D D R EH2 S — because the SPELLING
    // doubles. We collapse it, and we are right; `ˈkuːli` has one /l/.
    ["source geminate", (o, t) => t.length === o.length + 1 && t.some((p, i) =>
        i + 1 < t.length && bare(p) === bare(t[i + 1]!) && eq(t.slice(0, i).concat(t.slice(i + 1)), o))],
    // ⚠ `N G` AND `NG G` ARE THE SAME SOUND, two ARPABET spellings of [ŋɡ]. Neither is wrong.
    ["NG G / N G", (o, t) => ng(o) === ng(t)],
    // ⚠ /iə/ AND /jə/ ARE THE SAME SYLLABLE COMPRESSED OR NOT. `julian` JH UW1 L IY0 AH0 N against
    // JH UW1 L Y AH0 N, and `alien`, `copiously`, `crocodilian`, `eosinophilia`, `insouciant`,
    // `leniency`, `pannier`, `valonia` — 9 of the 691, and the alternation runs BOTH WAYS across them
    // (we are the compressed side on six, the full side on three), which is the tell that it is free
    // variation and not one source being consistently fuller than us.
    // ⚠ POST-CONSONANTAL AND UNSTRESSED ONLY. All 9 are a consonant + IY0 + vowel; an IY that carries
    // stress, or one after another vowel, is a syllable in its own right and its loss WOULD be a defect.
    // ⚠ `eosinophilia` HAS A SECOND DEFECT THIS DOES NOT ABSOLVE — our row carries TWO primary stresses
    // (`IH1 N ... F IH1 L`). The audit cannot see it, because `normalise` strips stress before comparing,
    // so no pure stress error is ever a candidate. Rejecting the glide here is right; the stress is a
    // separate class that needs its own pass over the whole dict.
    ["iə / jə compression", (o, t) => glide(o) === glide(t)],
    // ⚠ THE `-ed` ADJECTIVE IS DELIBERATELY *NOT* HERE, and it was in the first version of this table.
    // `cussed` is our /t/ against a syllabic /ɪd/ — but that is the `worsted` shape exactly, a
    // NOUN/ADJECTIVE against a PARTICIPLE, and unlike `primate` it IS expressible: the `adj` slot in
    // english.jsonc's heteronym table exists and is live (`arithmetic`). Our dictionary simply carries
    // only the participle for `cussed`, `blessed`, `aged`, `learned`, `dogged`, `crooked`. Rejecting
    // the class here would close the door on the real fix three lines after opening it for `worsted`.
];
// ⚠ THE PREDICATES MUST USE THE AUDIT'S OWN EQUIVALENCE, NOT A STRICTER ONE. `normalise` merges AH and
// IH into ə as well as stripping stress; a first version of this table compared with stress-stripping
// alone, so three rows whose only normalise-visible difference IS the geminate — `disservice`,
// `levittown`, `dissatisfaction` — became candidates under one relation and were then judged under a
// tighter one, and survived. The count printed 18 where the class is 21.
const bare = (p: string): string => {
    const b = p.replace(/[0-2]$/u, "");
    return b === "AH" || b === "IH" ? "ə" : b;
};
const eq = (a: string[], b: string[]): boolean => a.length === b.length && a.every((x, i) => bare(x) === bare(b[i]!));
const ng = (a: string[]): string => a.map(bare).join(" ").replace(/NG G/gu, "N G");
/**
 * Post-consonantal unstressed `IY` before a vowel folded to the glide `Y`, then the audit's own bare form.
 * ⚠ THE VOWEL TESTS RUN ON THE STRESS-STRIPPED BASE, NOT ON `bare`. `bare` rewrites AH and IH to `ə`,
 * which is not in `VOWELS`, so testing the folded form asked "is the next phone a vowel" of a symbol that
 * can never be one and the predicate fired on 1 of its 7 rows instead of 7.
 */
const glide = (a: string[]): string => {
    const base = a.map((p) => p.replace(/[0-2]$/u, ""));
    const out: string[] = [];
    for (let i = 0; i < a.length; i++) {
        const prev = base[i - 1];
        const onset = prev !== undefined && prev !== "Y" && !VOWELS.has(prev);
        if (base[i] === "IY" && a[i]!.endsWith("0") && VOWELS.has(base[i + 1] ?? "") && onset) { out.push("Y"); continue; }
        out.push(bare(a[i]!));
    }
    return out.join(" ");
};

export function audit(dictPath: string, freqPath: string, goldPath: string, mobyPath: string): {
    compared: number; agree: number; candidates: Candidate[]; split: number; rejected: Map<string, number>;
} {
    // ⚠ A DECLARED HETERONYM IS NOT COMPARABLE and must be skipped, for the same reason the audit skips
    // gold's POS-conditioned entries: the dict row is only the fallback, and english.jsonc `heteronyms`
    // is what the engine actually reads. All 8 that surfaced — `accent`, `address`, `concrete`, `detour`,
    // `egress`, `lead` — already carry the RIGHT default there; the dict row they sit on is dead weight,
    // and "fixing" it to match the sources would have moved a row the engine never consults.
    const het = new Set<string>(
        Object.keys(JSON.parse(
            readFileSync(join(REPO, "data/languages/english/english.jsonc"), "utf8")
                .replace(/^\s*\/\/.*$/gmu, "").replace(/,(\s*[}\]])/gu, "$1"),
        ).heteronyms as Record<string, unknown>),
    );
    const dict = new Map<string, string[]>();
    for (const l of readFileSync(dictPath, "utf8").split("\n")) {
        if (l.startsWith("#") || !l.includes("\t")) continue;
        const [w, p] = l.split("\t");
        dict.set(w!.toLowerCase(), p!.split(" "));
    }
    const gold: Record<string, unknown> = JSON.parse(readFileSync(goldPath, "utf8"));
    const goldOf = (w: string): string | undefined => {
        const v = gold[w] ?? gold[w[0]!.toUpperCase() + w.slice(1)];
        // ⚠ An object value is a POS-conditioned HETERONYM; our row is a single reading, so a mismatch there
        // is not a defect. Skipped rather than guessed at.
        return typeof v === "string" ? v : undefined;
    };
    const moby = new Map<string, string[][]>();
    // ⚠ CR-DELIMITED. `mobypron.unc` uses classic-Mac line endings, so splitting on "\n" returns ONE line
    // and the audit silently compares nothing — it reported 0 words before this was found. Split on all three.
    for (const line of readFileSync(mobyPath, "latin1").split(/\r\n|\r|\n/u)) {
        const sp = line.indexOf(" ");
        if (sp < 0) continue;
        const w = line.slice(0, sp).toLowerCase();
        if (MOBY_DEFECTIVE_READING.get(w)?.has(line.slice(sp + 1))) continue;
        const a = mobyToArpabet(line.slice(sp + 1), w);
        if (a) (moby.get(w) ?? moby.set(w, []).get(w)!).push(a);
    }
    // ⚠ THE FREQUENCY LIST IS A RANKING, NOT THE POPULATION, AND FOR FOUR BLOCKS IT WAS BOTH. This loop
    // used to be `freq.forEach`, so the audit compared only the 40,000 words in `g2p-common.txt` and was
    // BLIND to every triple-sourced word outside it. `determinedly` — gold `dətˈɜɹməndli`, Moby
    // `d/I/'t/[@]/rm/I/ndl/i/`, and our own `determined` contradicting our row — was invisible to
    // #1369, #1371, #1372 and #1373, every one of which searched for exactly that shape. The population
    // is `dict ∩ gold ∩ moby`; the ranking is a separate thing and is looked up, not iterated.
    const rank = new Map<string, number>();
    readFileSync(freqPath, "utf8").split("\n").map((s) => s.trim())
        .filter((s) => s && !s.startsWith("#")).forEach((w, i) => { if (!rank.has(w)) rank.set(w, i); });
    let compared = 0, agree = 0, split = 0;
    const rejected = new Map<string, number>();
    const candidates: Candidate[] = [];
    // ⚠ SORTED, so the output is stable across runs — `dict` is insertion-ordered off a file whose order
    // is not guaranteed, and an unstable candidate list makes two audits impossible to diff.
    for (const w of [...dict.keys()].sort()) {
        const ours = dict.get(w), g = goldOf(w), m = moby.get(w);
        if (!ours || !g || !m || het.has(w)) continue;
        const ga = goldToArpabet(g);
        if (!ga) continue;
        compared++;
        const o = normalise(ours), gg = normalise(ga);
        const ms = m.map((p) => normalise(modernise(p)));
        if (gg === o && ms.includes(o)) { agree++; continue; }
        // ⚠ MOBY MUST NOT ALSO CARRY OUR OWN READING. The bucket holds EVERY reading Moby gives the
        // lower-cased key, so a word with a case-distinct second headword contributes both: `leman
        // 'l/E/m/@/n` AND `Leman 'l/i/m/@/n`, the second of which IS our row. Without this test the
        // candidate rule below asks only "does SOME Moby variant match gold" and reports "both sources
        // agree against us" about a source that explicitly records our reading as standard.
        // ⚠ IT REMOVES 18 OF 784 AND #1375 APPLIED ONE OF THEM (`leman`), which is why this is a guard
        // and not a report. The others: alameda, bourbon, buhl, burnet, canton, concord, cush, lawman,
        // midi, moline, myrmidon, picayune, saros, sol, telamon, triton, vita.
        // ⚠ IT IS NOT A GENERAL TWO-FORM DETECTOR and must not be mistaken for one: Moby lists a second
        // reading only where it happens to have a case-variant headword. `hoof`, `sloth` and `capo` are
        // equally two-form and this test cannot see them. It is a cheap TRUE-POSITIVE filter, nothing more.
        if (ms.includes(o)) { split++; continue; }
        // ⚠ `rank` IS -1 FOR A WORD OFF THE FREQUENCY LIST, not 0 and not omitted. 0 is a REAL rank
        // (`the`), so a shared 0 would make an off-list row indistinguishable from the commonest word in
        // English; -1 cannot collide with any rank and so stays legible and bucketable. ⚠ IT DOES NOT
        // MOVE THE ROW DOWN — the report sorts ascending, so -1 prints FIRST, ahead of `the`. An earlier
        // comment claimed the opposite. Omitting the rank would hide exactly the rows this exists to
        // surface, which is the one thing that must not happen.
        if (gg !== o && ms.includes(gg)) {
            const never = NEVER_A_DEFECT.find(([, f]) => f(ours, ga));
            if (never) { rejected.set(never[0], (rejected.get(never[0]) ?? 0) + 1); split++; continue; }
            candidates.push({ rank: rank.get(w) ?? -1, word: w, ours, agreed: ga }); continue;
        }
        split++;
    }
    return { compared, agree, candidates, split, rejected };
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const moby = process.env["MOBY"];
    if (!moby) throw new Error("set MOBY to a mobypron.unc path (Project Gutenberg #3205)");
    const gold = process.env["GOLD"] ?? "";
    if (!gold) throw new Error("set GOLD to a misaki us_gold.json path");
    const r = audit("data/languages/english/g2p-dict.tsv", "data/languages/english/g2p-common.txt", gold, moby);
    const pc = (n: number): string => `${((100 * n) / r.compared).toFixed(1)}%`;
    console.log(`triple-sourced words (dict ∩ gold ∩ moby): ${r.compared}`);
    console.log(`  all three agree:                  ${r.agree} (${pc(r.agree)})`);
    console.log(`  gold AND Moby agree AGAINST us:   ${r.candidates.length} (${pc(r.candidates.length)})`);
    console.log(`  split / no majority:              ${r.split} (${pc(r.split)})`);
    for (const [k, n] of [...r.rejected].sort((a, b) => b[1] - a[1]))
        console.log(`    of which never-a-defect — ${k.padEnd(16)} ${n}`);
    for (const [lab, lo, hi] of [["off-list", -1, 0], ["top 1k", 0, 1000], ["1k–5k", 1000, 5000], ["5k–20k", 5000, 20000], ["20k–40k", 20000, Infinity]] as const)
        console.log(`    ${lab.padEnd(9)} ${r.candidates.filter((c) => c.rank >= lo && c.rank < hi).length}`);
    for (const c of r.candidates.sort((a, b) => a.rank - b.rank))
        console.log(`${c.rank}\t${c.word}\t${c.ours.join(" ")}\t${c.agreed.join(" ")}`);
}
