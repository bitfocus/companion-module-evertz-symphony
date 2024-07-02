export const proto_version = '01'
export const default_port = 9750
export const msg_delay = 5
export const keep_alive_timeout = 5000
export const clearToTx_timeout = 250

export const SOM = '\x02'
export const EOM = '\x03'

export const error_codes = {
    1: { id: '01', label: 'Protocol Version Unsupported' },
    2: { id: '02', label: 'Command Too Long' },
    3: { id: '03', label: 'Internal Error' },
    4: { id: '04', label: 'Syntax Error' },
    5: { id: '05', label: 'Invalid Command' },
    6: { id: '06', label: 'Invalid Property' },
    7: { id: '07', label: 'Duplicate Argument' },
    8: { id: '08', label: 'Missing Argument' },
    9: { id: '09', label: 'Property Type Error' },
    10: { id: '10', label: 'Property Value Too Long' },
    11: { id: '11', label: 'System Error' },
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
		{ id: 'exhibit', label: 'Exhibit' }
	],
	duration: [
		{id: 's', label: 'Seconds'},
		{id: 'f', label: 'Frames'}
	]
}