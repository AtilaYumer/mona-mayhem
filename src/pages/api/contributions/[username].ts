import type { APIRoute } from 'astro';

export const prerender = false;

const USERNAME_PATTERN = /^(?!-)(?!.*--)[a-z\d](?:[a-z\d-]{0,37})$/i;
const REQUEST_TIMEOUT_MS = 8000;
const CACHE_TTL_MS = 60 * 60 * 1000;
const SHARED_CACHE_MAX_AGE_SECONDS = 60 * 60;
const CLIENT_CACHE_MAX_AGE_SECONDS = 300;
const STALE_WHILE_REVALIDATE_SECONDS = 24 * 60 * 60;

type CachedPayload = {
	payload: string;
	expiresAt: number;
};

const contributionCache = new Map<string, CachedPayload>();

function buildCacheControl(): string {
	return `public, max-age=${CLIENT_CACHE_MAX_AGE_SECONDS}, s-maxage=${SHARED_CACHE_MAX_AGE_SECONDS}, stale-while-revalidate=${STALE_WHILE_REVALIDATE_SECONDS}`;
}

function jsonResponse(body: unknown, status: number, cacheStatus: 'HIT' | 'MISS' = 'MISS'): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			'Content-Type': 'application/json; charset=utf-8',
			'Cache-Control': buildCacheControl(),
			'X-Cache': cacheStatus,
		},
	});
}

function errorResponse(status: number, code: string, error: string, details?: string): Response {
	return jsonResponse({ code, error, ...(details ? { details } : {}) }, status);
}

function getCached(username: string): string | null {
	const cached = contributionCache.get(username);
	if (!cached) {
		return null;
	}

	if (Date.now() > cached.expiresAt) {
		contributionCache.delete(username);
		return null;
	}

	return cached.payload;
}

function setCached(username: string, payload: string): void {
	contributionCache.set(username, {
		payload,
		expiresAt: Date.now() + CACHE_TTL_MS,
	});
}

async function fetchWithTimeout(url: string): Promise<Response> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

	try {
		return await fetch(url, {
			signal: controller.signal,
			headers: {
				Accept: 'application/json',
				'User-Agent': 'mona-mayhem-proxy',
			},
		});
	} finally {
		clearTimeout(timer);
	}
}

export const GET: APIRoute = async ({ params }) => {
	const username = params.username?.trim().toLowerCase();

	if (!username || !USERNAME_PATTERN.test(username)) {
		return errorResponse(400, 'INVALID_USERNAME', 'Invalid GitHub username format.');
	}

	const cachedPayload = getCached(username);
	if (cachedPayload) {
		return new Response(cachedPayload, {
			status: 200,
			headers: {
				'Content-Type': 'application/json; charset=utf-8',
				'Cache-Control': buildCacheControl(),
				'X-Cache': 'HIT',
			},
		});
	}

	const upstreamUrl = `https://github.com/${username}.contribs`;
	let upstreamResponse: Response;

	try {
		upstreamResponse = await fetchWithTimeout(upstreamUrl);
	} catch (error) {
		if (error instanceof DOMException && error.name === 'AbortError') {
			return errorResponse(504, 'UPSTREAM_TIMEOUT', 'Upstream request timed out.');
		}

		return errorResponse(502, 'UPSTREAM_FETCH_FAILED', 'Failed to fetch data from upstream service.');
	}

	if (upstreamResponse.status === 404) {
		return errorResponse(404, 'USER_NOT_FOUND', 'GitHub user not found.');
	}

	if (upstreamResponse.status === 403 || upstreamResponse.status === 429) {
		return errorResponse(429, 'UPSTREAM_RATE_LIMITED', 'Upstream rate limit reached. Please try again later.');
	}

	if (!upstreamResponse.ok) {
		return errorResponse(502, 'UPSTREAM_BAD_RESPONSE', `Upstream returned HTTP ${upstreamResponse.status}.`);
	}

	let upstreamData: unknown;
	const contentType = upstreamResponse.headers.get('content-type') || '';

	try {
		if (contentType.includes('application/json')) {
			upstreamData = await upstreamResponse.json();
		} else {
			const textPayload = await upstreamResponse.text();
			upstreamData = JSON.parse(textPayload);
		}
	} catch {
		return errorResponse(502, 'UPSTREAM_PARSE_FAILED', 'Unable to parse upstream response as JSON.');
	}

	const normalizedPayload =
		upstreamData && typeof upstreamData === 'object' && !Array.isArray(upstreamData)
			? { username, ...(upstreamData as Record<string, unknown>) }
			: { username, data: upstreamData };

	const payloadAsString = JSON.stringify(normalizedPayload);
	setCached(username, payloadAsString);

	return new Response(payloadAsString, {
		status: 200,
		headers: {
			'Content-Type': 'application/json; charset=utf-8',
			'Cache-Control': buildCacheControl(),
			'X-Cache': 'MISS',
		},
	});
};
