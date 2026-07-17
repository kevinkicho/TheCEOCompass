export { getDeviceId, requireUid, tryUid, getDb, userPath } from "./scope"
export {
  loadLearnerJournalContext,
  loadLearnerJournalContextForUid,
  type LearnerJournalContext,
} from "./learner-context"
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
  loadReviewActivityDays,
  markConceptViewed,
  loadFrameworkProgress,
  WEAK_STAGE_SCORE_THRESHOLD,
  AGAIN_STAGE_SCORE_THRESHOLD,
  isWeakStageScore,
  hasWeakStages,
  shouldOfferConceptReview,
  ratingForWeakStages,
  humanizeConceptSlug,
  resolveConceptsForReview,
  seedConceptDueNow,
  seedConceptsToReview,
} from "./reviews"
export {
  computeReviewStats,
  computeReviewDayStreak,
  toLocalDayKey,
  MATURE_INTERVAL_DAYS,
  type ReviewRetentionStats,
} from "./review-stats"
export {
  exportUserData,
  downloadUserDataExport,
  importUserData,
  type UserDataExport,
} from "./export-import"
