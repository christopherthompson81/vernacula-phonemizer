/**
 * THE CURATED LAYER MUST NOT SILENTLY DIVERGE FROM THE OOV PATH.
 *
 * ⚠ `data/languages/english/g2p-model.json` is trained on UPSTREAM CMUdict, and `--emit` regenerates
 * `g2p-dict.tsv` from CMUdict too — so the ~20 hand corrections in `g2p-curated.tsv` reach the listed word
 * and, unless something propagates them, nothing else. Where they do not, the engine answers one way for a
 * recorded word and another for an unrecorded one IN THE SAME ENVIRONMENT, which is the defect
 * `tools/english/en_rebuild_lexicon.mts` exists to prevent on the lexicon side (#1295).
 *
 * ⚠ CURATION DOES PROPAGATE THROUGH MORPHOLOGY — `morphDecode` looks its stem up in the SHIPPED dict, not
 * in the model — so most curated rows are reproduced by the OOV path for free. This test pins WHICH ones
 * are not, so the list can only shrink by decision and never grow by accident.
 */
import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createEnglishG2p, type EnglishG2pModel } from "../src/languages/english/englishG2p.ts";
import { MANIFEST } from "../src/languages/english/manifest.ts";

const EN = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "languages", "english");

/**
 * ⚠ THE KNOWN GAPS ARE LISTED WITH A REASON, NOT WAIVED WHOLESALE, AND THE REASON DECIDES THE REMEDY.
 * A row leaving this list is progress; a row JOINING it is a regression that must be argued for.
 *
 * ⚠ THEY ARE NOT ALL THE SAME KIND. A first version of this comment said all three were pure-n-gram rows
 * that "only re-training or an overlay would close" — true of two of them and FALSE of `was`, which takes
 * the MORPH path. Saying so sent the next maintainer at the expensive fix for the cheap problem.
 */
const KNOWN_GAPS = new Map<string, string>([
    // ⚠ NOT AN N-GRAM ROW. `was` decodes through morphDecode on the two-letter dict stem `wa` (W AA1) plus
    // an `-s` allomorph — so a stem-side edit, or a floor on stem length, would close it without touching
    // the model. Left open deliberately: `wa` is a real dict row and raising the minimum stem length reaches
    // far past this word. Cheap to fix, not obviously right to fix.
    ["was", "morph (source M): `wa` + allomorph Z reconstructs the upstream W AA1 Z; see comment above"],

    // ⚠ `-ative` AGAIN, AND IT IS THE CLASS #1341's RETRAIN WAS NAMED FOR. `collaborative` sat here for
    // exactly this — the n-gram tier reads the suffix off the `-ate` verb and keeps its FACE vowel — and
    // left when the model was retrained on the curated dict. It is back for a different word because the
    // model has not been retrained since, so the shape `-ciative` was never in its training data with the
    // reduced vowel. Source N confirmed by holding the word out and reading `decompose().source`. The
    // remedy is the same retrain, not a rule: there is no spelling that says whether `-ative` reduces.
    ["appreciative", "n-gram (source N): predicts the upstream EY2 from the `-ate` stem; the `-ative` reduction is lexical and closes on a retrain"],

    // ⚠ THREE LOANWORD SPELLINGS THE n-GRAM READS AS ENGLISH, and they are here rather than fixed
    // because the fix is not available to a rule. `gaea` wants ⟨g⟩ = /d͡ʒ/ before a front vowel,
    // `mainz` and `piazza` want ⟨z⟩/⟨zz⟩ = /ts/ — and the dictionary itself splits 41 to 67 on the
    // Italian `-zz-` class (`intermezzo` already has `T S`), so there is no majority for the model to
    // have learnt and nothing to key a rule on. The model has also not been retrained since these
    // corrections landed; a retrain absorbs them for free, as #1341 did for `collaborative`.
    ["gaea", "n-gram (source N): reads ⟨g⟩ before a front vowel as /ɡ/; closes on a retrain"],
    ["mainz", "n-gram (source N): reads German ⟨z⟩ as /z/ and ⟨ai⟩ as FACE; closes on a retrain"],
    ["piazza", "n-gram (source N): reads Italian ⟨zz⟩ as /z/; the dict itself is 41-to-67 on that class"],

    // ⚠ THE COMPOUND-SEAM GEMINATE, and the remedy for these five was MEASURED AND REJECTED — do not
    // "fix" it by turning off `collapseGeminates` on the compositional paths. The dict geminates a
    // compound seam (`bookkeeper` B UH1 K K IY2 P ER0, `misspell`, `coattail`, `lamppost` — 93 rows) and
    // these five were corrected to match it, but the C/M paths collapse the seam, so each reconstructs
    // the upstream. Scoring the collapse on an UNBIASED 1-in-10 sweep of the dict says keep it: collapsing
    // matches the dict on 36 rows against 7, because `legally`/`cynically`/`artificially` really are one
    // L. Splitting it by path (keep the seam on C, collapse on M) then came out 3 against 4 — a wash —
    // because the dictionary ITSELF is inconsistent: it geminates `bookkeeper` and collapses `granddad`
    // and `spacesuit`. There is no target to converge on. See the referee audit investigation, Run 17.
    ["earrings", "seam (source M): `ear` + `rings` collapses the R R; measured, see above"],
    // ⚠ `forerunner`/`forerunners` LEFT THIS LIST AT #1344: the Moby import changed their morph stem, so
    // they no longer reconstruct the upstream shape at all. The seam reasoning below still stands for the
    // rows that remain.
    ["roommate", "seam (source C): `room` + `mate` collapses the M M; measured, see above"],
    ["roommates", "seam (source M): `roommate` + `s` collapses the M M; measured, see above"],
    ["teammate", "seam (source C): `team` + `mate` collapses the M M; measured, see above"],

    // ⚠ MORPH-PATH ROWS, like `was` above and NOT like the structural set below: each has a stem the
    // decoder reaches, and each reconstructs the upstream through a rule the morphology does not carry.
    ["truths", "morph (source M): `truth` + `s`; the /θ/ → /ðz/ plural allomorph is not in the suffix table"],
    ["matrices", "morph (source M): the -ices plural reconstructs IH0 S IH0 Z rather than IH0 S IY2 Z"],
    ["fairbanks", "morph (source M): `fairbank` + `s` reduces the compound's second element to AH0"],
    ["cannes", "morph (source M): read as an English `-es` plural; the word is French and the s is silent"],
    ["ares", "morph (source M): `are` + `s`; the word is the god's name, ˈɛɹiːz, not a plural of `are`"],
    ["idler", "morph (source M): `idle` + `er` keeps idle's syllabic l, which does not survive the suffix"],
    ["leominster", "compound (source C): split as `leo` + `minster`; the name is ˈlɛmənstɚ"],
    ["soledad", "compound (source C): split as `sole` + `dad`, which drops the middle syllable"],
    ["wolfram", "compound (source C): `wolf` + `ram` gives the second element a full vowel it does not have"],
    ["cloths", "morph (source M): `cloth` + `s`; the /θ/ → /ðz/ plural allomorph is not in the suffix table"],
    ["wreaths", "morph (source M): `wreath` + `s`; same missing /θ/ → /ðz/ allomorph as truths and cloths"],
    ["loathing", "morph (source M): decodes through the ADJECTIVE `loath` (voiceless) rather than the verb `loathe`"],
    ["lowland", "compound (source C): `low` + `land` gives -land the full vowel it keeps in woodland but not here"],
    ["neolithic", "compound (source C): `neo` + `lithic` keeps neo's full OW and its own primary stress"],
    ["breeches", "morph (source M): `breech` + `es`; the garment is said britches, the stem is not"],
]);

/**
 * THE STRUCTURAL GAP, kept separate from the three per-word oddities above so neither list can hide the other.
 *
 * `g2p-model.json` is trained on UPSTREAM CMUdict. So for a corrected word with NO morphological handle — a
 * root, a proper noun, a loan — the OOV path has only the n-gram, and the n-gram learned the row we corrected.
 * It reproduces the upstream shape by construction, and no amount of curation can change that.
 *
 * ⚠ IT IS 282 WORDS AND THAT NUMBER IS THE POINT — it is a MEASURE of the train/ship gap, not a waiver pile.
 * Every entry is a curated row whose correction the model cannot reproduce because the model learned the row we
 * corrected. When the remedy below is taken, this list should COLLAPSE, and that collapse is the test that the
 * retrain worked. If it instead keeps growing while nobody retrains, the gate is telling you the curated layer
 * and the OOV path have drifted apart, which is exactly what it is for.
 *
 * ⚠ THIS SET GREW FROM 0 TO 14 IN ONE CHANGE and that is not a regression: the #1334 audit corrected 88 dict
 * rows where wikipron AND misaki gold agree against CMUdict, and the ones with a stem to decode through
 * (`annulled` ← `annul`, `writhed` ← `writhe`, `insularity` ← `insular`, `debriefing` ← `debrief`) closed
 * themselves as soon as the STEM was corrected too — which is how four of them left this list during that run.
 * What remains is the residue that has nowhere to propagate from.
 *
 * ⚠ AND A RULE IS NOT THE ANSWER EITHER — THAT WAS MEASURED. Most of this set is the unstressed `en-`/`em-`/
 * `ex-`/`es-` prefix, which looks productive enough to belong in the converter rather than in 187 dict rows.
 * It is not. Of the dict rows starting `EH0` that gold also carries, gold REDUCES 36 and keeps a full `ɛ` in
 * 36; restricting to the ones gold leaves unstressed only moves it to 36 reduce / 27 keep. `embark`, `employ`,
 * `enforce`, `encourage` reduce while `aesthetic`, `ecstatic`, `erroneous`, `endemic`, `estonia` do not, and
 * gold splits even within one stem (`employ` ɪmplˈY but `employee` ˌɛmplˌYˈi; `enclosed` but `enclosure`).
 * There is no phonological discriminator: it tracks how far the prefix has assimilated, which is lexis. A
 * converter rule would be wrong 43% of the time, so the dictionary is the right mechanism.
 *
 * ⚠ THE REMEDY WAS TAKEN, AND THIS IS WHAT IT BOUGHT (#1341). The model now trains on the CURATED dict —
 * `en_g2p_ngram.ts` is given a CMUdict-format re-emission of `g2p-dict.tsv` instead of upstream — and the
 * set collapsed from 346 to 115, with 213 rows closing. Held-out exact went 48.90% → 49.43%, the whole gain
 * in source N, which is the correct signature: C and M decode through the DICTIONARY, so only the n-gram
 * tier can move when only the model changes.
 * ⚠ AND THE TWO NAMED n-gram GAPS BELOW WENT WITH IT — `collaborative` ("predicts the upstream EY2; -ative
 * is a class morphology cannot reach") and `research` ("the #1280 stress shift is lexical") are gone from
 * KNOWN_GAPS entirely. They were the rows the remedy was named for.
 * ⚠ WHAT DID NOT MOVE IS THE POINT: the M and C residue held at exactly 22 and 21. Those are morph and
 * compound-seam gaps — `truths`' /θ/→/ðz/ allomorph, the `roommate` seam — and no retrain can reach them,
 * because they are not the model's answer. A future collapse of THIS set means the same remedy again;
 * a collapse of those means something else was fixed.
 *
 * The original note, kept because the reasoning is still why the set exists: train the model on the CURATED
 * dict rather than on upstream CMUdict — `en_g2p_ngram.ts` reads $CMUDICT directly, so applying g2p-curated.tsv to its input
 * before the EM alignment would close this class outright, for these 14 and for every future correction.
 * That is a model regeneration with fleet-wide OOV consequences (held-out accuracy, the parity goldens and
 * the referee floors all move), so it is deliberately NOT bundled into a manual-correction PR.
 */
const STRUCTURAL_GAP = new Set([
    "abba", "acuff", "atman", "babka", "baile", "bellini", "benne", "bes", "boche", "bog", "bridie", "calabria",
    "cana", "casual", "chomp", "coauthor", "conger", "conversely", "convex", "cost", "cruelty", "cutoff", "dacron",
    "dagenham", "dal", "drachma", "duce", "dulce", "eamon", "eh", "embargo", "embark", "embrace", "embroidery",
    "encode", "encompass", "endorse", "endow", "enjoyment", "enliven", "enmesh", "envisage", "envision", "escudo",
    "esse", "evolve", "excoriate", "extort", "extortion", "extortionate", "extortionist", "fie", "finland",
    "forensic", "foster", "frog", "gala", "galloway", "genotype", "golf", "graben", "grana", "granum", "hadrian",
    "hamm", "harring", "heifer", "hog", "homs", "hulme", "hypertrophy", "ideal", "insular", "joseph", "kana",
    "kanji", "kersey", "kinda", "kingsport", "knockoff", "lachlan", "lough", "masochist", "mende", "mezzo",
    "minke", "monarchy", "mulligatawny", "myre", "nerine", "olde", "on", "onset", "pedicure", "poor", "pravda",
    "quahog", "rahway", "repression", "repressive", "repulsive", "retention", "reunite", "revolve", "riel",
    "runoff", "sandhog", "sauternes", "schedule", "selene", "semi", "smyre", "soave", "sodom", "sodomize",
    "soffit", "spawn", "splenic", "stanch", "stasi", "stomp", "strata", "stratus", "suggestive", "swanky", "thyme",
    "turnoff", "ulm", "unencumbered", "unreal", "vela", "wank", "wat", "watchdog", "williamsport", "zaftig"
]);

function dict(path: string): Map<string, string[]> {
    const m = new Map<string, string[]>();
    for (const l of readFileSync(path, "utf8").split("\n")) {
        if (l.startsWith("#") || !l.includes("\t")) continue;
        const [w, ph] = l.split("\t");
        const wl = w!.toLowerCase();
        if (/^[a-z]+$/.test(wl)) m.set(wl, ph!.split(" "));
    }
    return m;
}

describe("the curated layer against the OOV path", () => {
    const full = dict(join(EN, "g2p-dict.tsv"));
    const model = JSON.parse(readFileSync(join(EN, "g2p-model.json"), "utf8")) as EnglishG2pModel;
    const common = new Set(
        readFileSync(join(EN, "g2p-common.txt"), "utf8").split("\n").map((s) => s.trim()).filter(Boolean),
    );
    const classes = { ...MANIFEST.g2pClasses, vowels: MANIFEST.arpabet.vowels };

    const curated: { word: string; upstream: string; want: string }[] = [];
    for (const l of readFileSync(join(EN, "g2p-curated.tsv"), "utf8").split("\n")) {
        if (l.startsWith("#") || !l.includes("\t")) continue;
        const [word, upstream, want] = l.split("\t");
        curated.push({ word: word!, upstream: upstream!, want: want! });
    }

    // ⚠ ONE ROW PER WORD, and this exists because #1334 broke it. A word corrected in two separate passes
    // (`chillicothe`, LOT/THOUGHT and then the loanword final `-e`) got TWO rows, whose `upstream` columns
    // chained: the second row's upstream was the first row's output. The test below reads the FIRST match, so
    // it compared the shipped dict against a superseded value and failed with a message about the wrong thing.
    // A duplicate also makes the file's central claim — "this is the record needed to re-apply after an
    // --emit" — false, because replaying the rows in order depends on which one you take.
    test("no word has two curated rows", () => {
        const seen = new Map<string, number>();
        for (const { word } of curated) seen.set(word, (seen.get(word) ?? 0) + 1);
        expect([...seen.entries()].filter(([, n]) => n > 1).map(([w]) => w)).toEqual([]);
    });

    test("every curated row is still applied in the shipped dict", () => {
        // ⚠ THE FIRST THING AN --emit WOULD BREAK. If this fails, the dict was regenerated from CMUdict and
        // the curated layer was dropped; re-apply g2p-curated.tsv before shipping.
        expect(curated.length).toBeGreaterThan(15);
        for (const { word, want } of curated) {
            expect(`${word}: ${full.get(word)?.join(" ")}`).toBe(`${word}: ${want}`);
        }
    });

    test("no curated row falls back to the upstream shape on the OOV path, beyond the known gaps", () => {
        const live: string[] = [];
        for (const { word, upstream } of curated) {
            const held = new Map(full);
            held.delete(word);
            const g2p = createEnglishG2p(model, held, common, (p: string[]) => p.join(" "), classes);
            if (g2p.decompose(word).phones.join(" ") === upstream) live.push(word);
        }
        expect(live.filter((w) => !KNOWN_GAPS.has(w) && !STRUCTURAL_GAP.has(w))).toEqual([]);
        // ⚠ AND NEITHER WAIVER LIST MAY ROT. A gap that closes should be deleted, not left behind to mask
        // the next one — which is exactly what caught the four stem-corrected words during #1334.
        expect([...KNOWN_GAPS.keys()].filter((w) => !live.includes(w))).toEqual([]);
        expect([...STRUCTURAL_GAP].filter((w) => !live.includes(w))).toEqual([]);
    });
});
