import { describe, expect, it } from 'vitest'
import {
	clampDisplays,
	DEFAULT_DISPLAYS,
	GetConfigFields,
	MODEL_CHOICES,
	validPort,
	type ModuleConfig,
} from '../config.js'

describe('config fields', () => {
	it('keep the ids saved in existing configs', () => {
		const keys: (keyof ModuleConfig)[] = ['model', 'host', 'port', 'display']
		expect(GetConfigFields().map((field) => field.id)).toEqual(keys)
	})

	it('keep the model ids saved in existing configs, the MVP first and the default', () => {
		expect(MODEL_CHOICES.map(({ id }) => id)).toEqual(['mvp', 'vip', 'ngi', 'exhibit'])
		expect(GetConfigFields()[0]).toMatchObject({ type: 'dropdown', default: 'mvp' })
	})

	it('default the port to 9750', () => {
		expect(GetConfigFields().find((field) => field.id === 'port')).toMatchObject({
			type: 'number',
			default: 9750,
			min: 1,
			max: 65535,
		})
	})

	it('show the display count only for the MVP and NGI', () => {
		expect(GetConfigFields().find((field) => field.id === 'display')?.isVisibleExpression).toBe(
			"$(options:model) == 'mvp' || $(options:model) == 'ngi'",
		)
	})
})

describe('clampDisplays', () => {
	it.each([
		[6, 6],
		[999, 999],
		[1000, 999],
		[0, 1],
		[-3, 1],
		[3.7, 3],
		['12', 12],
		[undefined, DEFAULT_DISPLAYS],
		['many', DEFAULT_DISPLAYS],
	])('%j becomes %i', (count, expected) => {
		expect(clampDisplays(count)).toBe(expected)
	})
})

describe('validPort', () => {
	it('accepts a whole number from 1 to 65535, as a number or text', () => {
		expect(validPort(9750)).toBe(9750)
		expect(validPort('9750')).toBe(9750)
		expect(validPort(65535)).toBe(65535)
	})

	it.each([0, 65536, 20.5, '', 'abc', undefined, null])('rejects %j', (port) => {
		expect(validPort(port)).toBeUndefined()
	})
})
