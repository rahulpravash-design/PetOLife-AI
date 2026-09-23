import { NextResponse } from 'next/server';

import { db, dbDriver } from '@/lib/db';

export async function GET() {
  try {
    await db.get('SELECT 1 AS ok');
    return NextResponse.json({
      status: 'ok',
      service: 'petolife-backend',
      database: { driver: dbDriver, connected: true },
    });
  } catch (err) {
    console.error('Health check: database query failed', err);
    return NextResponse.json(
      {
        status: 'error',
        service: 'petolife-backend',
        database: { driver: dbDriver, connected: false },
      },
      { status: 503 },
    );
  }
}
