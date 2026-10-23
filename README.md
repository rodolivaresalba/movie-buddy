# movie buddy

A movie recommender with adaptive GPT-4o-mini questions, one real temperature control, and verified film suggestions from TMDB. No user database.

## Vercel setup

1. Push all files to the root of your GitHub repository (`index.html`, `api/chat.js`, `package.json`).
2. In Vercel → Project → Settings → Environment Variables, set `OPENAI_API_KEY` and `TMDB_API_READ_ACCESS_TOKEN`.
3. Redeploy the current commit. Use the `Other` framework preset.

No secret API key should ever be inserted in `index.html` or committed to GitHub. API calls use the server function `/api/chat`.
