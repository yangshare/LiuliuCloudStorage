import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export type SyncStage = 'transfer' | 'scan' | 'diff' | 'queue' | 'complete'
export type SyncItemStatus = 'running' | 'completed' | 'failed'

export interface AutoSyncGlobalItem {
  planId: number
  planName: string
  stage: SyncStage
  status: SyncItemStatus
  progress: number
  message: string
  queuedCount?: number
  startTime: number
}

export interface AutoSyncProgressData {
  planId: number
  stage: string
  status: string
  message?: string
  current?: number
  total?: number
}

export const STAGE_TEXT_MAP: Record<string, string> = {
  transfer: '转存中',
  scan: '扫描远程文件',
  diff: '快照对比',
  queue: '加入下载队列',
  complete: '完成'
}

const STAGE_DEFAULT_PROGRESS: Record<string, number> = {
  transfer: 15,
  scan: 45,
  diff: 70,
  queue: 85,
  complete: 100
}

const VALID_STAGES: readonly string[] = ['transfer', 'scan', 'diff', 'queue', 'complete']
const COMPLETED_DISMISS_DELAY = 4000
const FAILED_DISMISS_DELAY = 8000
const MAX_VISIBLE_ITEMS = 3

export const useAutoSyncGlobalStore = defineStore('autoSyncGlobal', () => {
  const items = ref<AutoSyncGlobalItem[]>([])
  const activeTimers = new Map<number, ReturnType<typeof setTimeout>>()

  const visibleItems = computed(() => items.value.slice(0, MAX_VISIBLE_ITEMS))
  const hiddenCount = computed(() => Math.max(0, items.value.length - MAX_VISIBLE_ITEMS))

  function getStageText(stage: string): string {
    return STAGE_TEXT_MAP[stage] || stage
  }

  function updateProgress(data: AutoSyncProgressData): void {
    const existing = items.value.find(item => item.planId === data.planId)
    const progress = calculateProgress(data.current, data.total, data.stage)
    const status = deriveStatus(data.stage, data.status)

    if (existing) {
      const message = data.message || ''
      const hasChanged =
        existing.stage !== data.stage ||
        existing.status !== status ||
        existing.progress !== progress ||
        existing.message !== message

      if (!hasChanged) {
        if (status !== 'completed' && status !== 'failed') return
        if (activeTimers.has(data.planId)) return
      }

      existing.stage = coerceStage(data.stage)
      existing.status = status
      existing.progress = progress
      existing.message = message
      if (status === 'completed') {
        extractQueuedCount(existing, data.message)
      }
    } else {
      items.value.push({
        planId: data.planId,
        planName: `同步计划 #${data.planId}`,
        stage: coerceStage(data.stage),
        status,
        progress,
        message: data.message || '',
        startTime: Date.now()
      })
    }

    if (status === 'completed') {
      scheduleDismiss(data.planId, COMPLETED_DISMISS_DELAY)
    } else if (status === 'failed') {
      scheduleDismiss(data.planId, FAILED_DISMISS_DELAY)
    }
  }

  function updatePlanName(planId: number, planName: string): void {
    const item = items.value.find(i => i.planId === planId)
    if (item) {
      item.planName = planName
    }
  }

  function dismiss(planId: number): void {
    clearTimer(planId)
    items.value = items.value.filter(item => item.planId !== planId)
  }

  function scheduleDismiss(planId: number, delay: number): void {
    clearTimer(planId)
    const timer = setTimeout(() => {
      dismiss(planId)
    }, delay)
    activeTimers.set(planId, timer)
  }

  function clearTimer(planId: number): void {
    const timer = activeTimers.get(planId)
    if (timer) {
      clearTimeout(timer)
      activeTimers.delete(planId)
    }
  }

  function clearAllTimers(): void {
    for (const [, timer] of activeTimers) {
      clearTimeout(timer)
    }
    activeTimers.clear()
  }

  function dismissAll(): void {
    clearAllTimers()
    items.value = []
  }

  function calculateProgress(
    current: number | undefined,
    total: number | undefined,
    stage: string
  ): number {
    if (current !== undefined && total !== undefined && total > 0) {
      return Math.min(Math.round((current / total) * 100), 100)
    }
    return STAGE_DEFAULT_PROGRESS[stage] ?? 0
  }

  function deriveStatus(stage: string, status: string): SyncItemStatus {
    if (status === 'failed') return 'failed'
    if (stage === 'complete' && status === 'completed') return 'completed'
    return 'running'
  }

  function coerceStage(stage: string): SyncStage {
    return VALID_STAGES.includes(stage) ? (stage as SyncStage) : 'transfer'
  }

  function extractQueuedCount(item: AutoSyncGlobalItem, message?: string): void {
    if (!message) return
    const match = message.match(/(\d+)\s*个/)
    if (match) {
      item.queuedCount = parseInt(match[1], 10)
    }
  }

  return {
    items,
    visibleItems,
    hiddenCount,
    getStageText,
    updateProgress,
    updatePlanName,
    dismiss,
    dismissAll,
    clearAllTimers
  }
})
