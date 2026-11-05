import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';

function getDatabaseUrl(): string {
  const rootDir = process.cwd();
  const prismaDir = path.join(rootDir, 'prisma');
  if (!fs.existsSync(prismaDir)) {
    try {
      fs.mkdirSync(prismaDir, { recursive: true });
    } catch {}
  }

  const envUrl = process.env.DATABASE_URL;
  if (envUrl && envUrl.startsWith('file:')) {
    const filePath = envUrl.replace(/^file:/, '');
    if (path.isAbsolute(filePath)) {
      return `file:${filePath}`;
    }
    if (filePath.includes('prisma')) {
      const clean = filePath.replace(/^\.\//, '');
      return `file:${path.resolve(rootDir, clean)}`;
    }
    const filename = path.basename(filePath);
    return `file:${path.resolve(rootDir, 'prisma', filename)}`;
  }

  const dbPath = path.join(rootDir, 'prisma', 'padel.db');
  return `file:${dbPath}`;
}

export async function ensureDbSchemaMigrated(client: PrismaClient) {
  if (typeof window !== 'undefined') return;
  try {
    // 1. User table migrations
    const userColumns: any = await client.$queryRawUnsafe(`PRAGMA table_info("User");`);
    const colNames = Array.isArray(userColumns) ? userColumns.map((c: any) => c.name) : [];
    
    if (colNames.length > 0) {
      if (!colNames.includes('highestElo')) {
        await client.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN "highestElo" REAL DEFAULT 1500.0;`);
      }
      if (!colNames.includes('lowestElo')) {
        await client.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN "lowestElo" REAL DEFAULT 1500.0;`);
      }
    }

    // 2. TournamentParticipant table migrations
    const participantCols: any = await client.$queryRawUnsafe(`PRAGMA table_info("TournamentParticipant");`);
    const partColNames = Array.isArray(participantCols) ? participantCols.map((c: any) => c.name) : [];
    if (partColNames.length > 0) {
      if (!partColNames.includes('tournamentElo')) {
        await client.$executeRawUnsafe(`ALTER TABLE "TournamentParticipant" ADD COLUMN "tournamentElo" REAL DEFAULT 1500.0;`);
      }
      if (!partColNames.includes('initialElo')) {
        await client.$executeRawUnsafe(`ALTER TABLE "TournamentParticipant" ADD COLUMN "initialElo" REAL DEFAULT 1500.0;`);
      }
      if (!partColNames.includes('eloDelta')) {
        await client.$executeRawUnsafe(`ALTER TABLE "TournamentParticipant" ADD COLUMN "eloDelta" REAL DEFAULT 0.0;`);
      }
    }

    // 3. LeagueMember table migrations
    const lmCols: any = await client.$queryRawUnsafe(`PRAGMA table_info("LeagueMember");`);
    const lmColNames = Array.isArray(lmCols) ? lmCols.map((c: any) => c.name) : [];
    if (lmColNames.length > 0) {
      if (!lmColNames.includes('highestElo')) {
        await client.$executeRawUnsafe(`ALTER TABLE "LeagueMember" ADD COLUMN "highestElo" REAL DEFAULT 1500.0;`);
      }
      if (!lmColNames.includes('lowestElo')) {
        await client.$executeRawUnsafe(`ALTER TABLE "LeagueMember" ADD COLUMN "lowestElo" REAL DEFAULT 1500.0;`);
      }
    }

    // 4. Match table migrations
    const matchCols: any = await client.$queryRawUnsafe(`PRAGMA table_info("Match");`);
    const matchColNames = Array.isArray(matchCols) ? matchCols.map((c: any) => c.name) : [];
    if (matchColNames.length > 0) {
      if (!matchColNames.includes('teamAEloBefore')) {
        await client.$executeRawUnsafe(`ALTER TABLE "Match" ADD COLUMN "teamAEloBefore" REAL;`);
      }
      if (!matchColNames.includes('teamBEloBefore')) {
        await client.$executeRawUnsafe(`ALTER TABLE "Match" ADD COLUMN "teamBEloBefore" REAL;`);
      }
      if (!matchColNames.includes('eloDelta')) {
        await client.$executeRawUnsafe(`ALTER TABLE "Match" ADD COLUMN "eloDelta" REAL;`);
      }
    }
  } catch (err) {
    console.warn('Auto-migration check notice:', err);
  }
}

const prismaClientSingleton = () => {
  const dbUrl = getDatabaseUrl();
  const client = new PrismaClient({
    datasources: {
      db: {
        url: dbUrl,
      },
    },
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

  // Tilkoblingsinnstillinger: Konfigurer SQLite med WAL-modus og busy_timeout=5000
  // Merk: PRAGMA-spørringer i SQLite returnerer rader og må kalles med $queryRawUnsafe (ikke $executeRawUnsafe)
  if (typeof window === 'undefined') {
    Promise.all([
      client.$queryRawUnsafe(`PRAGMA journal_mode = WAL;`),
      client.$queryRawUnsafe(`PRAGMA busy_timeout = 5000;`),
      client.$queryRawUnsafe(`PRAGMA synchronous = NORMAL;`),
    ])
      .then(() => ensureDbSchemaMigrated(client))
      .catch(() => {});
  }

  return client;
};

declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientSingleton>;
} & typeof global;

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma;
