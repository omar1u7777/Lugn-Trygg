type PolyfillLoader = () => Promise<unknown>;

const needsPromises = () =>
  typeof Promise === 'undefined' ||
  typeof Symbol === 'undefined' ||
  !('assign' in Object) ||
  !('from' in Array);

const needsFetch = () => typeof window !== 'undefined' && typeof window.fetch === 'undefined';

const needsAsyncRuntime = () => {
  if (typeof Symbol === 'undefined') {
    return true;
  }
  try {
     
    new Function('async function test() {}');
    return typeof (Symbol as any).asyncIterator === 'undefined';
  } catch {
    return true;
  }
};

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
