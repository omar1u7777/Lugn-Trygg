type PolyfillLoader = () => Promise<unknown>;

const needsPromises = () =>
  typeof Promise === 'undefined' ||
  typeof Symbol === 'undefined' ||
  !('assign' in Object) ||
  !('from' in Array);

const needsFetch = () => typeof window !== 'undefined' && typeof window.fetch === 'undefined';

/*
 * This used to compile `async function test() {}` with new Function to see
 * whether the browser knows async functions. Under the Content-Security-Policy
 * (no 'unsafe-eval') that throws, so every page load reported a violation and
 * fetched regenerator-runtime for nothing. The bundle is an ES module full of
 * async code: a browser running it already has async functions, and
 * asyncIterator is what is left to check.
 */
const needsAsyncRuntime = () =>
  typeof Symbol === 'undefined' ||
  typeof (Symbol as SymbolConstructor & { asyncIterator?: symbol }).asyncIterator === 'undefined';

const loadIfNeeded = (condition: boolean, loader: PolyfillLoader) =>
  condition ? loader() : Promise.resolve();

export const loadPolyfills = async () => {
  if (typeof window === 'undefined') {
    return;
  }

  const tasks: Promise<unknown>[] = [];

  tasks.push(loadIfNeeded(needsPromises(), () => import('core-js/stable')));
  tasks.push(loadIfNeeded(needsFetch(), () => import('whatwg-fetch')));
  tasks.push(loadIfNeeded(needsAsyncRuntime(), () => import('regenerator-runtime/runtime')));

  await Promise.all(tasks);
};
