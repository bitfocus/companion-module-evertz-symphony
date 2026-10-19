import { describe, expect, it } from 'vitest'
import type {
	CompanionMigrationAction,
	CompanionStaticUpgradeProps,
	CompanionUpgradeContext,
} from '@companion-module/base'
import {
	numericActionOptionsApi2,
	upgradePortToNumber,
	UpgradeScripts,
	variableDropdownOptionsApi2,
} from '../upgrades.js'
import { ActionId } from '../actions.js'
import type { Model, ModuleConfig } from '../config.js'
import { actionDefinitions, fakeInstance } from './fixtures.js'

/**
 * Upgrade scripts are order-sensitive: a stored upgrade index records how far a configuration has been migrated,
 * so scripts may only ever be appended. Pin the index rather than taking the last entry, so appending a script
 * can't silently retarget this suite.
 */
const API2_SCRIPT_INDEX = 0
const EXPECTED_SCRIPT_COUNT = 1

// Options reach upgrade scripts already wrapped as ExpressionOrValue — Companion does that before running them
const v = (value: unknown) => ({ isExpression: false, value })

function action(actionId: string, options: Record<string, unknown>): CompanionMigrationAction {
	return {
		id: `action-${actionId}`,
		controlId: 'bank-1',
		actionId,
		options: options as CompanionMigrationAction['options'],
	}
}

const config = (port: unknown, model: Model = 'mvp'): ModuleConfig =>
	({ model, host: '10.0.0.1', port, display: 6 }) as ModuleConfig

function run(
	actions: CompanionMigrationAction[],
	savedConfig: ModuleConfig | null = null,
	currentConfig: ModuleConfig | undefined = undefined,
) {
	return UpgradeScripts[API2_SCRIPT_INDEX]({ currentConfig } as CompanionUpgradeContext<ModuleConfig>, {
		config: savedConfig,
		secrets: null,
		actions,
		feedbacks: [],
	} satisfies CompanionStaticUpgradeProps<ModuleConfig, undefined>)
}

describe('API 2.x upgrade script', () => {
	it('sits at the index this suite targets', () => {
		// Appending a script is fine — bump EXPECTED_SCRIPT_COUNT. Never insert, reorder or remove one.
		expect(UpgradeScripts).toHaveLength(EXPECTED_SCRIPT_COUNT)
	})

	it('converts the numbers typed into the old text inputs', () => {
		const existing = action(ActionId.RouteAudio, { display: v('3'), window: v('Main'), pair: v('0') })
		const result = run([existing])

		expect(result.updatedActions).toEqual([existing])
		expect(existing.options).toEqual({
			display: { isExpression: false, value: 3 },
			window: { isExpression: false, value: 'Main' },
			pair: { isExpression: false, value: 0 },
		})
	})

	it('keeps fractional seconds', () => {
		const existing = action(ActionId.Move, {
			window: v('w'),
			duration: v('0.5'),
			units: v('s'),
			xPos: v('100'),
			yPos: v('340'),
		})
		run([existing])

		expect(existing.options).toMatchObject({
			duration: { isExpression: false, value: 0.5 },
			xPos: { isExpression: false, value: 100 },
			yPos: { isExpression: false, value: 340 },
		})
	})

	it('turns a variable into an expression, and wraps mixed text in parseVariables', () => {
		const existing = action(ActionId.Scale, {
			window: v('$(internal:w)'),
			duration: v('$(internal:d)'),
			units: v('f'),
			xSize: v('1$(internal:x)'),
			ySize: v('2'),
		})
		run([existing])

		expect(existing.options).toEqual({
			// A text input, whose variables Companion parses
			window: { isExpression: false, value: '$(internal:w)' },
			duration: { isExpression: true, value: '$(internal:d)' },
			units: { isExpression: false, value: 'f' },
			xSize: { isExpression: true, value: 'parseVariables("1$(internal:x)")' },
			ySize: { isExpression: false, value: 2 },
		})
	})

	it("converts every numeric option, the VGPI's included", () => {
		const vgpi = action(ActionId.SetVgpi, { vgpi: v('12'), state: v(true) })
		const unassign = action(ActionId.UnassignWindow, { display: v('2'), window: v('w') })
		const save = action(ActionId.SaveDisplay, { script: v('s'), display: v('4') })
		const change = action(ActionId.ChangeWindowSource, {
			display: v('5'),
			window: v('w'),
			family: v('f'),
			member: v('m'),
		})
		const result = run([vgpi, unassign, save, change])

		expect(result.updatedActions).toEqual([vgpi, unassign, save, change])
		expect([vgpi.options.vgpi, unassign.options.display, save.options.display, change.options.display]).toEqual([
			{ isExpression: false, value: 12 },
			{ isExpression: false, value: 2 },
			{ isExpression: false, value: 4 },
			{ isExpression: false, value: 5 },
		])
	})

	it("makes an expression of the MVP's custom script holding variables, and leaves a plain one", () => {
		const lone = action(ActionId.RunScript, { script: v('$(internal:script)'), display: v(1) })
		const mixed = action(ActionId.RunScript, { script: v('Scene $(internal:n).vssl'), display: v(1) })
		const plain = action(ActionId.RunScript, { script: v('Script1.vssl'), display: v(1) })
		const result = run([lone, mixed, plain], config(9750, 'mvp'))

		expect(result.updatedActions).toEqual([lone, mixed])
		expect(lone.options.script).toEqual({ isExpression: true, value: '$(internal:script)' })
		expect(mixed.options.script).toEqual({ isExpression: true, value: 'parseVariables("Scene $(internal:n).vssl")' })
		expect(plain.options.script).toEqual({ isExpression: false, value: 'Script1.vssl' })
	})

	it('does not make a script that looks like a number into one', () => {
		const existing = action(ActionId.RunScript, { script: v('42'), display: v(1) })
		run([existing], config(9750, 'mvp'))

		expect(existing.options.script).toEqual({ isExpression: false, value: '42' })
	})

	it.each<Model>(['vip', 'ngi'])("leaves the %s's script, a text input whose variables Companion parses", (model) => {
		const existing = action(ActionId.RunScript, { script: v('$(internal:script)') })
		const result = run([existing], config(9750, model))

		expect(result.updatedActions).toEqual([])
		expect(existing.options.script).toEqual({ isExpression: false, value: '$(internal:script)' })
	})

	it('tells the model from the current config when given no saved one', () => {
		const vip = action(ActionId.RunScript, { script: v('$(internal:script)') })
		const mvp = action(ActionId.RunScript, { script: v('$(internal:script)') })
		run([vip], null, config(9750, 'vip'))
		run([mvp], null, config(9750, 'mvp'))

		expect(vip.options.script).toMatchObject({ isExpression: false })
		expect(mvp.options.script).toMatchObject({ isExpression: true })
	})

	it('does not report actions it had nothing to convert', () => {
		const numbers = action(ActionId.RouteAudio, { display: v(2), window: v('w'), pair: v(1) })
		const alreadyExpression = action(ActionId.SetVgpi, { vgpi: { isExpression: true, value: '1 + 1' }, state: v(true) })
		const missingOption = action(ActionId.UnassignWindow, {})
		const textOnly = action(ActionId.RunSnapshot, { snapshot: v('$(internal:snap)') })
		const unknown = action('no_such_action', { display: v('3') })
		const result = run([numbers, alreadyExpression, missingOption, textOnly, unknown], config(9750))

		expect(result.updatedActions).toEqual([])
		expect(alreadyExpression.options.vgpi).toEqual({ isExpression: true, value: '1 + 1' })
	})

	it('makes the port a number', () => {
		expect(run([], config('9750')).updatedConfig?.port).toBe(9750)
		expect(run([], config(' 4000 ')).updatedConfig?.port).toBe(4000)
		expect(run([], null).updatedConfig).toBeNull()
	})

	it('converts no feedbacks, as there are none', () => {
		expect(run([]).updatedFeedbacks).toEqual([])
	})
})

describe('upgradePortToNumber', () => {
	it('leaves a port that is a number already', () => {
		expect(upgradePortToNumber(config(9750))).toBeNull()
	})

	it.each(['', 'abc', '0', '70000', '20.5'])('replaces %j, which is no port, with the default', (port) => {
		expect(upgradePortToNumber(config(port))?.port).toBe(9750)
	})

	it('keeps everything else in the config', () => {
		expect(upgradePortToNumber(config('9751', 'exhibit'))).toEqual(config(9751, 'exhibit'))
	})
})

type DefinitionLike = { options: { id: string; type: string; allowCustom?: boolean }[] } | false | undefined

describe('upgrade maps match the current definitions', () => {
	const mvp: Record<string, DefinitionLike> = actionDefinitions(fakeInstance({ model: 'mvp' }))
	const exhibit: Record<string, DefinitionLike> = actionDefinitions(fakeInstance({ model: 'exhibit' }))
	const definition = (id: string) => mvp[id] || exhibit[id]

	const optionIds = (def: DefinitionLike, test: (option: { type: string; allowCustom?: boolean }) => boolean) =>
		def ? def.options.filter(test).map((o) => o.id) : []

	it('keeps the ids saved on buttons', () => {
		expect(Object.values(ActionId).sort()).toEqual([
			'changeWindowSource',
			'hide',
			'move',
			'routeAudio',
			'runScript',
			'runSnapshot',
			'saveDisplay',
			'scale',
			'setVGPI',
			'show',
			'unassignWindow',
		])
	})

	// The script stores numbers, so each converted option must be a number field
	it.each(Object.entries(numericActionOptionsApi2))('%s: converted options are number fields', (id, keys) => {
		expect(optionIds(definition(id), (o) => o.type === 'number')).toEqual(expect.arrayContaining(keys))
	})

	it.each(Object.entries(variableDropdownOptionsApi2))(
		'%s: options given expressions are dropdowns allowing custom values',
		(id, keys) => {
			expect(optionIds(definition(id), (o) => o.type === 'dropdown' && o.allowCustom === true)).toEqual(
				expect.arrayContaining(keys),
			)
		},
	)
})
