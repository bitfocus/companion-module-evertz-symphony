import { EventEmitter } from 'node:events'
import { setTimeout as sleep } from 'node:timers/promises'
import { InstanceStatus, TCPHelper, type LogLevel } from '@companion-module/base'
import PQueue from 'p-queue'
import {
	Command,
	COMMAND_NAMES,
	ErrorCode,
	ERRORS,
	KEEPALIVE_INTERVAL_MS,
	KEEPALIVE_PROBE_VERSION,
	MAX_PENDING,
	MESSAGE_GAP_MS,
	PROTOCOL_VERSION,
	RECONNECT_INTERVAL_MS,
	REPLY_ERROR,
	REPLY_TIMEOUT_MS,
	UNPROMPTED_SEQUENCE,
} from './consts.js'
import { encode, formatSequence, nextSequence, printable, type Request } from './messages.js'
import { FrameReader, parseErrorCode, parseReply, parseScriptList, type Reply } from './replies.js'
import { errorMessage } from '../util.js'

export interface ConnectionTiming {
	/** Least time from sending one message to sending the next */
	messageGap: number
	/** Longest wait for a reply before sending the next message anyway */
	replyTimeout: number
	keepaliveInterval: number
	reconnectInterval: number
}

export const DEFAULT_TIMING: ConnectionTiming = {
	messageGap: MESSAGE_GAP_MS,
	replyTimeout: REPLY_TIMEOUT_MS,
	keepaliveInterval: KEEPALIVE_INTERVAL_MS,
	reconnectInterval: RECONNECT_INTERVAL_MS,
}

/**
 * A unit that has answered the keepalive on this connection, and then sends nothing for this many keepalive intervals, is
 * taken to have gone, and the connection is reopened. A pulled cable or a power cut leaves the socket open, and TCP can
 * take many minutes to notice.
 *
 * Only a unit known to answer is watched. One that never answers the keepalive would otherwise be reconnected every few
 * seconds while idle.
 */
export const WATCHDOG_INTERVALS = 1.5

export interface ConnectionOptions {
	host: string
	port: number
	/** Sent on connecting, and whenever nothing else has been sent for the keepalive interval */
	keepalive: Request
	log: (level: LogLevel, message: string) => void
	/** Defaults to {@link DEFAULT_TIMING}. Tests shorten it */
	timing?: Partial<ConnectionTiming>
}

export interface ConnectionEvents {
	/** A connection has opened. Fires again on every reconnection */
	connected: []
	/** The scripts an MVP has listed, in reply to List Scripts */
	scripts: [scripts: string[]]
	status: [status: InstanceStatus, message: string | null]
}

/** Resolves true if the promise settles within the time, false if not */
async function settlesWithin(promise: Promise<void>, ms: number): Promise<boolean> {
	let timer: NodeJS.Timeout | undefined
	const timeout = new Promise<false>((resolve) => {
		timer = setTimeout(() => resolve(false), ms)
	})
	try {
		return await Promise.race([promise.then(() => true), timeout])
	} finally {
		clearTimeout(timer)
	}
}

function describe(request: Request | undefined): string {
	return request === undefined ? 'unprompted message' : COMMAND_NAMES[request.command]
}

/**
 * The TCP connection to a Symphony unit: framing, sequence numbers, pacing, keepalive and reconnection. Knows nothing of
 * Companion beyond reporting a status for it.
 */
export class SymphonyConnection extends EventEmitter<ConnectionEvents> {
	readonly #options: ConnectionOptions
	readonly #timing: ConnectionTiming
	readonly #queue = new PQueue({ concurrency: 1 })
	readonly #reader = new FrameReader()
	/** The requests sent and not yet answered, by sequence number, oldest first */
	readonly #pending = new Map<string, Request>()
	/** The last sequence number used. It runs on across connections, as the 1.x module's did */
	#sequence = 0
	#socket: TCPHelper | undefined
	/** Exists while a connection is open, and is aborted as it closes, which drops everything queued for it */
	#session: AbortController | undefined
	/** Settles once the unit may be sent the next message */
	#lineClear: Promise<void> = Promise.resolve()
	/** Ends the wait for a reply to the last message sent */
	#replied: (() => void) | undefined
	#keepaliveTimer: NodeJS.Timeout | undefined
	#lastReceived = 0
	#answersKeepalive = false
	/** Set by the first failure of an outage, so retries against a unit that is off don't flood the log */
	#outageLogged = false
	#lastStatus: { status: InstanceStatus; message: string | null } | undefined
	#destroyed = false

	constructor(options: ConnectionOptions) {
		super()
		this.#options = options
		this.#timing = { ...DEFAULT_TIMING, ...options.timing }
	}

	get isConnected(): boolean {
		return this.#session !== undefined
	}

	/** Whether the keepalive is the probe sent to units other than the MVP */
	get #probing(): boolean {
		return this.#options.keepalive.version === KEEPALIVE_PROBE_VERSION
	}

	/** Opens the connection, replacing any already open. After that, TCPHelper reconnects by itself */
	connect(): void {
		if (this.#destroyed) throw new Error('Connection has been destroyed')
		this.#closeSocket()
		const { host, port } = this.#options
		this.#status(InstanceStatus.Connecting, `Connecting to ${host}:${port}`)
		const socket = new TCPHelper(host, port, { reconnect: true, reconnect_interval: this.#timing.reconnectInterval })
		this.#socket = socket
		socket.on('connect', () => this.#open())
		socket.on('data', (chunk) => this.#receive(chunk))
		socket.on('end', () => {
			this.#close()
			this.#status(InstanceStatus.Disconnected, 'Connection closed by unit')
			this.#logOutage('warn', `Connection closed by ${host}:${port}`)
		})
		socket.on('error', (err) => {
			this.#close()
			this.#status(InstanceStatus.ConnectionFailure, err.message)
			this.#logOutage('error', `Network error: ${err.message}`)
		})
	}

	/** Closes the connection for good. Anything still queued is rejected */
	destroy(): void {
		this.#destroyed = true
		this.removeAllListeners()
		this.#closeSocket()
	}

	/**
	 * Queues a request for the unit. Each waits for a reply to the one before, or for the reply timeout
	 * @param signal an action's context.signal. A request whose signal aborts before its turn is never sent
	 * @returns once the request is written to the socket
	 * @throws if there is no connection, or it closes or the signal aborts before the request is sent
	 */
	async send(request: Request, signal?: AbortSignal): Promise<void> {
		const session = this.#session
		if (session === undefined) throw new Error('Not connected to unit')
		// p-queue listens on the combined signal from the moment the job is queued, which makes it pass an abort on
		// eagerly. Only reading .aborted could miss one: AbortSignal.any holds its sources weakly
		const combined = signal ? AbortSignal.any([session.signal, signal]) : session.signal
		await this.#queue.add(async ({ signal: jobSignal }) => this.#transmit(request, jobSignal), { signal: combined })
	}

	async #transmit(request: Request, signal: AbortSignal | undefined): Promise<void> {
		// The wait is here, at the start of a job, rather than at the end of the one before. p-queue starts the next job as
		// soon as a running job's signal aborts, and the unit must still get its gap and its chance to reply
		await this.#lineClear
		signal?.throwIfAborted()
		const socket = this.#socket
		if (!socket?.isConnected) throw new Error('Not connected to unit')
		this.#sequence = nextSequence(this.#sequence)
		const sequence = formatSequence(this.#sequence)
		const text = encode(request, sequence)
		this.#remember(sequence, request)
		this.#holdLine()
		this.#options.log('debug', `Sending ${printable(text)}`)
		try {
			if (!(await socket.sendAsync(text))) throw new Error('Not connected to unit')
		} catch (err) {
			// No reply is coming to a message that never went
			this.#pending.delete(sequence)
			this.#releaseLine()
			throw err
		}
		this.#scheduleKeepalive()
	}

	#remember(sequence: string, request: Request): void {
		// Deleted first, so a sequence number used again after wrapping goes to the back
		this.#pending.delete(sequence)
		this.#pending.set(sequence, request)
		if (this.#pending.size <= MAX_PENDING) return
		const oldest = this.#pending.keys().next()
		if (!oldest.done) this.#pending.delete(oldest.value)
	}

	/** Called just before a message goes, so a reply can't arrive before anything is waiting for it */
	#holdLine(): void {
		const replied = new Promise<void>((resolve) => {
			this.#replied = resolve
		})
		const { messageGap, replyTimeout } = this.#timing
		this.#lineClear = Promise.all([sleep(messageGap), settlesWithin(replied, replyTimeout)]).then(() => undefined)
	}

	#releaseLine(): void {
		this.#replied?.()
		this.#replied = undefined
	}

	#open(): void {
		this.#close()
		const { host, port } = this.#options
		this.#session = new AbortController()
		this.#reader.reset()
		this.#lineClear = Promise.resolve()
		this.#lastReceived = Date.now()
		this.#answersKeepalive = false
		this.#outageLogged = false
		this.#options.log('info', `Connected to ${host}:${port}`)
		this.#status(InstanceStatus.Ok, 'Connected')
		// For the MVP the keepalive lists the scripts, which the Run Script action wants from the start
		this.#sendInBackground(this.#options.keepalive)
		this.emit('connected')
	}

	/** Ends the session, if one is open: everything queued for it is rejected, and its timers stopped */
	#close(): void {
		const session = this.#session
		if (session === undefined) return
		this.#session = undefined
		clearTimeout(this.#keepaliveTimer)
		this.#keepaliveTimer = undefined
		session.abort(new Error('Connection to unit closed'))
		this.#releaseLine()
		this.#lineClear = Promise.resolve()
		this.#reader.reset()
		this.#pending.clear()
	}

	#closeSocket(): void {
		this.#close()
		// TCPHelper's destroy removes its listeners first, so the old socket can't report anything once replaced
		this.#socket?.destroy()
		this.#socket = undefined
	}

	#receive(chunk: Buffer): void {
		this.#lastReceived = Date.now()
		// Anything from the unit shows it is ready for the next message, as the 1.x module had it
		this.#releaseLine()
		const { frames, discarded } = this.#reader.push(chunk)
		if (discarded > 0) this.#options.log('warn', `Discarded ${discarded} bytes with no ETX`)
		for (const frame of frames) {
			try {
				this.#handle(frame)
			} catch (err) {
				// This runs in the socket's data listener, where a throw would end the module's process
				this.#options.log('error', `Could not handle ${printable(frame)}: ${errorMessage(err)}`)
			}
		}
	}

	#handle(frame: string): void {
		const reply = parseReply(frame)
		if (reply === undefined) {
			this.#options.log('warn', `STX not found, invalid message received: ${printable(frame)}`)
			return
		}
		const request = this.#pending.get(reply.sequence)
		this.#pending.delete(reply.sequence)
		if (request === this.#options.keepalive) this.#answersKeepalive = true
		if (request?.version === KEEPALIVE_PROBE_VERSION) {
			this.#options.log('debug', `Keepalive answered: ${reply.text}`)
			return
		}
		if (reply.version !== PROTOCOL_VERSION) {
			this.#options.log(
				'warn',
				`Unsupported protocol version. Expected ${PROTOCOL_VERSION}, received ${reply.version}: ${reply.text}`,
			)
			return
		}
		if (request === undefined && reply.sequence !== UNPROMPTED_SEQUENCE) {
			this.#options.log('info', `Sequence ${reply.sequence} is not awaiting a reply: ${reply.text}`)
			this.#status(InstanceStatus.UnknownWarning, `Sequence ${reply.sequence} not found`)
			return
		}
		if (reply.status === REPLY_ERROR) {
			this.#handleError(reply, request)
			return
		}
		this.#status(InstanceStatus.Ok, 'Connected')
		if (request?.command === Command.ListScripts) {
			const scripts = parseScriptList(reply.properties)
			if (scripts === undefined) {
				this.#options.log('warn', `No list in the reply to List Scripts: ${reply.text}`)
				return
			}
			this.emit('scripts', scripts)
			return
		}
		this.#options.log('debug', `Reply to ${describe(request)}: ${reply.text}`)
	}

	#handleError(reply: Reply, request: Request | undefined): void {
		const code = parseErrorCode(reply.label)
		if (this.#probing && code === ErrorCode.ProtocolVersionUnsupported) {
			// The answer to the probe, whatever its sequence number. The 1.x module ignored any of these from a unit other
			// than the MVP, so one numbered other than as the probe was is taken to be its answer too
			this.#answersKeepalive = true
			this.#options.log('debug', `Keepalive answered: ${reply.text}`)
			return
		}
		const error = code === undefined ? undefined : ERRORS[code]
		const label = error?.label ?? `Unknown error ${reply.label}`
		this.#options.log('warn', `Error response to ${describe(request)}: ${label}`)
		this.#status(error?.status ?? InstanceStatus.UnknownError, label)
	}

	#scheduleKeepalive(): void {
		clearTimeout(this.#keepaliveTimer)
		this.#keepaliveTimer = setTimeout(() => this.#keepalive(), this.#timing.keepaliveInterval)
	}

	#keepalive(): void {
		this.#keepaliveTimer = undefined
		if (this.#session === undefined) return
		const silence = Date.now() - this.#lastReceived
		if (this.#answersKeepalive && silence > this.#timing.keepaliveInterval * WATCHDOG_INTERVALS) {
			this.#options.log('warn', `Nothing received from unit for ${silence} ms, reconnecting`)
			this.connect()
			return
		}
		this.#sendInBackground(this.#options.keepalive)
	}

	/** For requests nothing waits on. Their only failure is the connection closing, which is reported already */
	#sendInBackground(request: Request): void {
		this.send(request).catch((err) => this.#options.log('debug', `${describe(request)} not sent: ${errorMessage(err)}`))
	}

	#status(status: InstanceStatus, message: string | null): void {
		if (this.#lastStatus?.status === status && this.#lastStatus.message === message) return
		this.#lastStatus = { status, message }
		this.emit('status', status, message)
	}

	#logOutage(level: LogLevel, message: string): void {
		this.#options.log(this.#outageLogged ? 'debug' : level, message)
		this.#outageLogged = true
	}
}
