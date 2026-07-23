# `he-tagger.int8.onnx` provenance

The Hebrew **PHASE-2** neural vowel restorer — a per-consonant **BiLSTM tagger** that reads everyday UNVOCALIZED
Hebrew and emits Modern Israeli IPA directly (`phonemizeHebrewNeural`; inference in `hebrewTagger.ts`). Each
skeleton consonant → one IPA-chunk **tag** (the consonant + the restored vowel), a single forward pass. Because
output length == input length it **cannot degenerate**; the whole-word bidirectional pass supplies the context that
disambiguates the unwritten vowels. This is the Arabic-diacritizer analogue and the fa `faTagger` pattern; it shares
`core/onnx.ts` + the masked-argmax decode (`core/structuralTagger.ts`) with the fa/bn taggers.

**Two-phase design.** PHASE 1 (`hebrew.ts`) reads VOCALIZED (pointed) Hebrew deterministically (niqqud→IPA, 87.1%).
PHASE 2 (this model) restores the vowels of BARE consonantal text. `phonemizeHebrewNeural` routes per word: a word
that carries niqqud → Phase 1; a bare word → this tagger.

**Architecture:** char embedding (128) → 2-layer **bidirectional** LSTM (hidden 256) → linear → 127 tag logits.
Input: skeleton char-ids `[1, L]`. Output: tag logits `[1, L, 127]`. The per-consonant **consonant-consistency
mask** (⟨ב⟩ → only b…/v… tags, never a ⟨ק⟩ tag), masked argmax, and tag concatenation happen in TS. Char vocab 29,
tag vocab 127. One int8 ONNX graph, **~2.4 MB**.

**Training data:** the **Nakdimon `hebrew_diacritized`** collection (github.com/elazarg/nakdimon, MIT) — but only
the **permissively-licensed subset**: the PUBLIC-DOMAIN pre-modern authors (Bialik d.1934, Tchernichovsky d.1943,
Dushman, …) + the CC-BY-SA `modern/wiki` + `validation` subdirs (~830k words). The copyrighted modern news/blogs/
lyrics are EXCLUDED from the shipped model (the permissive-data policy; expanding to them is a licensed follow-up).
For each vocalized word the INPUT is the niqqud-stripped skeleton and the per-consonant LABEL is the IPA chunk the
Phase-1 g2p (`phonemizeAligned`) resolves — so labels are 1:1 with the skeleton, **no aligner needed** (unlike the
Bengali tagger). Built by `tools/hebrew/build_tagger_data.ts` → 891k (skeleton, tags) rows.

**Training:** 15 epochs, Adam 1e-3, cross-entropy `ignore_index=pad`, seed 0 (GPU). `tools/hebrew/train_he_tagger.py`
(writes `he_tagger.pt`) → `export_he_tagger_onnx.py` (int8 ONNX + meta; `dynamo=False`).

**Measured:** **48.0% folded** on the FULL unvocalized→IPA task vs the human en.wiktionary a=IL referee (strip
niqqud → tag → compare). The consonants are near-perfect; the ceiling is (a) the referee is **isolated citation
forms** — the hardest case, where the tagger's whole-word context is wasted and homographs (ילד = jeled/jaled) are
unresolvable; on RUNNING TEXT it is markedly better (שלום עולם→ʃalom ʔolam, אני אוהב אותך→ʔani ohav otχa); (b)
**sheva-na** stays ∅ because the Phase-1 labels drop it (a pointing-only limit); (c) modern loanwords are OOD given
the pre-modern-heavy permissive training subset. It nonetheless makes unvocalized Hebrew phonemizable at all — the
sync engine alone gives only a vowel-less consonant skeleton.

**Reproduce:**

```
git clone https://github.com/elazarg/hebrew_diacritized /tmp/hebrew_diacritized
npx tsx tools/hebrew/build_tagger_data.ts /tmp/hebrew_diacritized /tmp/he_tagger_train.tsv
python tools/hebrew/train_he_tagger.py /tmp/he_tagger_train.tsv src/languages/hebrew
python tools/hebrew/export_he_tagger_onnx.py src/languages/hebrew
```

**Runtime contract:** `onnxruntime-node` is OPTIONAL (lazy). If it or this model is absent, `createHebrewTagger()`
resolves to `undefined` and `phonemizeHebrewNeural` returns exactly the sync Phase-1 path (no throw). Separate async
path; the sync engine + its tests are untouched.
