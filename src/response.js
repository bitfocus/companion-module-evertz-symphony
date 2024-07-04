import { InstanceStatus } from '@companion-module/base'
import { command, response, error_codes, STX, proto_version, choices } from './consts.js'
export function processResponse(msg) {
	//this.log('debug', `processResponse ${msg}`)
	if (msg.includes(STX)) {
		let index = msg.search(STX)
		msg = msg.substring(index + 1)
	} else {
		this.log('warn', `STX not found; invalid message recieved : ${msg}`)
		return undefined
	}
	let proto = msg.substring(0, 2)
	let sequence = msg.substring(2, 6)
	let resp = msg.substring(6, 8)
	let label = parseInt(msg.substring(msg.indexOf('(') + 1, msg.indexOf(')')))
	let props = msg.substring(msg.indexOf(`)`) + 1)
	if (proto !== proto_version) {
		this.log('warn', `Unsupported Protocol Version. Expected ${proto_version}, Recieved ${proto}`)
		return undefined
	}
	if (resp === response.error) {
		if (this.config.model !== choices.device[0].id && label == error_codes[1].id) {
			//ignore invalid proto messages from units other than MVP since using proto 99 for KA
		} else {
			this.log('warn', `Error response recieved: ${error_codes[label].label}`)
			this.updateStatus(error_codes[label].status, error_codes[label].label)
		}
		this.log('warn', `Error response recieved: ${error_codes[label].label}`)
		this.updateStatus(error_codes[label].status, error_codes[label].label)
	}
	let type = undefined
	try {
		type = this.mvp.msgStore[sequence].type
		delete this.mvp.msgStore[sequence]
	} catch {
		this.log('info', `Sequence ${sequence} not found in msgStore`)
		this.updateStatus(InstanceStatus.UnknownWarning, `Sequence ${sequence} not found in msgStore`)
		return undefined
	}
	this.log(
		'debug',
		`Message Recieved: Protocol Version ${proto} Sequence Number ${sequence} Response ${resp} Label: ${label} Type ${type} Properties ${props}`
	)
	this.updateStatus(InstanceStatus.Ok)
	let workingVar
	let scripts = []
	let mvpScripts = []
	switch (type) {
		case command.run_script:
			this.log('debug', `Command type Run Scripts`)
			break
		case command.change_window_source:
			this.log('debug', `Command type Change Window Source`)
			break
		case command.route_audio:
			this.log('debug', `Command type Route Audio`)
			break
		case command.set_vgpi:
			this.log('debug', `Command type Set VPGI`)
			break
		case command.unassign_window_source:
			this.log('debug', `Command type Unassign Window Source`)
			break
		case command.run_snapshot:
			this.log('debug', `Command type Run Snapshot`)
			break
		case command.list_scripts:
			this.log('debug', `Command type List Scripts`)
			workingVar = props.substring(props.indexOf('[') + 1, props.indexOf(']')).replaceAll('"', '')
			scripts = workingVar.split(',')
			for (let i = 0; i < scripts.length; i++) {
				mvpScripts[i] = { id: scripts[i], label: scripts[i] }
			}
			if (this.mvp.scripts !== mvpScripts) {
				this.mvp.scripts = mvpScripts
				this.updateActions()
			}
			break
		case command.current_layout:
			this.log('debug', `Command type Current Layout`)
			break
		case command.list_windows:
			this.log('debug', `Command type List Windows`)
			break
		case command.window_geometry:
			this.log('debug', `Command type Window Geometry`)
			break
		case command.window_source:
			this.log('debug', `Command type Window Source`)
			break
		case command.display_listen:
			this.log('debug', `Command type Display Listen`)
			break
		case command.save_display:
			this.log('debug', `Command type Save Display`)
			break
		case command.show:
			this.log('debug', `Command type Show`)
			break
		case command.hide:
			this.log('debug', `Command type Hide`)
			break
		case command.move:
			this.log('debug', `Command type Move`)
			break
		case command.scale:
			this.log('debug', `Command type Scale`)
			break
		default:
			this.log('debug', `Command type not found ${type}`)
	}
}
