/** Synchronous recovery keeps the existing flush(): boolean contract safe on teardown. */
const writers = new Map<string, (document: unknown) => void>();
export function registerAnnotationWriter(storageId: string, write: (document: unknown) => void) { writers.set(storageId, write); return () => { if (writers.get(storageId) === write) writers.delete(storageId); }; }
export function publishAnnotationChange(storageId: string, document: unknown) { writers.get(storageId)?.(document); }
export async function annotationDocumentKey(mode: 'pages' | 'wrapped' | 'horizontal', layout: string) { const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(layout)); return `annotations:${mode}:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')}`; }
