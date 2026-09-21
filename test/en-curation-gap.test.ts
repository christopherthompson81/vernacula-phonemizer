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

    // ⚠ THE MODEL WAS RETRAINED ON THE CORRECTED DICTIONARY IN #1400, AND THIS LIST IS WHAT SURVIVED.
    // 70 gaps closed, 16 opened, live gaps 253 → 199 — source N 170 → 116, with M and C unchanged at 26
    // and 57, which is the correct signature: those two tiers decode through the DICTIONARY, so only the
    // n-gram can move when only the model changes.
    //
    // ⚠ AND FIVE ROWS PROMISED "CLOSES ON A RETRAIN" AND DID NOT CLOSE. That claim was written four
    // separate times in this file, inherited from #1341's `collaborative`, and it was never testable
    // until the retrain ran. `gaea`, `mainz`, `piazza` and `cham` want a LOANWORD spelling rule
    // (⟨g⟩ = /d͡ʒ/, ⟨z⟩/⟨zz⟩ = /ts/, ⟨ch⟩ = /k/) that the dictionary has no majority for — the
    // Italian `-zz-` class splits 41 to 67 — so there is nothing for the model to generalise FROM, no
    // matter what it trains on. `destabilize` is the same: its family is four words against a
    // dictionary-wide pattern that runs the other way. A retrain absorbs a row whose shape is ALREADY
    // THE MAJORITY somewhere in the training data; it cannot invent one.
    ["gaea", "n-gram (source N): reads ⟨g⟩ before a front vowel as /ɡ/; NOT closed by #1400's retrain — needs a loanword rule"],
    ["mainz", "n-gram (source N): reads German ⟨z⟩ as /z/ and ⟨ai⟩ as FACE; NOT closed by #1400's retrain"],
    ["piazza", "n-gram (source N): reads Italian ⟨zz⟩ as /z/; the dict itself is 41-to-67 on that class, so there is no majority to learn"],
    ["cham", "n-gram (source N): reads ⟨ch⟩ as /t͡ʃ/, right for the English word and wrong for this title; NOT closed by #1400's retrain"],
    ["destabilize", "n-gram (source N): the `de-` prefix vowel; its family is four words against a dictionary-wide pattern running the other way, so the retrain did not reach it"],

    // ⚠ SIXTEEN ROWS THE RETRAIN OPENED, and they are the cost side of a 70-for-16 trade. The model now
    // trains on the CORRECTED dictionary, so it generalises from corrected classes — and for these
    // sixteen that generalisation lands on the shape the curated row removed. Every one is source N.
    // ⚠ THEY ARE NOT THE SAME KIND OF ROW AS THE ONES ABOVE. A gap above is the model RECALLING an
    // upstream row it memorised; these are the model GENERALISING from a class, and arriving at the
    // upstream answer by a different route. Reverting any of them would put back a reading three
    // outside sources disagree with, to satisfy a model that is now better on 70 other words.
    ["brothel", "n-gram (source N): generalises ⟨o⟩ to LOT; opened by #1400's retrain"],
    ["carcinogenic", "n-gram (source N): opened by #1400's retrain"],
    ["clio", "n-gram (source N): opened by #1400's retrain"],
    ["enhance", "n-gram (source N): opened by #1400's retrain"],
    ["favela", "n-gram (source N): opened by #1400's retrain"],
    ["foggy", "n-gram (source N): generalises ⟨o⟩ to LOT; opened by #1400's retrain"],
    ["hoss", "n-gram (source N): opened by #1400's retrain"],
    ["lorain", "n-gram (source N): opened by #1400's retrain"],
    ["pretzel", "n-gram (source N): opened by #1400's retrain"],
    ["saas", "n-gram (source N): opened by #1400's retrain"],
    ["serologist", "n-gram (source N): opened by #1400's retrain"],
    ["soprano", "n-gram (source N): opened by #1400's retrain"],
    ["stich", "n-gram (source N): opened by #1400's retrain"],
    ["stipend", "n-gram (source N): opened by #1400's retrain"],
    ["unwanted", "n-gram (source N): opened by #1400's retrain"],
    // ⚠ `ya` IS THE ONE THIS LOG ALREADY NAMED. #1369 recorded `ya Y AA1 → Y AH0` as "the only edit
    // that strips a word's sole primary stress"; the model predicts the stressed form from two letters.
    ["ya", "n-gram (source N): predicts Y AA1, the sole-primary row #1369 flagged; opened by #1400's retrain"],

    // ⚠ `upholstery` AND `upholster` WERE HERE AND ARE GONE, which is this list working as designed.
    // They read ⟨ph⟩ across the up·holstery seam as a /f/-less /p/, the note said "a retrain closes
    // both", and #1400's retrain closed both. They are removed rather than left behind to mask the next
    // row — the rule the `waiver may not rot` assertion below enforces, and the assertion is what
    // caught them.

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
    // ⚠ THIS NOTE USED TO CITE `woodland` AS A WORD WHERE -land KEEPS THE FULL VOWEL. It no longer does:
    // #1369 corrected `woodland`, `midland` and `northland` to the reduced vowel on Moby+gold agreement, so
    // all four `-land` rows now reduce and the compound path gives all four the full vowel from `land`.
    // ⚠ AND `-land` IS NOT A RULE — MEASURED BEFORE WAIVING THESE. Each source stated on ITS OWN
    // population, because they barely overlap: gold covers only 88 of our 330 `-land` rows (27%), so
    // "gold on the same words" would be a quarter-sized subsample quoted against a full-population
    // count. Our dict: 257 of 330 reduced, 73 full. Gold's own `-land` entries: 125, of which 49
    // reduced and 71 full. Both split, and neither is near one-sided.
    // The line is COMPOUND TRANSPARENCY — `Disneyland`, `Dixieland`, `Lapland`, `Basutoland` keep the
    // full vowel; `England`, `Finland`, `Holland`, `Iceland`, `Auckland`, `Cleveland` reduce — and no
    // spelling predicts which a word is. A rule would be wrong roughly half the time either way round.
    // (Examples drawn from gold's list, not from ours: an earlier version of this note cited `ashland`
    // and `boland`, which have no gold entry at all, immediately after quoting a gold figure.)
    ["lowland", "compound (source C): `low` + `land` takes the full vowel from the free-standing `land`"],
    ["midland", "compound (source C): same `-land` shape as lowland"],
    ["northland", "compound (source C): same `-land` shape as lowland"],
    ["woodland", "compound (source C): same `-land` shape as lowland"],
    ["dextran", "compound (source C): decomposes to a free `-an` and takes its full vowel; the chemical suffix reduces"],
    ["fistful", "morph (source M): `fist` + `ful`, and the allomorph reduces where gold and Moby both keep ʊ"],
    ["shellacking", "morph (source M): `shellac` + `ing` keeps the stem's full ɛ; the derived form reduces it"],
    // ⚠ SOURCE C, WHICH IS SURPRISING FOR A SURNAME and is why the source was read rather than assumed:
    // `hutchins` decomposes on the compound path and reassembles the upstream `T CH`. Moby
    // (`'h/@//tS//I/nz`) and the en-GB referee (`hʌt͡ʃɪnz`) both give a single affricate.
    ["hutchins", "compound (source C): reassembles the upstream T CH across the seam it finds"],
    // ⚠ THE SAME SHAPE, AND THE REASON THE COMPOUND PATH CANNOT ARBITRATE THIS CLASS: it splits
    // `whit` + `church` mechanically and rebuilds the /t/, exactly as it does for the GENUINE seam
    // `christchurch`. The path cannot tell an opaque compound from a transparent one, which is the
    // distinction the correction turns on — en-GB carries `whitechurch waɪtt͡ʃɜːt͡ʃ` (transparent,
    // keeps the /t/) against a reduced `whitchurch`.
    ["whitchurch", "compound (source C): `whit` + `church` rebuilds the upstream T CH"],
    // ⚠ SOURCE C ON A SIX-LETTER WORD, which is why the source was read rather than assumed: the
    // compound path finds `bar` + `bel` and reassembles the upstream EH2. Gold `bˈɑɹbᵊl` and our own
    // `barbels` both reduce it.
    ["barbel", "compound (source C): `bar` + `bel` rebuilds the upstream EH2"],
    ["breeches", "morph (source M): `breech` + `es`; the garment is said britches, the stem is not"],

    // ⚠ TWENTY-NINE COMPOUND-PATH ROWS WITH ONE CAUSE, AND THE CAUSE HAS SINCE BEEN NARROWED, NOT FIXED.
    // `compoundSplit` used to end with `parts.flatMap((p, i) => (i === 0 ? p : stressDown(p)))` — every
    // piece but the first stressed down, UNCONDITIONALLY — so the path fore-stressed `over|come`,
    // `back|yard` and `con|volution` by construction. It now consults `stemStressPrefixes`, which is
    // right on 84.1% of the 13,661 words the path decodes against 78.8% before, and that closed
    // `archduke`, `miscue`, `neolithic` and `psychosocial` off these lists.
    // ⚠ `hypertrophy` IS NOT ONE OF THEM, and a first version of this comment said it was. `hyper`
    // measures 56% and does not clear the list's floor, so `hypertrophy` is still in STRUCTURAL_GAP
    // below — four lines from a comment that claimed it had closed.
    // ⚠ `archduke` LEFT THIS LIST BY RULE rather than by a dictionary entry — the same row #1379 had to
    // waive — which is the outcome the rule was for.
    // ⚠ THE ROWS BELOW ARE WHAT THE LIST DELIBERATELY DOES NOT REACH. `over`, `under`, `super`, `multi`,
    // `poly` and `post` measure around half for the stem — they carry their own stress and behave like
    // the first element of a compound as often as not — and `back`, `head`, `home`, `mid`, `ever` and
    // `never` are compound first elements, where fore-stress is right 96% of the time. A coin flip does
    // not belong in a rule, so these stay dictionary rows.
    // ⚠ `arch` IS NOT IN THAT SENTENCE ANY MORE. It IS in `stemStressPrefixes` (75%, n=12), which is
    // exactly what closed `archduke`, and an earlier version of this comment listed it among the
    // compound first elements the list does not reach — contradicting its own previous paragraph.
    ["backyard", "compound (source C): a compound first element, where fore-stress is right 96% of the time"],
    ["convolution", "compound (source C): a prefix the stem-stress list deliberately does not reach"],
    ["overcome", "compound (source C): a prefix the stem-stress list deliberately does not reach"],
    ["overpay", "compound (source C): a prefix the stem-stress list deliberately does not reach"],
    ["overtake", "compound (source C): a prefix the stem-stress list deliberately does not reach"],
    ["undermine", "compound (source C): a prefix the stem-stress list deliberately does not reach"],
    ["underpin", "compound (source C): a prefix the stem-stress list deliberately does not reach"],
    ["undertake", "compound (source C): a prefix the stem-stress list deliberately does not reach"],
    ["alternation", "compound (source C): a prefix the stem-stress list deliberately does not reach"],
    ["countervail", "compound (source C): a prefix the stem-stress list deliberately does not reach"],
    ["evermore", "compound (source C): a prefix the stem-stress list deliberately does not reach"],
    ["headmistress", "compound (source C): a prefix the stem-stress list deliberately does not reach"],
    ["homestretch", "compound (source C): a prefix the stem-stress list deliberately does not reach"],
    ["midstream", "compound (source C): a prefix the stem-stress list deliberately does not reach"],
    ["nevermore", "compound (source C): a prefix the stem-stress list deliberately does not reach"],
    ["outsmart", "compound (source C): a prefix the stem-stress list deliberately does not reach"],
    ["overbuy", "compound (source C): a prefix the stem-stress list deliberately does not reach"],
    ["overfill", "compound (source C): a prefix the stem-stress list deliberately does not reach"],
    ["overreach", "compound (source C): a prefix the stem-stress list deliberately does not reach"],
    ["overrule", "compound (source C): a prefix the stem-stress list deliberately does not reach"],
    ["oversell", "compound (source C): a prefix the stem-stress list deliberately does not reach"],
    ["overstep", "compound (source C): a prefix the stem-stress list deliberately does not reach"],
    ["overstuff", "compound (source C): a prefix the stem-stress list deliberately does not reach"],
    ["overtax", "compound (source C): a prefix the stem-stress list deliberately does not reach"],
    ["stockade", "compound (source C): a prefix the stem-stress list deliberately does not reach"],
    ["undersell", "compound (source C): a prefix the stem-stress list deliberately does not reach"],
    ["undersized", "compound (source C): a prefix the stem-stress list deliberately does not reach"],
    ["understate", "compound (source C): a prefix the stem-stress list deliberately does not reach"],
    ["underweight", "compound (source C): a prefix the stem-stress list deliberately does not reach"],
    ["understaffed", "morph (source M): `understaff` + `ed`; the stem is not in the referees' intersection"],

    // ⚠ TWO OPENED BY THE COMPOUND PATH'S NEW STRESS POLICY, and they are the honest price of it.
    // `stemStressPrefixes` makes the path stem-stress a prefixed form, which is right 84% of the time and
    // closed `archduke`, `miscue`, `neolithic` and `psychosocial` — four entries that used to be on these
    // lists and are gone. It is wrong on these two.
    // ⚠ `psycho` IS WRONG IN BOTH DIRECTIONS AT ONCE, which is the argument for the rule rather than
    // against it: `psychosocial` ˌsaɪkoʊˈsoʊʃəl is stem-stressed and both referees say so, while
    // `psychobabble` ˈsaɪkoʊˌbæbəl is fore-stressed and both referees say so. No setting of the list
    // reaches both — which is why one of them is a dictionary row.
    // ⚠ `extraordinary` IS NOT A STRESS ROW AT ALL. Its correction is segmental (`EH2 K S T R AH0 AO1` →
    // `IH0 K S T R AO1`, a syllable the word does not have), and the new policy simply moved the OOV
    // answer onto the upstream shape. A retrain reaches it; the other two cannot be reached by one.
    ["psychobabble", "compound (source C): `psycho` is a stem-stress prefix and this word is fore-stressed"],
    ["extraordinary", "compound (source C): a segmental correction the policy change exposed; closes on a retrain"],
    // ⚠ TWO MORPH-PATH ROWS WHOSE STEMS ARE DELIBERATELY NOT MOVED WITH THEM, and that is the whole
    // entry: correcting the stem is what closed `outdated` and `overpayment`, which were live in the
    // first cut of this block and are not here. These two cannot take that remedy.
    // `handcraft` is a NOUN and fore-stressed correctly (ˈhændˌkræft); the participle `hand-crafted` is
    // not, and no referee disputes the stem. `override` is the noun/verb pair itself — ˈoʊvɚˌraɪd against
    // ˌoʊvɚˈraɪd — and the dict carries one row, so `overriding` decodes through the noun's placement.
    ["handcrafted", "morph (source M): `handcraft` + `ed`; the stem is a correctly fore-stressed noun"],
    ["overriding", "morph (source M): decodes through `override`, which the dict carries as the noun"],
]);

/**
 * THE STRUCTURAL GAP, kept separate from the three per-word oddities above so neither list can hide the other.
 *
 * `g2p-model.json` is trained on UPSTREAM CMUdict. So for a corrected word with NO morphological handle — a
 * root, a proper noun, a loan — the OOV path has only the n-gram, and the n-gram learned the row we corrected.
 * It reproduces the upstream shape by construction, and no amount of curation can change that.
 *
 * ⚠ IT IS 173 WORDS AND THAT NUMBER IS THE POINT — and it said 282 while the set held 149, which is
 * the one thing a comment whose whole claim is "this number is a measurement" may not do — it is a MEASURE of the train/ship gap, not a waiver pile.
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
 * ⚠ AND TAKEN A SECOND TIME IN #1400, because 2,000 more corrections had landed since. Live gaps
 * 253 → 199; THIS SET 173 → 116, with 57 rows closing. Source N 170 → 116; M and C unchanged at 26 and
 * 57, the same signature as last time. 16 rows OPENED, listed individually in KNOWN_GAPS — a retrained
 * model generalises from the corrected classes, and for those sixteen the generalisation lands on the
 * shape the correction removed. A 70-for-16 trade on the n-gram tier.
 * ⚠ AND FIVE ROWS THAT PROMISED "CLOSES ON A RETRAIN" DID NOT CLOSE. See KNOWN_GAPS: `gaea`, `mainz`,
 * `piazza`, `cham` and `destabilize` need a majority in the training data that does not exist. The claim
 * had been written four times in this file and was never testable until the retrain ran.
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
    // ⚠ THREE ADDED BY THE #1377 PROPER-NOUN SKELETON FIX, and 29 of that block's 33 rows open no gap at
    // all — a consonant repair on a name mostly propagates, because the spelling that was misread is the
    // same spelling the OOV path decodes. (A fourth of the 33, `homs`, is on this list further down; it
    // was already live before the block and its row changing did not close it.)
    // These three are the ones no rule can reach. `basle` (N) and `waal` (N) are foreign orthography with
    // no English analogue: a silent ⟨s⟩ before ⟨le⟩ and a Dutch ⟨w⟩ read as /v/. Any rule general enough
    // to catch them would wreck `hassle` and `wall`. `showa` (N) is the ⟨ow⟩+vowel ambiguity English does
    // not resolve by spelling — `lower` has no /w/ and `power` does.
    // ⚠ `salamis` WAS HERE AND IS NOT ANY MORE, because the dictionary row was reverted instead. Its OOV
    // answer is source M: `salami` + `-s`, which is right for every word that is not the Greek island —
    // and running text means the plural. Waiving the gap was the wrong remedy; the sieve had simply
    // caught a homograph, the same way it caught `tours`.
    // ⚠ AND `basle` IS GONE TOO, CLOSED BY #1400's RETRAIN — which is worth noticing, because the
    // paragraph above calls it orthography "no rule can reach". No RULE can; a model trained on the
    // corrected dictionary evidently can. `waal` and `showa` did not close.
    "showa", "waal",
    // ⚠ TWENTY-FOUR ADDED BY THE STRESS BLOCK, all source N, and they are the class this list is a measure of:
    // the model learned CMUdict's placement for exactly these words, so held out it reproduces it. They
    // have no morphological handle the corrected dict could propagate through — `impasse`, `inverse`,
    // `dictator` and `truncation` are roots or opaque derivations — and there is no spelling that says
    // which syllable an English word stresses, so no rule is available either.
    // ⚠ "A RETRAIN ON THE CURATED DICT CLOSES ALL 24" IS WHAT THIS BLOCK USED TO SAY, AND #1400's
    // RETRAIN DISPROVED IT: 18 closed and SIX did not — the six still listed below. `foment` is among
    // the closed ones, so the prose example list above is also one word out of date and is corrected.
    // The same correction is recorded for five KNOWN_GAPS rows; this is the bulk half of it. A retrain
    // absorbs a row whose shape is already the majority somewhere in the training data, and stress
    // placement on an opaque root has no such majority — which is why these six are the residue.
    "dictator", "impasse", "inbred",
    "inverse",
    "truncation", "unbolt",
    // ⚠ ONE OF THE TWO ADDED BY THE #1375 AUDIT SWEEP: `khaki`, where the n-gram learned CMUdict's
    // ˈkɑki. `lech` was the other and closed on #1400's retrain.
    "khaki",
    // ⚠ ONE OF THE TWO ADDED BY THE #1372 SYNCOPE FIX (`indifferent` closed on #1400's retrain). ⚠ AND MOST OF THAT BLOCK IS NOT HERE,
    // which is the useful half: `several` and `differently` were NOT live splits, because the OOV
    // path ALREADY predicted the corrected form — `differently` is source M and decodes through
    // `different`, whose row already carried the schwa. The dictionary row was the outlier against
    // our own morphology, not just against the two external sources.
    "elbe",
    // ⚠ THE #1371 ⟨tch⟩ FIX HAD TWO ROWS HERE — `blotch` and `blotchy` — AND #1400's RETRAIN CLOSED
    // BOTH, so this block now heads nothing and is kept only for what it records: of the seven `blotch`
    // rows, only those two were ever open. `blotched` and `blotching` closed through the corrected stem
    // when the fix landed; `blotches`, `blotchier` and `blotchiest` never matched upstream at all, for
    // schwa and vowel reasons unrelated to the T.
    // ⚠ FOUR ADDED BY THE #1369 SCHWA ARBITRATION, all source N and all the same shape as the rest of this
    // list: the n-gram learned the upstream row, so it reproduces it by construction. `adman`/`chessman`
    // are the `-man` second element, which gold itself splits (`adman` æ, `guardsman` ə) with no spelling
    // to key on; `sputnik` is a proper noun with no morphological handle at all. ⚠ `navarre` was the
    // fourth and closed on #1400's retrain, so THREE of the four remain.
    "adman", "chessman", "sputnik",
    "acuff", "atman", "baile", "bellini", "bes", "boche", "bog", "bridie", "calabria",
    "cana", "casual", "conger", "conversely", "convex", "cost", "cruelty", "cutoff", "dacron",
    "dagenham", "dal", "drachma", "duce", "dulce", "eamon", "eh", "embargo", "embark", "embrace",
    "encode", "encompass", "endorse", "endow", "enjoyment", "enliven", "enmesh", "envision",
    "esse", "evolve", "fie", "finland",
    "forensic", "foster", "frog", "gala", "galloway", "genotype", "golf", "graben", "grana", "granum", "hadrian",
    "hamm", "harring", "heifer", "homs", "hulme", "hypertrophy", "joseph", "kana",
    "kanji", "kersey", "kinda", "kingsport", "knockoff", "lachlan", "lough", "mende",
    "minke", "monarchy", "nerine", "olde", "on", "onset", "poor", "pravda",
    "quahog", "rahway", "reunite", "revolve", "riel",
    "runoff", "sandhog", "sauternes", "selene", "semi", "soave", "sodomize",
    "soffit", "splenic", "stanch", "stasi", "strata", "stratus",
    "turnoff", "ulm", "unencumbered", "unreal", "vela", "wank", "wat", "watchdog", "williamsport", "zaftig",
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
    const classes = {
        ...MANIFEST.g2pClasses,
        vowels: MANIFEST.arpabet.vowels,
        letterNameExceptions: MANIFEST.letterNameExceptions,
    };

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
