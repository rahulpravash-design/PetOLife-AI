import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const dirname = path.dirname(fileURLToPath(import.meta.url));

// Tests run against their own throwaway SQLite file, never the dev database.
const testDbPath = path.join(os.tmpdir(), `petolife-test-${process.pid}-${Date.now()}.db`);

export default defineConfig({
  test: {
    env: { SQLITE_PATH: testDbPath },
  },
  resolve: {
    alias: {
      '@': path.resolve(dirname, 'src'),
    },
  },
});
