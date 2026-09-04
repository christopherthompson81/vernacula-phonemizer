#!/usr/bin/env python3
"""Recognize phones for a DIRECTORY-ingested corpus and log them beside our IPA — the non-FLEURS path.

`asr_align_corpus.py` is bound to FLEURS in three places: it streams audio out of the per-language
`train.tar.gz`, it reads a FLEURS TSV for the sentence id and transcript, and it looks IPA up in
`work/phonemized_vernacula/byid/<lang>.tsv`. A corpus ingested by `ingest_dir.py` has none of those —
it has a manifest that already carries `id`, `text` and `ipa` — so this is a sibling rather than a
flag on that script, for the same reason `ingest_dir.py` is a sibling of `ingest_fleurs.py`.

Everything that decides what a score MEANS is deliberately identical: same model, same fp16-on-cuda,
same batching, same INSERT OR REPLACE into the same `utt` table, same resume-by-default. The report
stage scores each utterance against its own language's median, so an `en_gb` row is only comparable
to other `en_gb` rows — and that only holds if the recognition side is not quietly different.

Two things genuinely differ from the FLEURS path, both forced by the corpus:

  * **The audio is resampled, not skipped.** `asr_align_corpus.py` prints and skips anything that is
    not already 16 kHz, because FLEURS is uniformly 16 kHz and an odd rate there means a broken
    member. SLR83 ships 48 kHz, so skipping would align nothing at all.
  * **`sentence_id` is the utterance id.** FLEURS repeats a sentence across speakers and the pair
    (sentence_id, wav) distinguishes the recording from the script; a directory corpus has one
    recording per id and nothing to repeat.

⚠ The IPA in the manifest came from the phonemizer and has never been checked against the audio
(`ipa_src="phonemizer"`). That is the whole reason to run this: these rows are the check.

  python3 asr_align_dir.py --lang en_gb \
      --dirs /mnt/data/omnivoice_ipa/slr83/southern_english_female /mnt/data/omnivoice_ipa/slr83/sem
"""
from __future__ import annotations

import argparse
import glob
import json
import os
import sqlite3
import sys
import time

ROOT = os.environ.get("ASR_ALIGN_ROOT", "/mnt/data/omnivoice_ipa")
MANIFESTS = f"{ROOT}/corpus/tokens"
DB = f"{ROOT}/work/asr_align/align.sqlite"
MODEL = "facebook/wav2vec2-xlsr-53-espeak-cv-ft"
SR = 16000

# Same table asr_align_corpus.py writes. Declared here too so this script can run first on a fresh
# machine, but it must not DRIFT from that one -- the report stage reads both without distinction.
SCHEMA = """
CREATE TABLE IF NOT EXISTS utt (
    lang        TEXT NOT NULL,
    sentence_id TEXT NOT NULL,
    wav         TEXT NOT NULL,
    text        TEXT,
    ipa         TEXT,
    phones      TEXT,
    n_samples   INTEGER,
    PRIMARY KEY (lang, wav)
);
CREATE INDEX IF NOT EXISTS utt_lang ON utt(lang);
"""


def load_manifest(lang: str) -> dict[str, tuple[str, str]]:
    """id -> (text, ipa), straight out of the ingest manifest. No second IPA source, by design."""
    p = f"{MANIFESTS}/manifest_{lang}.jsonl"
    out: dict[str, tuple[str, str]] = {}
    with open(p, encoding="utf8") as f:
        for line in f:
            if line.strip():
                r = json.loads(line)
                out[r["id"]] = (r.get("text") or "", r.get("ipa") or "")
    return out


def find_audio(dirs: list[str]) -> dict[str, str]:
    out: dict[str, str] = {}
    for d in dirs:
        for f in glob.glob(f"{d}/**/*", recursive=True):
            if f.lower().endswith((".wav", ".flac", ".mp3", ".opus")):
                out.setdefault(os.path.splitext(os.path.basename(f))[0], f)
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--lang", required=True, help="corpus language key, e.g. en_gb")
    ap.add_argument("--dirs", nargs="+", required=True, help="directories holding the audio")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--batch", type=int, default=8)
    ap.add_argument("--db", default=DB)
    ap.add_argument("--device", default="cuda")
    ap.add_argument("--redo", action="store_true", help="re-align rows already in the table")
    a = ap.parse_args()

    import librosa
    import numpy as np
    import soundfile as sf
    import torch
    from transformers import AutoModelForCTC, Wav2Vec2FeatureExtractor, Wav2Vec2PhonemeCTCTokenizer

    man = load_manifest(a.lang)
    audio = find_audio(a.dirs)
    todo = sorted(k for k in man if k in audio)
    missing = len(man) - len(todo)
    print(f"# {len(man):,} manifest rows, {len(audio):,} audio files, {len(todo):,} matched"
          + (f", {missing:,} WITHOUT AUDIO" if missing else ""), file=sys.stderr)
    if not todo:
        print("no manifest row matched an audio file -- check --dirs", file=sys.stderr)
        return 1

    os.makedirs(os.path.dirname(a.db), exist_ok=True)
    db = sqlite3.connect(a.db)
    db.executescript(SCHEMA)
    db.execute("PRAGMA journal_mode=WAL")
    db.commit()
    # Resume by default, and --redo has to CLEAR this rather than just re-enter the language --
    # the FLEURS script's comment records a run that reported success while skipping every row.
    have = set() if a.redo else {r[0] for r in db.execute(
        "SELECT wav FROM utt WHERE lang=?", (a.lang,))}

    # do_phonemize=False: the tokenizer builds an espeak backend in its constructor and hard-requires
    # the `phonemizer` package, but only for the ENCODE direction. We only decode CTC ids.
    tok = Wav2Vec2PhonemeCTCTokenizer.from_pretrained(MODEL, do_phonemize=False)
    ext = Wav2Vec2FeatureExtractor.from_pretrained(MODEL)
    model = AutoModelForCTC.from_pretrained(MODEL)
    dev = a.device if (a.device != "cuda" or torch.cuda.is_available()) else "cpu"
    model = model.to(dev).eval()
    if dev == "cuda":
        model = model.half()
    print(f"# model on {dev}, batch {a.batch}", file=sys.stderr)

    def flush(batch: list[tuple[str, str, str, "np.ndarray"]]) -> None:
        if not batch:
            return
        feats = ext([b[3] for b in batch], sampling_rate=SR, return_tensors="pt", padding=True)
        iv = feats.input_values.to(dev)
        if dev == "cuda":
            iv = iv.half()
        with torch.no_grad():
            logits = model(iv, attention_mask=feats.get("attention_mask", None)).logits
        for (uid, txt, ipa, aud), ids in zip(batch, torch.argmax(logits, dim=-1)):
            db.execute(
                "INSERT OR REPLACE INTO utt(lang,sentence_id,wav,text,ipa,phones,n_samples) "
                "VALUES (?,?,?,?,?,?,?)",
                # sentence_id == the utterance id: one recording per id, nothing to repeat.
                (a.lang, uid, uid, txt, ipa, tok.decode(ids), len(aud)),
            )
        db.commit()

    t0, n, batch = time.time(), 0, []
    for uid in todo:
        if uid in have:
            continue
        try:
            aud, sr = sf.read(audio[uid], dtype="float32")
        except Exception as e:      # one bad file must not kill the pass
            print(f"  {uid}: unreadable ({e})", file=sys.stderr)
            continue
        if aud.ndim > 1:
            aud = aud.mean(axis=1)
        if sr != SR:                # SLR83 is 48 kHz; skipping here would align nothing
            aud = librosa.resample(aud, orig_sr=sr, target_sr=SR, res_type="soxr_hq")
        txt, ipa = man[uid]
        batch.append((uid, txt, ipa, aud))
        n += 1
        if len(batch) >= a.batch:
            flush(batch)
            batch = []
            if n % 200 == 0:
                print(f"    {n:,}/{len(todo):,} ({n / (time.time() - t0):.1f}/s)", file=sys.stderr)
        if a.limit and n >= a.limit:
            break
    flush(batch)

    dt = time.time() - t0
    print(f"{a.lang}: {n:,} utterances in {dt:.0f}s ({n / max(dt, 1e-9):.1f}/s)", file=sys.stderr)
    total = db.execute("SELECT COUNT(*) FROM utt WHERE lang=?", (a.lang,)).fetchone()[0]
    print(f"{a.db}: {total:,} rows for {a.lang}", file=sys.stderr)
    db.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
