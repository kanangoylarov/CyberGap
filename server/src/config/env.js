import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

export const config = {
  port: process.env.PORT || 3000,
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret:process.env.JWT_SECRET,
  nodeEnv:process.env.NODE_ENV
};
