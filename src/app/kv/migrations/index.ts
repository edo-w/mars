import { initKvMigration } from '#src/app/kv/migrations/20260326-init-kv';
import type { DbMigration } from '#src/lib/db';

export const kvMigrations: DbMigration[] = [initKvMigration];
