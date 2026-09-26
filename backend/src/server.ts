import { createServer } from 'http';
import dotenv from 'dotenv';
import app from './app.js';
import redisClient from './config/redisClient.js';
import { initSocketServer } from './config/socketServer.js';
import { createResumeWorker } from './workers/resumeParser.worker.js';

dotenv.config();

const PORT = process.env['PORT'] ?? 5000;

const startServer = async (): Promise<void> => {
  try {
    // Verify Redis is reachable before accepting traffic
    const pingResult = await redisClient.ping();
    console.log(`✅ Redis connection test: ${pingResult}`);

    // Wrap Express in a raw HTTP server so Socket.io can share the same port
    const httpServer = createServer(app);

    // Attach Socket.io
    initSocketServer(httpServer);

    // Start the BullMQ resume-parsing worker (same process, async execution)
    createResumeWorker();

    httpServer.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start the server:', error);
    process.exit(1);
  }
};

startServer();

