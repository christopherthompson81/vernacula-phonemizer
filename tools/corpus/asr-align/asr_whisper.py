#!/usr/bin/env python3
"""
Transcribe the corpus with Whisper and store the ORTHOGRAPHY, as a third instrument on a new axis.

⚠ THIS MEASURES SOMETHING THE PHONE RECOGNIZERS CANNOT. wav2vec2 and allosaurus compare PHONES against
our IPA, which conflates three things — our error, the reader's divergence, and recognizer noise. Whisper
emits WORDS, so comparing it to the transcript asks "did the reader say what is written", and it never
consults our IPA at all. Readers reorder, substitute and drop words, and none of that moves a
sentence-level phone distance enough to be flagged: the Maori numeral code-switches all sat in `verified`.

⚠ AND IT IS BLIND TO WHAT THEY SEE. Whisper writes NORMALIZED orthography, so a numeral comes back as
digits whichever way it was read — `tekau` and `ten` are both `10`, matching the transcript either way.
Numeral register, code-switch, and pronunciation generally are invisible here. The two instruments cover
different failure modes; neither alone covers reader divergence.

    phone recognizers   how a word was pronounced; numeral register      blind to word identity
    whisper             substituted / dropped / reordered words          blind to how they were said

⚠ CONTAMINATION WAS CHECKED, NOT ASSUMED. FLEURS is a 2022 public benchmark and large-v3 trained on
scraped audio, so it could have been reciting transcripts rather than hearing. Measured median WER
against the transcript on 127 rows is 0.467 — nowhere near the near-zero a memorized corpus would give.

⚠ COMPETENCE IS SEVERELY LANGUAGE-DEPENDENT, exactly as it was for the phone recognizers, so a raw WER
threshold means nothing fleet-wide. Measured on the hand rows: fr_fr 0.000, hr_hr 0.100, fil_ph 0.250,
mi_nz 0.361, ha_ng 0.875, bn_in 1.000, mt_mt 1.000. A WER of 0.5 is alarming in French and BETTER THAN
MEDIAN in Hausa. Flag against each language's OWN distribution, never an absolute cut — the same lesson
the cps threshold taught, where a global cut was wrong by 2.6x.

⚠ 19 OF 102 LANGUAGES ARE NOT SUPPORTED and are skipped, not guessed at: ast ceb ckb ff ga ig kam kea ky
lg luo nso ny om or umb wo xh zu — 49,132 rows, Bantu- and West-Africa-heavy, which is where the phone
recognizers were weakest too. MMS is the candidate second instrument there.

  python3 asr_whisper.py --check
  python3 asr_whisper.py [--langs fr_fr ...] [--batch 16] [--limit N]
"""
from __future__ import annotations

import argparse
import io
import os
import re
import sqlite3
import sys
import tarfile

ROOT = os.environ.get("ASR_ALIGN_ROOT", "/mnt/data/omnivoice_ipa")
DB = f"{ROOT}/work/asr_align/align.sqlite"
AUDIO = f"{ROOT}/corpus/audio_cache/data"
MODEL = os.environ.get("WHISPER_MODEL", "openai/whisper-large-v3-turbo")
#: FLEURS prefix -> Whisper language token where they differ.
ALIAS = {"cmn": "zh", "nb": "no", "fil": "tl", "jv": "jw"}
#: Whisper's window is 30 s; longer input is truncated, not chunked. Those rows are already labelled
#: `uncodeable_length` / `audio_overlong` and are skipped rather than silently half-transcribed.
MAX_SECONDS = 30.0
MIN_SECONDS = 1.0


def degenerate(s: str) -> bool:
    """A repetition-loop decode: one character run, or one token looped. See the note in flush()."""
    import collections as _c
    if not s or not s.strip():
        return True
    if re.search(r"(.)\1{11,}", s):
        return True
    w = s.split()
    return len(w) > 5 and max(_c.Counter(w).values()) >= 6


def ensure_column(db: sqlite3.Connection) -> None:
    cols = {r[1] for r in db.execute("PRAGMA table_info(utt)")}
    if "asr_text" not in cols:
        db.execute("ALTER TABLE utt ADD COLUMN asr_text TEXT")
        db.commit()


def todo(db: sqlite3.Connection, lang: str) -> set[str]:
    return {w for (w,) in db.execute(
        "SELECT wav FROM utt WHERE lang=? AND COALESCE(asr_text,'') = ''", (lang,))}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--langs", nargs="*")
    ap.add_argument("--batch", type=int, default=16)
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--check", action="store_true")
    a = ap.parse_args()

    db = sqlite3.connect(DB)
    ensure_column(db)
    langs = a.langs or [r[0] for r in db.execute("SELECT DISTINCT lang FROM utt ORDER BY lang")]

    if a.check:
        import json
        gc = json.load(open(f"{os.path.expanduser('~')}/.local/share/Vernacula/models/whisper_turbo/"
                            "generation_config.json"))
        sup = {k.strip("<|>") for k in gc.get("lang_to_id", {})}
        n_t = n_s = 0
        for lang in langs:
            code = ALIAS.get(lang.split("_")[0], lang.split("_")[0])
            pend = len(todo(db, lang))
            if code in sup:
                n_s += 1; n_t += pend
            elif pend:
                print(f"  {lang:14}{pend:6} rows  — NOT SUPPORTED, skipped")
        print(f"\n{n_s} supported languages, {n_t} rows pending")
        return 0

    import numpy as np, soundfile as sf, librosa, torch          # noqa: E402
    from transformers import WhisperForConditionalGeneration, WhisperProcessor  # noqa: E402
    proc = WhisperProcessor.from_pretrained(MODEL)
    model = WhisperForConditionalGeneration.from_pretrained(MODEL, dtype=torch.float16).to("cuda").eval()
    sup = set(proc.tokenizer.additional_special_tokens)

    for lang in langs:
        code = ALIAS.get(lang.split("_")[0], lang.split("_")[0])
        if f"<|{code}|>" not in sup:
            continue
        want = todo(db, lang)
        tar = f"{AUDIO}/{lang}/audio/train.tar.gz"
        if not want or not os.path.exists(tar):
            continue
        done = skipped = 0
        buf: list[tuple[str, "np.ndarray"]] = []

        def flush():
            nonlocal buf, done
            if not buf:
                return
            feats = proc([w for _, w in buf], sampling_rate=16000,
                         return_tensors="pt").input_features.to("cuda").half()
            with torch.no_grad():
                # ⚠ THE REPETITION GUARD IS NOT OPTIONAL. Plain greedy decoding DEGENERATES on exactly
                #   the languages this is meant to help with — measured before it was added: am_et
                #   1576/1584 rows (99.5%) came back as a single character repeated hundreds of times
                #   or one word looped, and bn_in produced Icelandic-looking Latin gibberish for
                #   Bengali audio. hr_hr 0/352 and af_za 17/1027 were fine, so the failure tracks
                #   Whisper's competence: it collapses where it is weak, which is where we most want a
                #   second opinion. ⚠ NOT an fp16 artifact — fp32 reproduced it exactly.
                ids = model.generate(feats, language=code, task="transcribe", max_new_tokens=220,
                                     repetition_penalty=1.15, no_repeat_ngram_size=4, num_beams=1)
            txt = proc.batch_decode(ids, skip_special_tokens=True)
            # ⚠ STORE A DEGENERATE DECODE AS SUCH, never as if it were a reading. The guard reduces
            #   these but does not eliminate them, and a looped string scores a huge WER that would
            #   read as reader divergence.
            db.executemany("UPDATE utt SET asr_text=? WHERE lang=? AND wav=?",
                           [((f"\u26a0DEGENERATE {t.strip()[:80]}" if degenerate(t) else t.strip()),
                             lang, w) for (w, _), t in zip(buf, txt)])
            db.commit()
            done += len(buf)
            buf = []

        with tarfile.open(tar) as t:
            for m in t:
                base = m.name.split("/")[-1]
                if base not in want:
                    continue
                w, sr = sf.read(io.BytesIO(t.extractfile(m).read()), dtype="float32")
                if not (MIN_SECONDS <= len(w) / sr <= MAX_SECONDS):
                    skipped += 1
                    continue
                if sr != 16000:
                    w = librosa.resample(w, orig_sr=sr, target_sr=16000, res_type="soxr_hq")
                buf.append((base, w))
                if len(buf) >= a.batch:
                    flush()
                    print(f"  {lang}: {done}/{len(want)}", flush=True)
                if a.limit and done >= a.limit:
                    break
        flush()
        print(f"{lang}: {done} transcribed"
              + (f", {skipped} outside the {MIN_SECONDS:.0f}-{MAX_SECONDS:.0f}s window" if skipped else ""),
              flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
