import { Regex, InstanceStatus } from '@companion-module/base'

export const proto_version = '01'
export const default_port = 9750
export const msg_delay = 5
export const keep_alive_timeout = 5000
export const clearToTx_timeout = 250

export const STX = '\x02'
export const ETX = '\x03'

export const error_codes = {
	1: { id: '01', label: 'Protocol Version Unsupported', status: InstanceStatus.UnknownError },
	2: { id: '02', label: 'Command Too Long', status: InstanceStatus.UnknownError },
	3: { id: '03', label: 'Internal Error', status: InstanceStatus.UnknownError },
	4: { id: '04', label: 'Syntax Error', status: InstanceStatus.UnknownError },
	5: { id: '05', label: 'Invalid Command', status: InstanceStatus.UnknownWarning },
	6: { id: '06', label: 'Invalid Property', status: InstanceStatus.BadConfig },
	7: { id: '07', label: 'Duplicate Argument', status: InstanceStatus.BadConfig },
	8: { id: '08', label: 'Missing Argument', status: InstanceStatus.UnknownWarning },
	9: { id: '09', label: 'Property Type Error', status: InstanceStatus.BadConfig },
	10: { id: '10', label: 'Property Value Too Long', status: InstanceStatus.BadConfig },
	11: { id: '11', label: 'System Error', status: InstanceStatus.UnknownError },
}

export const response = {
	ok: 'OK',
	error: 'ER',
}

export const command = {
	run_script: 'RS', //mvp, vip, ngi
	change_window_source: 'CS', //mvp, ngi
	route_audio: 'RA', //mvp
	set_vgpi: 'VGPI', //mvp
	unassign_window_source: 'US', //mvp
	run_snapshot: 'SN', //mvp fw 2.13.0 or greater
	list_scripts: 'LS', //mvp fw 2.13.0 or greater
	current_layout: 'CL', //mvp fw 2.13.0 or greater
	list_windows: 'LW', //mvp fw 2.13.0 or greater
	window_geometry: 'WG', //mvp fw 2.13.0 or greater
	window_source: 'WS', //mvp fw 2.15.0 or greater
	display_listen: 'DL', //mvp fw 2.15.0 or greater
	display_listen_resp: 'DC', //mvp fw 2.15.0 or greater...POSSIBLY A TYPO IN EVERTZ DOCS? Unable to test.
	save_display: 'SD', //mvp fw 2.17.0 or greater
	show: 'SHOW', //exhibit
	hide: 'HIDE', //exhibit
	move: 'MOVE', //exhibit
	scale: 'SCALE', //exhibit
}

export const choices = {
	device: [
		{ id: 'mvp', label: 'MVP' },
		{ id: 'vip', label: 'VIP' },
		{ id: 'ngi', label: 'NGI' },
		{ id: 'exhibit', label: 'Exhibit' },
	],
	duration: [
		{ id: 's', label: 'Seconds' },
		{ id: 'f', label: 'Frames' },
	],
}

export const actionOptions = {
	runSciptMVP: {
		script: {
			id: 'script',
			type: 'dropdown',
			label: 'Script',
			allowCustom: true,
			regex: Regex.SOMETHING,
		},
		display: {
			id: 'display',
			type: 'textinput',
			label: 'Display',
			default: '1',
			useVariables: { local: true },
			regex: Regex.SOMETHING,
		},
	},
	routeAudio: {
		display: {
			id: 'display',
			type: 'textinput',
			label: 'Display',
			default: '1',
			useVariables: { local: true },
			regex: Regex.SOMETHING,
		},
		window: {
			id: 'window',
			type: 'textinput',
			label: 'Window Name',
			default: 'window',
			useVariables: { local: true },
			regex: Regex.SOMETHING,
		},
		pair: {
			id: 'pair',
			type: 'textinput',
			label: 'Pair',
			default: '1',
			useVariables: { local: true },
			tooltip: 'Return audio pair number, set to 0 to turn off',
			regex: Regex.SOMETHING,
		},
	},
	setVGPI: {
		vgpi: {
			id: 'vgpi',
			type: 'textinput',
			label: 'VGPI',
			default: '1',
			useVariables: { local: true },
			tooltip: `Return an integer between 1 and 320`,
			regex: Regex.SOMETHING,
		},
		state: {
			id: 'state',
			type: 'checkbox',
			label: 'State',
			default: true,
		},
	},
	unassignWindow: {
		display: {
			id: 'display',
			type: 'textinput',
			label: 'Display',
			default: '1',
			useVariables: { local: true },
			regex: Regex.SOMETHING,
		},
		window: {
			id: 'window',
			type: 'textinput',
			label: 'Window Name',
			default: 'window',
			useVariables: { local: true },
			regex: Regex.SOMETHING,
		},
	},
	runSnapshot: {
		snapshot: {
			id: 'snapshot',
			type: 'textinput',
			label: 'Snapshot',
			default: '',
			useVariables: { local: true },
			regex: Regex.SOMETHING,
		},
		info: {
			id: 'info',
			type: 'static-text',
			label: 'Note',
			value: 'Requires MVP software 2.13.0 or greater',
		},
	},
	saveDisplay: {
		script: {
			id: 'script',
			type: 'textinput',
			label: 'Script',
			useVariables: { local: true },
			default: 'Script1.vssl',
			regex: Regex.SOMETHING,
		},
		display: {
			id: 'display',
			type: 'textinput',
			label: 'Display',
			default: '1',
			useVariables: { local: true },
			regex: Regex.SOMETHING,
		},
		info: {
			id: 'info',
			type: 'static-text',
			label: 'Note',
			value: 'Requires MVP software 2.17.0 or greater',
		},
	},
	runScriptVIP: {
		script: {
			id: 'script',
			type: 'textinput',
			label: 'Script',
			default: 'script1.vssl',
			useVariables: { local: true },
			regex: Regex.SOMETHING,
		},
	},
	changeWindowSource: {
		display: {
			id: 'display',
			type: 'textinput',
			label: 'Display',
			default: '1',
			useVariables: { local: true },
			regex: Regex.SOMETHING,
		},
		window: {
			id: 'window',
			type: 'textinput',
			label: 'Window Name',
			default: 'window',
			useVariables: { local: true },
			regex: Regex.SOMETHING,
		},
		family: {
			id: 'family',
			type: 'textinput',
			label: 'Family Name',
			default: 'IC1',
			useVariables: { local: true },
			regex: Regex.SOMETHING,
		},
		member: {
			id: 'member',
			type: 'textinput',
			label: 'Member Name',
			default: 'BNC_A',
			useVariables: { local: true },
			regex: Regex.SOMETHING,
		},
	},
	show: {
		window: {
			id: 'window',
			type: 'textinput',
			label: 'Window Name',
			default: 'window',
			useVariables: { local: true },
			regex: Regex.SOMETHING,
		},
	},
	move: {
		duration: {
			id: 'duration',
			type: 'textinput',
			label: 'Duration',
			default: '1',
			useVariables: { local: true },
			regex: Regex.SOMETHING,
		},
		units: {
			id: 'units',
			type: 'dropdown',
			label: 'Units',
			default: choices.duration[0].id,
			choices: choices.duration,
			regex: Regex.SOMETHING,
		},
		xPos: {
			id: 'xPos',
			type: 'textinput',
			label: 'X Position',
			default: '100',
			useVariables: { local: true },
			regex: Regex.SOMETHING,
		},
		yPos: {
			id: 'yPos',
			type: 'textinput',
			label: 'Y Position',
			default: '340',
			useVariables: { local: true },
			regex: Regex.SOMETHING,
		},
	},
	scale: {
		xSize: {
			id: 'xSize',
			type: 'textinput',
			label: 'X Size',
			default: '100',
			useVariables: { local: true },
			regex: Regex.SOMETHING,
		},
		ySize: {
			id: 'ySize',
			type: 'textinput',
			label: 'Y Size',
			default: '340',
			useVariables: { local: true },
			regex: Regex.SOMETHING,
		},
	},
}
