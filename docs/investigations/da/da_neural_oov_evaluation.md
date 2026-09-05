# Danish OOV — should the shipped perceptron become a BiLSTM? (the referee-noise re-evaluation)

> **SUPERSEDED (2026-07-25).** The "keep the perceptron" verdict below was correct *for the 7.5k Wiktionary lexicon*
> (data-starved BiLSTM). It **flipped** once the ~199k NST lexicon (CC0) removed the data starvation: the BiLSTM now
> scores 73.4% word / 95.7% symbol held-out and ships as the OOV tier (the perceptron is deleted). See
> `docs/investigations/da/da_nst_ingest_investigation.md`.

Context: bn/nb/en/fr all replaced their OOV tier (rule / joint-n-gram / perceptron) with a per-grapheme BiLSTM and
roughly HALVED the phone-error-rate. Danish is the ONE language still shipping an averaged-perceptron OOV tier
(`danish/tagger.ts`, `da-g2p.tsv`, SYNC, in the default path: lexicon → perceptron → rule). Prompt: the perceptron's
"45.5%" number was measured FOLDED against a referee, and a noisy referee severely impaired our read of the BiLSTM
elsewhere — so re-evaluate Danish on a CLEAN basis.

## Run 1 — 2026-07-25 — clean da-lexicon held-out (no referee) + PER

**Referee IS noisy (confirmed).** `eval.ts da`: word-exact 27.4% vs **symbol-accuracy 75.5%** — the same brutal
word-exact/PER gap as English (the referee is very NARROW: stød, aspiration/affrication, voiceless diacritics,
half-length, syllable dots). So the folded "45.5%" was not a trustworthy read.

**Clean evaluation** (md5 90/10 split of da-lexicon.tsv, the lexicon IS the gold — self-consistent, no referee;
perceptron via da_tagger_prototype.py, BiLSTM via train_da_bilstm.py, both on the SAME "da:" split; rule =
phonemizeWordRules; measured word-exact + symbol-accuracy/PER on the 770-word held-out):

| model | word-exact | symbol-accuracy (1−PER) |
|---|---|---|
| rule g2p | 19.2% | 69.4% |
| **perceptron (shipped)** | 38.2% | 80.9% |
| **BiLSTM** | 43.8% | **82.0%** |

**Verdict: KEEP the perceptron.** Unlike nb/en/fr (BiLSTM halved errors), the Danish BiLSTM beats the perceptron only
MODESTLY (+5.6 word / **+1.1 symbol**). **Root cause = data scarcity:** the da-lexicon is only **7,476 words** (17× smaller
than English 117k / French 125k), so the BiLSTM is starved (82% symbol vs French's 99%) while the perceptron's
hand-crafted ±4-window features stay competitive at low data. Replacing a SYNC, no-dependency, default-path perceptron
with an opt-in ASYNC BiLSTM (onnxruntime + ~2MB model) for +1.1% symbol is a poor trade. The original Danish decision
(sync perceptron) holds — and the CLEAN data confirms it (for the right reason: data scarcity, not the noisy referee).

**The real lever for Danish is DATA, not the model** — a larger Danish pronunciation lexicon (the current one is a
small Wiktionary scrape) would lift both tiers and help the BiLSTM more. Revisit if such data appears. The POS
perceptron (`english/posTagger.ts`) is a DIFFERENT task (heteronym disambiguation, not OOV G2P) and out of scope here.

## Run 2 — 2026-07-25 — training-data coverage gaps + a 32× bigger corpus (NST, CC0)

Characterised the current da-lexicon (7,476 words, single-pron, from Wiktionary) — three systemic gaps:
1. **Small** → the BiLSTM is data-starved (the Run 1 finding).
2. **Poor common-word coverage** — only **54% of the top-2,000** most-frequent Danish words are in the lexicon (29% of
   top-10k, 11% of top-50k). So even common words routinely hit the OOV path (unlike en/fr, where the lexicon covers
   the common core). The OOV tier carries far more traffic than 7.5k suggests.
3. **Compounds under-represented + NO splitter.** Only **4%** of entries are ≥12 letters, yet Danish is a heavy
   compounding language → real-text OOV is dominated by compounds (sundhedsforsikring = sundheds+forsikring). And unlike
   English (compound-split→morph→n-gram) Danish has NO compositional decomposition — a train/serve distribution
   mismatch on the dominant OOV class.

**The lever is DATA, not the model — and a much bigger, license-clean corpus exists.** The **NST Danish pronunciation
lexicon** (Nasjonalbiblioteket / Språkbanken, `sbr-26`): **~238,000 words** (32× the current 7,476), **CC0 / public
domain**, SAMPA (semicolon-separated, 51 fields), **and it carries compound-decomposition + morphology annotation** —
which fixes all three gaps at once (size, common-word coverage, AND compounds/the splitter). Same source + license as
the Norwegian NST lexicon already shipped for nb. Verified downloadable: `da_leksikon.tar.gz` (5.7 MB, HTTP 200) at
`https://www.nb.no/sbfil/leksikalske_databaser/leksikon/`. NST also offers Norwegian (~814k) and **Swedish (~800k)**
lexica (both CC0) + speech corpora — so sv (which is NOT data-starved) is a strong future BiLSTM candidate too.

**Next step (deferred):** ingest the NST Danish lexicon (adapt the nb `nst_sampa.py` SAMPA→IPA converter to the Danish
SAMPA / stød), which would (a) massively improve the sync lexicon coverage, (b) feed a compound splitter from the NST
compound field, and (c) give a BiLSTM enough data to finally justify the swap. Re-measure the perceptron/BiLSTM
decision after ingest.
