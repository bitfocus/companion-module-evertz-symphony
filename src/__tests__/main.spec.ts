import { setTimeout as sleep } from 'node:timers/promises'
import { InstanceStatus, type CompanionActionDefinitions } from '@companion-module/base'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import EvertzSymphonyInstance from '../main.js'
import type { ModuleConfig } from '../config.js'
import { ActionId, type ActionSchema } from '../actions.js'
import { runScript } from '../api/index.js'
import { FakeSymphony } from './fakeSymphony.js'
import { runAction } from './fixtures.js'

/** What InstanceBase needs from the host, with everything it forwards to Companion mocked */
function createContext() {
	return {
		id: 'test-instance',
		_isInstanceContext: true as const,
		label: 'test',
		upgradeScripts: [],
		saveConfig: vi.fn(),
		updateStatus: vi.fn(),
		oscSend: vi.fn(),
		recordAction: vi.fn(),
		setActionDefinitions: vi.fn(),
		subscribeActions: vi.fn(),
		unsubscribeActions: vi.fn(),
		setFeedbackDefinitions: vi.fn(),
		unsubscribeFeedbacks: vi.fn(),
		checkFeedbacks: vi.fn(),
		checkAllFeedbacks: vi.fn(),
		checkFeedbacksById: vi.fn(),
		setPresetDefinitions: vi.fn(),
		setCompositeElementDefinitions: vi.fn(),
		setVariableDefinitions: vi.fn(),
		setVariableValues: vi.fn(),
		getVariableValue: vi.fn(),
		sharedUdpSocketHandlers: new Map(),
		sharedUdpSocketJoin: vi.fn(),
		sharedUdpSocketLeave: vi.fn(),
		sharedUdpSocketSend: vi.fn(),
	}
}

let fake: FakeSymphony
const instances: EvertzSymphonyInstance[] = []

beforeEach(async () => {
	fake = new FakeSymphony()
	await fake.listen()
})

afterEach(async () => {
	for (const instance of instances.splice(0)) await instance.destroy()
	await fake.close()
})

function createInstance() {
	const context = createContext()
	const instance = new EvertzSymphonyInstance(context)
	const log = vi.spyOn(instance, 'log').mockImplementation(() => {})
	instances.push(instance)
	return { instance, context, log }
}

function config(overrides: Partial<ModuleConfig> = {}): ModuleConfig {
	return { model: 'mvp', host: '127.0.0.1', port: fake.port, display: 6, ...overrides }
}

/** The action definitions last given to Companion */
const definedActions = (context: ReturnType<typeof createContext>) =>
	context.setActionDefinitions.mock.calls.at(-1)?.[0] as CompanionActionDefinitions<ActionSchema>

/** Waits for the connection, and for the keepalive sent on connecting to be answered */
async function started(overrides: Partial<ModuleConfig> = {}) {
	const created = createInstance()
	await created.instance.init(config(overrides))
	await vi.waitFor(() => expect(created.context.updateStatus).toHaveBeenCalledWith(InstanceStatus.Ok, 'Connected'))
	await vi.waitFor(() => expect(fake.received).toHaveLength(1))
	await sleep(50)
	return created
}

describe('starting', () => {
	// The 1.x module passed its message as the status, so Companion was given no status it knows
	it('reports connecting with the address as its message', async () => {
		const { context } = await started()
		expect(context.updateStatus.mock.calls[0]).toEqual([
			InstanceStatus.Connecting,
			`Connecting to 127.0.0.1:${fake.port}`,
		])
		for (const [status] of context.updateStatus.mock.calls) {
			expect(Object.values(InstanceStatus)).toContain(status)
		}
	})

	it('reports a missing host or an unusable port as bad config, without connecting', async () => {
		const { instance, context } = createInstance()
		await instance.init(config({ host: '  ' }))
		expect(context.updateStatus).toHaveBeenLastCalledWith(InstanceStatus.BadConfig, 'No host')
		await instance.configUpdated(config({ port: 0 }))
		expect(context.updateStatus).toHaveBeenLastCalledWith(InstanceStatus.BadConfig, 'Invalid port 0')
		expect(context.setActionDefinitions).toHaveBeenCalledTimes(2)
		await sleep(50)
		expect(fake.connections).toBe(0)
		await expect(instance.send(runScript('s'))).rejects.toThrow('Not connected')
	})

	it('lists the scripts on an MVP', async () => {
		await started()
		expect(fake.texts()).toEqual(['010001LS(){ }'])
	})

	it('probes any other unit', async () => {
		await started({ model: 'ngi' })
		expect(fake.texts()).toEqual(['990001LS(){ }'])
	})

	it('keeps the display count within what the protocol allows', async () => {
		const { instance } = createInstance()
		await instance.init(config({ host: '', display: 5000 }))
		expect(instance.displayCount).toBe(999)
	})
})

describe('scripts', () => {
	it('are offered by Run Script once the MVP lists them', async () => {
		const { context } = await started()
		const def = definedActions(context)[ActionId.RunScript]
		expect(def ? def.options.find((option) => option.id === 'script') : undefined).toMatchObject({
			choices: [
				{ id: 'Script1.vssl', label: 'Script1.vssl' },
				{ id: 'Script2.vssl', label: 'Script2.vssl' },
			],
		})
	})

	// The 1.x module compared a new array with the old by identity, so set the actions again on every keepalive
	it('set the actions again only when the list changes', async () => {
		const { instance, context } = await started()
		// Once by init, and once when the scripts were first listed
		expect(context.setActionDefinitions).toHaveBeenCalledTimes(2)
		const listed = fake.received.length
		await instance.send(runScript('Script1.vssl', 1))
		await vi.waitFor(() => expect(fake.received.length).toBeGreaterThanOrEqual(listed + 1))
		fake.dropConnections() // the reconnection, 2 s later, lists them again
		await vi.waitFor(() => expect(fake.texts(2)).toHaveLength(1), { timeout: 4000 })
		await sleep(50)
		expect(context.setActionDefinitions).toHaveBeenCalledTimes(2)
		fake.scripts = ['Script1.vssl', 'Script3.vssl']
		fake.dropConnections()
		await vi.waitFor(() => expect(context.setActionDefinitions).toHaveBeenCalledTimes(3), { timeout: 4000 })
		expect(instance.scripts).toEqual(['Script1.vssl', 'Script3.vssl'])
	})
})

describe('actions', () => {
	it('reach the unit', async () => {
		const { context } = await started()
		await runAction(definedActions(context), ActionId.RouteAudio, { display: 2, window: 'Main', pair: 1 })
		await vi.waitFor(() => expect(fake.texts()).toContain('010002RA(){ win = "D002Main" pair = 1 }'))
	})
})

describe('config changes and teardown', () => {
	it('replace the connection, and rebuild the actions for the new model', async () => {
		const { instance, context } = await started()
		await instance.configUpdated(config({ model: 'exhibit' }))
		await vi.waitFor(() => expect(fake.connections).toBe(2))
		await vi.waitFor(() => expect(fake.openConnections).toBe(1))
		const defined = Object.entries(definedActions(context))
			.filter(([, def]) => def)
			.map(([id]) => id)
		expect(defined.sort()).toEqual([ActionId.Hide, ActionId.Move, ActionId.Scale, ActionId.Show].sort())
	})

	it('destroy closes the connection for good', async () => {
		const { instance, context } = await started()
		await instance.destroy()
		await vi.waitFor(() => expect(fake.openConnections).toBe(0))
		expect(context.updateStatus).toHaveBeenLastCalledWith(InstanceStatus.Disconnected, null)
		await expect(instance.send(runScript('s'))).rejects.toThrow('Not connected')
	})
})
