import Toucan from 'toucan-js'
import pkg from '../package.json'
import { Logging } from './logs.js'

// TODO: Get Durable object typedef
/**
 * @typedef {Object} EnvInput
 * @property {string} IPFS_GATEWAYS
 * @property {string} VERSION
 * @property {string} COMMITHASH
 * @property {string} BRANCH
 * @property {string} DEBUG
 * @property {string} ENV
 * @property {string} [SENTRY_DSN]
 * @property {string} [LOGTAIL_TOKEN]
 * @property {Object} METRICS8
 * @property {Object} CIDS1
 *
 * @typedef {Object} EnvTransformed
 * @property {Array<string>} ipfsGateways
 * @property {Object} metricsDurable
 * @property {Object} cidsDurable
 * @property {Toucan} [sentry]
 * @property {Logging} [log]
 *
 * @typedef {EnvInput & EnvTransformed} Env
 */

/**
 * @param {Request} request
 * @param {Env} env
 * @param {import('./').Ctx} ctx
 */
export function envAll(request, env, ctx) {
  env.sentry = getSentry(request, env)
  env.ipfsGateways = JSON.parse(env.IPFS_GATEWAYS)
  env.metricsDurable = env.METRICS8
  env.cidsDurable = env.CIDS1
  env.log = new Logging(request, env, ctx)
}

/**
 * Get sentry instance if configured
 *
 * @param {Request} request
 * @param {Env} env
 */
function getSentry(request, env) {
  if (!env.SENTRY_DSN) {
    return
  }

  return new Toucan({
    request,
    dsn: env.SENTRY_DSN,
    allowedHeaders: ['user-agent', 'x-client'],
    allowedSearchParams: /(.*)/,
    debug: false,
    environment: env.ENV || 'dev',
    rewriteFrames: {
      root: '/',
    },
    release: env.VERSION,
    pkg,
  })
}
