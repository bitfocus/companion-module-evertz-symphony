import { command, choices, proto_version } from './consts.js'
export default function (self) {
	let actionList = []
	if (self.mvp.scripts.length === 0) {
		self.mvp.scripts[0] = {id: '', label: ''}
	}
	if (self.config.model == choices.device[0].id) {
		actionList['runScript'] = {
			name: 'Run Script',
			options: [
				{
					id: 'script',
					type: 'dropdown',
					label: 'Script',
					default: self.mvp.scripts[0].id,
					allowCustom: true,
					choices: self.mvp.scripts,
				},
				{
					id: 'display',
					type: 'textinput',
					label: 'Display',
					default: '1',
					useVariables: true,
					tooltip: `Return an integer between 1 and ${self.config.display}`
				},
			],
			callback: async (action) => {
				let script = await self.parseVariablesInString(action.options.script)
				let display = parseInt( await self.parseVariablesInString(action.options.display))
				if (isNaN(display) || display < 1 || display > self.config.display) {
					self.log('warn', `Invalid display selected ${display}`)
					return undefined
				}
				self.addCmdtoQueue({
					proto: proto_version,
					type: command.run_script,
					label: '',
					props: [
						{ name: 'script', value: `"${script}"` },
						{ name: 'display', value: display },
					],
				})
			},
		}
		
		actionList['routeAudio'] = {
			name: 'Route Audio',
			options: [
				{
					id: 'display',
					type: 'textinput',
					label: 'Display',
					default: '1',
					useVariables: true,
					tooltip: `Return an integer between 1 and ${self.config.display}`,
				},
				{
					id: 'window',
					type: 'textinput',
					label: 'Window Name',
					default: 'window',
					useVariables: true,
				},
				{
					id: 'pair',
					type: 'textinput',
					label: 'Pair',
					default: '1',
					useVariables: true,
					tooltip: 'Return audio pair number, set to 0 to turn off',
				},
			],
			callback: async (action) => {
				let display = parseInt(await self.parseVariablesInString(action.options.display))
				let window = await self.parseVariablesInString(action.options.window)
				let pair = parseInt(await self.parseVariablesInString(action.options.pair))
				if (isNaN(display) || display < 1 || display > self.config.display) {
					self.log('warn', `Invalid display selected ${display}`)
					return undefined
				}
				if (isNaN(pair) || pair < 0) {
					self.log('warn', `Invalid pair selected ${pair}`)
					return undefined
				}
				self.addCmdtoQueue({
					proto: proto_version,
					type: command.route_audio,
					label: '',
					props: [
						{ name: 'win', value: `"D${display}${window}"` },
						{ name: 'pair', value: pair },
					],
				})
			},
		}
		actionList['setVGPI'] = {
			name: 'Set VGPI',
			options: [
				{
					id: 'vgpi',
					type: 'textinput',
					label: 'VGPI',
					default: '1',
					useVariables: true,
					tooltip: `Return an integer between 1 and 320`,
				},
				{
					id: 'state',
					type: 'checkbox',
					label: 'State',
					default: true,
				},
			],
			callback: async (action) => {
				let vgpi = parseInt(await self.parseVariablesInString(action.options.vgpi))
				if (isNaN(vgpi) || display < 1 || vgpi > 320) {
					self.log('warn', `Invalid display selected ${vgpi}`)
					return undefined
				}
				let val = action.options.state ? `"on"` : `"off"`
				self.addCmdtoQueue({
					proto: proto_version,
					type: command.set_vgpi,
					label: vgpi,
					props: [{ name: 'val', value: val }],
				})
			},
		}
		actionList['unassignWindow'] = {
			name: 'Unassign Window Source',
			options: [
				{
					id: 'display',
					type: 'textinput',
					label: 'Display',
					default: '1',
					useVariables: true,
					tooltip: `Return an integer between 1 and ${self.config.display}`,
				},
				{
					id: 'window',
					type: 'textinput',
					label: 'Window Name',
					default: 'window',
					useVariables: true,
				},
			],
			callback: async (action) => {
				let display = parseInt(await self.parseVariablesInString(action.options.display))
				let window = await self.parseVariablesInString(action.options.window)
				if (isNaN(display) || display < 1 || display > self.config.display) {
					self.log('warn', `Invalid display selected ${display}`)
					return undefined
				}
				self.addCmdtoQueue({
					proto: proto_version,
					type: command.unassign_window_source,
					label: '',
					props: [{ name: 'win', value: `"D${display}${window}"` }],
				})
			},
		}
		actionList['runSnapshot'] = {
			name: 'Run Snapshot',
			options: [
				{
					id: 'snapshot',
					type: 'textinput',
					label: 'Snapshot',
					default: '',
					useVariables: true,
				},
			],
			callback: async (action) => {
				let snapshot = await self.parseVariablesInString(action.options.snapshot)
				self.addCmdtoQueue({
					proto: proto_version,
					type: command.run_snapshot,
					label: '',
					props: [{ name: 'snapshot', value: `"${snapshot}"` }],
				})
			},
		}
	}
	if (self.config.model == choices.device[1].id || self.config.model == choices.device[2].id) {
		actionList['runScript'] = {
			name: 'Run Script',
			options: [
				{
					id: 'script',
					type: 'textinput',
					label: 'Script',
					default: 'script1.vssl',
					useVariables: true,
				},
			],
			callback: async (action) => {
				let script = await self.parseVariablesInString(action.options.script)
				let display = parseInt(await self.parseVariablesInString(action.options.display))
				self.addCmdtoQueue({
					proto: proto_version,
					type: command.run_script,
					label: '',
					props: [{ name: 'script', value: `"${script}"` }],
				})
			},
		}
	}
	if (self.config.model == choices.device[0].id || self.config.model == choices.device[2].id) {
		actionList['changeWindowSource'] = {
			name: 'Change Window Source',
			options: [
				{
					id: 'display',
					type: 'textinput',
					label: 'Display',
					default: '1',
					useVariables: true,
					tooltip: `Return an integer between 1 and ${self.config.display}`,
				},
				{
					id: 'window',
					type: 'textinput',
					label: 'Window Name',
					default: 'window',
					useVariables: true,
				},
				{
					id: 'family',
					type: 'textinput',
					label: 'Family Name',
					default: 'IC1',
					useVariables: true,
				},
				{
					id: 'member',
					type: 'textinput',
					label: 'Member Name',
					default: 'BNC_A',
					useVariables: true,
				},
			],
			callback: async (action) => {
				let display = parseInt(await self.parseVariablesInString(action.options.display))
				if (isNaN(display) || display < 1 || display > self.config.display) {
					self.log('warn', `Invalid display selected ${display}`)
					return undefined
				}
				display = display.toString(10).padStart(3, '0')
				let window = await self.parseVariablesInString(action.options.window)
				let family = await self.parseVariablesInString(action.options.family)
				let member = await self.parseVariablesInString(action.options.member)
				self.addCmdtoQueue({
					proto: proto_version,
					type: command.change_window_source,
					label: '',
					props: [
						{ name: 'win', value: `"D${display}${window}"` },
						{ name: 'family', value: `"${family}"` },
						{ name: 'member', value: `"${member}"` },
					],
				})
			},
		}
	}
	if (self.config.model == choices.device[3].id) {
		actionList['show'] = {
			name: 'Show',
			options: [
				{
					id: 'window',
					type: 'textinput',
					label: 'Window Name',
					default: 'window',
					useVariables: true,
				},
			],
			callback: async (action) => {
				let window = await self.parseVariablesInString(action.options.window)
				self.addCmdtoQueue({
					type: command.show,
					label: '',
					props: [
						{ name: 'win', value: `"${window}"` },
					],
				})
			},
		}
		actionList['hide'] = {
			name: 'Hide',
			options: [
				{
					id: 'window',
					type: 'textinput',
					label: 'Window Name',
					default: 'window',
					useVariables: true,
				},
			],
			callback: async (action) => {
				let window = await self.parseVariablesInString(action.options.window)
				self.addCmdtoQueue({
					proto: proto_version,
					type: command.hide,
					label: '',
					props: [{ name: 'win', value: `"${window}"` }],
				})
			},
		}
		actionList['move'] = {
			name: 'move',
			options: [
				{
					id: 'window',
					type: 'textinput',
					label: 'Window Name',
					default: 'window',
					useVariables: true,
				},
				{
					id: 'duration',
					type: 'textinput',
					label: 'Duration',
					default: '1',
					useVariables: true,
				},
				{
					id: 'units',
					type: 'dropdown',
					label: 'Units',
					default: choices.duration[0].id,
					choices: choices.duration,
				},
				{
					id: 'xPos',
					type: 'textinput',
					label: 'X Position',
					default: '100',
					useVariables: true,
				},
				{
					id: 'yPos',
					type: 'textinput',
					label: 'Y Position',
					default: '340',
					useVariables: true,
				},
			],
			callback: async (action) => {
				let window = await self.parseVariablesInString(action.options.window)
				let duration =
					action.option.units === choices.duration[1].id
						? parseInt(await self.parseVariablesInString(action.options.duration))
						: Number(await self.parseVariablesInString(action.options.duration))
				if (isNaN(duration)) {
					self.log('warn', `Invalid Duration ${duration}`)
					return undefined
				}
				duration += action.option.units
				let xPos = parseInt(await self.parseVariablesInString(action.options.xPos))
				let yPos = parseInt(await self.parseVariablesInString(action.options.yPos))
				if (isNaN(xPos) || isNaN (yPos)) {
					self.log('warn', `Invalid postion ${xPos}:${yPos}`)
					return undefined
				}
				self.addCmdtoQueue({
					proto: proto_version,
					type: command.move,
					label: '',
					props: [
						{ name: 'win', value: `"${window}"` },
						{ name: 'dur', value: `"${duration}"` },
						{ name: 'x', value: xPos },
						{ name: 'y', value: yPos },
					],
				})
			},
		}
		actionList['scale'] = {
			name: 'Scale',
			options: [
				{
					id: 'window',
					type: 'textinput',
					label: 'Window Name',
					default: 'window',
					useVariables: true,
				},
				{
					id: 'duration',
					type: 'textinput',
					label: 'Duration',
					default: 'window',
					useVariables: true,
				},
				{
					id: 'units',
					type: 'dropdown',
					label: 'Units',
					default: choices.duration[0].id,
					choices: choices.duration,
				},
				{
					id: 'xSize',
					type: 'textinput',
					label: 'X Size',
					default: '100',
					useVariables: true,
				},
				{
					id: 'ySize',
					type: 'textinput',
					label: 'Y Size',
					default: '340',
					useVariables: true,
				},
			],
			callback: async (action) => {
				let window = await self.parseVariablesInString(action.options.window)
				let duration =
					action.option.units === choices.duration[1].id
						? parseInt(await self.parseVariablesInString(action.options.duration))
						: Number(await self.parseVariablesInString(action.options.duration))
				if (isNaN(duration)) {
					self.log('warn', `Invalid Duration ${duration}`)
					return undefined
				}
				duration += action.option.units
				let xSize = parseInt(await self.parseVariablesInString(action.options.xSize))
				let ySize = parseInt(await self.parseVariablesInString(action.options.ySize))
				if (isNaN(xSize) || isNaN(ySize) || xSize < 0 || ySize < 0) {
					self.log('warn', `Invalid size ${xSize}:${ySize}`)
					return undefined
				}
				self.addCmdtoQueue({
					proto: proto_version,
					type: command.scale,
					label: '',
					props: [
						{ name: 'win', value: `"${window}"` },
						{ name: 'dur', value: `"${duration}"` },
						{ name: 'x', value: xSize },
						{ name: 'y', value: ySize },
					],
				})
			},
		}
	}
	self.setActionDefinitions(actionList)
}
