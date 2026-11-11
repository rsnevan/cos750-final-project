/**
  What every screen receives from the app shell. Screens never touch
  localStorage or the URL directly: they read and save through `store`
  and move between screens with `navigate`, so routing and storage can
  change without changing the screens.
 */
import type { ProgressStore } from '../storage';

export type Route =
  | { readonly name: 'overview' }
  | { readonly name: 'lesson'; readonly lesson: 1 | 2 | 3 | 4 | 5 }
  | { readonly name: 'final' };

export interface AppContext {
  readonly store: ProgressStore;
  navigate(route: Route): void;
}

// A screen draws itself into `root` and may return a clean-up function,
// which the shell calls before the next screen is drawn.
export type Screen<R extends Route = Route> = (root: HTMLElement, route: R, ctx: AppContext) => void | (() => void);
