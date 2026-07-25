# Danish OOV — should the shipped perceptron become a BiLSTM? (the referee-noise re-evaluation)

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
