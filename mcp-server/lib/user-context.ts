import { getFirebaseAdmin } from './firebase-admin';

export interface UserContext {
  weightUnit: 'kg' | 'lb';
  energyUnit: 'cal' | 'kj';
  measurementUnit: 'inch' | 'cm';
}

export async function getUserContext(uid: string): Promise<UserContext> {
  const { db } = getFirebaseAdmin();
  const userDoc = await db.doc(`users/${uid}`).get();
  const data = userDoc.data() || {};

  const tdeeConfig = data.tdeeConfig || {};

  return {
    weightUnit: tdeeConfig.weightUnit || 'kg',
    energyUnit: tdeeConfig.energyUnit || 'cal',
    measurementUnit: tdeeConfig.measurementUnit || 'cm',
  };
}
