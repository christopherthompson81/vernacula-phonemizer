#!/usr/bin/env python3
"""Norwegian Bokmål OOV g2p — BiLSTM per-grapheme tagger (GPU). The neural OOV tier for nb: a char-embedding → 2-layer
BiLSTM → per-position tag head that labels each grapheme with an IPA CHUNK (incl. the stress mark ˈ, so the model
predicts stress POSITION + the stress-conditioned vowel quality DIRECTLY from spelling — the deep-orthography win the
first-syllable rule heuristic misses). On the held-out split it far outstrips the averaged-perceptron prototype
(56.6%) and the rule engine. Model + aligner come from tools/bilstm_training; trains on
the 90% split (honest held-out %), then the FULL NST lexicon, and exports the shared structuralTagger contract:
nb-g2p-tagger.onnx + nb-g2p-tagger.meta.json (src / tags / charTags mask) for onnxruntime-node serving.

    NB_LEX=/tmp/nb_train_stress.tsv NB_KEEP_STRESS=1 NB_SUBSAMPLE=0 .venv/bin/python -u tools/norwegian/train_nb_bilstm.py
"""
import os, re, sys, json, random
import torch
from nb_tagger_prototype import load, split  # env-configurable loader (NB_LEX / NB_KEEP_STRESS / NB_SUBSAMPLE)

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))  # must precede the bilstm_training import below
from bilstm_training import align  # noqa: E402 — SEP stays "" (single-codepoint IPA chunks)
from bilstm_training.tagger import DEV, Tagger, build_vocab, decode_chunks, encode, train  # noqa: E402

SRC = os.path.join(HERE, "..", "..", "src", "languages", "norwegian")
HID, BATCH, LOG_EVERY = 128, 128, 5  # as trained for the committed nb-g2p-tagger.onnx

_VOWEL = set("ɑaeɛiɪoɔuʉʊyʏøœæ")


def one_stress(ipa):
    """Mirror of norwegianTagger.ts oneStress(): exactly one primary ˈ (keep the first, drop later ones; promote a
    secondary or place ˈ before the first vowel's onset if none), collapse adjacent stress marks. Held-out accuracy
    must be measured with the SAME normalization the serving path applies, or it doesn't characterize the deployed
    decode."""
    ipa = re.sub(r'[ˈˌ]{2,}', lambda m: 'ˈ' if 'ˈ' in m.group() else 'ˌ', ipa)
    seen = [False]
    def keep_first(_):
        if seen[0]:
            return ''
        seen[0] = True
        return 'ˈ'
    ipa = re.sub('ˈ', keep_first, ipa)
    if seen[0]:
        return ipa
    if 'ˌ' in ipa:
        return ipa.replace('ˌ', 'ˈ', 1)
    idx = next((i for i, c in enumerate(ipa) if c in _VOWEL), -1)
    if idx < 0:
        return ipa
    o = idx
    while o > 0 and ipa[o - 1] not in _VOWEL:
        o -= 1
    return ipa[:o] + 'ˈ' + ipa[o:]


@torch.no_grad()
def predict(model, chars, itag, char_tags, word):
    """The SHIPPED decode (matches norwegianTagger.ts): MASKED argmax over each letter's charTags, decline ("") on an
    out-of-vocab grapheme, then one_stress()."""
    chunks = decode_chunks(model, chars, itag, char_tags, word)
    if chunks is None:  # OOV grapheme → decline, exactly as serving does
        return ""
    return one_stress("".join(chunks))

def heldout_eval(model, chars, itag, char_tags, te):
    ok = 0
    with open("/tmp/nb_holdout_bilstm.tsv", "w", encoding="utf-8") as f:
        for w, ph in te:
            ref = "".join(ph)
            pred = predict(model, chars, itag, char_tags, w)
            if pred == ref:
                ok += 1
            f.write(f"{w}\t{ref}\t{pred}\n")
    print(f"held-out BiLSTM exact-match: {ok}/{len(te)} = {100*ok/len(te):.1f}%  (→ /tmp/nb_holdout_bilstm.tsv)", flush=True)

def main():
    random.seed(0); torch.manual_seed(0)
    print(f"device: {DEV}")
    rows = load()
    tr, te = split(rows)
    # (1) honest held-out: align+train on 90%, predict the 10%
    aln_tr = align.align_parallel(tr)
    chars, tags, char_tags = build_vocab(aln_tr)
    itag = {v: k for k, v in tags.items()}
    Xtr, Ytr = encode(aln_tr, chars, tags)
    print(f"train {len(Xtr)} words, {len(chars)} chars, {len(tags)} tags")
    model = train(Tagger(len(chars), len(tags), hid=HID), Xtr, Ytr, batch=BATCH, log_every=LOG_EVERY)
    heldout_eval(model, chars, itag, char_tags, te)
    # (2) SHIPPED: align+train on the FULL lexicon, export ONNX + meta.json (the structuralTagger contract)
    aln = align.align_parallel(rows)
    chars, tags, char_tags = build_vocab(aln)
    itag = {v: k for k, v in tags.items()}
    Xf, Yf = encode(aln, chars, tags)
    full = train(Tagger(len(chars), len(tags), hid=HID), Xf, Yf, batch=BATCH, log_every=LOG_EVERY)
    full.eval().cpu()
    dummy = torch.tensor([[1, 2, 3, 4]])
    torch.onnx.export(full, dummy, os.path.join(SRC, "nb-g2p-tagger.onnx"),
                      input_names=["chars"], output_names=["logits"],
                      dynamic_axes={"chars": {0: "batch", 1: "len"}, "logits": {0: "batch", 1: "len"}}, opset_version=17)
    # meta.json in the shared TaggerMeta shape (src char→id, tags id→chunk, charTags id→permitted tag-ids = the mask)
    meta = {
        "src": chars,
        "tags": {str(i): itag[i] for i in range(len(tags))},
        "charTags": {str(ci): sorted(ti) for ci, ti in char_tags.items()},
    }
    json.dump(meta, open(os.path.join(SRC, "nb-g2p-tagger.meta.json"), "w", encoding="utf-8"), ensure_ascii=False)
    # ⚠ QUANTIZE — nb shipped fp32 alone in the fleet until 2026-08-19. Measured over the WHOLE 62,838-word
    # held-out (not a 400-word parity sample, because nb's 474-tag alphabet EMBEDS THE STRESS MARK and a
    # flipped label there moves stress, not just a vowel): fp32 94.709% vs int8 94.637% word-exact, -45 words
    # (0.072pp) for 2.9 MB → 0.7 MB. The disagreements are CHURN, not decay — of 624, int8-only-wrong 246 and
    # fp32-only-wrong 201, i.e. quantization nudges borderline cases both ways; 141 differ only in stress, also
    # bidirectionally. See nb-g2p-tagger.PROVENANCE.md.
    from onnxruntime.quantization import quantize_dynamic, QuantType
    quantize_dynamic(os.path.join(SRC, "nb-g2p-tagger.onnx"),
                     os.path.join(SRC, "nb-g2p-tagger.int8.onnx"), weight_type=QuantType.QUInt8)
    os.remove(os.path.join(SRC, "nb-g2p-tagger.onnx"))  # only the int8 graph ships
    print(f"exported → {SRC}/nb-g2p-tagger.int8.onnx + .meta.json ({len(chars)} chars, {len(tags)} tags)", flush=True)

if __name__ == "__main__":
    main()
