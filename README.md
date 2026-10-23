# movie buddy — AI film finder

Deploy these files to the root of your connected GitHub repo. Vercel automatically deploys them.

**Required Vercel Project Environment Variable:** `OPENAI_API_KEY` (Production). No TMDB or image-service key needed.

Adaptive questions and three film recommendations come from GPT-4o mini. The always-visible “How adventurous are you feeling?” slider controls real OpenAI temperature (0–2). When adjusted during a question or on results, the page immediately acknowledges the change, cancels stale requests, and requests revised content after 650 ms without further slider movement. Each new regeneration incurs OpenAI API charges.

Movie cards use color gradients selected by the model to suit each film’s mood, not copyrighted poster images. Recommendations are not independently verified against a movie catalog. No server-side user history database.
