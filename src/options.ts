import {
	Regex,
	type CompanionInputFieldCheckbox,
	type CompanionInputFieldDropdown,
	type CompanionInputFieldNumber,
	type CompanionInputFieldStaticText,
	type CompanionInputFieldTextInput,
	type DropdownChoice,
} from '@companion-module/base'
import { MAX_VGPI, type DurationUnit } from './api/index.js'

/**
 * Before API 2.x the numeric options were text inputs parsed as numbers, which is how variables got in. Expression mode
 * replaces that, and UpgradeScripts[0] converts the values saved. In expression mode Companion skips the action when the
 * result is outside the field's min and max.
 *
 * The protocol gives no upper limit for these, which the 1.x module did not check, so the field maximums are only there
 * because a number field must have one. They are set well past anything the units are likely to take.
 */
export const MAX_AUDIO_PAIR = 999
export const MAX_POSITION = 65535
export const MAX_DURATION = 9999

/** The text to choose when the MVP has listed no scripts yet. Sent as it is, which the MVP will refuse */
export const NO_SCRIPT = ''

/**
 * The MVP's scripts, as it last listed them. Custom values allow one it has not listed, or before it has. Unlike a text
 * input's, a custom value's variables are not parsed: an expression does that
 */
export function scriptChoiceOption(scripts: readonly string[]): CompanionInputFieldDropdown<'script', string> {
	const choices: DropdownChoice<string>[] =
		scripts.length > 0
			? scripts.map((script) => ({ id: script, label: script }))
			: [{ id: NO_SCRIPT, label: 'No scripts listed yet' }]
	return {
		id: 'script',
		type: 'dropdown',
		label: 'Script',
		choices,
		default: choices[0].id,
		allowCustom: true,
		regex: Regex.SOMETHING,
	}
}

export function scriptOption(defaultScript: string): CompanionInputFieldTextInput<'script'> {
	return {
		id: 'script',
		type: 'textinput',
		label: 'Script',
		default: defaultScript,
		useVariables: true,
		regex: Regex.SOMETHING,
	}
}

/** @param count the configured display count */
export function displayOption(count: number): CompanionInputFieldNumber<'display'> {
	return {
		id: 'display',
		type: 'number',
		label: 'Display',
		default: 1,
		min: 1,
		max: count,
		step: 1,
		asInteger: true,
		tooltip: `1 to ${count}`,
		expressionDescription: `Should return a display number, 1 to ${count}`,
	}
}

export const windowOption: CompanionInputFieldTextInput<'window'> = {
	id: 'window',
	type: 'textinput',
	label: 'Window Name',
	default: 'window',
	useVariables: true,
	regex: Regex.SOMETHING,
}

export const pairOption: CompanionInputFieldNumber<'pair'> = {
	id: 'pair',
	type: 'number',
	label: 'Pair',
	default: 1,
	min: 0,
	max: MAX_AUDIO_PAIR,
	step: 1,
	asInteger: true,
	tooltip: 'Audio pair number, 0 to turn off',
}

export const vgpiOption: CompanionInputFieldNumber<'vgpi'> = {
	id: 'vgpi',
	type: 'number',
	label: 'VGPI',
	default: 1,
	min: 1,
	max: MAX_VGPI,
	step: 1,
	asInteger: true,
	tooltip: `1 to ${MAX_VGPI}`,
}

export const stateOption: CompanionInputFieldCheckbox<'state'> = {
	id: 'state',
	type: 'checkbox',
	label: 'State',
	default: true,
}

export const snapshotOption: CompanionInputFieldTextInput<'snapshot'> = {
	id: 'snapshot',
	type: 'textinput',
	label: 'Snapshot',
	default: '',
	useVariables: true,
	regex: Regex.SOMETHING,
}

export const familyOption: CompanionInputFieldTextInput<'family'> = {
	id: 'family',
	type: 'textinput',
	label: 'Family Name',
	default: 'IC1',
	useVariables: true,
	regex: Regex.SOMETHING,
}

export const memberOption: CompanionInputFieldTextInput<'member'> = {
	id: 'member',
	type: 'textinput',
	label: 'Member Name',
	default: 'BNC_A',
	useVariables: true,
	regex: Regex.SOMETHING,
}

/** A note on the firmware an action needs */
export function firmwareNote(version: string): CompanionInputFieldStaticText {
	return {
		id: 'info',
		type: 'static-text',
		label: 'Note',
		value: `Requires MVP software ${version} or greater`,
	}
}

export const durationOption: CompanionInputFieldNumber<'duration'> = {
	id: 'duration',
	type: 'number',
	label: 'Duration',
	default: 1,
	min: 0,
	max: MAX_DURATION,
	tooltip: 'Seconds may be fractional, frames must be whole',
}

/** The ids are sent on the wire, after the duration */
export const UNIT_CHOICES = [
	{ id: 's', label: 'Seconds' },
	{ id: 'f', label: 'Frames' },
] as const satisfies DropdownChoice<DurationUnit>[]

export const unitsOption: CompanionInputFieldDropdown<'units', DurationUnit> = {
	id: 'units',
	type: 'dropdown',
	label: 'Units',
	choices: UNIT_CHOICES,
	default: UNIT_CHOICES[0].id,
	expressionDescription: `Should return ${UNIT_CHOICES.map(({ id }) => `'${id}'`).join(' or ')}`,
}

function positionOption<TKey extends string>(
	id: TKey,
	label: string,
	defaultValue: number,
): CompanionInputFieldNumber<TKey> {
	return {
		id,
		type: 'number',
		label,
		default: defaultValue,
		min: 0,
		max: MAX_POSITION,
		step: 1,
		asInteger: true,
	}
}

export const xPosOption = positionOption('xPos', 'X Position', 100)
export const yPosOption = positionOption('yPos', 'Y Position', 340)
export const xSizeOption = positionOption('xSize', 'X Size', 100)
export const ySizeOption = positionOption('ySize', 'Y Size', 340)
