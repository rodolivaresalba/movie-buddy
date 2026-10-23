# movie buddy — OpenAI only

A Vercel website with adaptive AI questions and three personalized film recommendations. No TMDB integration, no database, no accounts.

## Deploy

Upload the **contents** of this folder (not the folder itself) to the root of your existing GitHub repository, replacing `index.html`, `api/chat.js`, `package.json`, and `README.md`. Vercel deploys changes from `main` automatically.

In Vercel > movie-buddy > Environment Variables > Project, set:

- `OPENAI_API_KEY` = your OpenAI API key (Production)
- `OPENAI_MODEL` is not required; the backend uses `gpt-4o-mini`.

Remove or ignore `TMDB_API_READ_ACCESS_TOKEN` if present. No TMDB account is needed. Trigger a new deployment after changing environment variables.

## Limitations

The LLM is instructed to suggest existing films, but without a film database, the titles and release dates cannot be independently verified. Cards intentionally use typographic art, not movie posters. The slider changes the real temperature parameter passed to GPT-4o mini. API usage incurs charges; protect your public endpoint with rate limits or Vercel Firewall before broad sharing.
