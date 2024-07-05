import { actionOptions, command, choices, proto_version } from './consts.js'
export default function (self) {
	let actionList = []
	if (self.mvp.scripts.length === 0) {
		self.mvp.scripts[0] = { id: '', label: '' }
	}
	if (self.config.model == choices.device[0].id) {
		actionList['runScript'] = {
			name: 'Run Script',
			options: [
				{
					...actionOptions.runSciptMVP.script,
					default: self.mvp.scripts[0].id,
					choices: self.mvp.scripts,
				},
				{
					...actionOptions.runSciptMVP.display,
					tooltip: `Return an integer between 1 and ${self.config.display}`,
				},
			],
			callback: async (action) => {
				const display = parseInt(await self.parseVariablesInString(action.options.display))
				if (isNaN(display) || display < 1 || display > self.config.display) {
					self.log('warn', `Invalid display selected ${display}`)
					return undefined
				}
				self.addCmdtoQueue({
					proto: proto_version,
					type: command.run_script,
					label: '',
					props: [
						{ name: 'script', value: `"${await self.parseVariablesInString(action.options.script)}"` },
						{ name: 'display', value: display },
					],
				})
			},
		}

		actionList['routeAudio'] = {
			name: 'Route Audio',
			options: [
				{
					...actionOptions.routeAudio.display,
					tooltip: `Return an integer between 1 and ${self.config.display}`,
				},
				actionOptions.routeAudio.window,
				actionOptions.routeAudio.pair,
			],
			callback: async (action) => {
				let display = parseInt(await self.parseVariablesInString(action.options.display))
				const pair = parseInt(await self.parseVariablesInString(action.options.pair))
				if (isNaN(display) || display < 1 || display > self.config.display) {
					self.log('warn', `Invalid display selected ${display}`)
					return undefined
				}
				if (isNaN(pair) || pair < 0) {
					self.log('warn', `Invalid pair selected ${pair}`)
					return undefined
				}
				display = display.toString(10).padStart(3, '0')
				self.addCmdtoQueue({
					proto: proto_version,
					type: command.route_audio,
					label: '',
					props: [
						{ name: 'win', value: `"D${display}${await self.parseVariablesInString(action.options.window)}"` },
						{ name: 'pair', value: pair },
					],
				})
			},
		}
		actionList['setVGPI'] = {
			name: 'Set VGPI',
			options: [actionOptions.setVGPI.vgpi, actionOptions.setVGPI.state],
			callback: async (action) => {
				const vgpi = parseInt(await self.parseVariablesInString(action.options.vgpi))
				if (isNaN(vgpi) || vgpi < 1 || vgpi > 320) {
					self.log('warn', `Invalid display selected ${vgpi}`)
					return undefined
				}
				const val = action.options.state ? `"on"` : `"off"`
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
					...actionOptions.unassignWindow.display,
					tooltip: `Return an integer between 1 and ${self.config.display}`,
				},
				actionOptions.unassignWindow.window,
			],
			callback: async (action) => {
				let display = parseInt(await self.parseVariablesInString(action.options.display))
				if (isNaN(display) || display < 1 || display > self.config.display) {
					self.log('warn', `Invalid display selected ${display}`)
					return undefined
				}
				display = display.toString(10).padStart(3, '0')
				self.addCmdtoQueue({
					proto: proto_version,
					type: command.unassign_window_source,
					label: '',
					props: [{ name: 'win', value: `"D${display}${await self.parseVariablesInString(action.options.window)}"` }],
				})
			},
		}
		actionList['runSnapshot'] = {
			name: 'Run Snapshot',
			options: [actionOptions.runSnapshot.snapshot, actionOptions.runSnapshot.info],
			callback: async (action) => {
				self.addCmdtoQueue({
					proto: proto_version,
					type: command.run_snapshot,
					label: '',
					props: [{ name: 'snapshot', value: `"${await self.parseVariablesInString(action.options.snapshot)}"` }],
				})
			},
		}
		actionList['saveDisplay'] = {
			name: 'Save Display',
			options: [
				actionOptions.saveDisplay.script,
				{
					...actionOptions.saveDisplay.display,
					tooltip: `Return an integer between 1 and ${self.config.display}`,
				},
				actionOptions.saveDisplay.info,
			],
			callback: async (action) => {
				const display = parseInt(await self.parseVariablesInString(action.options.display))
				if (isNaN(display) || display < 1 || display > self.config.display) {
					self.log('warn', `Invalid display selected ${display}`)
					return undefined
				}
				self.addCmdtoQueue({
					proto: proto_version,
					type: command.save_display,
					label: '',
					props: [
						{ name: 'display', value: display },
						{ name: 'script', value: `"${await self.parseVariablesInString(action.options.script)}"` },
					],
				})
			},
		}
	}
	if (self.config.model == choices.device[1].id || self.config.model == choices.device[2].id) {
		actionList['runScript'] = {
			name: 'Run Script',
			options: [actionOptions.runScriptVIP.script],
			callback: async (action) => {
				self.addCmdtoQueue({
					proto: proto_version,
					type: command.run_script,
					label: '',
					props: [{ name: 'script', value: `"${await self.parseVariablesInString(action.options.script)}"` }],
				})
			},
		}
	}
	if (self.config.model == choices.device[0].id || self.config.model == choices.device[2].id) {
		actionList['changeWindowSource'] = {
			name: 'Change Window Source',
			options: [
				{
					...actionOptions.changeWindowSource.display,
					tooltip: `Return an integer between 1 and ${self.config.display}`,
				},
				actionOptions.changeWindowSource.window,
				actionOptions.changeWindowSource.family,
				actionOptions.changeWindowSource.member,
			],
			callback: async (action) => {
				let display = parseInt(await self.parseVariablesInString(action.options.display))
				if (isNaN(display) || display < 1 || display > self.config.display) {
					self.log('warn', `Invalid display selected ${display}`)
					return undefined
				}
				display = display.toString(10).padStart(3, '0')
				self.addCmdtoQueue({
					proto: proto_version,
					type: command.change_window_source,
					label: '',
					props: [
						{ name: 'win', value: `"D${display}${await self.parseVariablesInString(action.options.window)}"` },
						{ name: 'family', value: `"${await self.parseVariablesInString(action.options.family)}"` },
						{ name: 'member', value: `"${await self.parseVariablesInString(action.options.member)}"` },
					],
				})
			},
		}
	}
	if (self.config.model == choices.device[3].id) {
		actionList['show'] = {
			name: 'Show',
			options: [actionOptions.show.window],
			callback: async (action) => {
				self.addCmdtoQueue({
					type: command.show,
					label: '',
					props: [{ name: 'win', value: `"${await self.parseVariablesInString(action.options.window)}"` }],
				})
			},
		}
		actionList['hide'] = {
			name: 'Hide',
			options: [actionOptions.show.window],
			callback: async (action) => {
				self.addCmdtoQueue({
					proto: proto_version,
					type: command.hide,
					label: '',
					props: [{ name: 'win', value: `"${await self.parseVariablesInString(action.options.window)}"` }],
				})
			},
		}
		actionList['move'] = {
			name: 'move',
			options: [
				actionOptions.show.window,
				actionOptions.move.duration,
				actionOptions.move.units,
				actionOptions.move.xPos,
				actionOptions.move.yPos,
			],
			callback: async (action) => {
				const window = await self.parseVariablesInString(action.options.window)
				let duration =
					action.option.units === choices.duration[1].id
						? parseInt(await self.parseVariablesInString(action.options.duration))
						: Number(await self.parseVariablesInString(action.options.duration))
				if (isNaN(duration) || duration < 0) {
					self.log('warn', `Invalid Duration ${duration}`)
					return undefined
				}
				duration += action.option.units
				const xPos = parseInt(await self.parseVariablesInString(action.options.xPos))
				const yPos = parseInt(await self.parseVariablesInString(action.options.yPos))
				if (isNaN(xPos) || isNaN(yPos) || xPos < 0 || yPos < 0) {
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
				actionOptions.show.window,
				actionOptions.move.duration,
				actionOptions.move.units,
				actionOptions.scale.xSize,
				actionOptions.scale.ySize,
			],
			callback: async (action) => {
				const window = await self.parseVariablesInString(action.options.window)
				let duration =
					action.option.units === choices.duration[1].id
						? parseInt(await self.parseVariablesInString(action.options.duration))
						: Number(await self.parseVariablesInString(action.options.duration))
				if (isNaN(duration) || duration < 0) {
					self.log('warn', `Invalid Duration ${duration}`)
					return undefined
				}
				duration += action.option.units
				const xSize = parseInt(await self.parseVariablesInString(action.options.xSize))
				const ySize = parseInt(await self.parseVariablesInString(action.options.ySize))
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
