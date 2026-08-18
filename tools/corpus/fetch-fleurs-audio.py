#!/usr/bin/env python3
"""Fetch FLEURS *train* audio for languages whose transcripts we have but whose audio we lack.

WHY THIS IS COMMITTED. The audio is the fourth sourcing tier (see docs/normalization_playbook.md, "The
corpus's own AUDIO is a sourcing tier"): for a written SIGN — `+`, `−`, `×` — the word is absent from every
text haystack by construction, because writing uses the glyph, and only a recording of someone reading the
sentence answers it. Which languages that tier can reach is therefore a property of what has been downloaded,
and #586 hit that wall repeatedly: twelve languages were reported "unreachable" purely because their tarball
was missing. A scratch downloader would leave the same hole `tools/corpus/terms/my.tsv` documents — the tree's
richest artifact could not be regenerated because the script that built it was never committed.

LAYOUT. Writes `<root>/data/<lang>/audio/train.tar.gz`, which is the layout the corpus already uses, so
nothing else needs a path change. Downloads resume, and a file whose size already matches the remote is
skipped — so a re-run is cheap and interrupting this is safe.

Only the TRAIN split is fetched. That is where the sign-bearing utterances sit for every language checked
under #586 (te_in was the one language with a cached `test` tarball and its `+` rows were all in `train`),
and pulling dev/test as well would roughly double 58 GiB for no measured gain.

Usage:
  python3 tools/corpus/fetch-fleurs-audio.py --root $AUDIO_CACHE \
      --transcripts $FLEURS [--langs te_in,fa_ir] [--dry-run]
  # default: every language present in --transcripts but absent from <root>/data, plus any whose
  # train.tar.gz is missing or short.
"""
import argparse, multiprocessing as mp, os, queue, sys, time

REPO = "google/fleurs"

# ⚠ A STALL WATCHDOG, ADDED AFTER ONE. A sibling downloader sat on a single language for ELEVEN AND A HALF
# HOURS: the process alive and asleep, the partial file frozen, nothing in the log. `hf_hub_download` has a
# 10s read timeout (hub 1.8.0) and it did not help — a dead-but-open socket, or the library's own retry
# backoff, leaves the call blocked with no way for the caller to notice.
#
# So the caller watches the BYTES instead of trusting the call. The download runs in a child process while
# the parent polls the destination tree; if it has not grown in STALL_S the child is terminated and retried.
# Watching PROGRESS rather than imposing a deadline is the point — a genuinely slow link keeps its time and
# only a frozen one is cut. Nothing is lost either way: hf_hub_download is content-addressed and resumes,
# and the size check above re-verifies the result.
STALL_S = 300      # no new bytes for this long → assume the socket is dead
POLL_S = 30
RETRIES = 3


def _tree_bytes(root: str) -> int:
    total = 0
    for dirpath, _dirs, files in os.walk(root):
        for f in files:
            try:
                total += os.path.getsize(os.path.join(dirpath, f))
            except OSError:  # a file can vanish mid-walk as the downloader renames it into place
                pass
    return total


def _child(path: str, root: str, q) -> None:
    from huggingface_hub import hf_hub_download
    try:
        q.put(("ok", hf_hub_download(REPO, path, repo_type="dataset", local_dir=root)))
    except Exception as e:  # noqa: BLE001 — reported verbatim to the parent
        q.put(("err", f"{type(e).__name__}: {e}"))


def fetch_watched(path: str, root: str) -> str:
    """Download one file, aborting and retrying if the byte count stops moving."""
    last_err = "no attempt"
    for _attempt in range(RETRIES):
        q = mp.Queue()
        proc = mp.Process(target=_child, args=(path, root, q), daemon=True)
        proc.start()
        size, changed = _tree_bytes(root), time.monotonic()
        try:
            while proc.is_alive():
                proc.join(POLL_S)
                if not q.empty():
                    break
                now = _tree_bytes(root)
                if now != size:
                    size, changed = now, time.monotonic()
                elif time.monotonic() - changed > STALL_S:
                    raise TimeoutError(f"no new bytes for {STALL_S}s")
            kind, payload = q.get_nowait()
        except (TimeoutError, queue.Empty) as e:
            last_err = str(e) or "child exited without reporting"
            continue
        finally:
            if proc.is_alive():
                proc.terminate()
                proc.join(10)
        if kind == "ok":
            return payload
        last_err = payload
    raise RuntimeError(f"gave up after {RETRIES} attempts: {last_err}")


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--root", required=True, help="audio cache root; files land under <root>/data/<lang>/audio/")
    p.add_argument("--transcripts", required=True, help="dir of per-language transcript folders, used as the want-list")
    p.add_argument("--langs", help="comma-separated FLEURS codes; overrides the derived want-list")
    p.add_argument("--priority", default="", help="comma-separated codes to fetch FIRST, so work can resume early")
    p.add_argument("--splits", default="train",
                   help="comma-separated splits to fetch (train,dev,test). Default train — that is where every "
                        "sign-bearing utterance checked under #586 sits. dev/test are the held-out material a "
                        "FINE-TUNE wants, and they also carry a few corpus instances train lacks (ar's and th's "
                        "second `×`), so they are worth fetching for their own reasons.")
    p.add_argument("--dry-run", action="store_true", help="report sizes and exit without downloading")
    return p.parse_args()


def main() -> None:
    a = parse_args()
    from huggingface_hub import HfApi, hf_hub_download

    have_dir = os.path.join(a.root, "data")
    os.makedirs(have_dir, exist_ok=True)
    if a.langs:
        want = [s.strip() for s in a.langs.split(",") if s.strip()]
    else:
        want = sorted(os.listdir(a.transcripts))

    api = HfApi()
    splits = [x.strip() for x in a.splits.split(",") if x.strip()]
    paths = [f"data/{l}/audio/{sp}.tar.gz" for l in want for sp in splits]
    # One batched metadata call, not one HEAD per language — the lesson in tools/corpus/README.md.
    sizes = {(i.path.split("/")[1], i.path.rsplit("/", 1)[1][:-7]): i.size
             for i in api.get_paths_info(REPO, paths, repo_type="dataset")}
    absent = [f"{l}/{sp}" for l in want for sp in splits if (l, sp) not in sizes]
    if absent:
        print(f"no train tarball in {REPO} (skipped): {' '.join(absent)}", file=sys.stderr)

    def needed(key) -> bool:
        lang, sp = key
        dest = os.path.join(have_dir, lang, "audio", f"{sp}.tar.gz")
        return not (os.path.exists(dest) and abs(os.path.getsize(dest) - sizes[key]) < 1024)

    todo = [k for k in sizes if needed(k)]
    pri = [s.strip() for s in a.priority.split(",") if s.strip()]
    todo.sort(key=lambda k: (pri.index(k[0]) if k[0] in pri else len(pri), k[0], k[1]))
    total = sum(sizes[k] for k in todo)
    print(f"{len(todo)} to fetch, {total / 2**30:.1f} GiB "
          f"({len(sizes) - len(todo)} already complete)", flush=True)
    if a.dry_run:
        for lang, sp in todo:
            print(f"  {lang:16} {sp:5} {sizes[(lang, sp)] / 2**30:5.2f} GiB")
        return

    done, failed, got = [], [], 0
    for i, (lang, sp) in enumerate(todo, 1):
        t0 = time.time()
        try:
            fetch_watched(f"data/{lang}/audio/{sp}.tar.gz", a.root)
            n = os.path.getsize(os.path.join(have_dir, lang, "audio", f"{sp}.tar.gz"))
            got += n
            ok = abs(n - sizes[(lang, sp)]) < 1024
            print(f"[{i}/{len(todo)}] {lang}/{sp}: {n / 2**30:.2f} GiB in {time.time() - t0:.0f}s"
                  f"{'' if ok else '  ⚠ SIZE MISMATCH'}", flush=True)
            (done if ok else failed).append(f"{lang}/{sp}")
        except Exception as e:  # noqa: BLE001 — one language failing must not abandon the rest
            print(f"[{i}/{len(todo)}] {lang}/{sp}: FAILED {type(e).__name__}: {e}", flush=True)
            failed.append(f"{lang}/{sp}")

    print(f"\ndone {len(done)}  failed {len(failed)}  fetched {got / 2**30:.1f} GiB", flush=True)
    if failed:
        print("FAILED:", " ".join(failed), flush=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
