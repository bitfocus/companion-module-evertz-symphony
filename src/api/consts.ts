import { InstanceStatus } from '@companion-module/base'

/**
 * Symphony frames each message as STX, a 2 digit protocol version, a 4 character sequence number, a command, a label in
 * brackets and space separated properties in braces, then ETX. A string property is quoted, a number is not:
 *
 *     <STX>010001RS(){ script = "Script1.vssl" display = 1 }<ETX>
 *
 * The unit answers with the same sequence number, and OK or ER in place of the command. An ER reply has the error code
 * as its label:
 *
 *     <STX>010001ER(04)<ETX>
 *
 * There is no protocol document or device capture to hand. These are the formats the 1.x module sent and parsed, which
 * it was tested against an MVP with.
 */
export const STX = '\x02'
export const ETX = '\x03'

export const PROTOCOL_VERSION = '01'

/**
 * Only the MVP has a command that is answered and changes nothing, List Scripts. Other units are sent it with this
 * protocol version instead, as their keepalive, and answer it with {@link ErrorCode.ProtocolVersionUnsupported}.
 */
export const KEEPALIVE_PROBE_VERSION = '99'

/** The sequence number of a message the unit sends unprompted */
export const UNPROMPTED_SEQUENCE = '0000'

/** Sequence numbers are 4 base 36 digits. 0 is kept for unprompted messages, so they run from 1 to zzzz */
export const SEQUENCE_DIGITS = 4
export const SEQUENCE_RADIX = 36
export const MAX_SEQUENCE = SEQUENCE_RADIX ** SEQUENCE_DIGITS - 1

export const DEFAULT_PORT = 9750

/** Displays are numbered with 3 digits in a window's name */
export const MAX_DISPLAYS = 999

export const MAX_VGPI = 320

/** Least time from sending one message to sending the next */
export const MESSAGE_GAP_MS = 5

/** Longest wait for a reply before sending the next message anyway */
export const REPLY_TIMEOUT_MS = 250

/** The keepalive is sent once nothing else has been for this long */
export const KEEPALIVE_INTERVAL_MS = 5000

/** Matches TCPHelper's own default */
export const RECONNECT_INTERVAL_MS = 2000

/**
 * A frame still without its ETX at this length is not one, and is dropped. Far longer than any reply should be: a list of
 * scripts is the longest, and the protocol gives no limit to it
 */
export const MAX_FRAME_LENGTH = 1024 * 1024

/**
 * Requests kept waiting for their reply, so it can be told what it answers. A unit that never replies would otherwise
 * grow the list by a keepalive every 5 seconds. Past this the oldest are forgotten.
 */
export const MAX_PENDING = 1000

/**
 * The commands this module sends. The protocol has more, for querying layouts and windows, that it does not use.
 * Commands marked MVP 2.13 and later need that firmware or later.
 */
export enum Command {
	/** MVP, VIP and NGI */
	RunScript = 'RS',
	/** MVP and NGI */
	ChangeWindowSource = 'CS',
	/** MVP */
	RouteAudio = 'RA',
	/** MVP */
	SetVgpi = 'VGPI',
	/** MVP */
	UnassignWindowSource = 'US',
	/** MVP 2.13 and later */
	RunSnapshot = 'SN',
	/** MVP 2.13 and later */
	ListScripts = 'LS',
	/** MVP 2.17 and later */
	SaveDisplay = 'SD',
	/** Exhibit */
	Show = 'SHOW',
	/** Exhibit */
	Hide = 'HIDE',
	/** Exhibit */
	Move = 'MOVE',
	/** Exhibit */
	Scale = 'SCALE',
}

/** For the log */
export const COMMAND_NAMES: Record<Command, string> = {
	[Command.RunScript]: 'Run Script',
	[Command.ChangeWindowSource]: 'Change Window Source',
	[Command.RouteAudio]: 'Route Audio',
	[Command.SetVgpi]: 'Set VGPI',
	[Command.UnassignWindowSource]: 'Unassign Window Source',
	[Command.RunSnapshot]: 'Run Snapshot',
	[Command.ListScripts]: 'List Scripts',
	[Command.SaveDisplay]: 'Save Display',
	[Command.Show]: 'Show',
	[Command.Hide]: 'Hide',
	[Command.Move]: 'Move',
	[Command.Scale]: 'Scale',
}

/** What a reply has in place of the command, when the command worked */
export const REPLY_OK = 'OK'

/** What a reply has in place of the command, when it failed. Anything not this is taken as OK, as the 1.x module did */
export const REPLY_ERROR = 'ER'

/** The label of an {@link REPLY_ERROR} reply */
export enum ErrorCode {
	ProtocolVersionUnsupported = 1,
	CommandTooLong = 2,
	InternalError = 3,
	SyntaxError = 4,
	InvalidCommand = 5,
	InvalidProperty = 6,
	DuplicateArgument = 7,
	MissingArgument = 8,
	PropertyTypeError = 9,
	PropertyValueTooLong = 10,
	SystemError = 11,
}

/** What each error is called, and the status it gives the connection until the next OK reply */
export const ERRORS: Record<ErrorCode, { label: string; status: InstanceStatus }> = {
	[ErrorCode.ProtocolVersionUnsupported]: {
		label: 'Protocol Version Unsupported',
		status: InstanceStatus.UnknownError,
	},
	[ErrorCode.CommandTooLong]: { label: 'Command Too Long', status: InstanceStatus.UnknownError },
	[ErrorCode.InternalError]: { label: 'Internal Error', status: InstanceStatus.UnknownError },
	[ErrorCode.SyntaxError]: { label: 'Syntax Error', status: InstanceStatus.UnknownError },
	[ErrorCode.InvalidCommand]: { label: 'Invalid Command', status: InstanceStatus.UnknownWarning },
	[ErrorCode.InvalidProperty]: { label: 'Invalid Property', status: InstanceStatus.BadConfig },
	[ErrorCode.DuplicateArgument]: { label: 'Duplicate Argument', status: InstanceStatus.BadConfig },
	[ErrorCode.MissingArgument]: { label: 'Missing Argument', status: InstanceStatus.UnknownWarning },
	[ErrorCode.PropertyTypeError]: { label: 'Property Type Error', status: InstanceStatus.BadConfig },
	[ErrorCode.PropertyValueTooLong]: { label: 'Property Value Too Long', status: InstanceStatus.BadConfig },
	[ErrorCode.SystemError]: { label: 'System Error', status: InstanceStatus.UnknownError },
}

/** Units for the duration of an Exhibit move or scale */
export const DURATION_UNITS = ['s', 'f'] as const
export type DurationUnit = (typeof DURATION_UNITS)[number]
