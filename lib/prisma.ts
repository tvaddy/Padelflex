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
    ]).catch(() => {});
  }

  return client;
};

declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientSingleton>;
} & typeof global;

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma;
