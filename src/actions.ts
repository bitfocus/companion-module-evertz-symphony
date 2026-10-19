import type { CompanionActionDefinitions } from '@companion-module/base'
import type EvertzSymphonyInstance from './main.js'
import type { Model } from './config.js'
import {
	changeWindowSource,
	hide,
	move,
	routeAudio,
	runScript,
	runSnapshot,
	saveDisplay,
	scale,
	setVgpi,
	show,
	unassignWindowSource,
	type DurationUnit,
} from './api/index.js'
import {
	displayOption,
	durationOption,
	familyOption,
	firmwareNote,
	memberOption,
	pairOption,
	scriptChoiceOption,
	scriptOption,
	snapshotOption,
	stateOption,
	unitsOption,
	vgpiOption,
	windowOption,
	xPosOption,
	xSizeOption,
	yPosOption,
	ySizeOption,
} from './options.js'
import { isInRange } from './util.js'

/** Action ids. The values are the ids saved against every button using the action, so they must never change */
export enum ActionId {
	RunScript = 'runScript',
	RouteAudio = 'routeAudio',
	SetVgpi = 'setVGPI',
	UnassignWindow = 'unassignWindow',
	RunSnapshot = 'runSnapshot',
	SaveDisplay = 'saveDisplay',
	ChangeWindowSource = 'changeWindowSource',
	Show = 'show',
	Hide = 'hide',
	Move = 'move',
	Scale = 'scale',
}

export type ActionSchema = {
	/** The VIP and NGI take no display */
	[ActionId.RunScript]: { options: { script: string; display?: number } }
	[ActionId.RouteAudio]: { options: { display: number; window: string; pair: number } }
	[ActionId.SetVgpi]: { options: { vgpi: number; state: boolean } }
	[ActionId.UnassignWindow]: { options: { display: number; window: string } }
	[ActionId.RunSnapshot]: { options: { snapshot: string } }
	[ActionId.SaveDisplay]: { options: { script: string; display: number } }
	[ActionId.ChangeWindowSource]: { options: { display: number; window: string; family: string; member: string } }
	[ActionId.Show]: { options: { window: string } }
	[ActionId.Hide]: { options: { window: string } }
	[ActionId.Move]: {
		options: { window: string; duration: number; units: DurationUnit; xPos: number; yPos: number }
	}
	[ActionId.Scale]: {
		options: { window: string; duration: number; units: DurationUnit; xSize: number; ySize: number }
	}
}

/**
 * The display, if it is within the configured count. Value mode is not validated by Companion, and a saved value can
 * outlast a reduced count
 */
function checkDisplay(self: EvertzSymphonyInstance, display: number | undefined, action: string): number {
	if (!isInRange(display, 1, self.displayCount)) {
		throw new Error(`Display ${String(display)} is not 1 to ${self.displayCount}, ${action} not sent`)
	}
	return display
}

/**
 * Each action is offered only for the models that have its command. The rest are left undefined, which tells Companion
 * this connection does not have them.
 */
export function UpdateActions(self: EvertzSymphonyInstance): void {
	const model = self.config.model
	const isModel = (...models: Model[]): boolean => models.includes(model)
	const display = displayOption(self.displayCount)

	const actions: CompanionActionDefinitions<ActionSchema> = {
		[ActionId.RunScript]: isModel('mvp')
			? {
					name: 'Run Script',
					options: [scriptChoiceOption(self.scripts), display],
					callback: async ({ options }, { signal }) => {
						const target = checkDisplay(self, options.display, 'Run Script')
						await self.send(runScript(options.script, target), signal)
					},
				}
			: isModel('vip', 'ngi')
				? {
						name: 'Run Script',
						options: [scriptOption('script1.vssl')],
						callback: async ({ options }, { signal }) => {
							await self.send(runScript(options.script), signal)
						},
					}
				: undefined,
		[ActionId.RouteAudio]: isModel('mvp')
			? {
					name: 'Route Audio',
					options: [display, windowOption, pairOption],
					callback: async ({ options }, { signal }) => {
						const target = checkDisplay(self, options.display, 'Route Audio')
						await self.send(routeAudio(target, options.window, options.pair), signal)
					},
				}
			: undefined,
		[ActionId.SetVgpi]: isModel('mvp')
			? {
					name: 'Set VGPI',
					options: [vgpiOption, stateOption],
					callback: async ({ options }, { signal }) => {
						await self.send(setVgpi(options.vgpi, Boolean(options.state)), signal)
					},
				}
			: undefined,
		[ActionId.UnassignWindow]: isModel('mvp')
			? {
					name: 'Unassign Window Source',
					options: [display, windowOption],
					callback: async ({ options }, { signal }) => {
						const target = checkDisplay(self, options.display, 'Unassign Window Source')
						await self.send(unassignWindowSource(target, options.window), signal)
					},
				}
			: undefined,
		[ActionId.RunSnapshot]: isModel('mvp')
			? {
					name: 'Run Snapshot',
					options: [snapshotOption, firmwareNote('2.13.0')],
					callback: async ({ options }, { signal }) => {
						await self.send(runSnapshot(options.snapshot), signal)
					},
				}
			: undefined,
		[ActionId.SaveDisplay]: isModel('mvp')
			? {
					name: 'Save Display',
					options: [scriptOption('Script1.vssl'), display, firmwareNote('2.17.0')],
					callback: async ({ options }, { signal }) => {
						const target = checkDisplay(self, options.display, 'Save Display')
						await self.send(saveDisplay(target, options.script), signal)
					},
				}
			: undefined,
		[ActionId.ChangeWindowSource]: isModel('mvp', 'ngi')
			? {
					name: 'Change Window Source',
					options: [display, windowOption, familyOption, memberOption],
					callback: async ({ options }, { signal }) => {
						const target = checkDisplay(self, options.display, 'Change Window Source')
						await self.send(changeWindowSource(target, options.window, options.family, options.member), signal)
					},
				}
			: undefined,
		[ActionId.Show]: isModel('exhibit')
			? {
					name: 'Show',
					options: [windowOption],
					callback: async ({ options }, { signal }) => {
						await self.send(show(options.window), signal)
					},
				}
			: undefined,
		[ActionId.Hide]: isModel('exhibit')
			? {
					name: 'Hide',
					options: [windowOption],
					callback: async ({ options }, { signal }) => {
						await self.send(hide(options.window), signal)
					},
				}
			: undefined,
		[ActionId.Move]: isModel('exhibit')
			? {
					name: 'Move',
					options: [windowOption, durationOption, unitsOption, xPosOption, yPosOption],
					callback: async ({ options }, { signal }) => {
						const duration = { value: options.duration, unit: options.units }
						await self.send(move(options.window, duration, options.xPos, options.yPos), signal)
					},
				}
			: undefined,
		[ActionId.Scale]: isModel('exhibit')
			? {
					name: 'Scale',
					options: [windowOption, durationOption, unitsOption, xSizeOption, ySizeOption],
					callback: async ({ options }, { signal }) => {
						const duration = { value: options.duration, unit: options.units }
						await self.send(scale(options.window, duration, options.xSize, options.ySize), signal)
					},
				}
			: undefined,
	}

	self.setActionDefinitions(actions)
}
