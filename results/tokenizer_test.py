"""How badly does each candidate model's tokenizer break Chitonga into pieces? (Ícaro's test, Unsloth #12593, 8 Oct 2026)

    python tools/chitonga/tokenizer_test.py [--by T01]

Reads the translated lines (Chitonga + their English originals) from the database, read-only, and counts tokens per word
for each tokenizer, Chitonga beside English for the same sentences. Only tokenizer files are downloaded; no text leaves
the machine. Rule of thumb from the thread: above ~3 tokens per word, extend the vocabulary and train the embeddings.
"""
import argparse, json, os, urllib.request
from tokenizers import Tokenizer

CACHE = os.path.join(os.environ.get("TEMP", "."), "tok_cache")
MODELS = [  # (label, repo); ungated mirrors where the original is gated
    ("Gemma 3 4B", "unsloth/gemma-3-4b-it"),
    ("Gemma 4 E4B", "unsloth/gemma-4-E4B-it"),
    ("Qwen3 4B", "Qwen/Qwen3-4B"),
    ("Qwen3.5 9B", "Qwen/Qwen3.5-9B"),
    ("Llama 3.2 3B", "unsloth/Llama-3.2-3B-Instruct"),
    ("Phi-4 mini", "microsoft/Phi-4-mini-instruct"),
    ("Mistral 7B v0.3", "unsloth/mistral-7b-instruct-v0.3"),
    ("gpt-oss 20B", "openai/gpt-oss-20b"),
    ("DeepSeek V3", "deepseek-ai/DeepSeek-V3"),
    ("Sunflower 14B (Sunbird)", "Sunbird/Sunflower-14B"),
    ("NLLB-200 600M", "facebook/nllb-200-distilled-600M"),
]


def env():
    e = {}
    for l in open(os.environ.get("CHITONGA_ENV", ".env.local"), encoding="utf-8"):
        if "=" in l and not l.startswith("#"):
            k, v = l.split("=", 1); e[k.strip()] = v.strip()
    return e


def lines(by):
    e = env(); key = e["SUPABASE_SERVICE_ROLE_KEY"]; out = []
    for f in range(0, 20000, 1000):
        q = f"chitonga_lines?translated_by=eq.{by}&translation=not.is.null&select=line_id,en,translation&order=ord"
        r = urllib.request.Request(e["SUPABASE_URL"] + "/rest/v1/" + q, headers={"apikey": key, "Authorization": "Bearer " + key, "Range": f"{f}-{f+999}", "Range-Unit": "items"})
        j = json.load(urllib.request.urlopen(r)); out += j
        if len(j) < 1000: return out


def tokenizer(repo):
    p = os.path.join(CACHE, repo.replace("/", "__") + ".json")
    if not os.path.exists(p):
        os.makedirs(CACHE, exist_ok=True)
        urllib.request.urlretrieve(f"https://huggingface.co/{repo}/resolve/main/tokenizer.json", p)
    return Tokenizer.from_file(p)


def per_word(tok, texts):
    t = sum(len(tok.encode(s, add_special_tokens=False).ids) for s in texts)
    w = sum(len(s.split()) for s in texts)
    return t / w, t


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--by", default="T01"); a = ap.parse_args()
    rows = [r for r in lines(a.by) if (r.get("translation") or "").strip() and (r.get("en") or "").strip()]
    toi = [r["translation"].strip() for r in rows]; en = [r["en"].strip() for r in rows]
    wt, we = sum(len(s.split()) for s in toi), sum(len(s.split()) for s in en)
    print(f"{len(rows)} sentence pairs by {a.by}: {wt} Chitonga words, {we} English words "
          f"(Chitonga {sum(map(len, toi))/wt:.1f} letters a word, English {sum(map(len, en))/we:.1f})\n")
    print(f"{'tokenizer':26} {'Chitonga tok/word':>18} {'English tok/word':>17} {'ratio':>6} {'tokens per sentence, toi':>25}")
    for label, repo in MODELS:
        try:
            tok = tokenizer(repo)
        except Exception as ex:
            print(f"{label:26} not available ({str(ex)[:50]})"); continue
        ct, ctot = per_word(tok, toi); et, etot = per_word(tok, en)
        print(f"{label:26} {ct:18.2f} {et:17.2f} {ct/et:6.2f} {ctot/len(toi):25.1f}")
    print("\nexamples (Gemma 3):")
    try:
        tok = tokenizer("unsloth/gemma-3-4b-it")
        for s in toi[:3]:
            print("  ", s, "\n   ->", " | ".join(tok.encode(s, add_special_tokens=False).tokens))
    except Exception:
        pass


if __name__ == "__main__":
    main()
