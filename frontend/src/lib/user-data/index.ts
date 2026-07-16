export { getDeviceId, requireUid, tryUid, getDb, userPath } from "./scope"
export {
  migrateDeviceDataToUser,
  mergeUsersData,
  snapshotUserTree,
  stashPendingAnonMerge,
  peekPendingAnonMerge,
  takePendingAnonMerge,
  setLastMergeStatus,
  getLastMergeStatus,
  clearLastMergeStatus,
  type MergeUsersResult,
  type MergeStatus,
  type PendingAnonMerge,
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
