import {
	Command,
	DURATION_UNITS,
	ETX,
	KEEPALIVE_PROBE_VERSION,
	MAX_DISPLAYS,
	MAX_SEQUENCE,
	MAX_VGPI,
	PROTOCOL_VERSION,
	SEQUENCE_DIGITS,
	SEQUENCE_RADIX,
	STX,
	type DurationUnit,
} from './consts.js'

export interface Property {
	readonly name: string
	/** As sent: quoted if a string */
	readonly value: string
}

/** A command to send. The sequence number is added as it goes, by {@link encode} */
export interface Request {
	readonly version: string
	readonly command: Command
	readonly label: string
	readonly properties: readonly Property[]
}

export interface Duration {
	/** Seconds may be fractional, frames may not */
	readonly value: number
	readonly unit: DurationUnit
}

/** The whole message, sequence number and all, ready for the socket */
export function encode(request: Request, sequence: string): string {
	const properties = request.properties.map(({ name, value }) => ` ${name} = ${value}`).join('')
	return `${STX}${request.version}${sequence}${request.command}(${request.label}){${properties} }${ETX}`
}

/** A message with its STX and ETX made visible, for the log */
export function printable(text: string): string {
	return text.replaceAll(STX, '<STX>').replaceAll(ETX, '<ETX>')
}

/** The sequence number to use after this one. Runs from 1 to {@link MAX_SEQUENCE}, then starts at 1 again */
export function nextSequence(sequence: number): number {
	return sequence >= MAX_SEQUENCE ? 1 : sequence + 1
}

/** A sequence number as it goes on the wire */
export function formatSequence(sequence: number): string {
	return sequence.toString(SEQUENCE_RADIX).padStart(SEQUENCE_DIGITS, '0')
}

function isWhole(value: unknown, min: number, max = Number.MAX_SAFE_INTEGER): value is number {
	return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
}

/**
 * @throws RangeError when the check fails. A message with a bad property is never sent
 */
function check<T>(value: T, valid: (value: unknown) => boolean, what: string): T {
	if (!valid(value)) throw new RangeError(`${String(value)} is not a valid ${what}`)
	return value
}

/** Strings are sent in double quotes. Option values are not always strings at run time, whatever their type says */
function quoted(name: string, value: string): Property {
	return { name, value: `"${String(value)}"` }
}

function bare(name: string, value: number): Property {
	return { name, value: String(value) }
}

function request(command: Command, properties: Property[] = [], label = '', version = PROTOCOL_VERSION): Request {
	return { version, command, label, properties }
}

function checkDisplay(display: number): number {
	return check(display, (value) => isWhole(value, 1, MAX_DISPLAYS), 'display')
}

/** The name of a window on an MVP or NGI display: D, the display as 3 digits, then the window's own name */
export function displayWindow(display: number, window: string): string {
	return `D${String(checkDisplay(display)).padStart(3, '0')}${window}`
}

/** @param display for the MVP. The VIP and NGI take a script alone */
export function runScript(script: string, display?: number): Request {
	const properties = [quoted('script', script)]
	if (display !== undefined) properties.push(bare('display', checkDisplay(display)))
	return request(Command.RunScript, properties)
}

export function changeWindowSource(display: number, window: string, family: string, member: string): Request {
	return request(Command.ChangeWindowSource, [
		quoted('win', displayWindow(display, window)),
		quoted('family', family),
		quoted('member', member),
	])
}

/** @param pair the audio pair, or 0 for none */
export function routeAudio(display: number, window: string, pair: number): Request {
	return request(Command.RouteAudio, [
		quoted('win', displayWindow(display, window)),
		bare(
			'pair',
			check(pair, (value) => isWhole(value, 0), 'audio pair'),
		),
	])
}

/** The VGPI is the label, rather than a property */
export function setVgpi(vgpi: number, on: boolean): Request {
	check(vgpi, (value) => isWhole(value, 1, MAX_VGPI), 'VGPI')
	return request(Command.SetVgpi, [quoted('val', on ? 'on' : 'off')], String(vgpi))
}

export function unassignWindowSource(display: number, window: string): Request {
	return request(Command.UnassignWindowSource, [quoted('win', displayWindow(display, window))])
}

export function runSnapshot(snapshot: string): Request {
	return request(Command.RunSnapshot, [quoted('snapshot', snapshot)])
}

/** Saves a display's layout as a script */
export function saveDisplay(display: number, script: string): Request {
	return request(Command.SaveDisplay, [bare('display', checkDisplay(display)), quoted('script', script)])
}

/** The MVP's keepalive, which also keeps the Run Script action's list of scripts up to date */
export function listScripts(): Request {
	return request(Command.ListScripts)
}

/** The keepalive for any unit other than the MVP. See {@link KEEPALIVE_PROBE_VERSION} */
export function keepaliveProbe(): Request {
	return request(Command.ListScripts, [], '', KEEPALIVE_PROBE_VERSION)
}

export function show(window: string): Request {
	return request(Command.Show, [quoted('win', window)])
}

export function hide(window: string): Request {
	return request(Command.Hide, [quoted('win', window)])
}

function isDurationUnit(value: unknown): value is DurationUnit {
	return (DURATION_UNITS as readonly unknown[]).includes(value)
}

function durationProperty({ value, unit }: Duration): Property {
	check(unit, isDurationUnit, 'duration unit')
	if (unit === 'f') check(value, (v) => isWhole(v, 0), 'number of frames')
	else check(value, (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0, 'number of seconds')
	return quoted('dur', `${value}${unit}`)
}

function position(name: string, value: number, what: string): Property {
	return bare(
		name,
		check(value, (v) => isWhole(v, 0), what),
	)
}

/** Moves an Exhibit window, over the duration */
export function move(window: string, duration: Duration, x: number, y: number): Request {
	return request(Command.Move, [
		quoted('win', window),
		durationProperty(duration),
		position('x', x, 'X position'),
		position('y', y, 'Y position'),
	])
}

/** Resizes an Exhibit window, over the duration */
export function scale(window: string, duration: Duration, width: number, height: number): Request {
	return request(Command.Scale, [
		quoted('win', window),
		durationProperty(duration),
		position('x', width, 'X size'),
		position('y', height, 'Y size'),
	])
}
