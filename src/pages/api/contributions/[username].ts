import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
	const { username } = params;

	if (!username) {
		return new Response(JSON.stringify({ error: 'Username is required' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	const githubRes = await fetch(`https://github.com/${encodeURIComponent(username)}.contribs`, {
		headers: { Accept: 'application/json' },
	});

	if (githubRes.status === 404) {
		return new Response(JSON.stringify({ error: `User "${username}" not found` }), {
			status: 404,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	if (!githubRes.ok) {
		return new Response(JSON.stringify({ error: 'Failed to fetch contributions from GitHub' }), {
			status: 502,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	const data = await githubRes.json();

	return new Response(
		JSON.stringify({
			username,
			total: data.total_contributions ?? 0,
			weeks: data.weeks ?? [],
		}),
		{
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		}
	);
};
