import { NextResponse } from 'next/server'

import { ApiError, isApiError, toUnexpectedError } from './errors'
import { REQUEST_ID_HEADER, resolveRequestId } from './request-id'

/**
 * M0-T05 — route handler wrapper.
 *
 * Guarantees the two things the contract requires of every response: a request
 * id in the headers (05:38-46), and that any failure leaves as the frozen error
 * envelope rather than a framework stack trace.
 *
 * A handler returns its DTO directly. Single resources are returned bare, per
 * 05:67; only list endpoints get an envelope, built by listEnvelope().
 */
export type CookieOptions = {
  httpOnly: true
  secure: boolean
  sameSite: 'lax' | 'strict'
  path: string
  maxAge: number
}

export type ApiContext = {
  requestId: string
  request: Request
  /**
   * Queues a Set-Cookie for the response. Handlers never touch the response
   * object directly, so the wrapper stays the single place that guarantees the
   * request-id header and the error envelope.
   */
  setCookie: (name: string, value: string, options: CookieOptions) => void
}

export type ApiHandler<T> = (context: ApiContext) => Promise<T | ApiResult<T>> | T | ApiResult<T>

const API_RESULT = Symbol('apiResult')

export type ApiResult<T> = { [API_RESULT]: true; status: number; body: T }

/**
 * Returns a body with a specific status. Needed because the contract does not
 * use 200 everywhere: the magic-link request and resend are 202 (05:168, 05:197)
 * and consent creation is 201 (05:422).
 */
export function withStatus<T>(status: number, body: T): ApiResult<T> {
  return { [API_RESULT]: true, status, body }
}

function isApiResult<T>(value: unknown): value is ApiResult<T> {
  return typeof value === 'object' && value !== null && API_RESULT in value
}

export function withApi<T>(handler: ApiHandler<T>) {
  return async (request: Request): Promise<NextResponse> => {
    const requestId = resolveRequestId(request.headers)
    const cookies: { name: string; value: string; options: CookieOptions }[] = []
    const setCookie = (name: string, value: string, options: CookieOptions) => {
      cookies.push({ name, value, options })
    }

    const applyCookies = (response: NextResponse): NextResponse => {
      for (const cookie of cookies) response.cookies.set(cookie.name, cookie.value, cookie.options)
      return response
    }

    try {
      const returned = await handler({ requestId, request, setCookie })
      const status = isApiResult(returned) ? returned.status : 200
      const body = isApiResult(returned) ? returned.body : returned

      if (body === undefined) {
        return applyCookies(
          new NextResponse(null, {
            status: 204,
            headers: { [REQUEST_ID_HEADER]: requestId },
          }),
        )
      }

      return applyCookies(
        NextResponse.json(body, {
          status,
          headers: { [REQUEST_ID_HEADER]: requestId },
        }),
      )
    } catch (caught) {
      // Anything not deliberately thrown as ApiError is an internal fault, and
      // its message never reaches the client. It is logged on the server with
      // the request id (WF05-PROD-03, G12): class, message and stack only, never
      // the request body.
      if (!isApiError(caught)) {
        const fault = caught instanceof Error ? caught : new Error(String(caught))
        console.error('api unexpected error', {
          request_id: requestId,
          name: fault.name,
          message: fault.message,
          stack: fault.stack,
        })
      }
      const error: ApiError = isApiError(caught) ? caught : toUnexpectedError()

      // Cookies queued before the failure are still applied, so a logout that
      // throws afterwards cannot leave the session cookie in place.
      return applyCookies(
        NextResponse.json(error.toEnvelope(requestId), {
          status: error.status,
          headers: { [REQUEST_ID_HEADER]: requestId },
        }),
      )
    }
  }
}
