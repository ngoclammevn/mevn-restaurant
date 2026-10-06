import { createRemoteJWKSet, customFetch, jwtVerify, type JWTVerifyGetKey } from 'jose'
import { HttpError, isRecord, readBoundedJson, type Config } from './http.ts'

export async function fetchPublicJwks(url: string, options: RequestInit): Promise<Response> {
  // Do not follow redirects or pass a user bearer token to the key endpoint.
  // Workers has no ambient browser cookie jar; forward only these public headers.
  const response = await fetch(url, { ...options, redirect: 'error', headers: { Accept: 'application/json' } })
  if (response.status !== 200) throw new Error('jwks_unavailable')
  const jwks = await readBoundedJson(response, 32 * 1024, 503, 3000)
  if (!isRecord(jwks) || !Array.isArray(jwks.keys) || jwks.keys.length < 1 || jwks.keys.length > 10) throw new Error('invalid_jwks')
  return Response.json(jwks)
}

export async function authenticate(request: Request, config: Config, key?: JWTVerifyGetKey): Promise<{ token: string; subject: string }> {
  const authorization = request.headers.get('authorization') || ''
  const match = /^Bearer ([A-Za-z0-9_.-]+)$/i.exec(authorization)
  if (!match || match[1].length > 8192) throw new HttpError(401, 'unauthorized')
  const token = match[1]
  try {
    // The trusted setting supplies the JWKS URL, never an unverified token claim.
    const jwks = key ?? createRemoteJWKSet(new URL('/.well-known/jwks.json', config.issuer), { timeoutDuration: 3000, [customFetch]: fetchPublicJwks })
    const { payload } = await jwtVerify(token, jwks, {
      algorithms: ['RS256'], issuer: config.issuer,
      requiredClaims: ['sub', 'exp', 'nbf', 'azp'], clockTolerance: 0,
    })
    if (typeof payload.sub !== 'string' || !payload.sub.trim() || payload.sub.length > 256 ||
        typeof payload.azp !== 'string' || !config.origins.includes(payload.azp) ||
        payload.azp !== request.headers.get('origin') || payload.sts === 'pending') throw new Error('invalid_claims')
    return { token, subject: payload.sub }
  } catch {
    throw new HttpError(401, 'unauthorized')
  }
}
