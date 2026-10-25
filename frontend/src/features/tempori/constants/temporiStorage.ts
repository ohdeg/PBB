/** Current Tempori persistence names. Legacy identifiers are confined to migration. */
export const TEMPORI_STORAGE = {
  guestUserIdKey: 'tempori:guest-user-id',
  database: {
    name: 'tempori-local-library', version: 1, store: 'tempori', keyPath: 'id',
    userIndex: 'userId', createdAtIndex: 'createdAt', localIdPrefix: 'tempori-',
  },
  annotationsPrefix: 'tempori:annotations:',
  preferences: {
    bpm: 'tempori:last-bpm', measuresPerLine: 'tempori:last-measures-per-line',
    annotationBrushSizes: 'tempori:annotation-brush-sizes',
    autoScrollMode: 'tempori:auto-scroll-mode', viewerGuideSeen: 'tempori:guide:tempori-seen',
  },
  migrationFlag: 'tempori:storage-migrated-v1',
} as const;
