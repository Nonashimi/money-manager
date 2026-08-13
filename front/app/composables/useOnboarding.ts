interface SettingsResponse {
  seenTours: string[]
}

/**
 * Tracks which per-page product tours the current user has already seen.
 * Backed by `Settings.seenTours` so the flags survive across devices/browsers.
 */
export function useOnboarding() {
  const api = useApi()

  async function hasSeenTour(tourId: string): Promise<boolean> {
    try {
      const settings = await api<SettingsResponse>('/settings')
      return settings.seenTours?.includes(tourId) ?? false
    } catch {
      // If settings can't be read, don't block the page with a tour.
      return true
    }
  }

  function markTourSeen(tourId: string) {
    return api('/settings', { method: 'PATCH', body: { markTourSeen: tourId } })
  }

  /** Clears every tour flag so all page tours run again — used by the "show guide" setting. */
  function resetAllTours() {
    return api('/settings', { method: 'PATCH', body: { resetTours: true } })
  }

  return { hasSeenTour, markTourSeen, resetAllTours }
}
