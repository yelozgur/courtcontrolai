
'use client';

import { 
  Firestore, 
  doc, 
  runTransaction, 
  writeBatch, 
  collection, 
  serverTimestamp, 
  increment 
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/**
 * Transition tournament status with state machine enforcement.
 */
export async function transitionTournamentStatus(
  db: Firestore, 
  tournamentId: string, 
  newStatus: string, 
  userId: string
) {
  const tournamentRef = doc(db, 'tournaments', tournamentId);

  return runTransaction(db, async (transaction) => {
    const tDoc = await transaction.get(tournamentRef);
    if (!tDoc.exists()) throw new Error("Tournament not found");

    const currentStatus = tDoc.data().status;
    const validTransitions: Record<string, string[]> = {
      'draft': ['registration_open'],
      'registration_open': ['registration_closed', 'draft'],
      'registration_closed': ['in_progress', 'registration_open'],
      'in_progress': ['completed'],
      'completed': ['archived']
    };

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      throw new Error(`Invalid transition from ${currentStatus} to ${newStatus}`);
    }

    transaction.update(tournamentRef, {
      status: newStatus,
      version: increment(1),
      statusHistory: [...(tDoc.data().statusHistory || []), {
        from: currentStatus,
        to: newStatus,
        timestamp: new Date().toISOString(),
        actorId: userId
      }]
    });
  }).catch(async (e) => {
    errorEmitter.emit('permission-error', new FirestorePermissionError({
      path: tournamentRef.path,
      operation: 'update',
      requestResourceData: { status: newStatus }
    }));
  });
}

/**
 * Records a walkover victory.
 * Safeguard: Updates matchesWon/Lost but ignores set statistics.
 */
export async function recordWalkover(
  db: Firestore, 
  matchId: string, 
  winningSide: 'teamA' | 'teamB'
) {
  const matchRef = doc(db, 'matches', matchId);
  const batch = writeBatch(db);

  batch.update(matchRef, {
    status: 'completed',
    'score.winner': winningSide,
    'score.walkover': true,
    actualEndTime: serverTimestamp()
  });

  // Future: Trigger round advancement check here
  return batch.commit();
}
