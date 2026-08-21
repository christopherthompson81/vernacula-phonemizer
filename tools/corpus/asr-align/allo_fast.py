#!/usr/bin/env python3
"""
A vectorized `framesig` for allosaurus, because the stock one is a per-frame Python loop.

Profiling the corpus pass (`asr_align_allo.py`) put **91% of wall-clock in `pm.compute`** -- MFCC --
against 3% in the GPU acoustic model. The cause is `allosaurus/pm/preprocess.py:framesig`, which loops
over frames in Python doing two O(frame_len) numpy calls each:

    for frm in range(frames.shape[0]):          # ~1100 iterations for an 11s utterance
        frames[frm, :] = do_remove_dc_offset(frames[frm, :])
        raw_frames[frm, :] = frames[frm, :]
        frames[frm, :] = do_preemphasis(frames[frm, :], preemph)

Both operations are per-frame independent and vectorize over the frame axis exactly. The Povey window
is likewise rebuilt with a Python loop on every call, and depends only on `frame_len`, so it is cached.

⚠ THIS MONKEYPATCHES A THIRD-PARTY PACKAGE, which is only defensible because the equivalence is
CHECKED rather than argued: `selftest()` runs both implementations over real audio and compares the
decoded phone strings, and `install()` refuses to patch if allosaurus's source no longer matches what
this was written against. Run `python3 allo_fast.py --selftest` after any allosaurus upgrade.

⚠ It does NOT change what the model outputs -- if it ever does, that is a bug in here, not a better
decode. allosaurus is deterministic (its `do_dither` call is commented out upstream; verified 20/20
byte-identical on repeat decodes), so any difference at all is signal.
"""
from __future__ import annotations

import sys

import numpy as np

# Cache: frame_len -> povey window. The stock code rebuilds this with a Python loop per call.
_WIN: dict[tuple[int, str], np.ndarray] = {}


def _window(frame_len: int, wintype: str) -> np.ndarray:
    key = (frame_len, wintype)
    if key not in _WIN:
        if wintype == "povey":
            i = np.arange(frame_len)
            w = (0.5 - 0.5 * np.cos(2 * np.pi / (frame_len - 1) * i)) ** 0.85
        else:
            w = np.hamming(frame_len)
        _WIN[key] = w
    return _WIN[key]


def framesig(sig, frame_len, frame_step, dither=1.0, preemph=0.97, remove_dc_offset=True,
             wintype="hamming", stride_trick=True):
    """Vectorized drop-in for allosaurus.pm.preprocess.framesig. Same signature, same returns."""
    from allosaurus.pm.preprocess import rolling_window, round_half_up

    slen = len(sig)
    frame_len = int(round_half_up(frame_len))
    frame_step = int(round_half_up(frame_step))
    numframes = 1 if slen <= frame_len else 1 + ((slen - frame_len) // frame_step)

    padsignal = sig[: (numframes - 1) * frame_step + frame_len]
    win = _window(frame_len, wintype)

    if stride_trick:
        frames = rolling_window(padsignal, window=frame_len, step=frame_step)
    else:
        idx = np.tile(np.arange(0, frame_len), (numframes, 1)) + np.tile(
            np.arange(0, numframes * frame_step, frame_step), (frame_len, 1)).T
        frames = padsignal[np.array(idx, dtype=np.int32)]
        win = np.tile(win, (numframes, 1))

    frames = frames.astype(np.float32)
    # ⚠ The stock loop removes DC offset FIRST and snapshots raw_frames AFTER that but BEFORE
    # preemphasis. Getting that order wrong changes the energy term, which becomes cepstral
    # coefficient 0. Keep the three steps in this sequence.
    frames -= frames.mean(axis=1, keepdims=True, dtype=np.float32)
    raw_frames = frames.astype(np.float64)          # stock allocates np.zeros(shape) -> float64
    pre = np.empty_like(frames)
    pre[:, 0] = (1 - preemph) * frames[:, 0]        # NOT frames[:, 0]; upstream scales the first tap
    pre[:, 1:] = frames[:, 1:] - preemph * frames[:, :-1]

    return pre * win, raw_frames


# The upstream body this was derived from. If allosaurus changes `framesig`, the vectorization may no
# longer be equivalent, and silently patching over a changed implementation is the failure mode worth
# guarding: the pass would still run and the numbers would still look plausible.
_EXPECT = (
    "frames[frm, :] = do_remove_dc_offset(frames[frm, :])",
    "raw_frames[frm, :] = frames[frm, :]",
    "frames[frm, :] = do_preemphasis(frames[frm, :], preemph)",
    "return frames * win, raw_frames",
)


def install(strict: bool = True) -> bool:
    """Patch allosaurus to use the vectorized framesig. Returns whether the patch was applied."""
    import inspect

    from allosaurus.pm import preprocess

    if getattr(preprocess.framesig, "_vectorized", False):
        return True
    src = inspect.getsource(preprocess.framesig)
    if not all(frag in src for frag in _EXPECT):
        msg = "allo_fast: upstream framesig has changed; refusing to patch (rerun --selftest)"
        if strict:
            raise RuntimeError(msg)
        print(f"# {msg}", file=sys.stderr)
        return False
    framesig._vectorized = True
    preprocess.framesig = framesig
    # feature.py did `from allosaurus.pm import preprocess` and calls preprocess.framesig, so
    # rebinding the module attribute is enough -- but assert it rather than trust it.
    from allosaurus.pm import feature
    assert feature.preprocess.framesig is framesig, "framesig rebind did not reach feature.py"
    return True


def selftest(lang: str = "es_419", n: int = 40) -> int:
    """Decode real audio both ways and compare. Exit status is the number of mismatches."""
    import io
    import os
    import sqlite3
    import tarfile
    from argparse import Namespace

    import soundfile as sf
    import torch
    from allosaurus.am.utils import move_to_tensor
    from allosaurus.app import read_recognizer
    from allosaurus.audio import Audio
    from allosaurus.model import resolve_model_name
    from allosaurus.pm import preprocess

    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from asr_align_allo import AUDIO, DB, allo_lang

    stock = preprocess.framesig
    lid = allo_lang(lang)
    rec = read_recognizer(Namespace(model=resolve_model_name("latest"),
                                    device_id=0 if torch.cuda.is_available() else -1,
                                    lang="ipa", approximate=False, prior=None))
    dev = 0 if torch.cuda.is_available() else -1

    def decode(aud):
        f = rec.pm.compute(Audio(aud, 16000))
        tb, tl = move_to_tensor([np.expand_dims(f, 0),
                                 np.array([f.shape[0]], dtype=np.int32)], dev)
        with torch.no_grad():
            return f, rec.lm.compute(rec.am(tb, tl).detach().cpu().numpy()[0], lid, 1, emit=1.0)

    db = sqlite3.connect(DB)
    want = {w for w, in db.execute("SELECT wav FROM utt WHERE lang=? LIMIT ?", (lang, n))}
    bad = feat_exact = checked = 0
    with tarfile.open(f"{AUDIO}/{lang}/audio/train.tar.gz", "r:gz") as tf:
        for m in tf:
            w = os.path.basename(m.name)
            if not m.isfile() or w not in want:
                continue
            aud, sr = sf.read(io.BytesIO(tf.extractfile(m).read()), dtype="float32")
            if aud.ndim > 1:
                aud = aud.mean(axis=1)
            aud = (np.clip(aud, -1, 1) * 32767).astype(np.int16)
            preprocess.framesig = stock
            f0, p0 = decode(aud)
            install(strict=False)
            f1, p1 = decode(aud)
            preprocess.framesig = stock
            checked += 1
            feat_exact += int(np.array_equal(f0, f1))
            if p0 != p1:
                bad += 1
                print(f"  MISMATCH {w}\n    stock {p0[:90]}\n    fast  {p1[:90]}", file=sys.stderr)
            want.discard(w)
            if not want:
                break
    print(f"allo_fast selftest on {lang}: {checked} utterances, "
          f"{checked - bad} phone-identical, {feat_exact} bit-identical features")
    return bad


if __name__ == "__main__":
    import argparse

    ap = argparse.ArgumentParser()
    ap.add_argument("--selftest", action="store_true")
    ap.add_argument("--lang", default="es_419")
    ap.add_argument("-n", type=int, default=40)
    a = ap.parse_args()
    if a.selftest:
        sys.exit(1 if selftest(a.lang, a.n) else 0)
    ap.print_help()
