import { importGlobalCSS } from '../cssImport.web';

describe('importGlobalCSS (web)', () => {
  it('should be a function that returns void', () => {
    expect(typeof importGlobalCSS).toBe('function');
    expect(importGlobalCSS()).toBeUndefined();
  });
});
