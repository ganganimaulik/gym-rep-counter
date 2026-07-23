import {
  useState,
  useRef,
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
} from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { randomUUID } from 'expo-crypto'
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  startAfter,
  documentId,
  Timestamp,
  writeBatch,
  deleteField,
} from 'firebase/firestore'
import { db } from '../utils/firebase'
import { getDefaultWorkouts } from '../utils/defaultWorkouts'
import type { User as FirebaseUser } from 'firebase/auth'
import type {
  WorkoutSet,
  WeightUnit,
  WeightLog,
  CalorieLog,
  TDEEConfig,
  JournalEntry,
  SupplementLog,
} from '../declarations'
import getLocalDateString from '../utils/getLocalDateString'
import type { SupplementSuggestion } from '../utils/supplementSchedule'

// Interface for a WorkoutSet object that has been serialized to JSON
// where the Firestore Timestamp is just a plain object.
interface SerializedWorkoutSetData extends Omit<WorkoutSet, 'date'> {
  date: {
    seconds: number
    nanoseconds: number
  }
}

interface SerializedJournalEntry {
  id: string
  note: string
  date: {
    seconds: number
    nanoseconds: number
  }
  supplements?: SupplementLog[]
}

interface SerializedWeightLog {
  id: string
  weight: number
  date: {
    seconds: number
    nanoseconds: number
  }
}

interface SerializedCalorieLog {
  id: string
  calories: number
  date: {
    seconds: number
    nanoseconds: number
  }
}

// ---------------------------------------------------------------------------
// Offline write support
//
// Firestore uses a memory-only cache here (see utils/firebase.ts): while
// offline its write promises neither resolve nor reject — they hang until
// connectivity returns. Signed-in writes therefore commit to local state and
// AsyncStorage first, and the server write runs in the background. Anything
// the background write hasn't confirmed is retried from the persisted queues
// by syncOfflineQueue.
// ---------------------------------------------------------------------------

type LogCollection = 'weightLogs' | 'calorieLogs' | 'journalEntries'

type UserDocField = 'settings' | 'workouts' | 'tdeeConfig'

type PendingOp =
  | {
      kind: 'set'
      coll: LogCollection
      id: string
      data: Record<string, unknown>
    }
  | { kind: 'delete'; coll: LogCollection; id: string }
  | { kind: 'userDoc'; field: UserDocField; data: unknown }

const OFFLINE_QUEUE_KEY = 'offlineQueue'
const PENDING_OPS_KEY = 'pendingOps'
const ACTIVE_SESSION_KEY = 'activeWorkoutSession'

// Guest TDEE config lives under its own key: 'tdeeConfig' is the signed-in
// cache (a mirror of the server), and treating it as guest data to migrate
// would push a stale cache over Firestore on every launch.
const GUEST_TDEE_CONFIG_KEY = 'guestTdeeConfig'
const TDEE_CONFIG_CACHE_KEY = 'tdeeConfig'

// Firestore rejects undefined values
const stripUndefined = (data: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined))

const isSerializedTimestamp = (
  v: unknown,
): v is { seconds: number; nanoseconds: number } =>
  typeof v === 'object' &&
  v !== null &&
  typeof (v as { seconds?: unknown }).seconds === 'number' &&
  typeof (v as { nanoseconds?: unknown }).nanoseconds === 'number'

// Timestamps read back from AsyncStorage are plain {seconds, nanoseconds}
// objects; convert them back so Firestore stores real timestamps.
const reviveTimestamps = (data: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(data).map(([k, v]) => [
      k,
      v instanceof Timestamp
        ? v
        : isSerializedTimestamp(v)
          ? new Timestamp(v.seconds, v.nanoseconds)
          : v,
    ]),
  )

// Whether two ops target the same document (or user-doc field) — the newer
// op supersedes the older one in the pending queue.
const samePendingTarget = (a: PendingOp, b: PendingOp): boolean => {
  if (a.kind === 'userDoc' || b.kind === 'userDoc') {
    return a.kind === 'userDoc' && b.kind === 'userDoc' && a.field === b.field
  }
  return a.coll === b.coll && a.id === b.id
}

const persistOfflineQueue = (queue: WorkoutSet[]) => {
  if (queue.length === 0) {
    AsyncStorage.removeItem(OFFLINE_QUEUE_KEY)
  } else {
    AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue))
  }
}

const persistPendingOps = (ops: PendingOp[]) => {
  if (ops.length === 0) {
    AsyncStorage.removeItem(PENDING_OPS_KEY)
  } else {
    AsyncStorage.setItem(PENDING_OPS_KEY, JSON.stringify(ops))
  }
}

// Interfaces
export interface Settings {
  countdownSeconds: number
  restSeconds: number
  maxReps: number
  maxSets: number
  concentricSeconds: number
  eccentricSeconds: number
  eccentricCountdownEnabled: boolean
  countdownAnnouncementThreshold: number
  volume: number
  supplementSuggestions?: SupplementSuggestion[]
  statRemindersEnabled?: boolean
  statRemindersUseAutoSleep?: boolean
  statRemindersSleepStart?: number
  statRemindersSleepEnd?: number
}

export interface Exercise {
  id: string
  name: string
  sets: number
  reps: number
  // Default unit for logging this exercise's weight ('kg' when absent).
  // Omit rather than store undefined — the workouts array is written to
  // Firestore as-is, and Firestore rejects undefined values.
  weightUnit?: WeightUnit
  // Selectable variants (e.g. ["Standing", "Sitting"]); omit when none.
  variants?: string[]
}

export interface Workout {
  id: string
  name: string
  exercises: Exercise[]
}

// Editable fields of a logged set. `variant: null` means "remove the
// variant" (undefined means "leave unchanged").
export interface HistoryEntryUpdates {
  reps?: number
  weight?: number
  weightUnit?: WeightUnit
  variant?: string | null
}

// Merge edits into a logged set, honoring variant removal.
const mergeHistoryUpdates = <T extends WorkoutSet>(
  item: T,
  updates: HistoryEntryUpdates,
): T => {
  const { variant, ...rest } = updates
  const merged: T = { ...item, ...rest }
  if (variant === null) {
    delete merged.variant
  } else if (variant !== undefined) {
    merged.variant = variant
  }
  return merged
}

export interface DataHook {
  settings: Settings
  workouts: Workout[]
  todaysCompletions: WorkoutSet[]
  historyVersion: number
  offlineQueue: WorkoutSet[]
  weightLogs: WeightLog[]
  calorieLogs: CalorieLog[]
  journalEntries: JournalEntry[]
  loadSettings: () => Promise<Settings>
  saveSettings: (
    newSettings: Settings,
    user: FirebaseUser | null,
  ) => Promise<void>
  loadWorkouts: () => Promise<Workout[]>
  saveWorkouts: (
    newWorkouts: Workout[],
    user: FirebaseUser | null,
  ) => Promise<void>
  addHistoryEntry: (
    entry: Omit<WorkoutSet, 'id' | 'date' | 'set' | 'startTime'>,
    set: number,
    startTime: number,
    endTime: number, // When set ended (rest timer started) - used for date field
    user: FirebaseUser | null,
  ) => Promise<void>
  updateHistoryEntry: (
    entryId: string,
    updates: HistoryEntryUpdates,
    user: FirebaseUser | null,
  ) => Promise<void>
  deleteHistoryEntry: (
    entryId: string,
    user: FirebaseUser | null,
  ) => Promise<void>
  fetchHistory: (
    user: FirebaseUser | null,
    lastVisible?: WorkoutSet,
  ) => Promise<WorkoutSet[]>
  fetchTodaysCompletions: (
    user: FirebaseUser | null,
    exerciseId: string,
  ) => Promise<void>
  fetchAllTodaysCompletions: (user: FirebaseUser | null) => Promise<void>
  isSetCompleted: (exerciseId: string, setNumber: number) => boolean
  getNextUncompletedSet: (exerciseId: string) => number
  resetSetsFrom: (
    exerciseId: string,
    setNumber: number,
    user: FirebaseUser | null,
  ) => Promise<void>
  arePreviousSetsCompleted: (exerciseId: string, setNumber: number) => boolean
  syncUserData: (
    firebaseUser: FirebaseUser,
    localSettings: Settings,
    localWorkouts: Workout[],
  ) => Promise<void>
  migrateGuestHistory: (user: FirebaseUser) => Promise<WorkoutSet[]>
  migrateGuestWeightLogs: (user: FirebaseUser) => Promise<WeightLog[]>
  migrateGuestCalorieLogs: (user: FirebaseUser) => Promise<CalorieLog[]>
  migrateGuestJournalEntries: (user: FirebaseUser) => Promise<JournalEntry[]>
  syncOfflineQueue: (user: FirebaseUser) => Promise<void>
  fetchFullHistory: (
    user: FirebaseUser | null,
    daysBack?: number,
  ) => Promise<WorkoutSet[]>
  fetchWeightLogs: (user: FirebaseUser | null) => Promise<WeightLog[]>
  addWeightLog: (
    weight: number,
    date: Date,
    user: FirebaseUser | null,
  ) => Promise<void>
  updateWeightLog: (
    id: string,
    weight: number,
    date: Date,
    user: FirebaseUser | null,
  ) => Promise<void>
  deleteWeightLog: (id: string, user: FirebaseUser | null) => Promise<void>
  fetchCalorieLogs: (user: FirebaseUser | null) => Promise<CalorieLog[]>
  addCalorieLog: (
    calories: number,
    date: Date,
    user: FirebaseUser | null,
  ) => Promise<void>
  updateCalorieLog: (
    id: string,
    calories: number,
    date: Date,
    user: FirebaseUser | null,
  ) => Promise<void>
  deleteCalorieLog: (id: string, user: FirebaseUser | null) => Promise<void>
  tdeeConfig: TDEEConfig | null
  loadTDEEConfig: (user?: FirebaseUser | null) => Promise<TDEEConfig | null>
  saveTDEEConfig: (
    config: TDEEConfig,
    user: FirebaseUser | null,
  ) => Promise<void>
  deleteTDEEConfig: (user: FirebaseUser | null) => Promise<void>
  fetchJournalEntries: (user: FirebaseUser | null) => Promise<JournalEntry[]>
  addJournalEntry: (
    note: string,
    date: Date,
    user: FirebaseUser | null,
    supplements?: SupplementLog[],
  ) => Promise<void>
  updateJournalEntry: (
    id: string,
    note: string,
    date: Date,
    user: FirebaseUser | null,
    supplements?: SupplementLog[],
  ) => Promise<void>
  deleteJournalEntry: (id: string, user: FirebaseUser | null) => Promise<void>
  setWorkouts: Dispatch<SetStateAction<Workout[]>>
  setSettings: Dispatch<SetStateAction<Settings>>
  setOfflineQueue: Dispatch<SetStateAction<WorkoutSet[]>>
  saveActiveSession: (workoutId: string, exerciseIndex: number) => Promise<void>
  loadActiveSession: () => Promise<{
    workoutId: string
    exerciseIndex: number
  } | null>
  clearActiveSession: () => Promise<void>
  clearUserScopedCache: () => Promise<void>
}

const defaultSettings: Settings = {
  countdownSeconds: 5,
  restSeconds: 60,
  maxReps: 15,
  maxSets: 3,
  concentricSeconds: 1,
  eccentricSeconds: 4,
  eccentricCountdownEnabled: true,
  countdownAnnouncementThreshold: 15,
  volume: 1.0,
  statRemindersEnabled: true,
  statRemindersUseAutoSleep: true,
  statRemindersSleepStart: 23,
  statRemindersSleepEnd: 7,
  supplementSuggestions: [
    { name: 'Creatine', defaultDosage: '5g' },
    { name: 'Whey Protein', defaultDosage: '1 scoop' },
    { name: 'Pre-workout', defaultDosage: '1 scoop' },
    { name: 'Fish Oil', defaultDosage: '1 cap' },
    { name: 'Vitamin D3', defaultDosage: '5000 IU' },
    { name: 'Caffeine', defaultDosage: '200mg' },
    { name: 'Multivitamin', defaultDosage: '1 tab' },
    { name: 'Zinc', defaultDosage: '50mg' },
    { name: 'Magnesium', defaultDosage: '400mg' },
    { name: 'BCAA', defaultDosage: '5g' },
    { name: 'Ashwagandha', defaultDosage: '600mg' },
    { name: 'Beta-Alanine', defaultDosage: '3g' },
    { name: 'Citrulline Malate', defaultDosage: '6g' },
    { name: 'L-Glutamine', defaultDosage: '5g' },
    { name: 'L-Theanine', defaultDosage: '200mg' },
  ],
}

export const useData = (): DataHook => {
  const [settings, setSettings] = useState<Settings>(defaultSettings)
  const [workouts, setWorkouts] = useState<Workout[]>(() =>
    getDefaultWorkouts(),
  )
  const [todaysCompletions, setTodaysCompletions] = useState<WorkoutSet[]>([])
  const [offlineQueue, setOfflineQueue] = useState<WorkoutSet[]>([])
  const [pendingOps, setPendingOps] = useState<PendingOp[]>([])
  const [historyVersion, setHistoryVersion] = useState(0)
  const submittedKeysRef = useRef<Set<string>>(new Set())
  const offlineSyncInFlightRef = useRef(false)

  // Mirror of offlineQueue so stable callbacks (fetches) can read the latest
  // queue without depending on it and changing identity on every write.
  const offlineQueueRef = useRef<WorkoutSet[]>([])
  useEffect(() => {
    offlineQueueRef.current = offlineQueue
  }, [offlineQueue])

  const enqueueOfflineEntry = useCallback((entry: WorkoutSet) => {
    setOfflineQueue((prev) => {
      const updated = [...prev, entry]
      persistOfflineQueue(updated)
      return updated
    })
  }, [])

  const removeFromOfflineQueue = useCallback((ids: string[]) => {
    const idSet = new Set(ids)
    setOfflineQueue((prev) => {
      const remaining = prev.filter((entry) => !idSet.has(entry.id))
      if (remaining.length === prev.length) return prev
      persistOfflineQueue(remaining)
      return remaining
    })
  }, [])

  const updateOfflineQueueEntry = useCallback(
    (entryId: string, updates: HistoryEntryUpdates) => {
      setOfflineQueue((prev) => {
        if (!prev.some((entry) => entry.id === entryId)) return prev
        const updated = prev.map((entry) =>
          entry.id === entryId ? mergeHistoryUpdates(entry, updates) : entry,
        )
        persistOfflineQueue(updated)
        return updated
      })
    },
    [],
  )

  const enqueuePendingOp = useCallback((op: PendingOp): PendingOp => {
    setPendingOps((prev) => {
      const updated = [
        ...prev.filter((existing) => !samePendingTarget(existing, op)),
        op,
      ]
      persistPendingOps(updated)
      return updated
    })
    return op
  }, [])

  const removePendingOp = useCallback((op: PendingOp) => {
    setPendingOps((prev) => {
      if (!prev.includes(op)) return prev
      const remaining = prev.filter((existing) => existing !== op)
      persistPendingOps(remaining)
      return remaining
    })
  }, [])

  // Sets queued locally but not yet confirmed by the server. They drive the
  // set-completion UI, so they must survive refetches and app restarts.
  const getQueuedTodaysCompletions = useCallback(
    (queue: WorkoutSet[], exerciseId?: string): WorkoutSet[] => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const cutoff = today.getTime()
      return queue.filter(
        (entry) =>
          entry.date &&
          typeof entry.date.toMillis === 'function' &&
          entry.date.toMillis() >= cutoff &&
          (!exerciseId || entry.exerciseId === exerciseId),
      )
    },
    [],
  )

  const loadOfflineQueue = useCallback(async () => {
    try {
      const queue = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY)
      if (queue) {
        const parsedQueue = JSON.parse(queue)
        if (Array.isArray(parsedQueue)) {
          const validQueue = parsedQueue
            .filter(
              (item) =>
                item && item.date && typeof item.date.seconds === 'number',
            )
            .map((item: SerializedWorkoutSetData) => ({
              ...item,
              date: new Timestamp(item.date.seconds, item.date.nanoseconds),
              startTime: isSerializedTimestamp(item.startTime)
                ? new Timestamp(
                    item.startTime.seconds,
                    item.startTime.nanoseconds,
                  )
                : null,
            }))
          // Entries queued before this load finished must survive it.
          setOfflineQueue((prev) => {
            const merged = [
              ...validQueue.filter((l) => !prev.some((p) => p.id === l.id)),
              ...prev,
            ]
            if (prev.length > 0) persistOfflineQueue(merged)
            return merged
          })
          // Surface today's unconfirmed sets even if a completions fetch
          // already ran (or can't run because we're offline).
          const todaysQueued = getQueuedTodaysCompletions(validQueue)
          if (todaysQueued.length > 0) {
            setTodaysCompletions((prev) => {
              const additions = todaysQueued.filter(
                (q) => !prev.some((p) => p.id === q.id),
              )
              return additions.length > 0 ? [...prev, ...additions] : prev
            })
          }
        }
      }
    } catch (e) {
      console.error('Failed to load offline queue.', e)
    }
  }, [getQueuedTodaysCompletions])

  const loadPendingOps = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(PENDING_OPS_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return
      const validOps = (parsed as PendingOp[]).filter(
        (op) =>
          op &&
          ((op.kind === 'set' &&
            typeof op.coll === 'string' &&
            typeof op.id === 'string' &&
            op.data != null) ||
            (op.kind === 'delete' &&
              typeof op.coll === 'string' &&
              typeof op.id === 'string') ||
            (op.kind === 'userDoc' && typeof op.field === 'string')),
      )
      // Ops queued before this load finished are newer and win on conflict.
      setPendingOps((prev) => {
        const merged = [
          ...validOps.filter((l) => !prev.some((p) => samePendingTarget(p, l))),
          ...prev,
        ]
        if (prev.length > 0) persistPendingOps(merged)
        return merged
      })
    } catch (e) {
      console.error('Failed to load pending ops.', e)
    }
  }, [])

  useEffect(() => {
    loadOfflineQueue()
    loadPendingOps()
  }, [loadOfflineQueue, loadPendingOps])

  // Queue the op, then echo it to Firestore in the background. The queued
  // copy is dropped once the server confirms; until then syncOfflineQueue
  // retries it whenever connectivity returns.
  const syncLogDoc = useCallback(
    (
      user: FirebaseUser,
      op: Extract<PendingOp, { kind: 'set' | 'delete' }>,
    ) => {
      enqueuePendingOp(op)
      void (async () => {
        try {
          const docRef = doc(db, 'users', user.uid, op.coll, op.id)
          if (op.kind === 'set') {
            await setDoc(docRef, stripUndefined(op.data))
          } else {
            await deleteDoc(docRef)
          }
          removePendingOp(op)
        } catch (e) {
          console.error(
            `Failed to sync ${op.coll} write, will retry when online.`,
            e,
          )
        }
      })()
    },
    [enqueuePendingOp, removePendingOp],
  )

  const syncUserDocField = useCallback(
    (user: FirebaseUser, field: UserDocField, data: unknown) => {
      const op = enqueuePendingOp({ kind: 'userDoc', field, data })
      void (async () => {
        try {
          const userDocRef = doc(db, 'users', user.uid)
          if (data === null) {
            await updateDoc(userDocRef, { [field]: deleteField() })
          } else {
            await setDoc(userDocRef, { [field]: data }, { merge: true })
          }
          removePendingOp(op)
        } catch (e) {
          console.error(
            `Failed to sync ${field} to Firestore, will retry when online.`,
            e,
          )
        }
      })()
    },
    [enqueuePendingOp, removePendingOp],
  )

  const loadSettings = useCallback(async (): Promise<Settings> => {
    try {
      const savedSettings = await AsyncStorage.getItem('repCounterSettings')
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings)
        // Merge with defaults to ensure new settings properties have values for existing users
        const mergedSettings = { ...defaultSettings, ...parsed }
        setSettings(mergedSettings)
        return mergedSettings
      }
      setSettings(defaultSettings)
      return defaultSettings
    } catch (e) {
      console.error('Failed to load settings.', e)
      return defaultSettings
    }
  }, [])

  const saveSettings = useCallback(
    async (newSettings: Settings, user: FirebaseUser | null) => {
      try {
        setSettings(newSettings)
        await AsyncStorage.setItem(
          'repCounterSettings',
          JSON.stringify(newSettings),
        )

        if (user) {
          syncUserDocField(user, 'settings', newSettings)
        }
      } catch (e) {
        console.error('Failed to save settings.', e)
      }
    },
    [syncUserDocField],
  )

  const fetchAllTodaysCompletions = useCallback(
    async (user: FirebaseUser | null) => {
      if (!user) {
        setTodaysCompletions([])
        return
      }

      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const startOfToday = Timestamp.fromDate(today)

      try {
        const historyCollectionRef = collection(
          db,
          'users',
          user.uid,
          'history',
        )
        const q = query(historyCollectionRef, where('date', '>=', startOfToday))
        const querySnapshot = await getDocs(q)
        const todaysSets = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as WorkoutSet[]
        const queued = getQueuedTodaysCompletions(
          offlineQueueRef.current,
        ).filter((q) => !todaysSets.some((s) => s.id === q.id))
        setTodaysCompletions([...todaysSets, ...queued])
      } catch (e) {
        console.error("Failed to fetch all of today's completions", e)
        setTodaysCompletions(
          getQueuedTodaysCompletions(offlineQueueRef.current),
        )
      }
    },
    [getQueuedTodaysCompletions],
  )

  const loadWorkouts = useCallback(async (): Promise<Workout[]> => {
    try {
      const savedWorkouts = await AsyncStorage.getItem('workouts')
      if (savedWorkouts) {
        const parsed = JSON.parse(savedWorkouts)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setWorkouts(parsed)
          return parsed
        }
      }
      const defaultWorkouts = getDefaultWorkouts()
      setWorkouts(defaultWorkouts)
      await AsyncStorage.setItem('workouts', JSON.stringify(defaultWorkouts))
      return defaultWorkouts
    } catch (e) {
      console.error('Failed to load workouts.', e)
      const defaultWorkouts = getDefaultWorkouts()
      setWorkouts(defaultWorkouts)
      return defaultWorkouts
    }
  }, [])

  const saveWorkouts = useCallback(
    async (newWorkouts: Workout[], user: FirebaseUser | null) => {
      try {
        setWorkouts(newWorkouts)
        await AsyncStorage.setItem('workouts', JSON.stringify(newWorkouts))
        if (user) {
          syncUserDocField(user, 'workouts', newWorkouts)
        }
      } catch (e) {
        console.error('Failed to save workouts', e)
      }
    },
    [syncUserDocField],
  )

  const addHistoryEntry = useCallback(
    async (
      entry: Omit<WorkoutSet, 'id' | 'date' | 'set' | 'startTime'>,
      set: number,
      startTime: number,
      endTime: number, // When set ended (rest timer started) - used for date field
      user: FirebaseUser | null,
    ) => {
      // Dedup guard: prevent duplicate writes if called twice for the same set
      const dedupeKey = `${entry.exerciseId}-${set}-${endTime}`
      if (submittedKeysRef.current.has(dedupeKey)) {
        return
      }
      submittedKeysRef.current.add(dedupeKey)

      const newEntryBase = {
        ...entry,
        set,
        startTime: startTime > 0 ? Timestamp.fromMillis(startTime) : null,
        date: endTime > 0 ? Timestamp.fromMillis(endTime) : Timestamp.now(),
      }

      if (user) {
        // Local-first: commit to state and the persisted offline queue before
        // any network I/O. Offline, the Firestore write below hangs without
        // rejecting, so a set that isn't stored locally first is lost if the
        // app is killed before connectivity returns.
        const docRef = doc(collection(db, 'users', user.uid, 'history'))
        const newEntry: WorkoutSet = { ...newEntryBase, id: docRef.id }
        setTodaysCompletions((prev) => [...prev, newEntry])
        setHistoryVersion((v) => v + 1)
        enqueueOfflineEntry(newEntry)

        // Background sync: on server ack drop the queued copy; otherwise
        // syncOfflineQueue retries the write at the same doc id (idempotent).
        void (async () => {
          try {
            await setDoc(docRef, newEntryBase)
            removeFromOfflineQueue([docRef.id])
          } catch (e) {
            console.error(
              'Failed to sync history entry, will retry when online.',
              e,
            )
          }
        })()
      } else {
        // Guest user
        try {
          const newEntry: WorkoutSet = {
            ...newEntryBase,
            id: `${Date.now()}-${entry.exerciseId}-${set}`,
          }

          // Save to today's completions
          const todayKey = `todaysCompletions-${getLocalDateString()}`
          const savedCompletionsRaw = await AsyncStorage.getItem(todayKey)
          const savedCompletions = savedCompletionsRaw
            ? JSON.parse(savedCompletionsRaw)
            : []
          const updatedCompletions = [...savedCompletions, newEntry]
          await AsyncStorage.setItem(
            todayKey,
            JSON.stringify(updatedCompletions),
          )

          // Save to full history
          const historyKey = 'guestHistory'
          const savedHistoryRaw = await AsyncStorage.getItem(historyKey)
          const savedHistory = savedHistoryRaw
            ? JSON.parse(savedHistoryRaw)
            : []
          const updatedHistory = [...savedHistory, newEntry]
          await AsyncStorage.setItem(historyKey, JSON.stringify(updatedHistory))

          setTodaysCompletions((prev) => [...prev, newEntry])
          setHistoryVersion((v) => v + 1)
        } catch (e) {
          console.error('Failed to save guest history entry', e)
        }
      }
    },
    [enqueueOfflineEntry, removeFromOfflineQueue],
  )

  const updateHistoryEntry = useCallback(
    async (
      entryId: string,
      updates: HistoryEntryUpdates,
      user: FirebaseUser | null,
    ) => {
      // Keep today's completions in sync so the workout screen reflects
      // edits made from the history screen.
      const syncTodaysCompletions = () =>
        setTodaysCompletions((prev) =>
          prev.map((item) =>
            item.id === entryId ? mergeHistoryUpdates(item, updates) : item,
          ),
        )

      if (user) {
        // Keep any queued copy in sync so a later flush doesn't resurrect
        // stale data.
        updateOfflineQueueEntry(entryId, updates)
        try {
          const docRef = doc(db, 'users', user.uid, 'history', entryId)
          // variant: null means "remove" — translate to a field delete.
          const { variant, ...rest } = updates
          const firestoreUpdates: Record<string, unknown> = { ...rest }
          if (variant === null) {
            firestoreUpdates.variant = deleteField()
          } else if (variant !== undefined) {
            firestoreUpdates.variant = variant
          }
          await updateDoc(docRef, firestoreUpdates)
          syncTodaysCompletions()
        } catch (e) {
          console.error('Failed to update history entry', e)
        }
      } else {
        // Guest user
        try {
          // Update in full history
          const historyKey = 'guestHistory'
          const savedHistoryRaw = await AsyncStorage.getItem(historyKey)
          if (savedHistoryRaw) {
            const allHistory = JSON.parse(savedHistoryRaw)
            const updatedHistory = allHistory.map((item: WorkoutSet) =>
              item.id === entryId ? mergeHistoryUpdates(item, updates) : item,
            )
            await AsyncStorage.setItem(
              historyKey,
              JSON.stringify(updatedHistory),
            )
          }

          // Update in today's completions if it's from today
          const todayKey = `todaysCompletions-${getLocalDateString()}`
          const savedCompletionsRaw = await AsyncStorage.getItem(todayKey)
          if (savedCompletionsRaw) {
            const allCompletions = JSON.parse(savedCompletionsRaw)
            const updatedCompletions = allCompletions.map((item: WorkoutSet) =>
              item.id === entryId ? mergeHistoryUpdates(item, updates) : item,
            )
            await AsyncStorage.setItem(
              todayKey,
              JSON.stringify(updatedCompletions),
            )
          }

          syncTodaysCompletions()
        } catch (e) {
          console.error('Failed to update guest history entry', e)
        }
      }
    },
    [updateOfflineQueueEntry],
  )

  const deleteHistoryEntry = useCallback(
    async (entryId: string, user: FirebaseUser | null) => {
      // Keep today's completions in sync so a set deleted from the history
      // screen is no longer marked as completed on the workout screen.
      const syncTodaysCompletions = () =>
        setTodaysCompletions((prev) =>
          prev.filter((item) => item.id !== entryId),
        )

      if (user) {
        // Drop any queued copy so a later flush doesn't resurrect the entry.
        removeFromOfflineQueue([entryId])
        try {
          const docRef = doc(db, 'users', user.uid, 'history', entryId)
          await deleteDoc(docRef)
          syncTodaysCompletions()
        } catch (e) {
          console.error('Failed to delete history entry', e)
        }
      } else {
        // Guest user
        try {
          // Delete from full history
          const historyKey = 'guestHistory'
          const savedHistoryRaw = await AsyncStorage.getItem(historyKey)
          if (savedHistoryRaw) {
            const allHistory = JSON.parse(savedHistoryRaw)
            const updatedHistory = allHistory.filter(
              (item: WorkoutSet) => item.id !== entryId,
            )
            await AsyncStorage.setItem(
              historyKey,
              JSON.stringify(updatedHistory),
            )
          }

          // Delete from today's completions if applicable
          const todayKey = `todaysCompletions-${getLocalDateString()}`
          const savedCompletionsRaw = await AsyncStorage.getItem(todayKey)
          if (savedCompletionsRaw) {
            const allCompletions = JSON.parse(savedCompletionsRaw)
            const updatedCompletions = allCompletions.filter(
              (item: WorkoutSet) => item.id !== entryId,
            )
            await AsyncStorage.setItem(
              todayKey,
              JSON.stringify(updatedCompletions),
            )
          }

          syncTodaysCompletions()
        } catch (e) {
          console.error('Failed to delete guest history entry', e)
        }
      }
    },
    [removeFromOfflineQueue],
  )

  const fetchHistory = useCallback(
    async (user: FirebaseUser | null, lastVisible?: WorkoutSet) => {
      if (user) {
        try {
          const historyCollectionRef = collection(
            db,
            'users',
            user.uid,
            'history',
          )
          // Order by document ID as a tiebreaker so entries sharing the
          // exact same date timestamp aren't skipped across page boundaries.
          const q = query(
            historyCollectionRef,
            orderBy('date', 'desc'),
            orderBy(documentId(), 'desc'),
            limit(20),
            ...(lastVisible
              ? [startAfter(lastVisible.date, lastVisible.id)]
              : []),
          )

          const querySnapshot = await getDocs(q)
          const newHistory = querySnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as WorkoutSet[]

          return newHistory
        } catch (e) {
          console.error('Failed to fetch history', e)
          return []
        }
      } else {
        // Guest user
        try {
          const historyKey = 'guestHistory'
          const savedHistoryRaw = await AsyncStorage.getItem(historyKey)
          if (!savedHistoryRaw) return []

          const allHistory = JSON.parse(savedHistoryRaw)
            .map((item: SerializedWorkoutSetData) => ({
              ...item,
              date: new Timestamp(item.date.seconds, item.date.nanoseconds),
            }))
            .sort(
              (a: WorkoutSet, b: WorkoutSet) =>
                b.date.toMillis() - a.date.toMillis(),
            )

          const startIndex = lastVisible
            ? allHistory.findIndex(
                (item: WorkoutSet) => item.id === lastVisible.id,
              ) + 1
            : 0

          if (startIndex >= allHistory.length) return []

          const newHistory = allHistory.slice(startIndex, startIndex + 20)
          return newHistory
        } catch (e) {
          console.error('Failed to fetch guest history', e)
          return []
        }
      }
    },
    [],
  )

  const fetchTodaysCompletions = useCallback(
    async (user: FirebaseUser | null, exerciseId: string) => {
      if (user) {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const startOfToday = Timestamp.fromDate(today)

        try {
          const historyCollectionRef = collection(
            db,
            'users',
            user.uid,
            'history',
          )
          const q = query(
            historyCollectionRef,
            where('exerciseId', '==', exerciseId),
            where('date', '>=', startOfToday),
          )
          const querySnapshot = await getDocs(q)
          const todaysSets = querySnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as WorkoutSet[]
          const queued = getQueuedTodaysCompletions(
            offlineQueueRef.current,
            exerciseId,
          ).filter((q) => !todaysSets.some((s) => s.id === q.id))
          setTodaysCompletions([...todaysSets, ...queued])
        } catch (e) {
          console.error("Failed to fetch today's completions", e)
          setTodaysCompletions(
            getQueuedTodaysCompletions(offlineQueueRef.current, exerciseId),
          )
        }
      } else {
        // Guest user
        try {
          const todayKey = `todaysCompletions-${getLocalDateString()}`
          const savedCompletionsRaw = await AsyncStorage.getItem(todayKey)
          if (savedCompletionsRaw) {
            const allCompletions = JSON.parse(savedCompletionsRaw).map(
              (item: SerializedWorkoutSetData) => ({
                ...item,
                date: new Timestamp(item.date.seconds, item.date.nanoseconds),
              }),
            )
            const exerciseCompletions = allCompletions.filter(
              (c: WorkoutSet) => c.exerciseId === exerciseId,
            )
            setTodaysCompletions(exerciseCompletions)
          } else {
            setTodaysCompletions([])
          }
        } catch (e) {
          console.error("Failed to fetch guest's today's completions", e)
          setTodaysCompletions([])
        }
      }
    },
    [getQueuedTodaysCompletions],
  )

  const isSetCompleted = useCallback(
    (exerciseId: string, setNumber: number): boolean => {
      return todaysCompletions.some(
        (c) => c.exerciseId === exerciseId && c.set === setNumber,
      )
    },
    [todaysCompletions],
  )

  const arePreviousSetsCompleted = useCallback(
    (exerciseId: string, setNumber: number): boolean => {
      if (setNumber <= 1) {
        return true
      }

      const completedSets = todaysCompletions
        .filter((c) => c.exerciseId === exerciseId)
        .map((c) => c.set)

      for (let i = 1; i < setNumber; i++) {
        if (!completedSets.includes(i)) {
          return false
        }
      }
      return true
    },
    [todaysCompletions],
  )

  const getNextUncompletedSet = useCallback(
    (exerciseId: string): number => {
      const completedSets = todaysCompletions
        .filter((c) => c.exerciseId === exerciseId)
        .map((c) => c.set)
        .sort((a, b) => a - b)

      if (completedSets.length === 0) return 1

      let nextSet = 1
      for (const set of completedSets) {
        if (set === nextSet) {
          nextSet++
        } else {
          break
        }
      }
      return nextSet
    },
    [todaysCompletions],
  )

  const resetSetsFrom = useCallback(
    async (
      exerciseId: string,
      setNumber: number,
      user: FirebaseUser | null,
    ) => {
      if (user) {
        const setsToRemove = todaysCompletions.filter(
          (c) => c.exerciseId === exerciseId && c.set >= setNumber,
        )
        if (setsToRemove.length === 0) return

        // Drop queued copies so a later flush doesn't resurrect reset sets.
        removeFromOfflineQueue(setsToRemove.map((s) => s.id))

        try {
          const batch = writeBatch(db)
          setsToRemove.forEach((s) => {
            const docRef = doc(db, 'users', user.uid, 'history', s.id)
            batch.delete(docRef)
          })
          await batch.commit()

          setTodaysCompletions((prev) =>
            prev.filter((c) => !setsToRemove.some((r) => r.id === c.id)),
          )
          setHistoryVersion((v) => v + 1)
        } catch (e) {
          console.error('Failed to reset sets', e)
        }
      } else {
        // Guest user
        try {
          // Collect the ids of today's matching entries so the full-history
          // filter below only removes today's sets, never entries with the
          // same exercise/set number from previous days.
          const todayKey = `todaysCompletions-${getLocalDateString()}`
          const savedCompletionsRaw = await AsyncStorage.getItem(todayKey)
          const savedCompletions: WorkoutSet[] = savedCompletionsRaw
            ? JSON.parse(savedCompletionsRaw)
            : []
          const removedIds = new Set(
            [...savedCompletions, ...todaysCompletions]
              .filter((c) => c.exerciseId === exerciseId && c.set >= setNumber)
              .map((c) => c.id),
          )
          if (removedIds.size === 0) return

          setTodaysCompletions((prev) =>
            prev.filter((c) => !removedIds.has(c.id)),
          )

          // Update today's completions in AsyncStorage
          if (savedCompletionsRaw) {
            const updatedCompletions = savedCompletions.filter(
              (c) => !removedIds.has(c.id),
            )
            await AsyncStorage.setItem(
              todayKey,
              JSON.stringify(updatedCompletions),
            )
          }

          // Update full history in AsyncStorage
          const historyKey = 'guestHistory'
          const savedHistoryRaw = await AsyncStorage.getItem(historyKey)
          if (savedHistoryRaw) {
            const allHistory = JSON.parse(savedHistoryRaw)
            const updatedHistory = allHistory.filter(
              (c: WorkoutSet) => !removedIds.has(c.id),
            )
            await AsyncStorage.setItem(
              historyKey,
              JSON.stringify(updatedHistory),
            )
          }
          setHistoryVersion((v) => v + 1)
        } catch (e) {
          console.error('Failed to reset guest sets', e)
        }
      }
    },
    [todaysCompletions, removeFromOfflineQueue],
  )

  const migrateGuestHistory = useCallback(
    async (user: FirebaseUser): Promise<WorkoutSet[]> => {
      try {
        const historyKey = 'guestHistory'
        const savedHistoryRaw = await AsyncStorage.getItem(historyKey)
        if (!savedHistoryRaw) return []

        const parsedHistory = JSON.parse(savedHistoryRaw)
        if (!Array.isArray(parsedHistory)) {
          console.warn(
            'Guest history in AsyncStorage is not an array, skipping migration.',
          )
          return []
        }

        const guestHistory: WorkoutSet[] = parsedHistory
          .filter(
            (item) =>
              item && item.date && typeof item.date.seconds === 'number',
          )
          .map((item: SerializedWorkoutSetData) => ({
            ...item,
            date: new Timestamp(item.date.seconds, item.date.nanoseconds),
          }))

        if (guestHistory.length === 0) return []

        const batch = writeBatch(db)
        const historyCollectionRef = collection(
          db,
          'users',
          user.uid,
          'history',
        )
        const migratedEntries: WorkoutSet[] = []

        guestHistory.forEach((entry) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { id, ...dataToUpload } = entry
          const docRef = doc(historyCollectionRef) // Create a new doc with a new ID
          batch.set(docRef, dataToUpload)
          migratedEntries.push({ ...entry, id: docRef.id })
        })

        await batch.commit()
        await AsyncStorage.removeItem(historyKey)
        await AsyncStorage.removeItem(
          `todaysCompletions-${getLocalDateString()}`,
        )

        return migratedEntries
      } catch (e) {
        console.error('Failed to migrate guest history', e)
        return []
      }
    },
    [],
  )

  const migrateGuestWeightLogs = useCallback(
    async (user: FirebaseUser): Promise<WeightLog[]> => {
      try {
        const key = 'guestWeightLogs'
        const savedRaw = await AsyncStorage.getItem(key)
        if (!savedRaw) return []

        const parsed = JSON.parse(savedRaw)
        if (!Array.isArray(parsed)) return []

        const guestLogs: WeightLog[] = parsed
          .filter(
            (item) =>
              item && item.date && typeof item.date.seconds === 'number',
          )
          .map((item: SerializedWeightLog) => ({
            ...item,
            date: new Timestamp(item.date.seconds, item.date.nanoseconds),
          }))

        if (guestLogs.length === 0) return []

        const batch = writeBatch(db)
        const collRef = collection(db, 'users', user.uid, 'weightLogs')
        const migrated: WeightLog[] = []

        guestLogs.forEach((entry) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { id, ...dataToUpload } = entry
          const docRef = doc(collRef) // Create a new doc with a new ID
          batch.set(docRef, dataToUpload)
          migrated.push({ ...entry, id: docRef.id })
        })

        await batch.commit()
        await AsyncStorage.removeItem(key)
        return migrated
      } catch (e) {
        console.error('Failed to migrate guest weight logs', e)
        return []
      }
    },
    [],
  )

  const migrateGuestCalorieLogs = useCallback(
    async (user: FirebaseUser): Promise<CalorieLog[]> => {
      try {
        const key = 'guestCalorieLogs'
        const savedRaw = await AsyncStorage.getItem(key)
        if (!savedRaw) return []

        const parsed = JSON.parse(savedRaw)
        if (!Array.isArray(parsed)) return []

        const guestLogs: CalorieLog[] = parsed
          .filter(
            (item) =>
              item && item.date && typeof item.date.seconds === 'number',
          )
          .map((item: SerializedCalorieLog) => ({
            ...item,
            date: new Timestamp(item.date.seconds, item.date.nanoseconds),
          }))

        if (guestLogs.length === 0) return []

        const batch = writeBatch(db)
        const collRef = collection(db, 'users', user.uid, 'calorieLogs')
        const migrated: CalorieLog[] = []

        guestLogs.forEach((entry) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { id, ...dataToUpload } = entry
          const docRef = doc(collRef) // Create a new doc with a new ID
          batch.set(docRef, dataToUpload)
          migrated.push({ ...entry, id: docRef.id })
        })

        await batch.commit()
        await AsyncStorage.removeItem(key)
        return migrated
      } catch (e) {
        console.error('Failed to migrate guest calorie logs', e)
        return []
      }
    },
    [],
  )

  const migrateGuestJournalEntries = useCallback(
    async (user: FirebaseUser): Promise<JournalEntry[]> => {
      try {
        const key = 'guestJournalEntries'
        const savedRaw = await AsyncStorage.getItem(key)
        if (!savedRaw) return []

        const parsed = JSON.parse(savedRaw)
        if (!Array.isArray(parsed)) return []

        const guestEntries: JournalEntry[] = parsed
          .filter(
            (item) =>
              item && item.date && typeof item.date.seconds === 'number',
          )
          .map((item: SerializedJournalEntry) => ({
            ...item,
            date: new Timestamp(item.date.seconds, item.date.nanoseconds),
          }))

        if (guestEntries.length === 0) return []

        const batch = writeBatch(db)
        const collRef = collection(db, 'users', user.uid, 'journalEntries')
        const migrated: JournalEntry[] = []

        guestEntries.forEach((entry) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { id, ...dataToUpload } = entry
          const docRef = doc(collRef) // Create a new doc with a new ID
          batch.set(docRef, dataToUpload)
          migrated.push({ ...entry, id: docRef.id })
        })

        await batch.commit()
        await AsyncStorage.removeItem(key)
        return migrated
      } catch (e) {
        console.error('Failed to migrate guest journal entries', e)
        return []
      }
    },
    [],
  )

  const migrateGuestTDEEConfig = useCallback(
    async (user: FirebaseUser): Promise<void> => {
      try {
        const saved = await AsyncStorage.getItem(GUEST_TDEE_CONFIG_KEY)
        if (saved) {
          const parsed = JSON.parse(saved) as TDEEConfig
          const docRef = doc(db, 'users', user.uid)
          await setDoc(docRef, { tdeeConfig: parsed }, { merge: true })
          await AsyncStorage.removeItem(GUEST_TDEE_CONFIG_KEY)
        }
      } catch (e) {
        console.error('Failed to migrate guest TDEE config', e)
      }
    },
    [],
  )

  const syncOfflineQueue = useCallback(
    async (user: FirebaseUser) => {
      const entriesToSync = offlineQueue
      const opsToSync = pendingOps
      if (entriesToSync.length === 0 && opsToSync.length === 0) return
      // Two triggers (connectivity effect + login sync) can overlap; a second
      // flush of the same entries would double-write.
      if (offlineSyncInFlightRef.current) return
      offlineSyncInFlightRef.current = true

      console.log(
        `Syncing ${entriesToSync.length} offline entries and ${opsToSync.length} pending ops...`,
      )
      const batch = writeBatch(db)
      const historyCollectionRef = collection(db, 'users', user.uid, 'history')

      // History entries flush at their pre-assigned doc ids, so this stays
      // idempotent with a direct write that is still hanging for the same set.
      entriesToSync.forEach((entry) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, ...dataToUpload } = entry
        batch.set(
          doc(historyCollectionRef, entry.id),
          stripUndefined(reviveTimestamps(dataToUpload)),
        )
      })

      // Coalesce user-doc field ops into a single merge write; batches apply
      // per-doc writes in order but one write is simpler and cheaper.
      const userDocUpdates: Record<string, unknown> = {}
      opsToSync.forEach((op) => {
        if (op.kind === 'set') {
          batch.set(
            doc(db, 'users', user.uid, op.coll, op.id),
            stripUndefined(reviveTimestamps(op.data)),
          )
        } else if (op.kind === 'delete') {
          batch.delete(doc(db, 'users', user.uid, op.coll, op.id))
        } else {
          userDocUpdates[op.field] = op.data === null ? deleteField() : op.data
        }
      })
      if (Object.keys(userDocUpdates).length > 0) {
        batch.set(doc(db, 'users', user.uid), userDocUpdates, { merge: true })
      }

      try {
        await batch.commit()
        // Only drop what was flushed — entries/ops queued mid-commit must
        // survive.
        removeFromOfflineQueue(entriesToSync.map((entry) => entry.id))
        setPendingOps((prev) => {
          const remaining = prev.filter((op) => !opsToSync.includes(op))
          if (remaining.length === prev.length) return prev
          persistPendingOps(remaining)
          return remaining
        })
        console.log('Offline queue synced successfully.')
      } catch (e) {
        console.error('Failed to sync offline queue', e)
      } finally {
        offlineSyncInFlightRef.current = false
      }
    },
    [offlineQueue, pendingOps, removeFromOfflineQueue],
  )

  const syncUserData = useCallback(
    async (
      firebaseUser: FirebaseUser,
      localSettings: Settings,
      localWorkouts: Workout[],
    ) => {
      try {
        // Step 1: Migrate local data to Firestore
        await migrateGuestHistory(firebaseUser)
        await migrateGuestWeightLogs(firebaseUser)
        await migrateGuestCalorieLogs(firebaseUser)
        await migrateGuestJournalEntries(firebaseUser)
        await migrateGuestTDEEConfig(firebaseUser)
        await syncOfflineQueue(firebaseUser)

        const userDocRef = doc(db, 'users', firebaseUser.uid)
        const userDoc = await getDoc(userDocRef)

        // Step 2: Create user document if it doesn't exist
        if (!userDoc.exists()) {
          console.log('New user detected, creating document...')
          await setDoc(userDocRef, {
            email: firebaseUser.email,
            name: firebaseUser.displayName,
            settings: localSettings,
            workouts: localWorkouts,
          })
        }

        // Step 3: Fetch all data from Firestore to ensure local state is a mirror of the server
        console.log('Fetching latest user data from Firestore...')
        const freshUserDoc = await getDoc(userDocRef) // Re-fetch in case it was just created
        if (freshUserDoc.exists()) {
          const userData = freshUserDoc.data()
          // Sync Settings
          if (userData.settings) {
            // Merge with defaults to ensure new settings properties have values for existing users
            const mergedSettings = { ...defaultSettings, ...userData.settings }
            setSettings(mergedSettings)
            await AsyncStorage.setItem(
              'repCounterSettings',
              JSON.stringify(mergedSettings),
            )
          }
          // Sync Workouts
          if (
            userData.workouts &&
            Array.isArray(userData.workouts) &&
            userData.workouts.length > 0
          ) {
            setWorkouts(userData.workouts)
            await AsyncStorage.setItem(
              'workouts',
              JSON.stringify(userData.workouts),
            )
          }
          // Sync TDEE Config
          if (userData.tdeeConfig) {
            setTdeeConfig(userData.tdeeConfig)
            await AsyncStorage.setItem(
              TDEE_CONFIG_CACHE_KEY,
              JSON.stringify(userData.tdeeConfig),
            )
          }
        }

        // Step 4: Fetch a fresh copy of today's completions
        await fetchAllTodaysCompletions(firebaseUser)
      } catch (error) {
        console.error('Error syncing user data:', error)
      }
    },
    [
      migrateGuestHistory,
      migrateGuestWeightLogs,
      migrateGuestCalorieLogs,
      migrateGuestJournalEntries,
      migrateGuestTDEEConfig,
      syncOfflineQueue,
      fetchAllTodaysCompletions,
    ],
  )

  const fetchFullHistory = useCallback(
    async (
      user: FirebaseUser | null,
      daysBack: number = 90,
    ): Promise<WorkoutSet[]> => {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - daysBack)
      cutoffDate.setHours(0, 0, 0, 0)
      const cutoffTimestamp = Timestamp.fromDate(cutoffDate)

      if (user) {
        try {
          const historyCollectionRef = collection(
            db,
            'users',
            user.uid,
            'history',
          )
          const q = query(
            historyCollectionRef,
            where('date', '>=', cutoffTimestamp),
            orderBy('date', 'desc'),
          )
          const querySnapshot = await getDocs(q)
          return querySnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as WorkoutSet[]
        } catch (e) {
          console.error('Failed to fetch full history', e)
          return []
        }
      } else {
        // Guest user
        try {
          const historyKey = 'guestHistory'
          const savedHistoryRaw = await AsyncStorage.getItem(historyKey)
          if (!savedHistoryRaw) return []

          const allHistory = JSON.parse(savedHistoryRaw)
            .map((item: SerializedWorkoutSetData) => ({
              ...item,
              date: new Timestamp(item.date.seconds, item.date.nanoseconds),
            }))
            .filter((item: WorkoutSet) => item.date.toDate() >= cutoffDate)
            .sort(
              (a: WorkoutSet, b: WorkoutSet) =>
                b.date.toMillis() - a.date.toMillis(),
            )

          return allHistory
        } catch (e) {
          console.error('Failed to fetch guest full history', e)
          return []
        }
      }
    },
    [],
  )

  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([])
  const [calorieLogs, setCalorieLogs] = useState<CalorieLog[]>([])
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([])

  const fetchWeightLogs = useCallback(
    async (user: FirebaseUser | null): Promise<WeightLog[]> => {
      if (user) {
        try {
          const collRef = collection(db, 'users', user.uid, 'weightLogs')
          const q = query(collRef, orderBy('date', 'desc'))
          const querySnapshot = await getDocs(q)
          const logs = querySnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as WeightLog[]
          setWeightLogs(logs)
          return logs
        } catch (e) {
          console.error('Failed to fetch weight logs', e)
          return []
        }
      } else {
        // Guest user
        try {
          const key = 'guestWeightLogs'
          const savedRaw = await AsyncStorage.getItem(key)
          if (!savedRaw) {
            setWeightLogs([])
            return []
          }

          const parsed = JSON.parse(savedRaw)
          const guestLogs = parsed
            .map((item: SerializedWeightLog) => ({
              ...item,
              date: new Timestamp(item.date.seconds, item.date.nanoseconds),
            }))
            .sort(
              (a: WeightLog, b: WeightLog) =>
                b.date.toMillis() - a.date.toMillis(),
            )

          setWeightLogs(guestLogs)
          return guestLogs
        } catch (e) {
          console.error('Failed to fetch guest weight logs', e)
          return []
        }
      }
    },
    [],
  )

  const addWeightLog = useCallback(
    async (weight: number, date: Date, user: FirebaseUser | null) => {
      const newLogBase = {
        weight,
        date: Timestamp.fromDate(date),
      }

      if (user) {
        const docRef = doc(collection(db, 'users', user.uid, 'weightLogs'))
        const newEntry = {
          id: docRef.id,
          ...newLogBase,
        }
        setWeightLogs((prev) =>
          [newEntry, ...prev].sort(
            (a, b) => b.date.toMillis() - a.date.toMillis(),
          ),
        )
        syncLogDoc(user, {
          kind: 'set',
          coll: 'weightLogs',
          id: docRef.id,
          data: newLogBase,
        })
      } else {
        // Guest user
        try {
          const key = 'guestWeightLogs'
          const savedRaw = await AsyncStorage.getItem(key)
          const guestLogs = savedRaw ? JSON.parse(savedRaw) : []
          const newEntry = {
            id: randomUUID(),
            ...newLogBase,
          }
          const updatedLogs = [newEntry, ...guestLogs]
          await AsyncStorage.setItem(key, JSON.stringify(updatedLogs))

          // Reconstruct Timestamp for local state
          const stateLogs = updatedLogs
            .map((item: SerializedWeightLog) => ({
              ...item,
              date: new Timestamp(item.date.seconds, item.date.nanoseconds),
            }))
            .sort(
              (a: WeightLog, b: WeightLog) =>
                b.date.toMillis() - a.date.toMillis(),
            )

          setWeightLogs(stateLogs)
        } catch (e) {
          console.error('Failed to add guest weight log', e)
        }
      }
    },
    [syncLogDoc],
  )

  const updateWeightLog = useCallback(
    async (
      id: string,
      weight: number,
      date: Date,
      user: FirebaseUser | null,
    ) => {
      const updates = {
        weight,
        date: Timestamp.fromDate(date),
      }

      if (user) {
        setWeightLogs((prev) =>
          prev
            .map((item) => (item.id === id ? { ...item, ...updates } : item))
            .sort((a, b) => b.date.toMillis() - a.date.toMillis()),
        )
        syncLogDoc(user, {
          kind: 'set',
          coll: 'weightLogs',
          id,
          data: updates,
        })
      } else {
        // Guest user
        try {
          const key = 'guestWeightLogs'
          const savedRaw = await AsyncStorage.getItem(key)
          if (savedRaw) {
            const guestLogs = JSON.parse(savedRaw)
            const updatedLogs = guestLogs.map((item: SerializedWeightLog) =>
              item.id === id ? { ...item, ...updates } : item,
            )
            await AsyncStorage.setItem(key, JSON.stringify(updatedLogs))

            const stateLogs = updatedLogs
              .map((item: SerializedWeightLog) => ({
                ...item,
                date: new Timestamp(item.date.seconds, item.date.nanoseconds),
              }))
              .sort(
                (a: WeightLog, b: WeightLog) =>
                  b.date.toMillis() - a.date.toMillis(),
              )

            setWeightLogs(stateLogs)
          }
        } catch (e) {
          console.error('Failed to update guest weight log', e)
        }
      }
    },
    [syncLogDoc],
  )

  const deleteWeightLog = useCallback(
    async (id: string, user: FirebaseUser | null) => {
      if (user) {
        setWeightLogs((prev) => prev.filter((item) => item.id !== id))
        syncLogDoc(user, { kind: 'delete', coll: 'weightLogs', id })
      } else {
        // Guest user
        try {
          const key = 'guestWeightLogs'
          const savedRaw = await AsyncStorage.getItem(key)
          if (savedRaw) {
            const guestLogs = JSON.parse(savedRaw)
            const updatedLogs = guestLogs.filter(
              (item: SerializedWeightLog) => item.id !== id,
            )
            await AsyncStorage.setItem(key, JSON.stringify(updatedLogs))

            const stateLogs = updatedLogs
              .map((item: SerializedWeightLog) => ({
                ...item,
                date: new Timestamp(item.date.seconds, item.date.nanoseconds),
              }))
              .sort(
                (a: WeightLog, b: WeightLog) =>
                  b.date.toMillis() - a.date.toMillis(),
              )

            setWeightLogs(stateLogs)
          }
        } catch (e) {
          console.error('Failed to delete guest weight log', e)
        }
      }
    },
    [syncLogDoc],
  )

  const fetchCalorieLogs = useCallback(
    async (user: FirebaseUser | null): Promise<CalorieLog[]> => {
      if (user) {
        try {
          const collRef = collection(db, 'users', user.uid, 'calorieLogs')
          const q = query(collRef, orderBy('date', 'desc'))
          const querySnapshot = await getDocs(q)
          const logs = querySnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as CalorieLog[]
          setCalorieLogs(logs)
          return logs
        } catch (e) {
          console.error('Failed to fetch calorie logs', e)
          return []
        }
      } else {
        // Guest user
        try {
          const key = 'guestCalorieLogs'
          const savedRaw = await AsyncStorage.getItem(key)
          if (!savedRaw) {
            setCalorieLogs([])
            return []
          }

          const parsed = JSON.parse(savedRaw)
          const guestLogs = parsed
            .map((item: SerializedCalorieLog) => ({
              ...item,
              date: new Timestamp(item.date.seconds, item.date.nanoseconds),
            }))
            .sort(
              (a: CalorieLog, b: CalorieLog) =>
                b.date.toMillis() - a.date.toMillis(),
            )

          setCalorieLogs(guestLogs)
          return guestLogs
        } catch (e) {
          console.error('Failed to fetch guest calorie logs', e)
          return []
        }
      }
    },
    [],
  )

  const addCalorieLog = useCallback(
    async (calories: number, date: Date, user: FirebaseUser | null) => {
      const newLogBase = {
        calories,
        date: Timestamp.fromDate(date),
      }

      if (user) {
        const docRef = doc(collection(db, 'users', user.uid, 'calorieLogs'))
        const newEntry = {
          id: docRef.id,
          ...newLogBase,
        }
        setCalorieLogs((prev) =>
          [newEntry, ...prev].sort(
            (a, b) => b.date.toMillis() - a.date.toMillis(),
          ),
        )
        syncLogDoc(user, {
          kind: 'set',
          coll: 'calorieLogs',
          id: docRef.id,
          data: newLogBase,
        })
      } else {
        // Guest user
        try {
          const key = 'guestCalorieLogs'
          const savedRaw = await AsyncStorage.getItem(key)
          const guestLogs = savedRaw ? JSON.parse(savedRaw) : []
          const newEntry = {
            id: randomUUID(),
            ...newLogBase,
          }
          const updatedLogs = [newEntry, ...guestLogs]
          await AsyncStorage.setItem(key, JSON.stringify(updatedLogs))

          // Reconstruct Timestamp for local state
          const stateLogs = updatedLogs
            .map((item: SerializedCalorieLog) => ({
              ...item,
              date: new Timestamp(item.date.seconds, item.date.nanoseconds),
            }))
            .sort(
              (a: CalorieLog, b: CalorieLog) =>
                b.date.toMillis() - a.date.toMillis(),
            )

          setCalorieLogs(stateLogs)
        } catch (e) {
          console.error('Failed to add guest calorie log', e)
        }
      }
    },
    [syncLogDoc],
  )

  const updateCalorieLog = useCallback(
    async (
      id: string,
      calories: number,
      date: Date,
      user: FirebaseUser | null,
    ) => {
      const updates = {
        calories,
        date: Timestamp.fromDate(date),
      }

      if (user) {
        setCalorieLogs((prev) =>
          prev
            .map((item) => (item.id === id ? { ...item, ...updates } : item))
            .sort((a, b) => b.date.toMillis() - a.date.toMillis()),
        )
        syncLogDoc(user, {
          kind: 'set',
          coll: 'calorieLogs',
          id,
          data: updates,
        })
      } else {
        // Guest user
        try {
          const key = 'guestCalorieLogs'
          const savedRaw = await AsyncStorage.getItem(key)
          if (savedRaw) {
            const guestLogs = JSON.parse(savedRaw)
            const updatedLogs = guestLogs.map((item: SerializedCalorieLog) =>
              item.id === id ? { ...item, ...updates } : item,
            )
            await AsyncStorage.setItem(key, JSON.stringify(updatedLogs))

            const stateLogs = updatedLogs
              .map((item: SerializedCalorieLog) => ({
                ...item,
                date: new Timestamp(item.date.seconds, item.date.nanoseconds),
              }))
              .sort(
                (a: CalorieLog, b: CalorieLog) =>
                  b.date.toMillis() - a.date.toMillis(),
              )

            setCalorieLogs(stateLogs)
          }
        } catch (e) {
          console.error('Failed to update guest calorie log', e)
        }
      }
    },
    [syncLogDoc],
  )

  const deleteCalorieLog = useCallback(
    async (id: string, user: FirebaseUser | null) => {
      if (user) {
        setCalorieLogs((prev) => prev.filter((item) => item.id !== id))
        syncLogDoc(user, { kind: 'delete', coll: 'calorieLogs', id })
      } else {
        // Guest user
        try {
          const key = 'guestCalorieLogs'
          const savedRaw = await AsyncStorage.getItem(key)
          if (savedRaw) {
            const guestLogs = JSON.parse(savedRaw)
            const updatedLogs = guestLogs.filter(
              (item: SerializedCalorieLog) => item.id !== id,
            )
            await AsyncStorage.setItem(key, JSON.stringify(updatedLogs))

            const stateLogs = updatedLogs
              .map((item: SerializedCalorieLog) => ({
                ...item,
                date: new Timestamp(item.date.seconds, item.date.nanoseconds),
              }))
              .sort(
                (a: CalorieLog, b: CalorieLog) =>
                  b.date.toMillis() - a.date.toMillis(),
              )

            setCalorieLogs(stateLogs)
          }
        } catch (e) {
          console.error('Failed to delete guest calorie log', e)
        }
      }
    },
    [syncLogDoc],
  )

  // TDEE Config persistence
  const [tdeeConfig, setTdeeConfig] = useState<TDEEConfig | null>(null)

  const loadTDEEConfig = useCallback(
    async (user?: FirebaseUser | null): Promise<TDEEConfig | null> => {
      try {
        if (user) {
          // Always fetch from Firestore for signed-in users to ensure
          // cross-device changes are picked up.
          try {
            const userDocRef = doc(db, 'users', user.uid)
            const userDoc = await getDoc(userDocRef)
            if (userDoc.exists()) {
              const userData = userDoc.data()
              if (userData && userData.tdeeConfig) {
                setTdeeConfig(userData.tdeeConfig)
                await AsyncStorage.setItem(
                  TDEE_CONFIG_CACHE_KEY,
                  JSON.stringify(userData.tdeeConfig),
                )
                return userData.tdeeConfig
              }
            }
          } catch (networkError) {
            // Firestore fetch failed (likely offline) — fall back to cache
            console.warn(
              'Failed to fetch TDEE config from Firestore, using cache',
              networkError,
            )
            const saved = await AsyncStorage.getItem(TDEE_CONFIG_CACHE_KEY)
            if (saved) {
              const parsed = JSON.parse(saved) as TDEEConfig
              setTdeeConfig(parsed)
              return parsed
            }
          }
        } else {
          let saved = await AsyncStorage.getItem(GUEST_TDEE_CONFIG_KEY)
          if (!saved) {
            // One-time move of guest configs saved before the guest key was
            // split from the signed-in cache.
            saved = await AsyncStorage.getItem(TDEE_CONFIG_CACHE_KEY)
            if (saved) {
              await AsyncStorage.setItem(GUEST_TDEE_CONFIG_KEY, saved)
              await AsyncStorage.removeItem(TDEE_CONFIG_CACHE_KEY)
            }
          }
          if (saved) {
            const parsed = JSON.parse(saved) as TDEEConfig
            setTdeeConfig(parsed)
            return parsed
          }
        }
        return null
      } catch (e) {
        console.error('Failed to load TDEE config', e)
        return null
      }
    },
    [],
  )

  const saveTDEEConfig = useCallback(
    async (config: TDEEConfig, user: FirebaseUser | null): Promise<void> => {
      try {
        setTdeeConfig(config)
        await AsyncStorage.setItem(
          user ? TDEE_CONFIG_CACHE_KEY : GUEST_TDEE_CONFIG_KEY,
          JSON.stringify(config),
        )

        if (user) {
          syncUserDocField(user, 'tdeeConfig', config)
        }
      } catch (e) {
        console.error('Failed to save TDEE config', e)
      }
    },
    [syncUserDocField],
  )

  const deleteTDEEConfig = useCallback(
    async (user: FirebaseUser | null): Promise<void> => {
      try {
        setTdeeConfig(null)
        await AsyncStorage.removeItem(
          user ? TDEE_CONFIG_CACHE_KEY : GUEST_TDEE_CONFIG_KEY,
        )
        if (user) {
          syncUserDocField(user, 'tdeeConfig', null)
        }
      } catch (e) {
        console.error('Failed to delete TDEE config', e)
      }
    },
    [syncUserDocField],
  )

  const fetchJournalEntries = useCallback(
    async (user: FirebaseUser | null): Promise<JournalEntry[]> => {
      if (user) {
        try {
          const collRef = collection(db, 'users', user.uid, 'journalEntries')
          const q = query(collRef, orderBy('date', 'desc'))
          const querySnapshot = await getDocs(q)
          const entries = querySnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as JournalEntry[]
          setJournalEntries(entries)
          return entries
        } catch (e) {
          console.error('Failed to fetch journal entries', e)
          return []
        }
      } else {
        // Guest user
        try {
          const key = 'guestJournalEntries'
          const savedRaw = await AsyncStorage.getItem(key)
          if (!savedRaw) {
            setJournalEntries([])
            return []
          }

          const parsed = JSON.parse(savedRaw)
          const guestEntries = parsed
            .map((item: SerializedJournalEntry) => ({
              ...item,
              date: new Timestamp(item.date.seconds, item.date.nanoseconds),
            }))
            .sort(
              (a: JournalEntry, b: JournalEntry) =>
                b.date.toMillis() - a.date.toMillis(),
            )

          setJournalEntries(guestEntries)
          return guestEntries
        } catch (e) {
          console.error('Failed to fetch guest journal entries', e)
          return []
        }
      }
    },
    [],
  )

  const addJournalEntry = useCallback(
    async (
      note: string,
      date: Date,
      user: FirebaseUser | null,
      supplements?: SupplementLog[],
    ) => {
      const newEntryBase = {
        note,
        date: Timestamp.fromDate(date),
        supplements: supplements || [],
      }

      if (user) {
        const docRef = doc(collection(db, 'users', user.uid, 'journalEntries'))
        const newEntry = {
          id: docRef.id,
          ...newEntryBase,
        }
        setJournalEntries((prev) =>
          [newEntry, ...prev].sort(
            (a, b) => b.date.toMillis() - a.date.toMillis(),
          ),
        )
        syncLogDoc(user, {
          kind: 'set',
          coll: 'journalEntries',
          id: docRef.id,
          data: newEntryBase,
        })
      } else {
        // Guest user
        try {
          const key = 'guestJournalEntries'
          const savedRaw = await AsyncStorage.getItem(key)
          const guestEntries = savedRaw ? JSON.parse(savedRaw) : []
          const newEntry = {
            id: randomUUID(),
            ...newEntryBase,
          }
          const updatedEntries = [newEntry, ...guestEntries]
          await AsyncStorage.setItem(key, JSON.stringify(updatedEntries))

          // Reconstruct Timestamp for local state
          const stateEntries = updatedEntries
            .map((item: SerializedJournalEntry) => ({
              ...item,
              date: new Timestamp(item.date.seconds, item.date.nanoseconds),
            }))
            .sort(
              (a: JournalEntry, b: JournalEntry) =>
                b.date.toMillis() - a.date.toMillis(),
            )

          setJournalEntries(stateEntries)
        } catch (e) {
          console.error('Failed to add guest journal entry', e)
        }
      }
    },
    [syncLogDoc],
  )

  const updateJournalEntry = useCallback(
    async (
      id: string,
      note: string,
      date: Date,
      user: FirebaseUser | null,
      supplements?: SupplementLog[],
    ) => {
      const updates = {
        note,
        date: Timestamp.fromDate(date),
        supplements: supplements || [],
      }

      if (user) {
        setJournalEntries((prev) =>
          prev
            .map((item) => (item.id === id ? { ...item, ...updates } : item))
            .sort((a, b) => b.date.toMillis() - a.date.toMillis()),
        )
        syncLogDoc(user, {
          kind: 'set',
          coll: 'journalEntries',
          id,
          data: updates,
        })
      } else {
        // Guest user
        try {
          const key = 'guestJournalEntries'
          const savedRaw = await AsyncStorage.getItem(key)
          if (savedRaw) {
            const guestEntries = JSON.parse(savedRaw)
            const updatedEntries = guestEntries.map(
              (item: SerializedJournalEntry) =>
                item.id === id ? { ...item, ...updates } : item,
            )
            await AsyncStorage.setItem(key, JSON.stringify(updatedEntries))

            const stateEntries = updatedEntries
              .map((item: SerializedJournalEntry) => ({
                ...item,
                date: new Timestamp(item.date.seconds, item.date.nanoseconds),
              }))
              .sort(
                (a: JournalEntry, b: JournalEntry) =>
                  b.date.toMillis() - a.date.toMillis(),
              )

            setJournalEntries(stateEntries)
          }
        } catch (e) {
          console.error('Failed to update guest journal entry', e)
        }
      }
    },
    [syncLogDoc],
  )

  const deleteJournalEntry = useCallback(
    async (id: string, user: FirebaseUser | null) => {
      if (user) {
        setJournalEntries((prev) => prev.filter((item) => item.id !== id))
        syncLogDoc(user, { kind: 'delete', coll: 'journalEntries', id })
      } else {
        // Guest user
        try {
          const key = 'guestJournalEntries'
          const savedRaw = await AsyncStorage.getItem(key)
          if (savedRaw) {
            const guestEntries = JSON.parse(savedRaw)
            const updatedEntries = guestEntries.filter(
              (item: SerializedJournalEntry) => item.id !== id,
            )
            await AsyncStorage.setItem(key, JSON.stringify(updatedEntries))

            const stateEntries = updatedEntries
              .map((item: SerializedJournalEntry) => ({
                ...item,
                date: new Timestamp(item.date.seconds, item.date.nanoseconds),
              }))
              .sort(
                (a: JournalEntry, b: JournalEntry) =>
                  b.date.toMillis() - a.date.toMillis(),
              )

            setJournalEntries(stateEntries)
          }
        } catch (e) {
          console.error('Failed to delete guest journal entry', e)
        }
      }
    },
    [syncLogDoc],
  )

  const saveActiveSession = useCallback(
    async (workoutId: string, exerciseIndex: number) => {
      try {
        await AsyncStorage.setItem(
          ACTIVE_SESSION_KEY,
          JSON.stringify({ workoutId, exerciseIndex }),
        )
      } catch (e) {
        console.error('Failed to save active session', e)
      }
    },
    [],
  )

  const loadActiveSession = useCallback(async (): Promise<{
    workoutId: string
    exerciseIndex: number
  } | null> => {
    try {
      const raw = await AsyncStorage.getItem(ACTIVE_SESSION_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (
          parsed &&
          typeof parsed.workoutId === 'string' &&
          typeof parsed.exerciseIndex === 'number'
        ) {
          return parsed
        }
      }
    } catch (e) {
      console.error('Failed to load active session', e)
    }
    return null
  }, [])

  const clearActiveSession = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(ACTIVE_SESSION_KEY)
    } catch (e) {
      console.error('Failed to clear active session', e)
    }
  }, [])

  // Sign-out cleanup: drop caches and queues that belong to the signed-in
  // account so they can't seed the next account (or guest session) on a
  // shared device. Guest data ('guest*' keys, workoutHistory,
  // todaysCompletions-*) is device-local and survives.
  const clearUserScopedCache = useCallback(async () => {
    setSettings(defaultSettings)
    setWorkouts(getDefaultWorkouts())
    setOfflineQueue([])
    setPendingOps([])
    setTdeeConfig(null)
    setTodaysCompletions([])
    try {
      await AsyncStorage.multiRemove([
        'repCounterSettings',
        'workouts',
        TDEE_CONFIG_CACHE_KEY,
        OFFLINE_QUEUE_KEY,
        PENDING_OPS_KEY,
        ACTIVE_SESSION_KEY,
      ])
    } catch (e) {
      console.error('Failed to clear user-scoped cache', e)
    }
  }, [])

  return useMemo(
    () => ({
      settings,
      workouts,
      todaysCompletions,
      historyVersion,
      offlineQueue,
      weightLogs,
      calorieLogs,
      journalEntries,
      loadSettings,
      saveSettings,
      loadWorkouts,
      saveWorkouts,
      addHistoryEntry,
      updateHistoryEntry,
      deleteHistoryEntry,
      fetchHistory,
      fetchTodaysCompletions,
      fetchAllTodaysCompletions,
      isSetCompleted,
      getNextUncompletedSet,
      resetSetsFrom,
      arePreviousSetsCompleted,
      syncUserData,
      migrateGuestHistory,
      migrateGuestWeightLogs,
      syncOfflineQueue,
      fetchFullHistory,
      fetchWeightLogs,
      addWeightLog,
      updateWeightLog,
      deleteWeightLog,
      fetchCalorieLogs,
      addCalorieLog,
      updateCalorieLog,
      deleteCalorieLog,
      migrateGuestCalorieLogs,
      tdeeConfig,
      loadTDEEConfig,
      saveTDEEConfig,
      deleteTDEEConfig,
      migrateGuestJournalEntries,
      fetchJournalEntries,
      addJournalEntry,
      updateJournalEntry,
      deleteJournalEntry,
      setWorkouts,
      setSettings,
      setOfflineQueue,
      saveActiveSession,
      loadActiveSession,
      clearActiveSession,
      clearUserScopedCache,
    }),
    [
      settings,
      workouts,
      todaysCompletions,
      historyVersion,
      offlineQueue,
      weightLogs,
      calorieLogs,
      journalEntries,
      loadSettings,
      saveSettings,
      loadWorkouts,
      saveWorkouts,
      addHistoryEntry,
      updateHistoryEntry,
      deleteHistoryEntry,
      fetchHistory,
      fetchTodaysCompletions,
      fetchAllTodaysCompletions,
      isSetCompleted,
      getNextUncompletedSet,
      resetSetsFrom,
      arePreviousSetsCompleted,
      syncUserData,
      migrateGuestHistory,
      migrateGuestWeightLogs,
      syncOfflineQueue,
      fetchFullHistory,
      fetchWeightLogs,
      addWeightLog,
      updateWeightLog,
      deleteWeightLog,
      fetchCalorieLogs,
      addCalorieLog,
      updateCalorieLog,
      deleteCalorieLog,
      migrateGuestCalorieLogs,
      tdeeConfig,
      loadTDEEConfig,
      saveTDEEConfig,
      deleteTDEEConfig,
      migrateGuestJournalEntries,
      fetchJournalEntries,
      addJournalEntry,
      updateJournalEntry,
      deleteJournalEntry,
      setWorkouts,
      setSettings,
      setOfflineQueue,
      saveActiveSession,
      loadActiveSession,
      clearActiveSession,
      clearUserScopedCache,
    ],
  )
}
