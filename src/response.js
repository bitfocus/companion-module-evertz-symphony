import { InstanceStatus } from '@companion-module/base'
import { command, response, error_codes, SOM, proto_version } from './consts.js'
export function processResponse(msg) {
	//this.log('debug', `processResponse ${msg}`)
	if (msg.includes(SOM)) {
		let index = msg.search(SOM)
		msg = msg.substring(index + 1)
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
		this.log('warn', `Error response recieved: ${error_codes[label].label}`)
		this.updateStatus(InstanceStatus.UnknownWarning, error_codes[label].label)
	}
	let type = undefined
    try {
        type = this.mvp.msgStore[sequence].type
		delete this.mvp.msgStore[sequence]
    } catch {
        this.log('info', `Sequence ${sequence} not found in msgStore`)
        return undefined
    }
    this.log(
			'debug',
			`Message Recieved: Protocol Version ${proto} Sequence Number ${sequence} Response ${resp} Label: ${label} Type ${type} Properties ${props}`
		)
	let workingVar
	let scripts = []
	switch(type) {
		case command.run_script:
			break
		case command.change_window_source:
			break
		case command.route_audio:
			break
		case command.set_vgpi:
			break
		case command.unassign_window_source:
			break
		case command.run_snapshot:
			break
		case command.list_scripts:
			this.log('debug', `Command type List Scripts`)
			workingVar = props.substring(props.indexOf('[') + 1, props.indexOf(']')).replaceAll('"','')
			scripts = workingVar.split(',')
			this.mvp.scripts = []
			for (let i = 0; i < scripts.length; i++) {
				this.mvp.scripts[i] = { id: scripts[i], label: scripts[i]}
			}
			this.updateActions()
			break
		case command.current_layout:
			break
		case command.list_windows:
			this.log('debug', `Command type List Windows`)	
			break
		case command.window_geometry:
			break
		case command.window_source:
			break
		case command.display_listen:
			break
		case command.save_display:
			break
		case command.show:
			break
		case command.hide:
			break
		case command.move:
			break
		case command.scale:
			break
		default:
			this.log('debug', `Command type not found ${type}`)	
	}
}
