export { getDeviceId, requireUid, tryUid, getDb, userPath } from "./scope"
export {
  migrateDeviceDataToUser,
  mergeUsersData,
  snapshotUserTree,
  prepareAnonMerge,
  runPendingAnonMerge,
  stashPendingAnonMerge,
  peekPendingAnonMerge,
  takePendingAnonMerge,
  clearPendingAnonMerge,
  setLastMergeStatus,
  getLastMergeStatus,
  clearLastMergeStatus,
  type MergeUsersResult,
  type MergeStatus,
  type PendingAnonMerge,
  type SnapshotResult,
  type PrepareAnonMergeResult,
} from "./migrate"
export {
  loadJournalEntries,
  createJournalEntry,
  updateJournalEntry,
  deleteJournalEntry,
  recordOutcome,
} from "./journal"
export {
  loadPathwayProgress,
  markPathwayComplete,
  saveQuizResult,
  saveScenarioAttempt,
  loadScenarioHistory,
  toggleFavoriteQuote,
  loadFavoriteQuotes,
  buildPathway,
} from "./progress"
export {
  markConceptReviewed,
  loadDueReviews,
  loadAllReviews,
  loadReviewRecord,
  markConceptViewed,
  loadFrameworkProgress,
} from "./reviews"
export {
  exportUserData,
  downloadUserDataExport,
  importUserData,
  type UserDataExport,
} from "./export-import"
