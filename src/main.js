import { InstanceBase, Regex, runEntrypoint, InstanceStatus } from '@companion-module/base'
import UpgradeScripts from './upgrades'
import UpdateActions from './actions'
import UpdateFeedbacks from './feedbacks'
import UpdateVariableDefinitions from './variables'
import * as config from './config.js'
import * as tcp from './tcp.js'
import * as response from './response.js'
import sequence from './sequence.js'

class Evertz_MVP extends InstanceBase {
	constructor(internal) {
		super(internal)
		Object.assign(this, { ...config, ...tcp, ...response })
		this.mvp = {}
	}

	async init(config) {
		this.config = config
		this.updateStatus(InstanceStatus.Connecting)
		this.initTCP()
		this.updateActions() // export actions
		this.updateFeedbacks() // export feedbacks
		this.updateVariableDefinitions() // export variable definitions
	}
	// When module gets deleted
	async destroy() {
		this.log('debug', 'destroy')
		if (this.keepAliveTimer) {
			clearTimeout(this.keepAliveTimer)
			delete this.keepAliveTimer
		}
		if (this.cmdTimer) {
			clearTimeout(this.cmdTimer)
			delete this.cmdTimer
		}
		delete this.mvp
	}

	updateActions() {
		UpdateActions(this)
	}

	updateFeedbacks() {
		UpdateFeedbacks(this)
	}

	updateVariableDefinitions() {
		UpdateVariableDefinitions(this)
	}
	returnSequence() {
		return sequence(this)
	}
}

runEntrypoint(Evertz_MVP, UpgradeScripts)
