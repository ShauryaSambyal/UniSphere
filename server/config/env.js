import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Single source of truth for environment loading.
 *
 * Every module that reads `process.env` at module scope imports this file for
 * its side effect, which guarantees the variables are loaded before that
 * module's body runs. Previously each module called `dotenv.config()` with no
 * path, so the file was resolved against the current working directory and the
 * root `.env` documented in the README was silently ignored.
 *
 * Loaded in order — the first file that exists wins:
 *   1. server/.env  app-local overrides
 *   2. .env         repo root, shared by the server and the scripts
 */
dotenv.config({
  path: [
    path.resolve(__dirname, '../.env'),
    path.resolve(__dirname, '../../.env'),
  ],
  quiet: true,
});
