import { describe, expect, it } from 'vitest'
import { ErrorCode, FrameReader, MAX_FRAME_LENGTH, parseErrorCode, parseReply, parseScriptList } from '../api/index.js'

describe('parseReply', () => {
	it('reads an OK reply', () => {
		expect(parseReply('\x02010001OK()')).toEqual({
			text: '010001OK()',
			version: '01',
			sequence: '0001',
			status: 'OK',
			label: '',
			properties: '',
		})
	})

	it('reads an error reply, with its code as the label', () => {
		expect(parseReply('\x0201000aER(04)')).toMatchObject({ sequence: '000a', status: 'ER', label: '04' })
	})

	it('reads the properties after the label', () => {
		expect(parseReply('\x02010002OK(){ scripts = ["a","b"] }')?.properties).toBe('{ scripts = ["a","b"] }')
	})

	it('skips anything before STX', () => {
		expect(parseReply('\r\nxx\x02990003ER(01)')).toMatchObject({ version: '99', sequence: '0003', label: '01' })
	})

	it('gives no label or properties without brackets', () => {
		expect(parseReply('\x02010004OK')).toMatchObject({ status: 'OK', label: '', properties: '' })
	})

	it('is undefined without STX', () => {
		expect(parseReply('010001OK()')).toBeUndefined()
	})
})

describe('parseErrorCode', () => {
	it.each([
		['01', ErrorCode.ProtocolVersionUnsupported],
		['04', ErrorCode.SyntaxError],
		['11', ErrorCode.SystemError],
		['6', ErrorCode.InvalidProperty],
	])('%s is %i', (label, code) => {
		expect(parseErrorCode(label)).toBe(code)
	})

	it.each(['', '00', '12', '42', 'xx'])('%j is not a code the protocol lists', (label) => {
		expect(parseErrorCode(label)).toBeUndefined()
	})
})

describe('parseScriptList', () => {
	it('reads the quoted names', () => {
		expect(parseScriptList('{ scripts = ["Script1.vssl","Script 2.vssl"] }')).toEqual(['Script1.vssl', 'Script 2.vssl'])
	})

	// The 1.x module made an empty list into one script with no name
	it('reads an empty list as no scripts', () => {
		expect(parseScriptList('{ scripts = [] }')).toEqual([])
	})

	it('is undefined without square brackets', () => {
		expect(parseScriptList('{ }')).toBeUndefined()
		expect(parseScriptList('{ scripts = [ }')).toBeUndefined()
	})
})

describe('FrameReader', () => {
	it('splits frames at ETX, keeping what follows the last', () => {
		const reader = new FrameReader()
		expect(reader.push(Buffer.from('\x02a\x03\x02b\x03\x02c'))).toEqual({ frames: ['\x02a', '\x02b'], discarded: 0 })
		expect(reader.push(Buffer.from('d\x03'))).toEqual({ frames: ['\x02cd'], discarded: 0 })
	})

	// The 1.x module decoded each chunk on its own, so a character split between two became two replacement characters
	it('reads a character split across chunks', () => {
		const reader = new FrameReader()
		const bytes = Buffer.from('\x02é\x03')
		expect(reader.push(bytes.subarray(0, 2)).frames).toEqual([])
		expect(reader.push(bytes.subarray(2)).frames).toEqual(['\x02é'])
	})

	it('discards a frame that runs past the limit with no ETX, and carries on', () => {
		const reader = new FrameReader()
		expect(reader.push(Buffer.alloc(MAX_FRAME_LENGTH + 1, 'a'))).toEqual({
			frames: [],
			discarded: MAX_FRAME_LENGTH + 1,
		})
		expect(reader.push(Buffer.from('\x02b\x03')).frames).toEqual(['\x02b'])
	})

	it('forgets a partial frame on reset', () => {
		const reader = new FrameReader()
		reader.push(Buffer.from('\x02part'))
		reader.reset()
		expect(reader.push(Buffer.from('\x02b\x03')).frames).toEqual(['\x02b'])
	})
})
