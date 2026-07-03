import fs from 'fs/promises';
import path from 'path';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { importDataFile } from '../services/importService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const DATA_DIR = path.resolve(__dirname, '../data');

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/college-platform');
    console.log('MongoDB Connected...');
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

async function run() {
  await connectDB();
  
  console.log('Starting data ingestion...');
  
  const stats = {
    imported: 0,
    merged: 0,
    unmatched: 0,
    duplicates: 0
  };

  try {
    const files = await fs.readdir(DATA_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json'));

    // Priority to process aicte_colleges first if exists, to create base records
    const baseFiles = jsonFiles.filter(f => f.includes('aicte') || f.includes('college'));
    const otherFiles = jsonFiles.filter(f => !baseFiles.includes(f));

    for (const file of baseFiles) {
      await importDataFile(path.join(DATA_DIR, file), stats);
    }

    for (const file of otherFiles) {
      await importDataFile(path.join(DATA_DIR, file), stats);
    }

    console.log('\n--- Ingestion Complete ---');
    console.log(`New Records Imported: ${stats.imported}`);
    console.log(`Records Merged/Updated: ${stats.merged}`);
    console.log(`Records Unmatched (skipped): ${stats.unmatched}`);
    // Duplicate tracking depends on exact matching logic inside importService
    
  } catch (error) {
    console.error('Error reading data directory:', error);
  }

  mongoose.disconnect();
}

run();
