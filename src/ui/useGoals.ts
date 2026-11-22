import { useMemo } from 'react'
import { useList } from './context'
import { isGoalId, type Goal } from '../domain/goals'
import type { Meta } from '../domain/types'

/** Metas guardadas nas preferências (ids "goal:…"). */
export function useGoals(): Goal[] | undefined {
  const all = useList<Meta>('settings')
  return useMemo(() => all?.filter(r => isGoalId(r.id)) as Goal[] | undefined, [all])
}
