/**
 * Logger unifié - remplace console.log
 * En production, logs uniquement les erreurs
 * 
 * Usage:
 *   import { logger } from '../utils/logger';
 *   logger.log('Debug info');
 *   logger.error('Error occurred');
 */
const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = {
  log: (...args) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },
  
  error: (...args) => {
    // Toujours logger les erreurs
    console.error(...args);
    // TODO: Envoyer à service de monitoring (Sentry, etc.)
  },
  
  warn: (...args) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },
  
  debug: (...args) => {
    if (isDevelopment) {
      console.debug(...args);
    }
  },
  
  info: (...args) => {
    if (isDevelopment) {
      console.info(...args);
    }
  },
};

