import { ErrorCode, ETX, MAX_FRAME_LENGTH, STX } from './consts.js'

/** A message from the unit, split into its parts without judging them */
export interface Reply {
	/** The message from just after STX on, for the log */
	readonly text: string
	readonly version: string
	readonly sequence: string
	/** OK or ER, or whatever the unit sends in their place */
	readonly status: string
	/** Between the first pair of brackets: the error code of an ER reply. Empty if there are none */
	readonly label: string
	/** Everything after the label's closing bracket. Empty if there is none */
	readonly properties: string
}

/**
 * Splits a frame, less its ETX, into its parts, in the positions the 1.x module read them from
 * @returns undefined for a frame with no STX
 */
export function parseReply(frame: string): Reply | undefined {
	const start = frame.indexOf(STX)
	if (start === -1) return undefined
	const text = frame.slice(start + STX.length)
	const open = text.indexOf('(')
	const close = open === -1 ? -1 : text.indexOf(')', open + 1)
	return {
		text,
		version: text.slice(0, 2),
		sequence: text.slice(2, 6),
		status: text.slice(6, 8),
		label: close === -1 ? '' : text.slice(open + 1, close),
		properties: close === -1 ? '' : text.slice(close + 1),
	}
}

function isErrorCode(value: number): value is ErrorCode {
	return Object.values(ErrorCode).includes(value)
}

/** @returns undefined for a label that is not one of the codes the protocol lists */
export function parseErrorCode(label: string): ErrorCode | undefined {
	const code = Number.parseInt(label, 10)
	return isErrorCode(code) ? code : undefined
}

/**
 * The script names in the reply to List Scripts: the quoted, comma separated names between square brackets
 * @returns undefined if there are no square brackets
 */
export function parseScriptList(properties: string): string[] | undefined {
	const open = properties.indexOf('[')
	const close = properties.indexOf(']', open + 1)
	if (open === -1 || close === -1) return undefined
	return properties
		.slice(open + 1, close)
		.replaceAll('"', '')
		.split(',')
		.filter((name) => name !== '')
}

const ETX_BYTE = ETX.charCodeAt(0)

/**
 * Splits what arrives from the unit into frames at each ETX. A frame is decoded only once it is whole, so a character
 * split across two chunks is read correctly.
 */
export class FrameReader {
	#pending = Buffer.alloc(0)

	/**
	 * @returns each whole frame, less its ETX, and the number of bytes thrown away because a frame ran past
	 * {@link MAX_FRAME_LENGTH} without one
	 */
	push(chunk: Buffer): { frames: string[]; discarded: number } {
		const buffer = this.#pending.length > 0 ? Buffer.concat([this.#pending, chunk]) : chunk
		const frames: string[] = []
		let start = 0
		let end: number
		while ((end = buffer.indexOf(ETX_BYTE, start)) !== -1) {
			frames.push(buffer.toString('utf8', start, end))
			start = end + 1
		}
		const rest = buffer.subarray(start)
		if (rest.length > MAX_FRAME_LENGTH) {
			this.#pending = Buffer.alloc(0)
			return { frames, discarded: rest.length }
		}
		// A copy, so the chunk it came from isn't kept alive
		this.#pending = Buffer.from(rest)
		return { frames, discarded: 0 }
	}

	reset(): void {
		this.#pending = Buffer.alloc(0)
	}
}
