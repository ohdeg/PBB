// @vitest-environment jsdom
import { Blob as NodeBlob } from 'node:buffer';
import { describe, expect, it } from 'vitest';
import { sourceFromBlob } from './scoreSource';

describe('original score sources', () => {
  it('recognizes PDF bytes independent of MIME and preserves the original Blob', async () => {
    const blob = new NodeBlob(['%PDF-1.7\noriginal']);
    const source = await sourceFromBlob('pdf', blob as Blob);
    expect(source.kind).toBe('pdf');
    if (source.kind === 'pdf') expect(source.blob).toBe(blob);
  });
  it('rejects an arbitrary XML root and accepts a score root', async () => {
    await expect(sourceFromBlob('bad', new NodeBlob(['<?xml version="1.0"?><hello/>']) as Blob)).rejects.toThrow();
    const source = await sourceFromBlob('xml', new NodeBlob(['<score-partwise><part-list/></score-partwise>']) as Blob);
    expect(source.kind).toBe('musicxml');
  });
});
