import { createServer, type Server, type Socket } from 'node:net'

const STX = '\x02'
const ETX = '\x03'

/** A message as the fake unit received it */
export interface Received {
	/** performance.now() on arrival */
	at: number
	/** Which connection it came on, from 1 */
	connection: number
	/** From just after STX to just before ETX */
	text: string
	version: string
	sequence: string
	command: string
}

/**
 * A Symphony unit on a loopback TCP port, for the module to connect to.
 *
 * There is no protocol document or device capture to work from. The replies are in the formats the 1.x module parsed,
 * which it was tested against an MVP with: OK or ER and the request's sequence number, an error code as an ER reply's
 * label, and List Scripts' answer as quoted, comma separated names in square brackets. A request with a protocol version
 * other than 01 is answered with error 01, as the 1.x module expected of units other than the MVP. Everything here is
 * written out by hand rather than taken from the module under test.
 */
export class FakeSymphony {
	readonly received: Received[] = []
	port = 0
	/** Connections accepted so far */
	connections = 0
	/** Delay before each reply */
	replyDelay = 0
	/** Off, the socket stays open but nothing is answered, as when the unit hangs or a cable is pulled mid-path */
	answering = true
	/** Listed in reply to List Scripts */
	scripts = ['Script1.vssl', 'Script2.vssl']
	/** Set to reply to List Scripts with these properties in place of the list */
	listProperties: string | undefined
	/** Commands answered with an error, and the code each is answered with */
	readonly errors = new Map<string, string>()
	/** The protocol version of the reply to a request with one other than 01 */
	probeReplyVersion = '01'
	readonly #server: Server
	readonly #sockets = new Set<Socket>()
	readonly #buffers = new Map<Socket, string>()
	readonly #timers = new Set<NodeJS.Timeout>()

	constructor() {
		this.#server = createServer((socket) => {
			this.connections++
			const connection = this.connections
			this.#sockets.add(socket)
			this.#buffers.set(socket, '')
			socket.on('data', (chunk: Buffer) => this.#onData(socket, connection, chunk))
			socket.on('close', () => {
				this.#sockets.delete(socket)
				this.#buffers.delete(socket)
			})
			socket.on('error', () => {})
		})
	}

	async listen(port = 0): Promise<void> {
		await new Promise<void>((resolve) => this.#server.listen(port, '127.0.0.1', resolve))
		const address = this.#server.address()
		if (!address || typeof address === 'string') throw new Error('fake unit did not get a port')
		this.port = address.port
	}

	async close(): Promise<void> {
		for (const timer of this.#timers) clearTimeout(timer)
		this.dropConnections()
		await new Promise<void>((resolve) => this.#server.close(() => resolve()))
	}

	get openConnections(): number {
		return this.#sockets.size
	}

	/** Closes every connection from the unit's end */
	dropConnections(): void {
		for (const socket of this.#sockets) socket.destroy()
	}

	/** Writes to every connection, as is */
	broadcastRaw(data: string | Uint8Array): void {
		for (const socket of this.#sockets) socket.write(data)
	}

	/** Writes a message, between STX and ETX, to every connection */
	broadcast(text: string): void {
		this.broadcastRaw(STX + text + ETX)
	}

	/** The text of every message received, optionally only those on one connection */
	texts(connection?: number): string[] {
		return this.received.filter((m) => connection === undefined || m.connection === connection).map((m) => m.text)
	}

	/** The commands received, in order, optionally only those on one connection */
	commands(connection?: number): string[] {
		return this.received.filter((m) => connection === undefined || m.connection === connection).map((m) => m.command)
	}

	#onData(socket: Socket, connection: number, chunk: Buffer): void {
		let buffer = (this.#buffers.get(socket) ?? '') + chunk.toString('utf8')
		let end: number
		while ((end = buffer.indexOf(ETX)) !== -1) {
			const frame = buffer.slice(0, end)
			buffer = buffer.slice(end + 1)
			const start = frame.indexOf(STX)
			if (start === -1) continue
			const text = frame.slice(start + 1)
			const message: Received = {
				at: performance.now(),
				connection,
				text,
				version: text.slice(0, 2),
				sequence: text.slice(2, 6),
				command: text.slice(6, text.indexOf('(')),
			}
			this.received.push(message)
			this.#answer(socket, message)
		}
		this.#buffers.set(socket, buffer)
	}

	#answer(socket: Socket, { version, sequence, command }: Received): void {
		if (!this.answering) return
		let reply: string
		if (version !== '01') {
			reply = `${this.probeReplyVersion}${sequence}ER(01)`
		} else if (this.errors.has(command)) {
			reply = `01${sequence}ER(${this.errors.get(command)})`
		} else if (command === 'LS') {
			const list = `{ scripts = [${this.scripts.map((script) => `"${script}"`).join(',')}] }`
			reply = `01${sequence}OK()${this.listProperties ?? list}`
		} else {
			reply = `01${sequence}OK()`
		}
		const send = () => {
			if (!socket.destroyed) socket.write(STX + reply + ETX)
		}
		if (this.replyDelay === 0) {
			send()
			return
		}
		const timer = setTimeout(() => {
			this.#timers.delete(timer)
			send()
		}, this.replyDelay)
		this.#timers.add(timer)
	}
}

/** A port nothing is listening on */
export async function closedPort(): Promise<number> {
	const unit = new FakeSymphony()
	await unit.listen()
	const { port } = unit
	await unit.close()
	return port
}
