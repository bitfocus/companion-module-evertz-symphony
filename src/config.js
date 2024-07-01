import { Regex } from '@companion-module/base'
import { default_port } from './consts.js'

export async function configUpdated(config) {
		//let oldConfig = this.config
		this.config = config
		this.initTCP()
		this.initVariables()
		this.updateActions()
		this.updateFeedbacks()
		this.updateVariableDefinitions()
		this.updatePresetsDefinitions()
	}
	// Return config fields for web config
export function	getConfigFields() {
		return [
			{
				type: 'textinput',
				id: 'host',
				label: 'Hostname',
				width: 12,
				regex: Regex.HOSTNAME,
			},
			{
				type: 'textinput',
				id: 'port',
				label: 'Port',
				width: 6,
				regex: Regex.PORT,
				default: default_port,
				tooltip: `Default, TCP:${default_port}`,
			},
			{
				type: 'number',
				id: 'display',
				label: 'Displays',
				width: 6,
				default: 6,
				min: 1,
				max: 999,
				range: true,
				step: 1,
				tooltip: `Number of addressable displays in the system`,
			},
		]
	}
