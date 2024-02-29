import Fastify from 'fastify'
import fastifyCors from '@fastify/cors'
import { config } from 'dotenv'
import axios from 'axios'

config()

const PORT = process.env.PORT! || 3000
const API_KEY = process.env.API_KEY!
const PROSPECT_TOKEN_API_URL = process.env.PROSPECT_TOKEN_API_URL!
const PROSPECT_CLIENT_ID = process.env.PROSPECT_CLIENT_ID!
const PROSPECT_CLIENT_SECRET = process.env.PROSPECT_CLIENT_SECRET!
const PROSPECT_GRANT_TYPE = process.env.PROSPECT_GRANT_TYPE!
const PROSPECT_USERNAME = process.env.PROSPECT_USERNAME!
const PROSPECT_PASSWORD = process.env.PROSPECT_PASSWORD!
const PROSPECT_LEAD_API_URL = process.env.PROSPECT_LEAD_API_URL!

const TOKEN_REFRESH_MARGIN = process.env.TOKEN_REFRESH_MARGIN!

let cachedToken: null | string = null
let tokenExpiryTime: null | number = null

const getBearerToken = async () => {
  const currentTime = Math.floor(Date.now() / 1000)

  if (
    cachedToken &&
    tokenExpiryTime &&
    currentTime < tokenExpiryTime - +TOKEN_REFRESH_MARGIN
  ) {
    return cachedToken
  }

  const response = await axios.post(
    PROSPECT_TOKEN_API_URL,
    new URLSearchParams({
      grant_type: PROSPECT_GRANT_TYPE,
      client_id: PROSPECT_CLIENT_ID,
      client_secret: PROSPECT_CLIENT_SECRET,
      username: PROSPECT_USERNAME,
      password: PROSPECT_PASSWORD,
    }),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  )

  cachedToken = response.data.access_token
  tokenExpiryTime = currentTime + response.data.expires_in

  return cachedToken
}

const checkApiKey = async (request: any, reply: any) => {
  const apiKey = request.headers['x-api-key']
  if (!apiKey || apiKey !== API_KEY) {
    reply.code(401).send({ error: 'Unauthorized' })
    throw new Error('Unauthorized')
  }
}

const fastify = Fastify({ logger: true })
fastify.register(fastifyCors, { origin: true, credentials: true })

fastify.post(
  '/leads',
  { preHandler: checkApiKey },
  async (request: any, reply) => {
    try {
      const bearerToken = await getBearerToken()
      const response = await axios.post(PROSPECT_LEAD_API_URL, request.body, {
        headers: {
          Authorization: `Bearer ${bearerToken}`,
          'Content-Type': 'application/json',
        },
      })
      reply.send(response.data)
    } catch (error: any) {
      if (error.response && error.response.status === 401) {
        cachedToken = null
      }

      reply.code(502).send({ error: 'Failed to process the request' })
    }
  }
)

fastify.listen({ port: +PORT, host: '0.0.0.0' }, (err) => {
  if (err) throw err
})
