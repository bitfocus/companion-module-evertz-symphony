import { vi } from 'vitest'
import type {
	CompanionActionCallbackContext,
	CompanionActionDefinitions,
	CompanionActionEvent,
	CompanionOptionValues,
} from '@companion-module/base'
import type EvertzSymphonyInstance from '../main.js'
import type { Model, ModuleConfig } from '../config.js'
import { UpdateActions, type ActionId, type ActionSchema } from '../actions.js'
import { encode } from '../api/index.js'

function createMocks() {
	return {
		send: vi.fn<EvertzSymphonyInstance['send']>(async () => {}),
		setActionDefinitions: vi.fn<(defs: CompanionActionDefinitions<ActionSchema>) => void>(),
	}
}

export type FakeInstance = { self: EvertzSymphonyInstance } & ReturnType<typeof createMocks>

/**
 * A plain object standing in for the instance, for the definitions to be built from. Everything that would reach
 * Companion or the unit is a mock.
 */
export function fakeInstance({
	model = 'mvp',
	displays = 6,
	scripts = [] as string[],
}: { model?: Model; displays?: number; scripts?: string[] } = {}): FakeInstance {
	const mocks = createMocks()
	const config: Partial<ModuleConfig> = { model, display: displays }
	const self = { config, displayCount: displays, scripts, ...mocks } as unknown as EvertzSymphonyInstance
	return { self, ...mocks }
}

export function actionDefinitions(fake: FakeInstance): CompanionActionDefinitions<ActionSchema> {
	UpdateActions(fake.self)
	return fake.setActionDefinitions.mock.calls[0][0]
}

// The definitions' callbacks are typed per action. This takes any options, as the values Companion passes are not checked
type AnyCallback = (event: CompanionActionEvent, context: CompanionActionCallbackContext) => Promise<void> | void

/** Runs an action's callback as Companion would, with the option values already resolved */
export async function runAction(
	defs: CompanionActionDefinitions<ActionSchema>,
	actionId: ActionId,
	options: CompanionOptionValues,
	signal = new AbortController().signal,
): Promise<void> {
	const def = defs[actionId]
	if (!def) throw new Error(`${actionId} is not defined`)
	const event: CompanionActionEvent = {
		id: `action-${actionId}`,
		controlId: 'bank-1',
		actionId,
		surfaceId: undefined,
		options,
	}
	await (def.callback as AnyCallback)(event, { type: 'action', signal } as never)
}

/** Each request sent, as it would go on the wire with sequence number 1, less STX and ETX */
export function sentTexts(fake: FakeInstance): string[] {
	return fake.send.mock.calls.map(([request]) => encode(request, '0001').slice(1, -1))
}
