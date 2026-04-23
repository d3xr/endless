import type { EndpointPreference } from '6-shared/api/zenmoney'
import type { AppThunk } from 'store'
import { tokenStorage } from '6-shared/api/tokenStorage'
import { zenmoney } from '6-shared/api/zenmoney'
import { setToken } from 'store/token'
import { applyServerPatch, resetData } from 'store/data'
import { syncData } from '4-features/sync'
import { convertZmToLocal, workerMethods } from 'worker'
import { clearLocalData, saveDataLocally } from './localData'
import { zmPreferenceStorage } from '6-shared/api/zmPreferenceStorage'
import { getDemoData, generatePersonaDiff, getPersonaById, type PersonaId } from 'demoData'

export const logOut = (): AppThunk => (dispatch, getState) => {
  // Clear persona-scoped localStorage BEFORE dispatching Redux actions.
  // resetData() triggers a re-render which recomputes the Savings page
  // asset projections; if localStorage still held the previous persona's
  // data at that moment, the memo would latch onto stale values until the
  // next account-list change.
  try {
    localStorage.removeItem('endless_assets')
    localStorage.removeItem('endless_current_salary')
    localStorage.removeItem('endless_behavioral_scenarios')
  } catch {}
  workerMethods.clearStorage()
  dispatch(resetData())
  dispatch(setToken(null))
  dispatch(clearLocalData())
  tokenStorage.clear()
}

export const logIn =
  (endpoint: EndpointPreference): AppThunk =>
  async (dispatch, getState) => {
    // Clear all data before logging in
    dispatch(logOut())

    // Get token
    const token = await zenmoney.authorize(endpoint)
    if (!token) return

    // Save token and endpoint preference
    zmPreferenceStorage.set(endpoint)
    tokenStorage.set(token)
    dispatch(setToken(token))

    // Sync data
    dispatch(syncData())
  }

export const loadBackup =
  (file: File): AppThunk<void> =>
  async (dispatch, getState) => {
    try {
      const txt = await file.text()
      const data = JSON.parse(txt)
      const converted = await convertZmToLocal(data)
      // TODO: maybe later make more elegant solution for local data
      tokenStorage.set(zenmoney.fakeToken)
      dispatch(setToken(zenmoney.fakeToken))
      dispatch(applyServerPatch(converted))
      dispatch(saveDataLocally())
    } catch (error) {
      console.error(error)
    }
  }

export const loadDemoData =
  (personaId?: PersonaId): AppThunk<void> =>
  async (dispatch, getState) => {
    try {
      // Clear any existing data first (important when switching personas)
      dispatch(logOut())

      const persona = personaId ? getPersonaById(personaId) : null
      const diff = persona ? generatePersonaDiff(persona) : getDemoData()
      console.log('Demo data loaded:', {
        persona: persona?.bio.headline,
        transactions: diff.transaction?.length,
      })

      // Per-persona physical assets + current salary + behavioural
      // trajectory power the Savings (Capital) projection page. Empty
      // assets array is valid — it just means this persona owns no
      // significant physical assets. behavioralScenarios overrides the
      // macro salaryMultipliers/savingsRateByYear fallback so each persona
      // gets their own three-scenario life path.
      //
      // CRITICAL: write localStorage BEFORE applyServerPatch. The patch
      // updates Redux account list, which triggers the useAssetProjections
      // memo to recompute and read these same keys. If we wrote them after,
      // the memo would fire against stale (just-cleared) localStorage and
      // fall back to DEFAULT_ASSETS / FALLBACK_SALARY, leaving the Capital
      // page stuck on generics until the next account-list change.
      if (persona) {
        try {
          localStorage.setItem(
            'endless_assets',
            JSON.stringify(persona.finance.assets)
          )
          localStorage.setItem(
            'endless_current_salary',
            String(persona.finance.income.salaryBase)
          )
          localStorage.setItem(
            'endless_behavioral_scenarios',
            JSON.stringify(persona.finance.behavioralScenarios)
          )
        } catch {}
      }

      // TODO: maybe later make more elegant solution for local data
      tokenStorage.set(zenmoney.fakeToken)
      dispatch(setToken(zenmoney.fakeToken))
      dispatch(applyServerPatch(diff))
      dispatch(saveDataLocally())
    } catch (error) {
      console.error(error)
    }
  }
