interface ApiErrorResponse {
	code?: string;
	error?: string;
	details?: string;
}

interface DateRange {
	start: string;
	end: string;
}

interface WeekDay {
	weekday: number;
	count: number;
	level?: number;
	date?: string;
	color?: string;
}

interface WeekBlock {
	index: number;
	first_day: string;
	contribution_days: WeekDay[];
}

interface ContributionCell {
	date: string;
	count: number;
	color: string;
}

interface CalendarCell {
	date: string;
	count: number;
	color: string;
}

interface ContributionApiResponse {
	username?: string;
	totalContributions?: number;
	total_contributions?: number;
	dateRange?: DateRange;
	from?: string;
	to?: string;
	colorPalette?: string[];
	colors_full?: string[];
	contributions?: ContributionCell[];
	weeks?: WeekBlock[];
}

const FALLBACK_COLORS = ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'];

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#039;');
}

function formatNumber(value: number): string {
	return new Intl.NumberFormat().format(value);
}

function parseDateRange(payload: ContributionApiResponse): string {
	if (payload.dateRange?.start && payload.dateRange?.end) {
		return `${payload.dateRange.start} to ${payload.dateRange.end}`;
	}

	if (payload.from && payload.to) {
		return `${payload.from} to ${payload.to}`;
	}

	return 'Unknown range';
}

function normalizePalette(payload: ContributionApiResponse): string[] {
	if (Array.isArray(payload.colorPalette) && payload.colorPalette.length > 0) {
		return payload.colorPalette;
	}

	if (Array.isArray(payload.colors_full) && payload.colors_full.length > 0) {
		return payload.colors_full;
	}

	return FALLBACK_COLORS;
}

function parseTotalContributions(payload: ContributionApiResponse): number {
	if (typeof payload.totalContributions === 'number') {
		return payload.totalContributions;
	}

	if (typeof payload.total_contributions === 'number') {
		return payload.total_contributions;
	}

	return flattenContributionCells(payload).reduce((acc, cell) => acc + cell.count, 0);
}

function levelToColor(level: number | undefined, palette: string[]): string {
	if (typeof level !== 'number' || Number.isNaN(level)) {
		return palette[0] ?? FALLBACK_COLORS[0];
	}

	const index = Math.max(0, Math.min(palette.length - 1, level));
	return palette[index] ?? palette[0] ?? FALLBACK_COLORS[0];
}

function addDays(date: string, days: number): string {
	const base = new Date(date);
	if (Number.isNaN(base.getTime())) {
		return date;
	}

	base.setUTCDate(base.getUTCDate() + days);
	return base.toISOString().slice(0, 10);
}

function flattenFromWeeks(payload: ContributionApiResponse, palette: string[]): ContributionCell[] {
	if (!Array.isArray(payload.weeks)) {
		return [];
	}

	const cells: ContributionCell[] = [];
	for (const week of payload.weeks) {
		if (!week || !Array.isArray(week.contribution_days)) {
			continue;
		}

		for (const day of week.contribution_days) {
			if (!day || typeof day.count !== 'number') {
				continue;
			}

			const color = typeof day.color === 'string' && day.color ? day.color : levelToColor(day.level, palette);
			const date = typeof day.date === 'string' && day.date ? day.date : addDays(week.first_day, day.weekday ?? 0);
			cells.push({
				date,
				count: day.count,
				color,
			});
		}
	}

	return cells;
}

function flattenContributionCells(payload: ContributionApiResponse): ContributionCell[] {
	if (Array.isArray(payload.contributions) && payload.contributions.length > 0) {
		return payload.contributions
			.filter((entry): entry is ContributionCell => {
				return (
					entry &&
					typeof entry.date === 'string' &&
					typeof entry.count === 'number' &&
					typeof entry.color === 'string'
				);
			})
			.map((entry) => ({
				date: entry.date,
				count: entry.count,
				color: entry.color,
			}))
			.sort((a, b) => a.date.localeCompare(b.date));
	}

	return flattenFromWeeks(payload, normalizePalette(payload)).sort((a, b) => a.date.localeCompare(b.date));
}

function toIsoDate(date: Date): string {
	return date.toISOString().slice(0, 10);
}

function parseIsoDate(value: string): Date | null {
	const parsed = new Date(`${value}T00:00:00Z`);
	if (Number.isNaN(parsed.getTime())) {
		return null;
	}

	return parsed;
}

function shiftDays(date: Date, days: number): Date {
	const shifted = new Date(date.getTime());
	shifted.setUTCDate(shifted.getUTCDate() + days);
	return shifted;
}

function buildCalendar(cells: ContributionCell[], palette: string[]): { weeks: CalendarCell[][]; monthLabels: Array<{ index: number; label: string }> } {
	const map = new Map<string, ContributionCell>();
	for (const cell of cells) {
		map.set(cell.date, cell);
	}

	const validDates = cells
		.map((cell) => parseIsoDate(cell.date))
		.filter((date): date is Date => date instanceof Date)
		.sort((a, b) => a.getTime() - b.getTime());

	if (!validDates.length) {
		return { weeks: [], monthLabels: [] };
	}

	const minDate = validDates[0];
	const maxDate = validDates[validDates.length - 1];

	const start = shiftDays(minDate, -minDate.getUTCDay());
	const end = shiftDays(maxDate, 6 - maxDate.getUTCDay());

	const weeks: CalendarCell[][] = [];
	let current = start;
	while (current <= end) {
		const week: CalendarCell[] = [];
		for (let day = 0; day < 7; day += 1) {
			const iso = toIsoDate(current);
			const existing = map.get(iso);
			week.push({
				date: iso,
				count: existing?.count ?? 0,
				color: existing?.color ?? palette[0] ?? FALLBACK_COLORS[0],
			});
			current = shiftDays(current, 1);
		}
		weeks.push(week);
	}

	const monthLabels: Array<{ index: number; label: string }> = [];
	let prevMonthKey = '';
	for (let i = 0; i < weeks.length; i += 1) {
		const startOfWeek = parseIsoDate(weeks[i][0].date);
		if (!startOfWeek) {
			continue;
		}

		const month = startOfWeek.getUTCMonth();
		const year = startOfWeek.getUTCFullYear();
		const monthKey = `${year}-${month}`;
		if (i === 0 || monthKey !== prevMonthKey) {
			monthLabels.push({
				index: i,
				label: startOfWeek.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }),
			});
			prevMonthKey = monthKey;
		}
	}

	return { weeks, monthLabels };
}

const GITHUB_USERNAME_RE = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/;

function validateUsername(value: string): string | null {
	if (!value) {
		return 'Username cannot be empty.';
	}
	if (value.length > 39) {
		return 'Username must be 39 characters or fewer.';
	}
	if (!GITHUB_USERNAME_RE.test(value)) {
		return 'Invalid username. Use letters, numbers, or hyphens only.';
	}
	return null;
}

function triggerShake(el: HTMLElement): void {
	el.classList.remove('input-error');
	// eslint-disable-next-line @typescript-eslint/no-unused-expressions
	void el.offsetWidth;
	el.classList.add('input-error');
}

function setFieldError(input: HTMLInputElement, errorEl: HTMLElement, message: string | null): void {
	if (message) {
		errorEl.textContent = message;
		errorEl.classList.add('visible');
		triggerShake(input);
		input.setAttribute('aria-invalid', 'true');
	} else {
		errorEl.textContent = '';
		errorEl.classList.remove('visible');
		input.classList.remove('input-error');
		input.removeAttribute('aria-invalid');
	}
}

function toUserFacingError(payload: ApiErrorResponse | null, username: string): string {
	if (!payload) {
		return `Could not load data for ${username}.`;
	}

	if (payload.code === 'INVALID_USERNAME') {
		return `"${username}" is not a valid GitHub username.`;
	}

	if (payload.code === 'USER_NOT_FOUND') {
		return `GitHub user "${username}" was not found.`;
	}

	if (payload.code === 'UPSTREAM_RATE_LIMITED') {
		return 'GitHub rate limit reached. Please try again in a moment.';
	}

	if (payload.code === 'UPSTREAM_TIMEOUT') {
		return 'GitHub request timed out. Please try again.';
	}

	if (payload.error && payload.error.trim()) {
		return payload.error;
	}

	return `Could not load data for ${username}.`;
}

async function fetchContributionSummary(username: string): Promise<ContributionApiResponse> {
	const response = await fetch(`/api/contributions/${encodeURIComponent(username)}`);
	const payload = (await response.json().catch(() => null)) as ContributionApiResponse | ApiErrorResponse | null;

	if (!response.ok) {
		throw new Error(toUserFacingError(payload as ApiErrorResponse | null, username));
	}

	return (payload ?? {}) as ContributionApiResponse;
}

function renderGrid(cells: ContributionCell[], palette: string[]): string {
	if (!cells.length) {
		return '<p>No contribution data available for this period.</p>';
	}

	const { weeks, monthLabels } = buildCalendar(cells, palette);
	if (!weeks.length) {
		return '<p>No contribution data available for this period.</p>';
	}

	const weekCount = weeks.length;
	const monthHtml = monthLabels
		.map((entry) => {
			return `<span class="month-label" style="grid-column:${entry.index + 1}">${escapeHtml(entry.label)}</span>`;
		})
		.join('');

	const cellHtml = weeks
		.map((week) => {
			return week
				.map((cell) => {
					const safeDate = escapeHtml(cell.date);
					const safeColor = escapeHtml(cell.color || palette[0] || FALLBACK_COLORS[0]);
					const safeCount = escapeHtml(String(cell.count));
					return `<span class="contrib-cell" style="background:${safeColor}" title="${safeDate}: ${safeCount} contributions"></span>`;
				})
				.join('');
		})
		.join('');

	const swatches = palette
		.map((color) => `<span class="legend-swatch" style="background:${escapeHtml(color)}"></span>`)
		.join('');

	return `
		<div class="gh-graph" style="--week-count:${weekCount}">
			<div class="months-row">${monthHtml}</div>
			<div class="graph-body">
				<div class="weekday-labels">
					<span>Mon</span>
					<span>Wed</span>
					<span>Fri</span>
				</div>
				<div class="contrib-grid-wrap">
					<div class="contrib-grid">${cellHtml}</div>
				</div>
			</div>
			<div class="legend-row">
				<span>Less</span>
				<div class="legend" aria-label="Contribution intensity legend">${swatches}</div>
				<span>More</span>
			</div>
		</div>
	`;
}

function renderPlayerCard(title: string, payload: ContributionApiResponse, fallbackUsername: string): string {
	const username = payload.username && payload.username.trim() ? payload.username : fallbackUsername;
	const total = parseTotalContributions(payload);
	const dateRange = parseDateRange(payload);
	const palette = normalizePalette(payload);
	const cells = flattenContributionCells(payload);

	return `
		<article class="player-card">
			<h2>${escapeHtml(title)}: ${escapeHtml(username)}</h2>
			<dl>
				<div>
					<dt>Total Contributions</dt>
					<dd>${formatNumber(total)}</dd>
				</div>
				<div>
					<dt>Date Range</dt>
					<dd>${escapeHtml(dateRange)}</dd>
				</div>
			</dl>
			<p class="graph-title">Contribution Graph</p>
			${renderGrid(cells, palette)}
		</article>
	`;
}

export function initBattlePage(): void {
	const battleForm = document.getElementById('battleForm');
	const playerOneInput = document.getElementById('playerOne');
	const playerTwoInput = document.getElementById('playerTwo');
	const playerOneError = document.getElementById('playerOneError');
	const playerTwoError = document.getElementById('playerTwoError');
	const battleButton = document.getElementById('battleButton');
	const statusEl = document.getElementById('status');
	const resultsContent = document.getElementById('resultsContent');

	if (
		!(battleForm instanceof HTMLFormElement) ||
		!(playerOneInput instanceof HTMLInputElement) ||
		!(playerTwoInput instanceof HTMLInputElement) ||
		!(playerOneError instanceof HTMLElement) ||
		!(playerTwoError instanceof HTMLElement) ||
		!(battleButton instanceof HTMLButtonElement) ||
		!(statusEl instanceof HTMLElement) ||
		!(resultsContent instanceof HTMLElement)
	) {
		return;
	}

	const setStatus = (message: string, type: 'error' | 'loading' | 'success' | ''): void => {
		statusEl.textContent = message;
		statusEl.className = 'status';
		if (type) {
			statusEl.classList.remove('status');
			statusEl.className = `status ${type}`;
			if (type === 'error') {
				statusEl.classList.remove('error');
				void statusEl.offsetWidth;
				statusEl.classList.add('error');
			}
		}
	};

	const runBattle = async (): Promise<void> => {
		const playerOne = playerOneInput.value.trim();
		const playerTwo = playerTwoInput.value.trim();

		const errorOne = validateUsername(playerOne);
		const errorTwo = validateUsername(playerTwo);

		setFieldError(playerOneInput, playerOneError, errorOne);
		setFieldError(playerTwoInput, playerTwoError, errorTwo);

		if (errorOne || errorTwo) {
			const bothEmpty = !playerOne && !playerTwo;
			setStatus(
				bothEmpty
					? 'Enter both usernames to start a battle.'
					: 'Fix the errors above before starting a battle.',
				'error'
			);
			if (errorOne) {
				playerOneInput.focus();
			} else {
				playerTwoInput.focus();
			}
			return;
		}

		setStatus('', '');

		battleButton.disabled = true;
		setStatus('Loading contribution data...', 'loading');

		try {
			const [playerOneData, playerTwoData] = await Promise.all([
				fetchContributionSummary(playerOne),
				fetchContributionSummary(playerTwo),
			]);

			resultsContent.innerHTML = `
				<div class="result-grid">
					${renderPlayerCard('Player 1', playerOneData, playerOne)}
					<div class="vs-badge">VS</div>
					${renderPlayerCard('Player 2', playerTwoData, playerTwo)}
				</div>
			`;
			setStatus('Battle complete.', '');
		} catch (error) {
			setStatus(
				error instanceof Error ? error.message : 'Something went wrong while running the battle.',
				'error'
			);
		} finally {
			battleButton.disabled = false;
		}
	};

	const clearFieldErrorOnInput = (input: HTMLInputElement, errorEl: HTMLElement): void => {
		input.addEventListener('input', () => {
			if (input.classList.contains('input-error')) {
				const msg = validateUsername(input.value.trim());
				setFieldError(input, errorEl, msg);
			}
		});
	};

	clearFieldErrorOnInput(playerOneInput, playerOneError);
	clearFieldErrorOnInput(playerTwoInput, playerTwoError);

	battleForm.addEventListener('submit', async (event) => {
		event.preventDefault();
		await runBattle();
	});

	const handleEnter = async (event: KeyboardEvent): Promise<void> => {
		if (event.key !== 'Enter') {
			return;
		}

		event.preventDefault();
		await runBattle();
	};

	playerOneInput.addEventListener('keydown', (event) => {
		void handleEnter(event);
	});

	playerTwoInput.addEventListener('keydown', (event) => {
		void handleEnter(event);
	});
}
