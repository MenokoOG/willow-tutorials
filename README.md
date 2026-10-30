# willow-tutorials

These tutorials come from real work: Willow, a chat assistant I built for a clinic's website. The code is rewritten for teaching, and all names and contact details are placeholders.

## Tutorials

| Folder | What you build |
| --- | --- |
| `tutorial-1-offline-chatbot` | A keyword chatbot in TypeScript that needs no API and no key. |
| `tutorial-2-ai-with-fallback` | An AI assistant that falls back to the offline engine when the API fails. |

## Run a tutorial

Each folder is its own project.

```bash
cd tutorial-1-offline-chatbot
npm install
npm test
```

## Run every tutorial

From the repo root, this installs what is missing, then runs the tests and the typecheck in every `tutorial-*` folder.

```bash
npm test
```

## Write a lesson

Start from `LESSON_TEMPLATE.md`.

## The full app

The complete app (React, Vite, a Netlify Function) lives in [willow-bend](https://github.com/MenokoOG/willow-bend).
