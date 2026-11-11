# Integration guide

How the modules are put together into one app, how progress is saved, and how the app is built, tested and published. Owner: Meinka (integration and repo).

## How the app is put together

```
index.html
└── src/app/main.ts          app shell: creates the store, follows the URL, draws one screen
    ├── router.ts            #/  #/lesson/1 … #/lesson/5  #/final
    ├── context.ts           what every screen receives: { store, navigate }
    ├── progressActions.ts   finishActivity() and finishFinalTest()
    └── screens/
        ├── overview.ts      lesson map, badges, Continue, progress codes
        ├── lesson.ts        PLACEHOLDER: replaced by the six stage screens
        └── final.ts         PLACEHOLDER: replaced by the final test screens

src/engine       tree logic and animation steps   (Ethan)
src/content      lesson and test data              (Ethan)
src/assessment   scoring, hints, unlocking         (Nevan)
src/visualiser   drawing and the step player       (Unathi)
src/storage      saving progress and settings      (Meinka)
```

Screens import modules through their `index.ts` only (`'../../engine'`, never `'../../engine/insert'`).

## Plugging in a screen

A screen is a function that draws into `root` and can return a clean-up function:

```ts
import type { Screen } from '../context';
import { finishActivity } from '../progressActions';

export const lessonScreen: Screen = (root, route, ctx) => {
  // route.lesson is 1 to 5
  // ... draw the six stages into root ...
  // when the end-of-lesson activity is scored:
  //   const unlocked = finishActivity(ctx, route.lesson, activityResult(...));
  //   if (unlocked) show the badge
  return () => { /* destroy players, remove listeners */ };
};
```

Rules for screens:

- Never read or write `localStorage` directly. Use `ctx.store` (or the two helpers in `progressActions.ts`).
- Move between screens with `ctx.navigate({ name: 'lesson', lesson: 2 })`, not by setting `location`.
- Pass saved settings into the player, and save changes back:

```ts
createPlayer(mount, steps, {
  settings: ctx.store.load().settings,
  onSettingsChange: (s) => ctx.store.saveSettings(s),
});
```

- Earlier attempts for a lesson, for "retry only the items you missed": `ctx.store.attemptsFor(2)`.

## Saving progress

`src/storage` keeps one record in the browser's localStorage under `cos212-bst-app`:

| Field | Contents |
|---|---|
| `progress` | Lessons passed, badges, final test done (Nevan's `Progress` type) |
| `settings` | Visualiser display settings (Unathi's `VisualiserSettings`) |
| `attempts` | The last 100 results: lesson, band, missed item ids, time |

No names, emails or student numbers are stored. Saved data is checked when it is loaded: damaged or unknown data is dropped, lessons must be passed in order, and badges must match what was passed, so a corrupted record can't break the app. If the browser blocks storage, the app keeps progress in memory for that sitting and shows a notice.

**Moving between computers.** The ID document asks for progress to follow the student between computers. The prototype does this with a progress code: "Switching computers?" on the overview shows a code to copy, and pasting it into the app on another computer loads that progress. Accounts with sign-in are listed as future work. Only `src/storage` would change, because screens only call the store.

## Commands

```bash
npm ci                 # install
npm run dev            # local server with live reload (http://localhost:5173)
npm run check          # typecheck and tests, as CI runs them
npm run build          # dist/          the site for GitHub Pages
npm run build:offline  # dist-offline/  one index.html for the demo
npm run preview        # serve dist/ locally to check the production build
```

## Branches and pull requests

1. Branch from `main`: `yourname/feature`.
2. Push and open a pull request into `main`. CI runs the typecheck, the tests and both builds.
3. Merge when CI is green and one other person has looked at it. Merging to `main` publishes the site.

Branch protection on `main` (Settings → Branches): require a pull request and the `CI / check` status.

## Publishing

`.github/workflows/deploy.yml` builds `main` and publishes it to GitHub Pages. One-time setup by the repo owner: Settings → Pages → Source: **GitHub Actions**. The site is then at `https://rsnevan.github.io/cos750-final-project/`.

Note: GitHub Pages for a **private** repository needs a paid GitHub plan (GitHub Pro, or GitHub Education's free Pro for students). If Pages isn't available, use the offline build for the demo.

## Offline demo build

`npm run build:offline` produces `dist-offline/index.html`: the whole app in one file, with no network requests. Double-click it to open it in any browser, from a laptop or a USB stick. Every CI run also attaches it as the `offline-demo` download. Bring a copy to the presentation in case the venue Wi-Fi fails.

Progress saved in the offline file is separate from the published site's progress (they are different origins in the browser).
