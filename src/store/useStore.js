import { useEffect, useState } from 'react'
import {
  getTestSet,
  getVersions,
  getCurrentVersion,
  getEvaluation,
  getBadcases,
  getABTests,
  getRegression,
  subscribe,
  MAX_TESTSET_SIZE
} from './store.js'

// React Hook：订阅 store 变化，返回最新状态
export function useStore() {
  const [snapshot, setSnapshot] = useState(() => {
    const versions = getVersions()
    return {
      testSet: getTestSet(),
      versions,
      currentVersion: getCurrentVersion(),
      evaluations: Object.fromEntries(
        versions.map(v => [v.id, getEvaluation(v.id)])
      ),
      badcases: getBadcases(),
      abtests: getABTests(),
      regressions: Object.fromEntries(
        versions.map(v => [v.id, getRegression(v.id)])
      ),
      maxTestSetSize: MAX_TESTSET_SIZE
    }
  })

  useEffect(() => {
    const refresh = () => {
      const versions = getVersions()
      setSnapshot({
        testSet: getTestSet(),
        versions,
        currentVersion: getCurrentVersion(),
        evaluations: Object.fromEntries(
          versions.map(v => [v.id, getEvaluation(v.id)])
        ),
        badcases: getBadcases(),
        abtests: getABTests(),
        regressions: Object.fromEntries(
          versions.map(v => [v.id, getRegression(v.id)])
        ),
        maxTestSetSize: MAX_TESTSET_SIZE
      })
    }
    const unsubscribe = subscribe(refresh)
    return unsubscribe
  }, [])

  return snapshot
}
