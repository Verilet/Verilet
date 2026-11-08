import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';

// jsdom doesn't implement scrolling, and the app scrolls to the top on every page change.
window.scrollTo = () => undefined;

afterEach(() => {
  sessionStorage.clear();
});
