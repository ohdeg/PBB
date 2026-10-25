/** Read-only compatibility sources. Never write or delete legacy data during migration. */
export const LEGACY_STORAGE = {
  guestUserIdKey: 'tempoflow:guest-user-id',
  localIdPrefix: 'local-',
  completedFlag: 'score-viewer:storage-migrated-v1',
  sources: [
    { prefix: 'score-viewer:', database: 'score-viewer-local-scores', guide: 'guide:score-viewer-seen' },
    { prefix: 'music-viewer:', database: 'music-viewer-local-scores', guide: 'guide:music-viewer-seen' },
  ],
  store: 'scores',
} as const;
