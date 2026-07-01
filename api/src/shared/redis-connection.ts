import type { RedisOptions } from 'ioredis';

export function createRedisConnectionOptions(): RedisOptions {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    throw new Error('CONFIGURACAO ERRO: REDIS_URL nao esta definida nas variaveis de ambiente!');
  }

  return {
    ...parseRedisUrl(redisUrl),
    maxRetriesPerRequest: null,
  };
}

export function createApiRedisConnectionOptions(): RedisOptions {
  return {
    ...createRedisConnectionOptions(),
    maxRetriesPerRequest: 3,
    commandTimeout: 5000,
  };
}

function parseRedisUrl(value: string): RedisOptions {
  const url = new URL(value);
  
  const options: RedisOptions = {
    host: url.hostname,
    port: url.port ? Number(url.port) : 6379,
    username: decodeURIComponent(url.username || ''),
    password: url.password ? decodeURIComponent(url.password) : undefined,
    db: url.pathname.length > 1 ? Number(url.pathname.slice(1)) : undefined,
  };

  if (url.protocol === 'rediss:') {
    options.tls = {
      // Isso ignora a verificação de certificado autorizada, 
      // o que resolve o erro de handshake em ambientes de nuvem como Azure/Upstash
      rejectUnauthorized: false 
    };
  }

  return options;
}
