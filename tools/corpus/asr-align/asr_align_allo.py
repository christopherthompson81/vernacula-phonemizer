#!/usr/bin/env python3
"""
Recognize phones a SECOND time with allosaurus, beside the wav2vec2 column, for every FLEURS utterance.

`asr_align_corpus.py` filled `phones` from `facebook/wav2vec2-xlsr-53-espeak-cv-ft`. That model is
fine-tuned on **espeak** labels, so it is not independent of espeak for symbol choices OR dialect
choices -- and four separate findings in docs/investigations/asr_align_qc_investigation.md turned on
being unable to separate the instrument's convention from the speech (the hy/ky/ur low-vowel holds,
the es_419 theta, the "22 languages cannot spell Latin acronyms" framing, the BCS devoicing rate).

allosaurus is trained on a PHOIBLE phone-inventory / allophone tradition instead. That independence is
the entire point: it is the one thing the espeak confound cannot reach. Run 69 used it to settle es_419
-- wav2vec2 returned exactly one theta per orthographic <c/z> (28/28) and allosaurus returned none.

  audio -> phones        wav2vec2, espeak-labelled     what the espeak tradition would write
  audio -> phones_allo   allosaurus, PHOIBLE-labelled  what a different tradition would write

⚠ IT IS NOT GROUND TRUTH EITHER, and it is not the better of the two. It is coarser (fewer length
marks, dental diacritics the folds must handle) and it carries its own inventory prior. The value is
in the PAIR: agreement between two independently-labelled recognizers is far stronger evidence than
either alone, and disagreement is exactly the signal that a finding is about the instrument.

Usage:
  python3 asr_align_allo.py                       # every language already in the table
  python3 asr_align_allo.py --langs es_419 en_us
  python3 asr_align_allo.py --limit 50 --langs es_419      # throughput probe
"""
from __future__ import annotations

import argparse
import io
import os
import queue
import sqlite3
import sys
import tarfile
import threading
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

ROOT = os.environ.get("ASR_ALIGN_ROOT", "/mnt/data/omnivoice_ipa")
AUDIO = f"{ROOT}/corpus/audio_cache/data"
DB = f"{ROOT}/work/asr_align/align.sqlite"

# ⚠ THE UNIVERSAL DECODE IS A DIFFERENT INSTRUMENT, not a smaller version of the same one. Restricting
# the decode to a language's PHOIBLE inventory yielded 33 phone types on es_419 where the unrestricted
# `ipa` decode yielded 88, at 0.249 PER between them -- the unrestricted one invents exotica (b̞, ɻ̩,
# k͡p̚) that no fold table will ever tame. So the restricted decode is what we store.
#
# The obvious worry about restricting is the mirror image of espeak's failure: a narrow inventory could
# SUPPRESS a real phone rather than invent one. Measured, on the case that matters most -- theta IS in
# allosaurus's 46-phone Spanish inventory, and it wrote 0 of 66 anyway; and on English it emits theta
# readily (11 across 20 theta-word utterances). The inventory was not the reason for the es_419 zero.
#
# 96 of the 102 corpus languages resolve to a PHOIBLE inventory. The other six have none, so they get
# the universal decode -- and `phones_allo_lang` records which decode each row got, so the column is
# never silently two instruments.
ALLO_LANG = {
    "af_za": "afr", "am_et": "amh", "ar_eg": "arz", "as_in": "asm", "ast_es": "ast",
    "az_az": "azj", "bg_bg": "bul", "bn_in": "ben", "ca_es": "cat", "ceb_ph": "ceb",
    "ckb_iq": "ckb", "cmn_hans_cn": "cmn", "cs_cz": "ces", "cy_gb": "cym", "da_dk": "dan",
    "de_de": "deu", "el_gr": "ell", "en_us": "eng", "es_419": "spa", "et_ee": "ekk",
    "fa_ir": "pes", "ff_sn": "fuc", "fi_fi": "fin", "fil_ph": "fil", "fr_fr": "fra",
    "ga_ie": "gle", "gl_es": "glg", "gu_in": "guj", "ha_ng": "hau", "he_il": "heb",
    "hi_in": "hin", "hr_hr": "hrv", "hu_hu": "hun", "hy_am": "hye", "id_id": "ind",
    "ig_ng": "ibo", "is_is": "isl", "it_it": "ita", "ja_jp": "jpn", "jv_id": "jav",
    "ka_ge": "kat", "kam_ke": "kam", "kea_cv": "kea", "km_kh": "khm", "kn_in": "kan",
    "ko_kr": "kor", "ky_kg": "kir", "lb_lu": "ltz", "lg_ug": "lug", "ln_cd": "lin",
    "lo_la": "lao", "lt_lt": "lit", "luo_ke": "luo", "lv_lv": "lvs", "mi_nz": "mri",
    "mk_mk": "mkd", "ml_in": "mal", "mn_mn": "khk", "mr_in": "mar", "ms_my": "zsm",
    "mt_mt": "mlt", "my_mm": "mya", "nb_no": "nob", "ne_np": "npi", "nl_nl": "nld",
    "oc_fr": "oci", "or_in": "ory", "pa_in": "pan", "pl_pl": "pol", "ps_af": "pbt",
    "pt_br": "por", "ro_ro": "ron", "ru_ru": "rus", "sd_in": "snd", "sk_sk": "slk",
    "sl_si": "slv", "sn_zw": "sna", "so_so": "som", "sr_rs": "srp", "sv_se": "swe",
    "sw_ke": "swh", "ta_in": "tam", "te_in": "tel", "tg_tj": "tgk", "th_th": "tha",
    "tr_tr": "tur", "uk_ua": "ukr", "umb_ao": "umb", "ur_pk": "urd", "uz_uz": "uzn",
    "vi_vn": "vie", "wo_sn": "wol", "xh_za": "xho", "yo_ng": "yor", "yue_hant_hk": "yue",
    "zu_za": "zul",
}
# No PHOIBLE inventory ships for these. `ipa` is allosaurus's unrestricted 230-phone decode.
UNIVERSAL = "ipa"
NO_INVENTORY = ("be_by", "bs_ba", "kk_kz", "nso_za", "ny_mw", "om_et")

MIGRATE = (
    "ALTER TABLE utt ADD COLUMN phones_allo TEXT",
    "ALTER TABLE utt ADD COLUMN phones_allo_lang TEXT",
)
NOTES = {
    "phones_allo": "allosaurus (PHOIBLE-trained) phones -- a second, espeak-INDEPENDENT opinion on the "
                   "same audio. Space-separated units. Not ground truth; read it against `phones`, "
                   "where disagreement means the finding is about the instrument.",
    "phones_allo_lang": "the allosaurus lang_id used: an ISO-639-3 code for a restricted inventory "
                        f"decode, or {UNIVERSAL!r} for the unrestricted 230-phone decode used by the "
                        "six languages with no PHOIBLE inventory. NEVER pool the two without checking.",
}


def allo_lang(lang: str) -> str:
    return ALLO_LANG.get(lang, UNIVERSAL)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--langs", nargs="*")
    ap.add_argument("--limit", type=int, default=0, help="utterances per language (probe)")
    ap.add_argument("--batch", type=int, default=48)
    # ⚠ THREADS, not processes, and it genuinely scales: MFCC is 87% of the pass and 92% of THAT is
    # `resampy` resampling 16 kHz FLEURS audio down to the model's 8 kHz. resampy's kernel is a numba
    # gufunc, which releases the GIL, so a plain thread pool gets 15.8 -> 100 utt/s at 12 workers with
    # bit-identical features (96/96). The GPU is only ~4% of the pass, so feeding it is not the problem.
    ap.add_argument("--threads", type=int, default=min(12, (os.cpu_count() or 4)))
    ap.add_argument("--db", default=DB)
    ap.add_argument("--device", default="cuda")
    ap.add_argument("--redo", action="store_true", help="re-run languages already filled in")
    ap.add_argument("--stock-mfcc", action="store_true",
                    help="skip the allo_fast vectorization (identical output, ~20x slower)")
    a = ap.parse_args()

    # ⚠ Set BEFORE numpy/torch import or it is ignored. Stock MFCC was 91% of wall-clock and BLAS was
    # spreading its small per-frame matmuls over every core -- 19m40s of CPU to produce 2m12s of
    # wall-clock on af_za, i.e. paying 9x the power for thrash. `allo_fast` removes the per-frame loop
    # entirely, after which the remaining arrays are too small for threading to help.
    for var in ("OMP_NUM_THREADS", "OPENBLAS_NUM_THREADS", "MKL_NUM_THREADS", "NUMEXPR_NUM_THREADS"):
        os.environ.setdefault(var, "1")

    import numpy as np
    import soundfile as sf
    import torch
    from concurrent.futures import ThreadPoolExecutor
    from allosaurus.am.utils import move_to_tensor
    from allosaurus.app import read_recognizer
    from allosaurus.audio import Audio
    from allosaurus.model import resolve_model_name
    from argparse import Namespace

    db = sqlite3.connect(a.db)
    for stmt in MIGRATE:
        try:
            db.execute(stmt)
        except sqlite3.OperationalError:
            pass  # already migrated
    for col, note in NOTES.items():
        db.execute("INSERT OR REPLACE INTO schema_notes(col,note) VALUES (?,?)", (col, note))
    db.execute("PRAGMA journal_mode=WAL")
    db.commit()

    dev = 0 if (a.device == "cuda" and torch.cuda.is_available()) else -1
    cfg = Namespace(model=resolve_model_name("latest"), device_id=dev,
                    lang=UNIVERSAL, approximate=False, prior=None)
    rec = read_recognizer(cfg)

    import allo_fast
    fast = allo_fast.install(strict=not a.stock_mfcc)
    print(f"# allosaurus on {'cuda' if dev >= 0 else 'cpu'}, batch {a.batch}, "
          f"{a.threads} mfcc threads, mfcc {'vectorized' if fast and not a.stock_mfcc else 'stock'}", file=sys.stderr)

    todo = a.langs or [r[0] for r in db.execute("SELECT DISTINCT lang FROM utt ORDER BY lang")]
    pool = ThreadPoolExecutor(a.threads)
    for lang in todo:
        lid = allo_lang(lang)
        want = {r[0] for r in db.execute(
            "SELECT wav FROM utt WHERE lang=?" + ("" if a.redo else " AND phones_allo IS NULL"),
            (lang,))}
        if not want:
            print(f"{lang}: already done", file=sys.stderr)
            continue
        tar_path = f"{AUDIO}/{lang}/audio/train.tar.gz"
        if not os.path.exists(tar_path):
            print(f"{lang}: no train.tar.gz, skipped", file=sys.stderr)
            continue
        t0, n, batch = time.time(), 0, []

        def flush(batch: list[tuple[str, "np.ndarray"]]) -> None:
            if not batch:
                return
            feats = list(pool.map(lambda b: rec.pm.compute(Audio(b[1], 16000)), batch))
            # ⚠ allosaurus's AM packs its BiLSTM (pack_padded_sequence), which is the right thing --
            # but it uses enforce_sorted, so the batch must be in DESCENDING length order and the
            # results unsorted afterwards. Verified batch==single on 60/60 utterances; padding does
            # not leak into the decode.
            order = sorted(range(len(feats)), key=lambda j: -feats[j].shape[0])
            srt = [feats[j] for j in order]
            pad = np.zeros((len(srt), srt[0].shape[0], srt[0].shape[1]), dtype=srt[0].dtype)
            for j, f in enumerate(srt):
                pad[j, : f.shape[0]] = f
            tb, tl = move_to_tensor(
                [pad, np.array([f.shape[0] for f in srt], dtype=np.int32)], dev)
            with torch.no_grad():
                lprobs = rec.am(tb, tl).detach().cpu().numpy()
            for j, src in enumerate(order):
                out = rec.lm.compute(lprobs[j][: srt[j].shape[0]], lid, 1, emit=1.0)
                db.execute(
                    "UPDATE utt SET phones_allo=?, phones_allo_lang=? WHERE lang=? AND wav=?",
                    (out, lid, lang, batch[src][0]))
            db.commit()

        # ⚠ Decompression runs in its own thread, feeding a bounded queue. gunzip is only ~3% of the
        # pass but it was SERIALIZED with the 87% -- the reader sat idle during MFCC and vice versa.
        # Bounded so a fast reader cannot pull a whole language's audio into RAM.
        q: "queue.Queue[tuple[str, np.ndarray] | None]" = queue.Queue(maxsize=a.batch * 4)

        def produce() -> None:
            try:
                with tarfile.open(tar_path, "r:gz") as tf:
                    seen = 0
                    for m in tf:
                        if not m.isfile() or not m.name.endswith(".wav"):
                            continue
                        wav = os.path.basename(m.name)
                        if wav not in want:
                            continue
                        fh = tf.extractfile(m)
                        if fh is None:
                            continue
                        try:
                            aud, sr = sf.read(io.BytesIO(fh.read()), dtype="float32")
                        except Exception as e:  # a truncated member must not kill the language
                            print(f"  {lang}/{wav}: unreadable ({e})", file=sys.stderr)
                            continue
                        if aud.ndim > 1:
                            aud = aud.mean(axis=1)
                        if sr != 16000:
                            print(f"  {lang}/{wav}: {sr} Hz, skipped", file=sys.stderr)
                            continue
                        # ⚠ IN-MEMORY int16, NOT ffmpeg. allosaurus's own reader takes a 16-bit PCM
                        # FILE and FLEURS wavs are float32, so run 69 went through `ffmpeg
                        # -sample_fmt s16` and a temp file. That is ~20x slower and NOT more correct:
                        # ffmpeg DITHERS on the way down, perturbing the decode by ~2-4% PER against
                        # this path. Neither quantization is the true one; this one is free.
                        q.put((wav, (np.clip(aud, -1, 1) * 32767).astype(np.int16)))
                        seen += 1
                        if a.limit and seen >= a.limit:
                            break
            finally:
                q.put(None)

        reader = threading.Thread(target=produce, daemon=True)
        reader.start()
        while True:
            item = q.get()
            if item is None:
                break
            batch.append(item)
            n += 1
            if len(batch) >= a.batch:
                flush(batch)
                batch = []
        flush(batch)
        reader.join()
        dt = time.time() - t0
        print(f"{lang}: {n} utterances ({lid}) in {dt:.0f}s ({n / max(dt, 1e-9):.1f}/s)",
              file=sys.stderr)

    pool.shutdown()
    done = db.execute("SELECT COUNT(*) FROM utt WHERE phones_allo IS NOT NULL").fetchone()[0]
    total = db.execute("SELECT COUNT(*) FROM utt").fetchone()[0]
    print(f"\n{a.db}: phones_allo on {done}/{total} rows", file=sys.stderr)
    db.close()


if __name__ == "__main__":
    main()
