// Thin client for the Fireflies GraphQL API.
// Docs: https://docs.fireflies.ai/graphql-api
const ENDPOINT = 'https://api.fireflies.ai/graphql'

async function gql(apiKey, query, variables = {}) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({ query, variables })
  })

  let payload
  try {
    payload = await res.json()
  } catch {
    throw new Error(`Fireflies returned a non-JSON response (HTTP ${res.status}).`)
  }

  if (payload.errors?.length) {
    throw new Error(payload.errors.map((e) => e.message).join('; '))
  }
  if (!res.ok) {
    throw new Error(`Fireflies request failed (HTTP ${res.status}).`)
  }
  return payload.data
}

// Validates the key and returns the signed-in user's name/email so we can
// optionally filter to "my" action items.
export async function fetchCurrentUser(apiKey) {
  const data = await gql(
    apiKey,
    `query Me { user { name email user_id } }`
  )
  return data.user
}

// Pulls recent transcripts with their AI summary (which contains action items).
export async function fetchTranscripts(apiKey, limit = 25) {
  const data = await gql(
    apiKey,
    `query Transcripts($limit: Int) {
      transcripts(limit: $limit) {
        id
        title
        date
        duration
        transcript_url
        summary { action_items overview }
      }
    }`,
    { limit }
  )
  return data.transcripts || []
}
