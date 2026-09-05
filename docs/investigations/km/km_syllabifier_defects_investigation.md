# Khmer syllabifier — two residual defect classes, and an end-to-end measurement

Opened after a maturity-doc audit found the `km` row ten commits stale. Refreshing it surfaced two things the
row could not answer, both quoted from the live referee residual:

- an **inserted nasal** — កម្លាំង → `kɑmlamŋ` against gold `kɑmlaŋ`
- a **dropped final syllable** — កញ្ចក់ → `kɑɲ` against gold `kɑɲcaʔ`

and a third, structural: **the shipped dict-first path has no end-to-end measurement at all**, because the
exceptions lexicon was mined from the only referee, so scoring the shipped path against wikipron is circular.

The question this doc answers: are those two real rule bugs (fixable) or referee noise, and can the shipped
path be measured without circularity?

## Run 1 — 2026-08-09 10:40 — reproduce, and find they are not two bugs but three shapes

    npx tsx scratchpad/probe.ts     # phonemizeWordRules vs phonemizeWord on hand-picked shapes

| word | rules | shipped (lexicon) |
|---|---|---|
| កម្លាំង | `kɑmlamŋ` | kɑmlɑŋ |
| កញ្ចក់ | `kɑɲ` | kɑɲcɑʔ |
| ចំណង | `cɑmnŋɑː` | cɑmnɑːŋ |
| សំណង់ | `sɑmn` | sɑmnɑŋ |
| កំណត់ | `kɑmn` | kɑmnɑt |
| កាំង | `kamŋ` | kɑŋ |

The two reported words were the visible tip. Reading PASS 2 of `phonemizeWordRules` gives the causes, and the
dropped-syllable defect is **two independent guard failures that happen to produce the same symptom**:

1. **The trailing-bare-unit rule discards a unit that already owns a coda.** កញ្ចក់ scans to
   `[ក][ញ្ច][ក់]`. The bantaq rule correctly assigns ក as ញ្ច's coda and drops the ក់ unit. Then the
   trailing rule sees ញ្ច as a bare final unit, takes its `ons[0]` as ក's coda, and **slices it away** —
   discarding the coda ក that had just been assigned to it. A whole syllable disappears.
2. **The medial-bare rule steals a unit that already owns a coda.** កំណត់ scans to `[កំ][ណ][ត់]`; the
   bantaq rule gives ណ the coda ត, then the medial rule takes ណ as កំ's coda and drops it, ត with it.
3. **The medial-bare rule also steals the onset of the final syllable.** ចំណង scans to `[ចំ][ណ][ង]`. ណ is
   medial and bare so the rule fires, leaving ង stranded as its own unit, which then renders with a long
   inherent vowel — hence the garbled `cɑmnŋɑː`. ណ is the *onset* of syllable 2 and ង is its coda.

So: three missing guards, not two bugs. All three are "a rule consumed a unit without asking whether that unit
was already carrying something".

**The inserted nasal is a different, data-answerable question**, so it does not get guessed at — see Run 2.

## Run 2 — 2026-08-09 10:47 — what does ⟨ំ⟩ + a following consonant actually do?

The naive reading of កម្លាំង is that ាំ carries its own `-m` and the ង then adds `ŋ`, giving `amŋ`. Asked the
referee which consonants after ⟨ំ⟩ keep the m:

    python3 - <<'PY'   # 7,108 wikipron rows; bucket by the consonant following ំ
    ...
    PY

| next | total | ipa has an m | no m |
|---|---|---|---|
| ណ | 102 | 102 | 0 |
| **ង** | **88** | **14** | **68** |
| ព | 64 | 64 | 0 |
| ប | 60 | 60 | 0 |
| ន | 50 | 50 | 0 |
| រ | 49 | 49 | 0 |

⟨ង⟩ is the **only** environment that drops the m, and every other consonant keeps it exceptionlessly
(កាំបិត → `k a m ɓ ə t`, កាំជ្រួច → `k a m c r u ə c`). So the merge is real and narrow.

⚠ **The 14 counter-examples are not counter-examples, and checking them changed the rule.** The word-level
test ("does an m appear anywhere in the IPA") is crude, so all 20 words with a literal ⟨ំង⟩ substring and an m
were read individually. Every one has its m from *elsewhere* — កម្លាំង's m is the ម of the ម្ល medial
cluster, and ាំង itself is still `a ŋ`. But two are genuinely different:

    ជំងឺ    → c u m ŋ ɨː       ង carries its own vowel ឺ
    ទំងន់   → t u m ŋ ŭ ə n    ង is bare but OPENS a syllable closed by ន់

Both keep the m. So the rule is **not** "⟨ំ⟩ before ⟨ង⟩" — it is **"⟨ំ⟩ in a syllable whose CODA is ⟨ង⟩"**.
Had I stopped at the bucket table I would have written the substring rule and broken both of these. In PASS-2
terms the condition is available directly: the unit's assigned `coda === ង`.

Note this depends on the Run-1 guards being in place: without them ទំងន់ mis-parses anyway.

## Run 3 — 2026-08-09 11:05 — implement the four changes, and measure

Four changes in `phonemizeWordRules`, three of them guards on rules that CONSUME a unit:

- trailing-bare-unit rule: require `last.coda === null`
- medial-bare rule: require `cur.coda === null`
- medial-bare rule: skip when the next unit is bare and final (then `cur` is an onset, not a coda)
- PASS 3: strip a nikahit nucleus's trailing `m` when the unit's assigned coda is ⟨ង⟩

<!-- -->

    npx tsx tools/referee-eval/eval.ts km

| metric | before | after |
|---|---|---|
| raw exact | 3,411 (48.0%) | **3,581 (50.4%)** |
| folded backbone | 3,980 (56.0%) | **4,248 (59.8%)** |
| symbol accuracy | 81.9% | **84.2%** |

**+3.8pp folded, +2.4pp raw, +2.3pp symbol** on 7,108 human transcriptions. No fold was touched, so this is
the engine getting words right that it previously got wrong, not the metric being loosened.

Per-word A/B (`tools/khmer/ab_syllabifier_fix.ts`, both sides on identical folds):

    words: 7108   gained: 268   lost: 0   net: +268

| class (orthographic shape) | n | before | after |
|---|---|---|---|
| bantaq-coda dropped syllable | 686 | 55.0% | **71.4%** |
| medial-bare onset theft | 30 | **0.0%** | **93.3%** |
| nikahit + ⟨ង⟩ coda | 88 | 3.4% | **63.6%** |
| final cluster (coeng) | 3,486 | 50.5% | 53.3% |

**Zero regressions.** The medial-bare class was 0.0% — every one of those 30 words was wrong, the same shape
as the independent-vowel finding (a class that is entirely broken reads as a rounding error in the headline).

⚠ **440 exceptions-lexicon rows are now redundant** — words the lexicon was memorising that the rules now
derive. Not pruned: the lexicon still wins at lookup so the shipped output is unchanged either way, and
pruning would alter the raw (unfolded) reading of 440 words for no measurable gain. Recorded because it is
evidence the fix GENERALISED rather than special-cased — the guards paid for 440 hand-mined entries.

## Run 4 — 2026-08-09 11:30 — why the shipped path could not be measured, stated exactly

Before measuring, the construction that blocks it, checked rather than assumed:

    referee ∩ exceptions lexicon = 2,822 of 2,822   ← mined FROM the referee; scoring it is circular
    referee ∩ dictionary tier    =     0 of 56,355  ← the builder EXCLUDES every referee word by design

Both directions are airtight, and they block measurement in opposite ways. Masking the exceptions lexicon and
scoring the referee does **not** measure the shipped path — it reproduces the rules number exactly, because
the dictionary tier cannot contribute a single referee word. So the naive "hold out the lexicon" experiment
answers nothing, and that is worth writing down before running it.

## Run 5 — 2026-08-09 11:45 — rebuild BOTH tiers against an 80% split, then score the 20%

The experiment that does work: split the referee's 6,628 unique words 80/20 on a hash, and rebuild both tiers
as if only the 80% had ever existed — dropping held-out rows from the exceptions lexicon, and re-running the
builder's own `convert()` with the **exclusion gate seeing only the 80%**, so held-out words the dictionary
covers now enter the tier exactly as they would have if the referee had never listed them.

    npx tsx tools/khmer/eval_shipped_heldout.ts <km/data/lexicon.tsv>

| on the 1,296 held-out words | folded |
|---|---|
| rules only | 62.3% |
| **shipped (dict-first)** | **73.1%** |

**+10.8pp for the shipped path over the rules, on vocabulary neither tier was built around.** This is the
first end-to-end number this language has had, and the first evidence that the dictionary tier's `+15pp`
transfer argument — recorded in `docs/investigations/km/km_dict_lexicon_investigation.md` as explicitly unmeasurable on available
gold — actually holds when the words are genuinely unseen. It does.

Where the answers came from: exceptions tier 0, **dictionary tier 1,125**, rules 171. The dictionary answers
87% of held-out vocabulary and is **78.8%** correct when it does — closely reproducing the 78.3% that the
earlier comparable-population argument predicted, which is a real out-of-sample confirmation of that estimate
rather than a restatement of it.

⚠ **This measures the WORD path only.** Reading running Khmer also needs boundary restoration, which has its
own honest figure (80.4% against human gold) and is not re-measured here.

⚠ **A DEFECT FOUND BY WRITING THIS.** `eval_shipped_heldout.ts` imports `convert` from the builder, and an ES
import executes the whole module — so the import REBUILT AND OVERWROTE the shipped `km-lexicon-dict.tsv`,
using whatever `process.argv[2]` the importing tool happened to take. It went unnoticed because the rebuild
happened to be byte-identical; with a different argument it would have silently replaced a shipped data file.
The builder now runs its body only when it is the entry point. Both paths verified afterwards: the import
writes nothing, and a direct run still reproduces the committed file byte-for-byte.

## Run 6 — 2026-08-09 12:10 — a second independent source exists after all: aakanee, via ipa-dict

The 🔷 caveat has always been "no second large independent referee". Searched for one. Candidates found and
their lineage, which is the whole question:

| source | lineage | verdict |
|---|---|---|
| **open-dict-data/ipa-dict km.txt** | **aakanee.com Khmer-English dictionary** | **independent of Wiktionary AND Google — usable** |
| seanghay/khmerphonemizer | acknowledges WikiPron | correlated, no |
| seanghay/native-khmer-g2p | rule FST from the academic "automatic phonemic transcription" work | independent but rule-vs-rule; data licence undocumented; noted, not pursued |
| kaikki km | Wiktionary | same lineage as wikipron, already known |
| UNESCO Khmer Pronouncing Dictionary | independent print authority | scanned PDF, extraction is its own project; noted |
| SEAlang (Headley/Chuon Nath) | independent | scraping + unclear redistribution terms; noted |

⚠ **THE LICENCE IS CC BY-NC-SA 4.0** (the ipa-dict repo is MIT, but its km data inherits aakanee's terms).
NonCommercial is stricter than anything this repo distributes, so the Urdu arrangement applies verbatim: the
data is NEVER committed (`.gitignore` guards the canonical name), the tool and the measurements are. It can
never become a committed referee for the same reason — which bounds what this run can change.

3,276 single-word Khmer entries; 1,696 overlap the wikipron referee, 1,579 are new vocabulary. The notation is
romanization-flavoured (length by doubling, implosives as plain d/b, onset ʋ as v, ⟨ៅ⟩ as av) and the mapping
was derived the same way the dict tier's was — iterating against wikipron agreement on the overlap: first pass
68.6%, closing the systematic classes (d→ɗ, b→ɓ, positional v, ʊə→uə, ee→ei) reached **93.1%**, residual reads
as genuine variance (wikipron's own e~ei inconsistency, loan vowels), not unclosed notation.

    npx tsx tools/khmer/aakanee-crosscheck.ts <ipa-dict data/km.txt>

| measurement | n | result |
|---|---|---|
| aakanee vs wikipron (source health, no engine) | 1,696 | **93.1%** |
| RULES vs aakanee (independent of every tier) | 3,276 | **67.9%** |
| SHIPPED vs aakanee | 3,276 | **79.5%** |
| — answered by exceptions tier (= wikipron-vs-aakanee via our lexicon) | 492 | 79.9% |
| — answered by dictionary tier (= **Google-vs-aakanee cross-validation**) | 897 | **77.3%** |
| — answered by rules | 1,887 | 80.4% |

Three things interlock, which is what makes this more than one more number:

- **shipped − rules = +11.6pp against a source neither tier has ever seen**, independently reproducing Run 5's
  +10.8pp held-out delta by a completely different method.
- **the dictionary tier scores 77.3% against aakanee** — two independent sources checking each other with our
  conversion in the middle — landing on top of the 78.3% comparable-population estimate and Run 5's 78.8%
  held-out figure. Three routes, one answer.
- **93.1% source health** clears Urdu's bar (wikipron-vs-CLE was 88.2%): the two human traditions agree, so
  km's referee is healthy and the rules' 59.8% residual is not an artifact of a bad referee.

⚠ The shipped-vs-aakanee 79.5% is fully non-circular BY CONSTRUCTION: the exceptions tier is wikipron-derived
and aakanee is independent of Wiktionary; the dict tier is Google-derived and aakanee is independent of
Google; the rules read no lexicon at all.

What this does NOT do: the NC licence means the committed referee is still single-lineage, so the 🔷 stays
factually true for what ships in-tree. What changed is the evidence: the engine is now corroborated by two
independent human traditions, out-of-band.

## Run 7 — 2026-08-09 12:35 — the second referee was already in the tree

A question from review dissolved Run 6's framing: *"Wiktionary + Google/language-resources is no longer 1
source already?"* — and the answer is yes, and the 🔷 caveat had been conflating two different circularities.
The Google dictionary is an independent human-curated lineage; what it cannot do is referee the SHIPPED path
(whose dictionary tier is this same data). But the eval scores `phonemizeWordRules`, which reads no lexicon —
so the Google data has been a legitimate second referee for the rules all along, and unlike aakanee it is
**CC BY 4.0 and committable**. The aakanee hunt found a third lineage; the second was already on disk.

Wired as the SECONDARY referee (the af/RCRL move exactly): `referees/km.google-lexicon.tsv`, 62,093 rows —
ALL Khmer words converted by the dict-tier's own derived mapping, INCLUDING the wikipron-settled words the
lexicon tier excludes (a referee is measurement data; the overlap is what makes cross-source comparison
possible). Generator committed as `tools/referee-eval/build-km-google-referee.ts`.

    npx tsx tools/referee-eval/eval.ts km

| referee | words | raw | folded | symbol |
|---|---|---|---|---|
| wikipron (primary) | 7,108 | 50.4% | 59.8% | 84.2% |
| **google-lexicon (secondary)** | **62,093** | 39.8% | **46.2%** | **84.0%** |

**The symbol accuracies agree to 0.2pp across two independent traditions and a 9x vocabulary difference** —
that is the corroboration a second referee exists to provide. The lower word-exact is the expected shape: a
TTS dictionary skews to long compounds and derived forms (median length well above wikipron's headwords), and
the two sources themselves only agree ~78% word-exact where they overlap, which bounds any engine score
against the secondary.

Residual on the secondary read before accepting: ʋ~w in clusters (ក្វាត kʋaːt≠kwaːt — notational, a fold
candidate left unfolded pending justification), ou~oː and ə~ɨ vowel-convention splits, Pali compound vowels —
and ONE real engine gap: **⟨ហ្វ⟩→f** (the ha+coeng-va digraph Khmer uses for loan /f/, ហ្វក faːk read hʋɑːk,
12×). Small, real, recorded rather than fixed here.

Attribution: adding the referee surfaced that `km-lexicon-dict.tsv` — shipped since the dict tier landed —
had NO attribution in NOTICE.md or PROVENANCE.md at all, though CC BY requires it (the bn Google entry
existed; km's was never added). Both files now carry the km entry, covering the lexicon tier and the referee.

**Verdict effect:** the 🔷's stated premise ("no second large independent referee") is gone — km now has a
committed non-Wiktionary secondary, the af pattern. Promoted 🔷 → 🟡: the residual is a characterized lexical
tail (vowel quality on ័-marked and Pali vocabulary, the ⟨ហ្វ⟩ digraph), which is what 🟡 means. What keeps it
from ✅: the shipped path's word-exact (73.1% held-out / 79.5% vs aakanee) still carries a real error rate on
lexicon-missed words, and the ʋ~w / ou~oː convention splits between the referees remain unadjudicated.

## Run 8 — 2026-08-09 13:05 — the residual worked as a list, and the OOV-tagger question sized

Challenged, fairly: the 🟡 verdict says work is outstanding, so refusing the BiLSTM needs to not mean refusing
the work. The residual decomposes into items with DIFFERENT right tools, and only one of them is a model:

| residual item | tool | done here? |
|---|---|---|
| ⟨ហ្វ⟩ read *hʋ* | an engine digraph | **fixed** |
| ʋ~w, ou~oː referee splits | per-referee folds | **adjudicated** |
| ə~ɨ variance | nothing — lexical | measured, left unfolded |
| dict-answered-wrong (78.8% ceiling) | source adjudication | bounded by the sources themselves |
| no-evidence tail (7.4% of lookups @ 35.1%) | the BiLSTM | **declined on sizing** |

**⟨ហ្វ⟩→f**: Khmer has no native /f/ and spells it ហ+coeng+វ. Both referees corroborate (wikipron កាហ្វេ
*k aː f eː*, តេឡេហ្វូន, ទីហ្វុង; the google residual surfaced it at 12×). One digraph case in the onset
renderer. Primary 59.8 → **60.0%** folded (+19 raw words); pinned by tests including the bare-ហ control.

**The two convention splits, adjudicated by counting rather than folded on suspicion:**
- ʋ~w in C+coeng+វ clusters: wikipron writes ʋ **120:1**, google writes w **1133:288** — the same phoneme,
  opposite letters, and the engine follows the primary. Folded ʋ→w on the google referee ONLY.
- ូ as ou~oː: wikipron **471:6** ou, google **9151:0** oː — a TOTAL convention split. Folded ou→oː, google only.
- ⚠ ə~ɨ was checked identically and REFUSED: wikipron 622:282, google 6680:2643 — BOTH referees use both at
  ~2.4:1. That is lexical variance, and a fold would hide real errors rather than notation.

Secondary after both: 46.2 → **48.0%** folded, symbol 84.0 → **84.9%** (primary agreement now 0.6pp apart).
Held-out shipped (73.1%) and aakanee (79.5%) re-run and stand — few ហ្វ words in either sample.

**The BiLSTM, sized and declined — with the decomposition that answers the "conflict":** the tagger serves
only the no-evidence tail. On the held-out run that tail is 171 of 1,296 words and the rules score **35.1%**
on it (60/171 — far below their 62.3% overall, because these are the words even a 62k dictionary lacks); on
running text its reachable population is **7.4% of lookups** (everything frequent is covered by one of three
sources). An af-grade tagger (~85%) over 35.1% on 7.4% of lookups ≈ **+3pp type-level, less token-weighted**
since no-evidence words are rare by construction — the ur/dakshina sizing class, and declined the same way.
Feasibility is not the objection (68k CC-BY pairs clears da's ~10k BiLSTM threshold); the objection is that
487 of the 520 shipped misses live where a tagger cannot reach: dict-answered words bounded by the ~78%
inter-source agreement, and lexical ə~ɨ. A COMBINED segmentation+g2p model was also declined structurally:
it gives up the segmenter's length-preservation invariant and its 2.85M-boundary supervision for a joint
task with no aligned text→IPA corpus to learn from.

What remains the bigger running-text lever: the segmenter (a joined junction corrupts 54.6% of readings;
sync 79.2% vs the BiLSTM tier's 83.5%).

## Run 9 — 2026-08-09 13:55 — expand the lexicon: a kaikki third tier

Directive: expand the lexicon. The one big licence-safe source not yet consumed is kaikki's Khmer extraction —
the SAME en.wiktionary lineage as the primary referee (CC BY-SA, the §3 fence km-lexicon.tsv already lives
under), but a different scrape, so it carries words our wikipron file lacks. Same-lineage is exactly why it
can be a LEXICON and can never be a referee.

⚠ **kaikki has almost no IPA for Khmer** — wiktextract does not expand `{{km-IPA}}` (2 of 11,257 entries
carry `sounds`). What it has is the human-curated headword ROMANIZATION (`kampuciə`), 7,664 Khmer words'
worth: 6,564 overlap wikipron (the validation set), 1,100 are new, 625 of those covered by nothing at all.

⚠ **And many romanizations arrive FUSED with the initial letter's name** — `kɑɑkɑkɑɑ` for កករ is kɑɑ (the
name of ក) + kɑkɑɑ, an upstream template-expansion artifact, confirmed by reading the raw JSONL (the
head_templates expansion itself is fused). De-fused by stripping a leading C+ɑɑ/ɔɔ when the remainder repeats
the onset consonant.

The conversion was derived by iteration against wikipron on the 6,564-word overlap, the method every km
conversion in this repo used: 88.5% raw → 96.0% after de-fusion → **97.7%** after oy→oj, ɔə→oə and gemination
variance (residual = the lexical ə~e / ɨ~i zone wikipron itself varies on). 97.7% is far above the dict
tier's 78.3% inter-source bar — these are, after all, the same tradition.

**The tier** (`km-lexicon-kaikki.tsv`, built by `tools/gen/build-km-kaikki-lexicon.mts`): 557 entries after
three gates — no wikipron word (settled), rules must disagree (the exceptions principle; 536 skipped where
the rules already match — the rules are right on half of new Wiktionary vocabulary), and a malformed-row
reject (7). Breves normalised out for output consistency with the other tiers. Precedence is an evidence
ranking: `LEX (wikipron-verified) → KAIKKI (same-tradition human) → DICT (converted Google) → rules`.
196 entries override the Google dictionary; **361 words gain first-ever evidence**. Invariants pinned in
`test/kmDictLexicon.test.ts` exactly as the dict tier's are: no referee leakage, no LEX shadowing, the
override seam is real, plus a golden — កណ្តាល, the ⟨ត⟩-spelling of "central" (479× in the frequency table),
rules *kɑntaːl* → shipped **kɑnɗaːl**.

**Measured, against the independent (non-Wiktionary) aakanee source:**

| | before | after |
|---|---|---|
| shipped vs aakanee (3,276 words) | 79.5% | **80.7%** |
| — kaikki-tier rows | — | **83.8%** (n=99, the best tier accuracy on that set) |

Token-weighted coverage on the frequent-token table (freq≥25): 88.7% → 89.0% evidence-covered — modest, but
the words are high-value: ខាងលិច "west" (864×), ព្រះមហាក្សត្រ "king" (705×), កណ្តាល (479×), សហរដ្ឋអាមេរិក
"United States" (437×). Wikipron referee eval unchanged at 60.0% (the rules read no lexicon); held-out
shipped unchanged at 73.1% — the held-out harness now mirrors the three-tier production path, with the
one-lineage rule written down (a held-out word must be held out of BOTH Wiktionary scrapes; a no-op today
since the tier contains no wikipron word, recorded so a future rebuild cannot silently break the experiment).

## Run 10 — 2026-08-09 14:50 — close the gap: the residual worked at full scale, and the ✅ case

Challenged, correctly: the verdict work kept landing +1–2pp while the 60% rules number — the thing the verdict
hangs on — went unattacked. The fix was to stop reading the residual's top-12 and map ALL of it: 2,365 wrong
words clustered by edit type into 432 classes, the top eight of which were SYSTEMATIC and rule-shaped, almost
all in the Indic/Pali polysyllable register.

Each class was DERIVED from the referee (counts recorded), implemented, and measured individually:

| class | derivation | Δ kept |
|---|---|---|
| ⟨ៈ⟩ yuukaleapintu — was in the DIACRITICS list, silently skipped | aʔ 69:8 | ✔ |
| bantaq re-colours o-series ⟨ា⟩ → oə (silent-subscript keeps iə) | 71:1 (vs 11:0) | ✔ |
| o-series ⟨េ⟩ → ei | 186:86 | ✔ |
| non-final open ⟨ិ⟩/⟨ី⟩ reduce → e/i | 110:36 | ✔ |
| closed o-series presyllable → u (ង/ល codas → uə) | per-coda | ✔ |
| ⟨ី⟩+coda → iː any position | 135:6 | ✔ |
| ⟨ដ្ឋ⟩ → tt | 59:38 | ✔ |
| ⟨័រ⟩ samyok + silent-រ → oə | 25:1 | ✔ |
| open presyllable → eə | trial | ✘ REVERTED (−0.8pp) |
| medial ⟨ប⟩ → p | trial | ✘ REVERTED (−2.2pp; derivation contaminated) |

    56.0 → 60.0 (morning) → 62.4 → 63.4 → 63.7 → 63.9 → 64.9 → 65.5 → 65.8%

**Day total: 56.0 → 65.8% (+9.8pp), A/B +624 gained / 31 lost.** Per-class: bantaq shape 55.4 → 82.8%.

⚠ **A substring bug in one derivation, caught by goldens.** "Does the referee contain i" matches inside "iː",
so the ⟨ី⟩ rules first emitted SHORT i — identical under the folded metric (the backbone strips length), wrong
in the raw output of every ី word (ពីរ *pi*, ទីហ្វុង *tifoŋ*). Four goldens failed; the fix emits iː. A
reminder that the folded metric cannot see length errors, and the goldens exist precisely there.

⚠ **The overfit check, and it passes:** every one of these rules was derived from wikipron, so the risk is
fitting that referee's conventions. rules-vs-aakanee (independent lineage) moved **68.2 → 74.4% (+6.2pp)**, in
step with the primary's +5.8pp. These are Khmer facts, not wikipron facts.

**The frequency-weighted metric km never had** (`freq/km.txt`, from this repo's own 2.85M writer-boundary
harvest — no external licence): rules alone **77.7% token-weighted** against 65.8% word-exact — the referee is
dictionary-shaped and over-samples rare Pali compounds, the af pattern exactly. And the SHIPPED path on real
text: **99.7%** against the wikipron-verified readings (the verified-coverage claim), and **94.0% against the
fully-independent aakanee — AT the 93.1% ceiling where the two human sources agree with each other.** On
frequent words the shipped engine is as close to aakanee as the other human source is.

**Verdict ✅.** The legend's bar is "trust the output; the low referee % is referee noise / a fold ceiling /
minor deferrals". All three now hold with numbers attached: the word-exact deflation is dictionary shape
(+11.9pp token-weighted) plus inter-source disagreement (independent humans agree 78–93%); the residual after
this sweep is the lexical class Huffman calls unpredictable, carried by three lexicon tiers; the evidence is
multi-source (two committed referees, aakanee out-of-band, every rule class derived with counts). Floor
0.58 → 0.63. Remaining deferrals recorded with sizes: the BiLSTM OOV tier (~+3pp, declined), ə~ɨ, the async
segmenter gap.
