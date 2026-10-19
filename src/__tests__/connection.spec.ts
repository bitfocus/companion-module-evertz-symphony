import { setTimeout as sleep } from 'node:timers/promises'
import { InstanceStatus, type LogLevel } from '@companion-module/base'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
	keepaliveProbe,
	listScripts,
	runScript,
	SymphonyConnection,
	type ConnectionTiming,
	type Request,
} from '../api/index.js'
import { closedPort, FakeSymphony } from './fakeSymphony.js'

const TIMING: ConnectionTiming = { messageGap: 5, replyTimeout: 50, keepaliveInterval: 200, reconnectInterval: 50 }

let fake: FakeSymphony
const connections: SymphonyConnection[] = []

beforeEach(async () => {
	fake = new FakeSymphony()
	await fake.listen()
})

afterEach(async () => {
	for (const connection of connections.splice(0)) connection.destroy()
	await fake.close()
})

function createConnection({
	keepalive = listScripts(),
	timing = TIMING,
	port = fake.port,
}: { keepalive?: Request; timing?: Partial<ConnectionTiming>; port?: number } = {}) {
	const log = vi.fn<(level: LogLevel, message: string) => void>()
	const statuses: [InstanceStatus, string | null][] = []
	const scripts = vi.fn<(scripts: string[]) => void>()
	const connection = new SymphonyConnection({ host: '127.0.0.1', port, keepalive, log, timing })
	connection.on('status', (status, message) => statuses.push([status, message]))
	connection.on('scripts', scripts)
	connections.push(connection)
	return { connection, log, statuses, scripts }
}

/** Connects, and waits for the keepalive sent on connecting to be answered */
async function connected(options: Parameters<typeof createConnection>[0] = {}) {
	const created = createConnection(options)
	created.connection.connect()
	await vi.waitFor(() => expect(created.connection.isConnected).toBe(true))
	await vi.waitFor(() => expect(fake.received).toHaveLength(1))
	await sleep(20)
	return created
}

const logged = (log: ReturnType<typeof createConnection>['log'], level: LogLevel) =>
	log.mock.calls.filter(([l]) => l === level).map(([, message]) => message)

describe('connecting', () => {
	it('reports connecting, then connected, and sends the keepalive at once', async () => {
		const { statuses } = await connected()
		expect(statuses).toEqual([
			[InstanceStatus.Connecting, `Connecting to 127.0.0.1:${fake.port}`],
			[InstanceStatus.Ok, 'Connected'],
		])
		expect(fake.texts()).toEqual(['010001LS(){ }'])
	})

	it('passes on the scripts the MVP lists', async () => {
		const { scripts } = await connected()
		expect(scripts).toHaveBeenCalledExactlyOnceWith(['Script1.vssl', 'Script2.vssl'])
	})

	it('sends another unit the probe, and takes its error as the answer', async () => {
		const { statuses, log } = await connected({ keepalive: keepaliveProbe() })
		expect(fake.texts()).toEqual(['990001LS(){ }'])
		expect(statuses.at(-1)).toEqual([InstanceStatus.Ok, 'Connected'])
		expect(logged(log, 'warn')).toEqual([])
	})

	it("takes the probe's answer whatever protocol version it carries", async () => {
		fake.probeReplyVersion = '99'
		const { statuses, log } = await connected({ keepalive: keepaliveProbe() })
		expect(statuses.at(-1)).toEqual([InstanceStatus.Ok, 'Connected'])
		expect(logged(log, 'warn')).toEqual([])
	})

	it('takes error 01 as the answer to the probe, even unprompted, as the 1.x module did', async () => {
		const { statuses, log } = await connected({ keepalive: keepaliveProbe() })
		fake.broadcast('010000ER(01)')
		await sleep(20)
		expect(statuses.at(-1)).toEqual([InstanceStatus.Ok, 'Connected'])
		expect(logged(log, 'warn')).toEqual([])
	})

	it('refuses to send before connecting', async () => {
		const { connection } = createConnection()
		await expect(connection.send(listScripts())).rejects.toThrow('Not connected')
	})
})

describe('sending', () => {
	it('numbers each message in base 36, from 1', async () => {
		const { connection } = await connected()
		for (let i = 0; i < 10; i++) await connection.send(runScript('s'))
		await vi.waitFor(() => expect(fake.received).toHaveLength(11))
		expect(fake.received.map((m) => m.sequence)).toEqual([
			'0001',
			'0002',
			'0003',
			'0004',
			'0005',
			'0006',
			'0007',
			'0008',
			'0009',
			'000a',
			'000b',
		])
	})

	it('waits for each reply before sending the next', async () => {
		const { connection } = await connected()
		fake.replyDelay = 30
		await Promise.all([
			connection.send(runScript('a')),
			connection.send(runScript('b')),
			connection.send(runScript('c')),
		])
		await vi.waitFor(() => expect(fake.received).toHaveLength(4))
		const [, ...sent] = fake.received
		expect(sent[1].at - sent[0].at).toBeGreaterThanOrEqual(25)
		expect(sent[2].at - sent[1].at).toBeGreaterThanOrEqual(25)
	})

	it('sends on after the reply timeout when nothing answers, and keeps the gap when replies are instant', async () => {
		const { connection } = await connected({ timing: { ...TIMING, messageGap: 20 } })
		await Promise.all([connection.send(runScript('a')), connection.send(runScript('b'))])
		fake.answering = false
		await Promise.all([connection.send(runScript('c')), connection.send(runScript('d'))])
		await vi.waitFor(() => expect(fake.received).toHaveLength(5))
		const at = fake.received.map((m) => m.at)
		expect(at[2] - at[1]).toBeGreaterThanOrEqual(15)
		expect(at[4] - at[3]).toBeGreaterThanOrEqual(45)
		expect(at[4] - at[3]).toBeLessThan(150)
	})

	it('drops a request whose signal aborts before its turn', async () => {
		const { connection } = await connected()
		fake.answering = false
		const first = connection.send(runScript('first'))
		const controller = new AbortController()
		const second = connection.send(runScript('second'), controller.signal)
		controller.abort()
		await first
		await expect(second).rejects.toThrow()
		await sleep(100)
		expect(fake.texts().some((text) => text.includes('second'))).toBe(false)
	})

	it('rejects requests still queued when the connection closes', async () => {
		const { connection } = await connected()
		fake.answering = false
		await connection.send(runScript('first')) // holds the line, waiting for a reply
		const queued = connection.send(runScript('queued'))
		fake.dropConnections()
		await expect(queued).rejects.toThrow()
	})
})

describe('replies', () => {
	it('report an error as the status, until the next OK reply', async () => {
		const { connection, statuses, log } = await connected()
		fake.errors.set('RS', '06')
		await connection.send(runScript('a'))
		await vi.waitFor(() => expect(statuses.at(-1)).toEqual([InstanceStatus.BadConfig, 'Invalid Property']))
		expect(logged(log, 'warn')).toEqual(['Error response to Run Script: Invalid Property'])
		fake.errors.clear()
		await connection.send(runScript('a'))
		await vi.waitFor(() => expect(statuses.at(-1)).toEqual([InstanceStatus.Ok, 'Connected']))
	})

	// The 1.x module threw on a code missing from its table, in the socket's data listener, which ends the process
	it('report an error code the protocol does not list, and carry on', async () => {
		const { connection, statuses, log, scripts } = await connected()
		fake.errors.set('RS', '42')
		await connection.send(runScript('a'))
		await vi.waitFor(() => expect(statuses.at(-1)).toEqual([InstanceStatus.UnknownError, 'Unknown error 42']))
		expect(logged(log, 'error')).toEqual([])
		await connection.send(listScripts())
		await vi.waitFor(() => expect(scripts).toHaveBeenCalledTimes(2))
	})

	it('report error 01 to a request from the MVP, which is no probe', async () => {
		const { connection, statuses } = await connected()
		fake.errors.set('RS', '01')
		await connection.send(runScript('a'))
		await vi.waitFor(() =>
			expect(statuses.at(-1)).toEqual([InstanceStatus.UnknownError, 'Protocol Version Unsupported']),
		)
	})

	// The 1.x module read the base 36 sequence number as base 10, so took 000a, 00b1 and the like to be 0, unprompted
	it('take one numbered as nothing awaits as unknown, base 36 numbers included', async () => {
		const { statuses, log } = await connected()
		fake.broadcast('01000aOK()')
		await vi.waitFor(() => expect(statuses.at(-1)).toEqual([InstanceStatus.UnknownWarning, 'Sequence 000a not found']))
		expect(logged(log, 'info')).toContain('Sequence 000a is not awaiting a reply: 01000aOK()')
	})

	it('take sequence 0000 as unprompted', async () => {
		const { statuses, log } = await connected()
		fake.broadcast('010000OK()')
		await vi.waitFor(() => expect(logged(log, 'debug')).toContain('Reply to unprompted message: 010000OK()'))
		expect(statuses.at(-1)).toEqual([InstanceStatus.Ok, 'Connected'])
	})

	it('warn of another protocol version, or no STX, and change nothing', async () => {
		const { statuses, log } = await connected()
		fake.broadcast('020000OK()')
		fake.broadcastRaw('junk\x03')
		await vi.waitFor(() => expect(logged(log, 'warn')).toHaveLength(2))
		expect(logged(log, 'warn')).toEqual([
			'Unsupported protocol version. Expected 01, received 02: 020000OK()',
			'STX not found, invalid message received: junk',
		])
		expect(statuses.at(-1)).toEqual([InstanceStatus.Ok, 'Connected'])
	})

	it('warn of a List Scripts reply with no list', async () => {
		const { connection, log, scripts } = await connected()
		fake.listProperties = '{ }'
		await connection.send(listScripts())
		await vi.waitFor(() => expect(logged(log, 'warn')).toEqual(['No list in the reply to List Scripts: 010002OK(){ }']))
		expect(scripts).toHaveBeenCalledTimes(1)
	})
})

describe('keepalive', () => {
	it('is sent once nothing else has been for the interval, and not while other requests are', async () => {
		const { connection } = await connected()
		await sleep(TIMING.keepaliveInterval * 2.5)
		expect(fake.commands()).toEqual(['LS', 'LS', 'LS'])
		for (let i = 0; i < 6; i++) {
			await connection.send(runScript('busy'))
			await sleep(TIMING.keepaliveInterval / 2)
		}
		expect(fake.commands().slice(3)).toEqual(['RS', 'RS', 'RS', 'RS', 'RS', 'RS'])
	})

	// The 1.x module started another send loop on every reconnection, and never stopped the old ones
	it('stays at one an interval across reconnections', async () => {
		const { connection } = await connected()
		for (let i = 2; i <= 4; i++) {
			fake.dropConnections()
			await vi.waitFor(() => expect(fake.connections).toBe(i))
			await vi.waitFor(() => expect(connection.isConnected).toBe(true))
		}
		const before = fake.received.length
		await sleep(TIMING.keepaliveInterval * 5 + 50)
		const keepalives = fake.received.slice(before).filter((m) => m.command === 'LS').length
		expect(keepalives).toBeGreaterThanOrEqual(4)
		expect(keepalives).toBeLessThanOrEqual(6)
	})

	it('reconnects when a unit that has answered stops', async () => {
		const { log } = await connected()
		fake.answering = false
		await vi.waitFor(() => expect(fake.connections).toBe(2), { timeout: 2000 })
		expect(logged(log, 'warn')).toEqual([
			expect.stringMatching(/^Nothing received from unit for \d+ ms, reconnecting$/),
		])
	})

	it('does not watch a unit that has never answered', async () => {
		fake.answering = false
		const { connection } = createConnection()
		connection.connect()
		await sleep(TIMING.keepaliveInterval * 5)
		expect(fake.connections).toBe(1)
		expect(fake.commands().length).toBeGreaterThanOrEqual(4)
	})
})

describe('reconnection', () => {
	it('follows the unit closing the connection', async () => {
		const { connection, statuses, log } = await connected()
		fake.dropConnections()
		await vi.waitFor(() => expect(fake.connections).toBe(2))
		await vi.waitFor(() => expect(fake.texts(2)).toEqual(['010002LS(){ }']))
		expect(connection.isConnected).toBe(true)
		expect(statuses.slice(2)).toEqual([
			[InstanceStatus.Disconnected, 'Connection closed by unit'],
			[InstanceStatus.Ok, 'Connected'],
		])
		expect(logged(log, 'warn')).toEqual([`Connection closed by 127.0.0.1:${fake.port}`])
	})

	it('logs an outage at error level once, and keeps the failure as the status', async () => {
		const { connection, log, statuses } = createConnection({ port: await closedPort() })
		connection.connect()
		await sleep(TIMING.reconnectInterval * 5)
		expect(logged(log, 'error')).toHaveLength(1)
		expect(logged(log, 'debug').filter((m) => m.startsWith('Network error')).length).toBeGreaterThanOrEqual(2)
		expect(statuses.map(([status]) => status)).toEqual([InstanceStatus.Connecting, InstanceStatus.ConnectionFailure])
	})

	it('stops for good on destroy', async () => {
		const { connection } = await connected()
		connection.destroy()
		await vi.waitFor(() => expect(fake.openConnections).toBe(0))
		await sleep(TIMING.reconnectInterval * 3)
		expect(fake.connections).toBe(1)
		await expect(connection.send(listScripts())).rejects.toThrow('Not connected')
		expect(() => connection.connect()).toThrow('destroyed')
	})
})
