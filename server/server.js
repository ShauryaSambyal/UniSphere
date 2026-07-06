import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Route imports
import authRoutes from './routes/authRoutes.js';
import collegeRoutes from './routes/collegeRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import embeddingRoutes from './routes/embeddingRoutes.js';
import reviewRoutes from './routes/reviewRoutes.js';
import summaryRoutes from './routes/summaryRoutes.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// ────────────────────────────────────────────────────────────
// CORS – allow localhost in dev + all URLs listed in CLIENT_URL
//
// CLIENT_URL can be a single URL or a comma-separated list:
//   e.g. https://unisphere.vercel.app,https://unisphere-malg.onrender.com
//
// Set this in your Render dashboard under Environment Variables.
// ────────────────────────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:5173',  // Vite dev server
  'http://localhost:3000',  // alternate dev port
  // Support comma-separated list of production origins
  ...(process.env.CLIENT_URL
    ? process.env.CLIENT_URL.split(',').map(u => u.trim()).filter(Boolean)
    : []),
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (Postman, server-to-server, curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    // Allow any Vercel preview deployment (*.vercel.app)
    if (/^https:\/\/[a-z0-9-]+-[a-z0-9-]+\.vercel\.app$/.test(origin)) {
      return callback(null, true);
    }
    console.warn(`CORS blocked: ${origin}`);
    return callback(new Error(`CORS policy: origin ${origin} is not allowed`));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

app.use(express.json());

// Serve uploads static folder
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ────────────────────────────────────────────────────────────
// Health-check endpoints (Render uses these to verify server)
// ────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'UniSphere API is running 🚀' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Routes mount
app.use('/api/auth', authRoutes);
app.use('/api/colleges', collegeRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/embeddings', embeddingRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/generate-summary', summaryRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.stack);
  res.status(500).json({
    message: 'Internal server error occurred',
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  });
});

// Database connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/college-platform';

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✅ Successfully connected to MongoDB.');
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server is running on port ${PORT}`);
      console.log(`🌍 Allowed CORS origins: ${allowedOrigins.join(', ')}`);
    });
  })
  .catch(err => {
    console.error('❌ Database connection error:', err);
    process.exit(1);
  });
