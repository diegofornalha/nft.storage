/**
 * @typedef {Object} GatewayMetrics
 * @property {number} totalReqCount total number of performed requests
 * @property {number} totalResponseTime total response time of the rquests
 * @property {number} failedReqCount total number of requests failed
 * @property {number} fasterReqCount number of performed requests where faster
 * @property {Record<string, number>} responseTimeHistogram
 *
 * @typedef {Object} ResponseStats
 * @property {string} url gateway URL
 * @property {boolean} ok request was successful
 * @property {number} [responseTime] number of milliseconds to get response
 * @property {boolean} [faster]
 */

/**
 * Durable Object for keeping Metrics state.
 */
export class Metrics11 {
  constructor(state, env) {
    this.state = state
    /** @type {Array<string>} */
    this.ipfsGateways = JSON.parse(env.IPFS_GATEWAYS)

    // `blockConcurrencyWhile()` ensures no requests are delivered until initialization completes.
    this.state.blockConcurrencyWhile(async () => {
      /** @type {Map<string, GatewayMetrics>} */
      this.gatewayMetrics = new Map()

      // Get state and initialize if not existing
      const storedMetricsPerGw = await Promise.all(
        this.ipfsGateways.map(async (gw) => {
          /** @type {GatewayMetrics} */
          const value =
            (await this.state.storage.get(gw)) || createMetricsTracker()

          return {
            gw,
            value: { ...value },
          }
        })
      )

      storedMetricsPerGw.forEach(({ gw, value }) => {
        this.gatewayMetrics.set(gw, value)
      })
    })
  }

  // Handle HTTP requests from clients.
  async fetch(request) {
    // Apply requested action.
    let url = new URL(request.url)
    switch (url.pathname) {
      case '/update':
        const data = await request.json()
        // Updated Metrics
        this._updatedMetrics(data)
        // Save updated Metrics
        await Promise.all(
          this.ipfsGateways.map((gw) =>
            this.state.storage.put(gw, this.gatewayMetrics.get(gw))
          )
        )
        return new Response()
      case '/metrics':
        const resp = {}
        this.ipfsGateways.forEach((url) => {
          resp[url] = this.gatewayMetrics.get(url)
        })

        return new Response(JSON.stringify(resp))
      default:
        return new Response('Not found', { status: 404 })
    }
  }

  /**
   * @param {ResponseStats[]} responseStats
   */
  _updatedMetrics(responseStats) {
    responseStats.forEach((stats) => {
      const gwMetrics = this.gatewayMetrics.get(stats.url)

      if (!stats.ok) {
        // Update request count
        gwMetrics.totalReqCount += 1
        gwMetrics.failedReqCount += 1
        return
      }

      // Update request count and response time sum
      gwMetrics.totalReqCount += 1
      gwMetrics.totalResponseTime += stats.responseTime

      // Update faster count if appropriate
      if (stats.faster) {
        gwMetrics.fasterReqCount += 1
      }

      // Update histogram
      const gwHistogram = {
        ...gwMetrics.responseTimeHistogram,
      }

      const histogramCandidate =
        histogram.find((h) => stats.responseTime <= h) ||
        histogram[histogram.length - 1]
      gwHistogram[histogramCandidate] += 1
      gwMetrics.responseTimeHistogram = gwHistogram
    })
  }
}

export const histogram = [300, 500, 750, 1000, 1500, 2000, 3000, 5000, 10000]

function createMetricsTracker() {
  const h = [...histogram].map((h) => [h, 0])

  return {
    totalReqCount: 0,
    totalResponseTime: 0,
    failedReqCount: 0,
    fasterReqCount: 0,
    responseTimeHistogram: Object.fromEntries(h),
  }
}
