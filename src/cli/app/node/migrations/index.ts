import { initNodeMigration } from '#src/cli/app/node/migrations/20260328-init-node';
import type { DbMigration } from '#src/lib/db';

export const nodeMigrations: DbMigration[] = [initNodeMigration];
