import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const parseRedisConfig = () => {
  if (process.env.REDIS_URL) {
    const url = new URL(process.env.REDIS_URL);
    const config = {
      host: url.hostname,
      port: parseInt(url.port || '6379', 10),
      maxRetriesPerRequest: null, // Required by BullMQ
    };

    if (url.username) {
      config.username = decodeURIComponent(url.username);
    }

    if (url.password) {
      config.password = decodeURIComponent(url.password);
    }

    if (url.protocol === 'rediss:') {
      config.tls = {};
    }

    return config;
  }

  const config = {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    maxRetriesPerRequest: null, // Required by BullMQ
  };

  if (process.env.REDIS_USERNAME) {
    config.username = process.env.REDIS_USERNAME;
  }

  if (process.env.REDIS_PASSWORD) {
    config.password = process.env.REDIS_PASSWORD;
  }

  if (process.env.REDIS_TLS === 'true') {
    config.tls = {};
  }

  return config;
};

const redisConfig = parseRedisConfig();

export const getRedisConnection = () => {
  return new Redis(redisConfig);
};

export default redisConfig;
