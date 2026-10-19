import {
	FixupNumericOrVariablesValueToExpressions,
	type CompanionMigrationAction,
	type CompanionStaticUpgradeProps,
	type CompanionStaticUpgradeResult,
	type CompanionStaticUpgradeScript,
	type CompanionUpgradeContext,
	type ExpressionOrValue,
	type JsonValue,
} from '@companion-module/base'
import { DEFAULT_PORT } from './api/index.js'
import { validPort, type ModuleConfig } from './config.js'
import { ActionId } from './actions.js'

type OptionValue = ExpressionOrValue<JsonValue | undefined> | undefined

/**
 * Options that were text inputs parsed as numbers before the API 2.x migration, so could hold a number typed as a
 * string, or variables. They hold a number since. Frozen history for UpgradeScripts[0]: do not edit to track later
 * changes, add a new script instead.
 */
export const numericActionOptionsApi2: Partial<Record<ActionId, string[]>> = {
	// The MVP's. The VIP's and NGI's has no display
	[ActionId.RunScript]: ['display'],
	[ActionId.RouteAudio]: ['display', 'pair'],
	[ActionId.SetVgpi]: ['vgpi'],
	[ActionId.UnassignWindow]: ['display'],
	[ActionId.SaveDisplay]: ['display'],
	[ActionId.ChangeWindowSource]: ['display'],
	[ActionId.Move]: ['duration', 'xPos', 'yPos'],
	[ActionId.Scale]: ['duration', 'xSize', 'ySize'],
}

/**
 * Before API 2.x the module parsed the variables in the MVP's Run Script dropdown, whose custom values could hold them.
 * Companion parses a text input's variables itself, but not a dropdown's. Frozen history for UpgradeScripts[0], as
 * {@link numericActionOptionsApi2} is.
 */
export const variableDropdownOptionsApi2: Partial<Record<ActionId, string[]>> = {
	[ActionId.RunScript]: ['script'],
}

/** Whether the helper changed a value. It always hands back a fresh object, so this compares contents, not identity */
function isChanged(current: OptionValue, fixed: OptionValue): boolean {
	return fixed?.isExpression !== current?.isExpression || fixed?.value !== current?.value
}

/** Converts the listed options in place. Returns whether anything changed */
function fixupNumericOptions(action: CompanionMigrationAction, keys?: string[]): boolean {
	if (!keys) return false
	let changed = false
	for (const key of keys) {
		const current = action.options[key]
		const fixed = FixupNumericOrVariablesValueToExpressions(current)
		if (isChanged(current, fixed)) {
			action.options[key] = fixed
			changed = true
		}
	}
	return changed
}

/**
 * Makes an expression of each listed option holding variables, which gives the text it did when the module parsed
 * them: a lone variable as it is, anything else in parseVariables(). Other text is left as it is.
 * Returns whether anything changed
 */
function fixupVariableOptions(action: CompanionMigrationAction, keys?: string[]): boolean {
	if (!keys) return false
	let changed = false
	for (const key of keys) {
		const current = action.options[key]
		if (current === undefined || current.isExpression || typeof current.value !== 'string') continue
		if (!current.value.includes('$(')) continue
		// Text with a variable in it never reads as a number, so the helper takes it as text
		const fixed = FixupNumericOrVariablesValueToExpressions(current)
		if (isChanged(current, fixed)) {
			action.options[key] = fixed
			changed = true
		}
	}
	return changed
}

/**
 * The port was a textinput before API 2.x, so a saved config holds a string, or the number default if never edited.
 * One that is not a usable port becomes the default.
 * @returns the config with the port a number, or null if it was one already
 */
export function upgradePortToNumber(config: ModuleConfig | null): ModuleConfig | null {
	if (config === null) return null
	const port: unknown = config.port
	if (typeof port === 'number') return null
	return { ...config, port: validPort(port) ?? DEFAULT_PORT }
}

export const UpgradeScripts: CompanionStaticUpgradeScript<ModuleConfig>[] = [
	/*
	 * Place your upgrade scripts here
	 * Remember that once it has been added it cannot be removed!
	 */

	// 0: API 2.x — numeric text inputs became number fields, and the port a number field. "3" becomes 3,
	// "$(local:x)" becomes an expression, anything else is wrapped in parseVariables(). The MVP's script dropdown gets
	// the same for a custom value holding variables.
	function (
		context: CompanionUpgradeContext<ModuleConfig>,
		props: CompanionStaticUpgradeProps<ModuleConfig, undefined>,
	): CompanionStaticUpgradeResult<ModuleConfig, undefined> {
		// The VIP's and NGI's Run Script script is a text input, whose variables Companion still parses. If the model
		// can't be told, converting does no harm: the expression gives the same text
		const model: unknown = (props.config ?? context.currentConfig)?.model
		const scriptIsDropdown = model === undefined || model === 'mvp'
		return {
			updatedConfig: upgradePortToNumber(props.config),
			updatedActions: props.actions.filter((action) => {
				const id = action.actionId as ActionId
				const numeric = fixupNumericOptions(action, numericActionOptionsApi2[id])
				const variables = scriptIsDropdown && fixupVariableOptions(action, variableDropdownOptionsApi2[id])
				return numeric || variables
			}),
			updatedFeedbacks: [],
		}
	},
]
