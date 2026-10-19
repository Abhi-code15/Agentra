const SENSITIVE_KEYS = new Set([
  'password',
  'password_hash',
  'token',
  'token_hash',
  'sessiontoken',
  'secret',
  'authorization',
  'cookie',
  'gemini_api_key',
  'openai_api_key',
  'client_secret'
]);

function redact(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(redact);

  const cleaned = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      cleaned[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      cleaned[key] = redact(value);
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

function formatLog(level, message, context = {}) {
  const timestamp = new Date().toISOString();
  const entry = {
    timestamp,
    level,
    message,
    ...redact(context)
  };
  return JSON.stringify(entry);
}

export const logger = {
  info(message, context) {
    console.log(formatLog('info', message, context));
  },
  warn(message, context) {
    console.warn(formatLog('warn', message, context));
  },
  error(message, context) {
    console.error(formatLog('error', message, context));
  },
  debug(message, context) {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(formatLog('debug', message, context));
    }
  }
};
