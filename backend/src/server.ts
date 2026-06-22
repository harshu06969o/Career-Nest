import dotenv from 'dotenv';
import app from './app.js';
import redisClient from './config/redisClient.js';

dotenv.config();

const PORT = process.env['PORT'] ?? 5000;

const startServer = async (): Promise<void> => {
  try {
    const pingResult = await redisClient.ping();
    console.log(`✅ Redis connection test: ${pingResult}`);

    app.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start the server:', error);
    process.exit(1);
  }
};

startServer();
