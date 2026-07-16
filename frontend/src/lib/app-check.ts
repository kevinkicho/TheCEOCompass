/**
 * Firebase App Check scaffold (reCAPTCHA v3).
 *
 * - Initializes only when `NEXT_PUBLIC_APPCHECK_SITE_KEY` is set.
 * - No-ops safely when the key is missing (local dev without keys).
 * - Client token attachment is independent of backend enforcement.
 * - Full enforcement requires BOTH remote flag `app_check_enforced: true`
 *   AND Firebase Console → App Check → Enforce on RTDB / Functions.
 *
 * Debug tokens (localhost while console enforcement is on):
 *   NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN=true   // interactive prompt
 *   NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN=<uuid> // fixed debug token from console
 */

import {
  initializeAppCheck,
  ReCaptchaV3Provider,
  type AppCheck,
} from "firebase/app-check"
import type { FirebaseApp } from "firebase/app"
import { getFlag } from "@/lib/feature-flags"

let appCheckInstance: AppCheck | null = null
/** True after a successful or failed initializeAppCheck attempt with a site key. */
let initAttempted = false
let missingKeyWarned = false

export function getAppCheckSiteKey(): string {
  return (process.env.NEXT_PUBLIC_APPCHECK_SITE_KEY || "").trim()
}

/** True when a reCAPTCHA v3 site key is present in env. */
export function isAppCheckConfigured(): boolean {
  return getAppCheckSiteKey().length > 0
}

/**
 * Whether ops intend App Check enforcement.
 * Full blocking still requires Firebase Console enforce switches.
 */
export function isAppCheckEnforced(): boolean {
  return getFlag("app_check_enforced") === true
}

export function getAppCheckInstance(): AppCheck | null {
  return appCheckInstance
}

function attachDebugTokenIfConfigured(): void {
  if (typeof window === "undefined") return
  const raw = (process.env.NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN || "").trim()
  if (!raw) return
  // Must be set before initializeAppCheck (Firebase web SDK contract).
  const value: string | boolean = raw === "true" ? true : raw
  ;(
    globalThis as typeof globalThis & {
      FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean
    }
  ).FIREBASE_APPCHECK_DEBUG_TOKEN = value
}

/**
 * Initialize App Check when `NEXT_PUBLIC_APPCHECK_SITE_KEY` is set.
 * Safe no-op when missing key, SSR, no app, or already initialized.
 * Never throws — local dev without keys must keep working.
 */
export function initAppCheckIfConfigured(
  app: FirebaseApp | null | undefined,
): AppCheck | null {
  if (typeof window === "undefined") return null
  if (!app) return null
  if (appCheckInstance) return appCheckInstance

  const siteKey = getAppCheckSiteKey()
  if (!siteKey) {
    // Re-check after feature flags load so the warn can fire once when enforced.
    if (isAppCheckEnforced() && !missingKeyWarned) {
      missingKeyWarned = true
      console.warn(
        "[app-check] app_check_enforced is true but NEXT_PUBLIC_APPCHECK_SITE_KEY is unset; " +
          "App Check will not attach tokens. Local dev is fine only while Console enforce is off.",
      )
    }
    return null
  }

  if (initAttempted) return appCheckInstance
  initAttempted = true

  try {
    attachDebugTokenIfConfigured()
    appCheckInstance = initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(siteKey),
      isTokenAutoRefreshEnabled: true,
    })
    return appCheckInstance
  } catch (err) {
    // Duplicate init / network / reCAPTCHA load failures must not brick the app.
    console.warn("[app-check] initializeAppCheck failed:", err)
    appCheckInstance = null
    return null
  }
}

/** Test helper — reset module state between tests. */
export function resetAppCheckForTests(): void {
  appCheckInstance = null
  initAttempted = false
  missingKeyWarned = false
}
