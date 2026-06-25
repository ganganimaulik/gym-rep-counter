import { importGlobalCSS } from '../cssImport';

describe('importGlobalCSS (native)', () => {
  it('should be a function that returns void', () => {
    expect(typeof importGlobalCSS).toBe('function');
    expect(importGlobalCSS()).toBeUndefined();
  });
});
