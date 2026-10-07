import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const clubs = await prisma.club.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        logoUrl: true,
        createdAt: true,
      },
    });
    return NextResponse.json(clubs, { status: 200 });
  } catch (error) {
    console.error('GET /api/clubs error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch clubs' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, slug, description, logoUrl } = body;

    if (!name || !slug) {
      return NextResponse.json(
        { error: 'Missing required fields: name, slug' },
        { status: 400 }
      );
    }

    const existingClub = await prisma.club.findUnique({ where: { slug } });
    if (existingClub) {
      return NextResponse.json(
        { error: 'Club with this slug already exists' },
        { status: 409 }
      );
    }

    const club = await prisma.club.create({
      data: {
        name,
        slug,
        ownerId: session.user.firebaseUid || session.user.id,
        adminIds: [session.user.firebaseUid || session.user.id],
        description,
        logoUrl,
      },
    });

    return NextResponse.json(club, { status: 201 });
  } catch (error) {
    console.error('POST /api/clubs error:', error);
    return NextResponse.json(
      { error: 'Failed to create club' },
      { status: 500 }
    );
  }
}
