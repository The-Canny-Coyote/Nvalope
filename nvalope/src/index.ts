/**
 * Nvalope API Worker: auth, entitlements, CORS.
 * - POST /api/session: create user + session cookie.
 * - GET /api/entitlements: current user's entitlements (requires a valid session).
 * - Set JWT_SECRET via `wrangler secret put JWT_SECRET` and replace database_id in wrangler.jsonc.
 */

import { SignJWT, jwtVerify } from 'jose';

// Types for D1 and env (run `npm run cf-typegen` to regenerate from wrangler; then you can remove this block if desired)
interface NvalopeEnv {
	DB: D1Database;
	/** Minimum 32 characters. Set via: wrangler secret put JWT_SECRET */
	JWT_SECRET: string;
}

interface D1Database {
	prepare(query: string): {
		bind(...values: unknown[]): {
			all<T = Record<string, unknown>>(): Promise<{ results?: T[] }>;
			run(): Promise<unknown>;
		};
	};
}

const SESSION_COOKIE_NAME = 'nvalope_session';
const JWT_ISSUER = 'nvalope-api';
const JWT_AUDIENCE = 'nvalope-app';
const JWT_EXPIRY = '30d';

const ALLOWED_ORIGINS = [
	'https://nvalope.app',
	'http://localhost:5173',
	'http://localhost:5174',
	'http://127.0.0.1:5173',
	'http://127.0.0.1:5174',
];

function corsHeaders(origin: string | null): Record<string, string> {
	const o = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
	return {
		'Access-Control-Allow-Origin': o,
		'Access-Control-Allow-Credentials': 'true',
		'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type, Authorization',
		'Access-Control-Max-Age': '86400',
	};
}

function jsonResponse(
	data: object,
	status: number,
	headers: Record<string, string> = {}
): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: {
			'Content-Type': 'application/json',
			...headers,
		},
	});
}

/** Get user id from cookie or Authorization Bearer. Returns null if missing/invalid. */
async function getUserId(request: Request, env: NvalopeEnv): Promise<string | null> {
	const authHeader = request.headers.get('Authorization');
	if (authHeader?.startsWith('Bearer ')) {
		const token = authHeader.slice(7);
		try {
			const secret = new TextEncoder().encode(env.JWT_SECRET);
			const { payload } = await jwtVerify(token, secret, {
				issuer: JWT_ISSUER,
				audience: JWT_AUDIENCE,
			});
			const sub = payload.sub;
			return typeof sub === 'string' ? sub : null;
		} catch {
			return null;
		}
	}
	const cookieHeader = request.headers.get('Cookie');
	if (!cookieHeader) return null;
	const match = cookieHeader.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
	if (!match) return null;
	try {
		const secret = new TextEncoder().encode(env.JWT_SECRET);
		const { payload } = await jwtVerify(match[1].trim(), secret, {
			issuer: JWT_ISSUER,
			audience: JWT_AUDIENCE,
		});
		const sub = payload.sub;
		return typeof sub === 'string' ? sub : null;
	} catch {
		return null;
	}
}

/** Create a new user in D1 and return user_id. */
async function createUser(env: NvalopeEnv): Promise<string> {
	const userId = crypto.randomUUID();
	await env.DB.prepare(
		'INSERT INTO users (id, email, created_at) VALUES (?, ?, datetime(\'now\'))'
	)
		.bind(userId, null)
		.run();
	return userId;
}

/** Remove stale anonymous users (no entitlements) to cap `users` table growth from repeated session bootstraps. */
async function purgeExpiredAnonymousSessions(env: NvalopeEnv): Promise<void> {
	await env.DB.prepare(
		"DELETE FROM users WHERE created_at < datetime('now', '-60 days') AND id NOT IN (SELECT user_id FROM one_time_entitlements)"
	).run();
}

/** Issue a session JWT and return Set-Cookie header value. */
async function issueSessionCookie(userId: string, env: NvalopeEnv): Promise<string> {
	const secret = new TextEncoder().encode(env.JWT_SECRET);
	const token = await new SignJWT({})
		.setProtectedHeader({ alg: 'HS256' })
		.setIssuer(JWT_ISSUER)
		.setAudience(JWT_AUDIENCE)
		.setSubject(userId)
		.setIssuedAt()
		.setExpirationTime(JWT_EXPIRY)
		.sign(secret);
	return `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`;
}

/**
 * NOTE: JWT TOKEN REVOCATION
 * Tokens issued by /api/session are valid for 30 days with no server-side
 * revocation mechanism. A stolen token remains valid until expiry.
 * For the current anonymous session model this is acceptable.
 * When paid entitlements are in production, consider:
 *   - Reducing JWT_EXPIRY to 7d and refreshing on entitlement fetch
 *   - Adding a token_revoked_at column to the users table
 *   - Checking issue time against a per-user revocation timestamp
 * See: https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html
 */
async function getEntitlementsForUser(
	env: NvalopeEnv,
	userId: string
): Promise<{ premium_full: boolean; team: boolean; bulk_receipt: boolean; premium_ai: boolean; premium_import: boolean }> {
	const { results } = await env.DB.prepare(
		'SELECT entitlement_key FROM one_time_entitlements WHERE user_id = ?'
	)
		.bind(userId)
		.all<{ entitlement_key: string }>();
	const keys = new Set((results ?? []).map((r) => r.entitlement_key));
	const premiumFull = keys.has('premium_full');
	return {
		premium_full: premiumFull,
		team: premiumFull || keys.has('team'),
		bulk_receipt: premiumFull || keys.has('bulk_receipt'),
		premium_ai: premiumFull || keys.has('premium_ai'),
		premium_import: premiumFull || keys.has('premium_import'),
	};
}

/**
 * RATE LIMITING: This Worker has no code-level rate limiting on /api/session.
 * Configure Cloudflare rate limiting rules in the Cloudflare dashboard to limit
 * POST /api/session to e.g. 10 requests per minute per IP.
 * Without this, /api/session can be spammed to fill the D1 users table.
 * See: https://developers.cloudflare.com/waf/rate-limiting-rules/
 */
export default {
	async fetch(
		request: Request,
		env: NvalopeEnv,
		_ctx: ExecutionContext
	): Promise<Response> {
		const origin = request.headers.get('Origin');
		const headers = corsHeaders(origin);

		if (request.method === 'OPTIONS') {
			return new Response(null, { status: 204, headers });
		}

		const url = new URL(request.url);
		if (url.pathname === '/api/session' && request.method === 'POST') {
			if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) {
				return jsonResponse(
					{ error: 'Server misconfiguration: JWT_SECRET missing or too short (min 32 chars)' },
					500,
					headers
				);
			}
			const contentLength = parseInt(request.headers.get('content-length') ?? '0', 10);
			if (!isNaN(contentLength) && contentLength > 1024) {
				return jsonResponse({ error: 'Bad request' }, 400, headers);
			}
			const userId = await createUser(env);
			const setCookie = await issueSessionCookie(userId, env);
			const res = jsonResponse({ ok: true }, 201, headers);
			res.headers.set('Set-Cookie', setCookie);
			// Best-effort cleanup: old users without entitlements; non-blocking so POST /api/session stays fast.
			void purgeExpiredAnonymousSessions(env).catch(() => {});
			return res;
		}

		if (url.pathname === '/api/entitlements' && request.method === 'GET') {
			if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) {
				return jsonResponse(
					{ error: 'Server misconfiguration: JWT_SECRET missing or too short (min 32 chars)' },
					500,
					headers
				);
			}
			const userId = await getUserId(request, env);
			if (!userId) return jsonResponse({ error: 'Unauthorized' }, 401, headers);
			const entitlements = await getEntitlementsForUser(env, userId);
			return jsonResponse(entitlements, 200, headers);
		}

		// Health / root
		if (url.pathname === '/' || url.pathname === '/health') {
			return jsonResponse({ ok: true, service: 'nvalope-api' }, 200, headers);
		}

		return jsonResponse({ error: 'Not Found' }, 404, headers);
	},
} satisfies ExportedHandler<NvalopeEnv>;
