# Lumina Research

Production-ready AI research web application built with Next.js 15, TypeScript, TailwindCSS, Framer Motion, React Query, Context.dev retrieval, and the OpenAI Responses API.

## Local Development

```bash
npm install
npm run dev
```

Open http://127.0.0.1:3000.

## Required Environment Variables

Copy `.env.example` to `.env.local` locally. In Vercel, add these in Project Settings -> Environment Variables.

- `CONTEXT_DEV_API_KEY`: Context.dev API key for web retrieval.
- `CONTEXTDEV_BASE_URL`: defaults to `https://api.context.dev/v1/web/search`.
- `OPENAI_API_KEY`: enables full synthesized reports with OpenAI Responses API. Without it, the app returns evidence-only reports instead of hallucinating.
- `OPENAI_MODEL`: defaults to `gpt-4.1`.

## Deployment

Vercel build command: `npm run build`

Vercel output: Next.js default

Before pushing, verify:

```bash
npm run build
git status --short
```

Never commit `.env.local`, `.next`, or `node_modules`.
