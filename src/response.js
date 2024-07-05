import { InstanceStatus } from '@companion-module/base'
import { command, response, error_codes, STX, proto_version, choices } from './consts.js'
export function processResponse(msg) {
	//this.log('debug', `processResponse ${msg}`)
	if (msg.includes(STX)) {
		let index = msg.search(STX)
		msg = msg.substring(index + 1)
	} else {
		this.log('warn', `STX not found; invalid message recieved: ${msg}`)
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
	let type = undefined
	try {
		type = this.mvp.msgStore[sequence].type
		delete this.mvp.msgStore[sequence]
	} catch {
		if (parseInt(sequence) !== 0) {
			//sequence 0 used for some unprompted messages
			this.log('info', `Sequence ${sequence} not found in msgStore`)
			this.updateStatus(InstanceStatus.UnknownWarning, `Sequence ${sequence} not found in msgStore`)
			return undefined
		}
	}
	if (resp === response.error) {
		if (this.config.model !== choices.device[0].id && label == error_codes[1].id) {
			//ignore invalid proto messages from units other than MVP since using proto 99 for KA
		} else {
			this.log('warn', `Error response recieved: ${error_codes[label].label}`)
			this.updateStatus(error_codes[label].status, error_codes[label].label)
		}
		return undefined
	}
	/* this.log(
		'debug',
		`Message Recieved: Protocol Version ${proto} Sequence Number ${sequence} Response ${resp} Label: ${label} Type ${type} Properties ${props}`
	) */
	this.updateStatus(InstanceStatus.Ok)
	let workingVar
	let scripts = []
	let mvpScripts = []
	switch (type) {
		case command.run_script:
			this.log('debug', `Recieved Command type Run Script ${msg}`)
			break
		case command.change_window_source:
			this.log('debug', `Recieved Command type Change Window Source ${msg}`)
			break
		case command.route_audio:
			this.log('debug', `Recieved Command type Route Audio ${msg}`)
			break
		case command.set_vgpi:
			this.log('debug', `Recieved Command type Set VPGI ${msg}`)
			break
		case command.unassign_window_source:
			this.log('debug', `Recieved Command type Unassign Window Source ${msg}`)
			break
		case command.run_snapshot:
			this.log('debug', `Recieved Command type Run Snapshot ${msg}`)
			break
		case command.list_scripts:
			//this.log('debug', `Recieved Command type List Scripts`)
			workingVar = props.substring(props.indexOf('[') + 1, props.indexOf(']')).replaceAll('"', '')
			scripts = workingVar.split(',')
			for (let i = 0; i < scripts.length; i++) {
				mvpScripts[i] = { id: scripts[i], label: scripts[i] }
			}
			if (this.mvp.scripts !== mvpScripts) {
				this.log('debug', `New scripts found in List Scripts response, updating actions. ${msg}`)
				this.mvp.scripts = mvpScripts
				this.updateActions()
			}
			break
		case command.current_layout:
			this.log('debug', `Recieved Command type Current Layout ${msg}`)
			break
		case command.list_windows:
			this.log('debug', `RecievedCommand type List Windows ${msg}`)
			break
		case command.window_geometry:
			this.log('debug', `Recieved Command type Window Geometry ${msg}`)
			break
		case command.window_source:
			this.log('debug', `Recieved Command type Window Source ${msg}`)
			break
		case command.display_listen:
			this.log('debug', `Recieved Command type Display Listen ${msg}`)
			break
		case command.save_display:
			this.log('debug', `Recieved Command type Save Display ${msg}`)
			break
		case command.show:
			this.log('debug', `Recieved Command type Show ${msg}`)
			break
		case command.hide:
			this.log('debug', `Recieved Command type Hide ${msg}`)
			break
		case command.move:
			this.log('debug', `RecievedCommand type Move ${msg}`)
			break
		case command.scale:
			this.log('debug', `Recieved Command type Scale ${msg}`)
			break
		default:
			this.log('debug', `Recieved Command type not found ${type} in ${msg}`)
	}
}
