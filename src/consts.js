export const proto_version = '01'
export const default_port = 9750
export const msg_delay = 5
export const keep_alive = 30000

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
    0: { id: '10', label: 'Property Value Too Long' },
    1: { id: '11', label: 'System Error' },
}

export const response = {
    ok: 'OK',
    error: 'ER',
}

export const command = {
    run_script: 'RS',
    change_window_source: 'CS',
    route_audio: 'RA',
    set_vgpi: 'VGPI',
    unassign_window_source: 'US',
    run_snapshot: 'SN', //2.13.0 or greater
    list_scripts: 'LS', //2.13.0 or greater
    current_layout: 'CL', //2.13.0 or greater
    list_windows: 'LW',
    window_geometry: 'WG',
    window_source: 'WS',
    display_listen: 'DL',
    save_display: 'SD',
}