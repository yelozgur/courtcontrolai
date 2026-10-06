import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const firebaseUid = session.user.firebaseUid;
    if (!firebaseUid) {
      return NextResponse.json(
        { error: 'Firebase UID not found in session' },
        { status: 400 }
      );
    }

    const adminAuth = getFirebaseAdmin();
    const customToken = await adminAuth.createCustomToken(firebaseUid);

    return NextResponse.json({ token: customToken });
  } catch (error) {
    console.error('Firebase bridge token generation failed:', error);
    return NextResponse.json(
      { error: 'Failed to generate Firebase token' },
      { status: 500 }
    );
  }
}
