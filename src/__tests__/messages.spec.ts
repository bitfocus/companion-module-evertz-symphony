import { describe, expect, it } from 'vitest'
import {
	changeWindowSource,
	displayWindow,
	encode,
	formatSequence,
	hide,
	keepaliveProbe,
	listScripts,
	MAX_SEQUENCE,
	move,
	nextSequence,
	printable,
	routeAudio,
	runScript,
	runSnapshot,
	saveDisplay,
	scale,
	setVgpi,
	show,
	unassignWindowSource,
	type Duration,
} from '../api/index.js'

/**
 * Each message as the 1.x module built it, written out by hand from its sendCommand: STX, protocol version, sequence
 * number, command, label in brackets, then each property as ` name = value` in braces, a space before the closing brace
 */
const wire = (text: string) => `\x02${text}\x03`

describe('encode', () => {
	it.each([
		[runScript('Script1.vssl', 2), '010001RS(){ script = "Script1.vssl" display = 2 }'],
		[runScript('script1.vssl'), '010001RS(){ script = "script1.vssl" }'],
		[
			changeWindowSource(3, 'window', 'IC1', 'BNC_A'),
			'010001CS(){ win = "D003window" family = "IC1" member = "BNC_A" }',
		],
		[routeAudio(12, 'Main', 4), '010001RA(){ win = "D012Main" pair = 4 }'],
		[routeAudio(1, 'Main', 0), '010001RA(){ win = "D001Main" pair = 0 }'],
		[setVgpi(5, true), '010001VGPI(5){ val = "on" }'],
		[setVgpi(320, false), '010001VGPI(320){ val = "off" }'],
		[unassignWindowSource(999, 'w'), '010001US(){ win = "D999w" }'],
		[runSnapshot('Snap 1'), '010001SN(){ snapshot = "Snap 1" }'],
		[saveDisplay(1, 'Script1.vssl'), '010001SD(){ display = 1 script = "Script1.vssl" }'],
		[listScripts(), '010001LS(){ }'],
		[keepaliveProbe(), '990001LS(){ }'],
		[hide('w1'), '010001HIDE(){ win = "w1" }'],
		[move('w1', { value: 1.5, unit: 's' }, 100, 340), '010001MOVE(){ win = "w1" dur = "1.5s" x = 100 y = 340 }'],
		[scale('w1', { value: 25, unit: 'f' }, 640, 360), '010001SCALE(){ win = "w1" dur = "25f" x = 640 y = 360 }'],
	])('%o', (request, text) => {
		expect(encode(request, '0001')).toBe(wire(text))
	})

	// The 1.x module left the protocol version off Show, so sent "undefined" in its place
	it('puts the protocol version on Show', () => {
		expect(encode(show('w1'), '0001')).toBe(wire('010001SHOW(){ win = "w1" }'))
	})

	it('quotes a string property even when the value is not a string at run time', () => {
		expect(encode(runScript(42 as unknown as string), '0001')).toBe(wire('010001RS(){ script = "42" }'))
	})

	it('puts the sequence number after the protocol version', () => {
		expect(encode(listScripts(), 'zzzz')).toBe(wire('01zzzzLS(){ }'))
	})
})

describe('sequence numbers', () => {
	it.each([
		[1, '0001'],
		[9, '0009'],
		[10, '000a'],
		[35, '000z'],
		[36, '0010'],
		[MAX_SEQUENCE, 'zzzz'],
	])('%i is %s', (sequence, text) => {
		expect(formatSequence(sequence)).toBe(text)
	})

	it('start at 1 and wrap to 1, as 0 is kept for unprompted messages', () => {
		expect(nextSequence(0)).toBe(1)
		expect(nextSequence(1)).toBe(2)
		expect(nextSequence(MAX_SEQUENCE)).toBe(1)
	})
})

describe('refusals', () => {
	const seconds = (value: number): Duration => ({ value, unit: 's' })
	it.each([
		['a display of 0', () => runScript('s', 0), /0 is not a valid display/],
		['a display past 999', () => displayWindow(1000, 'w'), /1000 is not a valid display/],
		['a fractional display', () => saveDisplay(1.5, 's'), /1.5 is not a valid display/],
		['a negative audio pair', () => routeAudio(1, 'w', -1), /-1 is not a valid audio pair/],
		['a fractional audio pair', () => routeAudio(1, 'w', 1.5), /1.5 is not a valid audio pair/],
		['VGPI 0', () => setVgpi(0, true), /0 is not a valid VGPI/],
		['VGPI 321', () => setVgpi(321, true), /321 is not a valid VGPI/],
		['negative seconds', () => move('w', seconds(-1), 0, 0), /-1 is not a valid number of seconds/],
		['infinite seconds', () => move('w', seconds(Infinity), 0, 0), /Infinity is not a valid number of seconds/],
		['fractional frames', () => move('w', { value: 2.5, unit: 'f' }, 0, 0), /2.5 is not a valid number of frames/],
		['a unit that is neither', () => move('w', { value: 1, unit: 'x' as 's' }, 0, 0), /x is not a valid duration unit/],
		['a negative position', () => move('w', seconds(1), -1, 0), /-1 is not a valid X position/],
		['a fractional size', () => scale('w', seconds(1), 1, 2.5), /2.5 is not a valid Y size/],
	])('%s', (_what, build, error) => {
		expect(build).toThrow(RangeError)
		expect(build).toThrow(error)
	})

	it('allows fractional seconds, and none', () => {
		expect(() => move('w', seconds(0.25), 0, 0)).not.toThrow()
		expect(() => move('w', { value: 0, unit: 'f' }, 0, 0)).not.toThrow()
	})
})

describe('printable', () => {
	it('shows STX and ETX', () => {
		expect(printable('\x0201LS\x03')).toBe('<STX>01LS<ETX>')
	})
})
