import { getFirebaseClient } from './firebase-client'
import { doc, getDoc } from 'firebase/firestore'

export interface UserContext {
  weightUnit: 'kg' | 'lb'
  energyUnit: 'cal' | 'kj'
  measurementUnit: 'inch' | 'cm'
}

export async function getUserContext(uid: string): Promise<UserContext> {
  const { db } = getFirebaseClient()
  const userDoc = await getDoc(doc(db, `users/${uid}`))
  const data = userDoc.data() || {}

  const tdeeConfig = data.tdeeConfig || {}

  return {
    weightUnit: tdeeConfig.weightUnit || 'kg',
    energyUnit: tdeeConfig.energyUnit || 'cal',
    measurementUnit: tdeeConfig.measurementUnit || 'cm',
  }
}
