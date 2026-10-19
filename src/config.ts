import { Regex, type DropdownChoice, type SomeCompanionConfigField } from '@companion-module/base'
import { DEFAULT_PORT, MAX_DISPLAYS } from './api/index.js'

/** The ids are saved in every existing config, so must never change */
export const MODEL_CHOICES = [
	{ id: 'mvp', label: 'MVP' },
	{ id: 'vip', label: 'VIP' },
	{ id: 'ngi', label: 'NGI' },
	{ id: 'exhibit', label: 'Exhibit' },
] as const satisfies DropdownChoice<string>[]

export type Model = (typeof MODEL_CHOICES)[number]['id']

export type ModuleConfig = {
	model: Model
	host: string
	port: number
	/** Number of addressable displays, for the MVP and NGI */
	display: number
}

export const DEFAULT_DISPLAYS = 6

export function GetConfigFields(): SomeCompanionConfigField[] {
	return [
		{
			type: 'dropdown',
			id: 'model',
			label: 'Model',
			width: 6,
			default: MODEL_CHOICES[0].id,
			choices: MODEL_CHOICES,
		},
		{
			type: 'textinput',
			id: 'host',
			label: 'Hostname',
			width: 12,
			default: '',
			regex: Regex.HOSTNAME,
		},
		{
			type: 'number',
			id: 'port',
			label: 'Port',
			width: 6,
			min: 1,
			max: 65535,
			default: DEFAULT_PORT,
			asInteger: true,
			tooltip: `Default, TCP:${DEFAULT_PORT}`,
		},
		{
			type: 'number',
			id: 'display',
			label: 'Displays',
			width: 6,
			default: DEFAULT_DISPLAYS,
			min: 1,
			max: MAX_DISPLAYS,
			range: true,
			step: 1,
			asInteger: true,
			tooltip: 'Number of addressable displays in the system',
			isVisibleExpression: `$(options:model) == '${MODEL_CHOICES[0].id}' || $(options:model) == '${MODEL_CHOICES[2].id}'`,
		},
	]
}

/**
 * The display count from the config, made a whole number from 1 to {@link MAX_DISPLAYS}. A saved config isn't checked
 * against its field's min and max. One without a count gets the default.
 */
export function clampDisplays(count: unknown): number {
	const value = Math.floor(Number(count))
	return Number.isNaN(value) ? DEFAULT_DISPLAYS : Math.min(Math.max(value, 1), MAX_DISPLAYS)
}

/** The port from the config, or undefined if it is not one TCP can use */
export function validPort(port: unknown): number | undefined {
	const value = Number(port)
	return Number.isInteger(value) && value >= 1 && value <= 65535 ? value : undefined
}
