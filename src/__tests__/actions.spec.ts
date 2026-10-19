import { describe, expect, it } from 'vitest'
import { ActionId } from '../actions.js'
import type { Model } from '../config.js'
import { NO_SCRIPT } from '../options.js'
import { actionDefinitions, fakeInstance, runAction, sentTexts } from './fixtures.js'

const defined = (model: Model) =>
	Object.entries(actionDefinitions(fakeInstance({ model })))
		.filter(([, def]) => def)
		.map(([id]) => id)
		.sort()

describe('the actions offered', () => {
	it.each<[Model, ActionId[]]>([
		[
			'mvp',
			[
				ActionId.RunScript,
				ActionId.RouteAudio,
				ActionId.SetVgpi,
				ActionId.UnassignWindow,
				ActionId.RunSnapshot,
				ActionId.SaveDisplay,
				ActionId.ChangeWindowSource,
			],
		],
		['vip', [ActionId.RunScript]],
		['ngi', [ActionId.RunScript, ActionId.ChangeWindowSource]],
		['exhibit', [ActionId.Show, ActionId.Hide, ActionId.Move, ActionId.Scale]],
	])('%s: %j', (model, ids) => {
		expect(defined(model)).toEqual([...ids].sort())
	})

	it('are none for a model the module does not know, as in the 1.x module', () => {
		expect(defined('other' as Model)).toEqual([])
	})

	it('define every id in the enum, as undefined where the model has no such action', () => {
		expect(Object.keys(actionDefinitions(fakeInstance({ model: 'vip' }))).sort()).toEqual(
			Object.values(ActionId).sort(),
		)
	})
})

describe('MVP', () => {
	it('Run Script sends the script and display, passing on the action signal', async () => {
		const fake = fakeInstance()
		const signal = new AbortController().signal
		await runAction(actionDefinitions(fake), ActionId.RunScript, { script: 'Script1.vssl', display: 3 }, signal)
		expect(sentTexts(fake)).toEqual(['010001RS(){ script = "Script1.vssl" display = 3 }'])
		expect(fake.send.mock.calls[0][1]).toBe(signal)
	})

	it('Run Script offers the scripts the MVP listed, or says there are none yet', () => {
		const choices = (scripts: string[]) => {
			const def = actionDefinitions(fakeInstance({ scripts }))[ActionId.RunScript]
			return def ? def.options.find((option) => option.id === 'script') : undefined
		}
		expect(choices(['a.vssl', 'b.vssl'])).toMatchObject({
			type: 'dropdown',
			choices: [
				{ id: 'a.vssl', label: 'a.vssl' },
				{ id: 'b.vssl', label: 'b.vssl' },
			],
			default: 'a.vssl',
			allowCustom: true,
		})
		expect(choices([])).toMatchObject({ choices: [{ id: NO_SCRIPT }], default: NO_SCRIPT })
	})

	it('Route Audio sends the window on the display, and the pair', async () => {
		const fake = fakeInstance()
		await runAction(actionDefinitions(fake), ActionId.RouteAudio, { display: 2, window: 'Main', pair: 0 })
		expect(sentTexts(fake)).toEqual(['010001RA(){ win = "D002Main" pair = 0 }'])
	})

	it('Set VGPI sends the VGPI as the label', async () => {
		const fake = fakeInstance()
		const defs = actionDefinitions(fake)
		await runAction(defs, ActionId.SetVgpi, { vgpi: 12, state: true })
		await runAction(defs, ActionId.SetVgpi, { vgpi: 12, state: false })
		expect(sentTexts(fake)).toEqual(['010001VGPI(12){ val = "on" }', '010001VGPI(12){ val = "off" }'])
	})

	it('Unassign Window Source sends the window on the display', async () => {
		const fake = fakeInstance()
		await runAction(actionDefinitions(fake), ActionId.UnassignWindow, { display: 6, window: 'PiP' })
		expect(sentTexts(fake)).toEqual(['010001US(){ win = "D006PiP" }'])
	})

	it('Run Snapshot sends the snapshot', async () => {
		const fake = fakeInstance()
		await runAction(actionDefinitions(fake), ActionId.RunSnapshot, { snapshot: 'Morning' })
		expect(sentTexts(fake)).toEqual(['010001SN(){ snapshot = "Morning" }'])
	})

	it('Save Display sends the display, then the script', async () => {
		const fake = fakeInstance()
		await runAction(actionDefinitions(fake), ActionId.SaveDisplay, { script: 'Saved.vssl', display: 1 })
		expect(sentTexts(fake)).toEqual(['010001SD(){ display = 1 script = "Saved.vssl" }'])
	})

	it('Change Window Source sends the window, family and member', async () => {
		const fake = fakeInstance()
		await runAction(actionDefinitions(fake), ActionId.ChangeWindowSource, {
			display: 4,
			window: 'window',
			family: 'IC1',
			member: 'BNC_A',
		})
		expect(sentTexts(fake)).toEqual(['010001CS(){ win = "D004window" family = "IC1" member = "BNC_A" }'])
	})
})

describe('VIP and NGI', () => {
	it.each<Model>(['vip', 'ngi'])('%s: Run Script sends the script alone', async (model) => {
		const fake = fakeInstance({ model })
		await runAction(actionDefinitions(fake), ActionId.RunScript, { script: 'script1.vssl' })
		expect(sentTexts(fake)).toEqual(['010001RS(){ script = "script1.vssl" }'])
	})

	it('NGI: Change Window Source is as the MVP has it', async () => {
		const fake = fakeInstance({ model: 'ngi' })
		await runAction(actionDefinitions(fake), ActionId.ChangeWindowSource, {
			display: 1,
			window: 'w',
			family: 'f',
			member: 'm',
		})
		expect(sentTexts(fake)).toEqual(['010001CS(){ win = "D001w" family = "f" member = "m" }'])
	})
})

describe('Exhibit', () => {
	// The 1.x module left the protocol version off Show, so sent "undefined" in its place
	it('Show and Hide send the window, with the protocol version', async () => {
		const fake = fakeInstance({ model: 'exhibit' })
		const defs = actionDefinitions(fake)
		await runAction(defs, ActionId.Show, { window: 'w1' })
		await runAction(defs, ActionId.Hide, { window: 'w1' })
		expect(sentTexts(fake)).toEqual(['010001SHOW(){ win = "w1" }', '010001HIDE(){ win = "w1" }'])
	})

	// The 1.x module read the units from action.option, which does not exist, so Move and Scale always threw
	it('Move and Scale send the duration in its units, and the position or size', async () => {
		const fake = fakeInstance({ model: 'exhibit' })
		const defs = actionDefinitions(fake)
		await runAction(defs, ActionId.Move, { window: 'w1', duration: 0.5, units: 's', xPos: 100, yPos: 340 })
		await runAction(defs, ActionId.Scale, { window: 'w1', duration: 12, units: 'f', xSize: 640, ySize: 360 })
		expect(sentTexts(fake)).toEqual([
			'010001MOVE(){ win = "w1" dur = "0.5s" x = 100 y = 340 }',
			'010001SCALE(){ win = "w1" dur = "12f" x = 640 y = 360 }',
		])
	})
})

describe('refusals', () => {
	// Value mode is not validated by Companion, and a saved value can outlast a reduced count
	it.each([
		['mvp', ActionId.RunScript, { script: 's', display: 7 }, /Display 7 is not 1 to 6, Run Script not sent/],
		['mvp', ActionId.RunScript, { script: 's' }, /Display undefined is not 1 to 6/],
		['mvp', ActionId.RouteAudio, { display: 0, window: 'w', pair: 1 }, /Display 0 is not 1 to 6/],
		['mvp', ActionId.RouteAudio, { display: 1, window: 'w', pair: -1 }, /-1 is not a valid audio pair/],
		['mvp', ActionId.SetVgpi, { vgpi: 321, state: true }, /321 is not a valid VGPI/],
		['mvp', ActionId.UnassignWindow, { display: 2.5, window: 'w' }, /Display 2.5 is not 1 to 6/],
		['mvp', ActionId.SaveDisplay, { script: 's', display: '1' }, /Display 1 is not 1 to 6/],
		['ngi', ActionId.ChangeWindowSource, { display: 9, window: 'w', family: 'f', member: 'm' }, /Display 9/],
		[
			'exhibit',
			ActionId.Move,
			{ window: 'w', duration: 1.5, units: 'f', xPos: 0, yPos: 0 },
			/1.5 is not a valid number of frames/,
		],
		[
			'exhibit',
			ActionId.Scale,
			{ window: 'w', duration: 1, units: 'ms', xSize: 0, ySize: 0 },
			/ms is not a valid duration unit/,
		],
		[
			'exhibit',
			ActionId.Scale,
			{ window: 'w', duration: 1, units: 's', xSize: -5, ySize: 0 },
			/-5 is not a valid X size/,
		],
	] as const)('%s %s refuses %o and sends nothing', async (model, actionId, options, error) => {
		const fake = fakeInstance({ model })
		await expect(runAction(actionDefinitions(fake), actionId, options)).rejects.toThrow(error)
		expect(fake.send).not.toHaveBeenCalled()
	})
})

describe('definitions', () => {
	it('limit the display to the configured count', () => {
		const def = actionDefinitions(fakeInstance({ displays: 12 }))[ActionId.RouteAudio]
		expect(def ? def.options.find((option) => option.id === 'display') : undefined).toMatchObject({
			type: 'number',
			min: 1,
			max: 12,
			asInteger: true,
		})
	})

	it('take variables in every text input', () => {
		for (const model of ['mvp', 'vip', 'ngi', 'exhibit'] as const) {
			for (const def of Object.values(actionDefinitions(fakeInstance({ model })))) {
				if (!def) continue
				for (const option of def.options) {
					if (option.type === 'textinput') expect(option).toMatchObject({ useVariables: true })
				}
			}
		}
	})
})
