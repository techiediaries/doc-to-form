# Research: AI to find and generate templates on demand

Status: research only, not planned yet (2026-11-26).

## Goal

Let users get templates that are not in the library: they describe the document, the app finds or generates it.

## The model from the Quran project

`quran-semantic` / `quran-semantic-v2` used **multilingual-e5** (small, then base) through
`@huggingface/transformers` (ONNX, CPU, no Python).

**It does not generate text.** e5 is an embedding model: it turns text into vectors to compare meaning.
It cannot write a document.

## Where e5 fits: search

- A user types in plain words, Darija or French: «بغيت ورقة باش نخرج من الخدمة».
- e5 matches it to **استقالة** even with no shared word.
- About 120 MB; runs in the browser or at build time (precomputed vectors). The site stays static and free.
- A low similarity score tells us "nothing close in the library" — the moment to offer generation.

## Where generation needs an LLM

| Option | Arabic legal wording | Cost / setup |
|---|---|---|
| Small model in the browser (Qwen 0.5–1.5B, WebLLM / transformers.js) | Weak: shaky grammar, invented legal terms | Free, slow on phones, big download |
| Cloudflare Workers AI (site is already on Cloudflare) | Fair with the larger models | Free tier, then low cost; one Worker route |
| Claude API | Best Arabic + French, follows a JSON template format | Paid per request; needs a Worker to hide the key |

## Proposed flow

1. User describes the document they need.
2. **e5 search** over the existing library → if a good match, show it (no generation).
3. If no match → **LLM generates** a template in our format (body + blanks), Moroccan wording,
   ideally in the bilingual v2 format (see TODO.md).
4. Mark it **"not legally reviewed"** (badge already planned in TODO.md).
5. Cache it; after review, it joins the library. Each template is generated once, not once per user → low cost.

## Risks

- **Legal accuracy**: an LLM may invent law articles or use Egyptian wording (same problem as the 61 old forms).
  Mitigation: review before publishing; prompt with Moroccan references (مدونة الشغل, ق.ل.ع); never present as legal advice.
- **Abuse / cost**: a public endpoint can be used as a free chatbot.
  Mitigation: rate limit per IP, accept only document-type requests, fixed output schema, max length.
- **Privacy**: users may type personal data in the description. Do not log it; generate templates with blanks, not filled documents.

## Recommendation

e5 for search + Claude or Workers AI for generation, with human review before a generated template joins the library.
A small in-browser LLM is not good enough for legal Arabic.

## Prerequisites

- Template format v2 (JSON, fields + body) — the generator needs a fixed format to write into.
- Node build script (manifest + search index) — would also produce the e5 vectors.
