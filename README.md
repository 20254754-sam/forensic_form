# Form ni Jerah

A mobile-first interview form builder for UC interview work, surveys, and quiz-style forms.

## Current Status

- Works with local storage for now.
- Supports creator, editor, and respondent links.
- Supports form and quiz modes.
- Supports required questions, scoring, feedback, and saved responses.
- Uses a UC-inspired green and black interface.
- Ready for Supabase integration later.

## Tech Stack

- React
- Vite
- Local storage
- CSS responsive layout

## Run Locally

Install dependencies:

```bash
npm install
```

Start the local server:

```bash
npm run dev
```

Open:

```text
http://localhost:5173/
```

## Check Before Push

Run lint:

```bash
npm run lint
```

Run production build:

```bash
npm run build
```

## Share With Teammates

After pushing to GitHub, send your teammates the repository link.

For live testing in a browser, deploy the repo to Vercel or Netlify.

## Future Work

- Connect Supabase for database storage.
- Add authentication for form creators.
- Add APK packaging after the web version is stable.
