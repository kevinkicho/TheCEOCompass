/**
 * Barrel re-export for user-data modules (backward-compatible import path).
 * Prefer `@/lib/user-data` for new code.
 */
export {
  getDeviceId,
  requireUid,
  tryUid,
  getDb,
  userPath,
  migrateDeviceDataToUser,
  loadJournalEntries,
  createJournalEntry,
  updateJournalEntry,
  deleteJournalEntry,
  recordOutcome,
  loadPathwayProgress,
  markPathwayComplete,
  saveQuizResult,
  saveScenarioAttempt,
  loadScenarioHistory,
  toggleFavoriteQuote,
  loadFavoriteQuotes,
  buildPathway,
  markConceptReviewed,
  loadDueReviews,
  loadAllReviews,
  loadReviewRecord,
  loadReviewActivityDays,
  markConceptViewed,
  loadFrameworkProgress,
} from "./user-data"
