import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import astroPlugin from 'eslint-plugin-astro';
import astroParser from 'astro-eslint-parser';

/** @type {import("eslint").Linter.FlatConfig[]} */
export default [
	{
		ignores: ['dist/**', 'node_modules/**', '.astro/**'],
	},
	// TypeScript files
	{
		files: ['**/*.ts', '**/*.tsx'],
		languageOptions: {
			parser: tsParser,
			parserOptions: {
				project: './tsconfig.json',
			},
		},
		plugins: {
			'@typescript-eslint': tsPlugin,
		},
		rules: {
			...tsPlugin.configs.recommended.rules,
			'@typescript-eslint/no-unused-vars': [
				'error',
				{ argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
			],
			'no-unused-vars': 'off', // Handled by @typescript-eslint/no-unused-vars
			'eqeqeq': ['error', 'always'],
			'no-console': 'warn',
			'prefer-const': 'error',
		},
	},
	// Astro files
	{
		files: ['**/*.astro'],
		plugins: {
			astro: astroPlugin,
			'@typescript-eslint': tsPlugin,
		},
		languageOptions: {
			parser: astroParser,
			parserOptions: {
				parser: tsParser,
				extraFileExtensions: ['.astro'],
				project: './tsconfig.json',
			},
		},
		rules: {
			...astroPlugin.configs.recommended.rules,
			'prefer-const': 'error',
			'eqeqeq': ['error', 'always'],
		},
	},
];
