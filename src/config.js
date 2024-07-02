import { Regex } from '@companion-module/base'
import { default_port, choices } from './consts.js'

	// Return config fields for web config
export function	getConfigFields() {
		return [
			{
				type: 'dropdown',
				id: 'model',
				label: 'Model',
				witdth: 6,
				default: choices.device[0].id,
				allowCustom: false,
				choices: choices.device,
			},
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
				isVisible: (options) => {
					return options.model === choices.device[0].id || options.model === choices.device[2].id
				},
			},
		]
	}
