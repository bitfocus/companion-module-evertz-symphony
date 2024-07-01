import { InstanceStatus, TCPHelper } from '@companion-module/base'
import { command, SOM, EOM, keep_alive, msg_delay, proto_version } from './consts.js'

export function queryOnConnect() {
	//function to make initial queries and start message command queue
	this.cmdTimer = setTimeout(() => {
		this.processCmdQueue()
	}, msg_delay)
	this.addCmdtoQueue({type: command.list_scripts, label: '', props: []})
	this.addCmdtoQueue({ type: command.display_listen, label: '', props: [] })
	for (let i = 1; i <= this.config.display; i++) {
		this.addCmdtoQueue({ type: command.list_windows, label: '', props: [{name: 'display', value: i}] })
	}
	this.subscribeActions()
	this.subscribeFeedbacks()
}


export function addCmdtoQueue(cmd) {
		if (cmd !== undefined && cmd instanceof Object) {
			if (this.cmdQueue === undefined) {
				this.cmdQueue = []
			}
			this.cmdQueue.push(cmd)
			return true
		}
		this.log('warn', `Invalid command: ${cmd}`)
		return false
}

export function keepAlive() {
	this.addCmdtoQueue({ type: command.list_scripts, label: null, props: [] })
}

export function processCmdQueue() {
		if (this.cmdQueue.length > 0 && this.clearToTx) {
			//dont send command if still waiting for response from last command
			this.sendCommand(this.cmdQueue.splice(0, 1))
			this.cmdTimer = setTimeout(() => {
				this.processCmdQueue()
			}, msg_delay)
			return true
		}
		this.cmdTimer = setTimeout(() => {
			this.processCmdQueue()
		}, msg_delay)
		return false
	}

export function sendCommand(cmd) {
	if (Array.isArray(cmd)) {
		cmd = cmd[0]
	}
		if (cmd !== undefined && cmd instanceof Object) {
			if (this.socket !== undefined && this.socket.isConnected) {
				if (this.keepAliveTimer) {
					clearTimeout (this.keepAliveTimer)
				}
				let sequence = this.returnSequence()
				let msg = SOM + proto_version + sequence + cmd.type + '(' + cmd.label + ')'
				let properties= '{'
				let props = cmd.props
				for (let i = 0; i < props.lenght; i++) {
					properties += ` ${props[i].name} = ${ props[i].value}`
				}
				msg += properties + ' }' + EOM
				//this.log('debug', `Sending Command: ${msg}`)
				console.log(msg)
				this.clearToTx = false
				this.socket.send(SOM + Buffer.from(msg) + EOM)
				if (this.mvp.msgStore === undefined) {
					this.mvp.msgStore = []
				}
				this.mvp.msgStore[sequence] = cmd
				this.keepAliveTimer = setTimeout(() => {
					this.keepAlive()
				}, keep_alive)
				return sequence
			} else {
				this.log('warn', `Socket not connected, tried to send: ${JSON.toString(cmd)}`)
			}
		} else {
			this.log('warn', 'Command undefined')
		}
		return false
	}

export function initTCP () {
	this.log('debug', 'initTCP')
		if (this.socket !== undefined) {
			this.socket.destroy()
			delete this.socket
		}
		if (this.config.host) {
			this.log('debug', 'Creating New Socket')

			this.updateStatus(`Connecting to MVP : ${this.config.host}:${this.config.port}`)
			this.socket = new TCPHelper(this.config.host, this.config.port)

			this.socket.on('status_change', (status, message) => {
				this.updateStatus(status, message)
			})
			this.socket.on('error', (err) => {
                this.log('error', `Network error: ${err.message}`)
                this.updateStatus(InstanceStatus.ConnectionFailure, message)
				delete this.mvp.msgStore
				delete this.mvp.sequence
				delete this.cmdQueue
			})
			this.socket.on('connect', () => {
                this.log('info', `Connected to ${this.config.host}:${this.config.port}`)
                this.updateStatus(InstanceStatus.Ok, 'Connected')
				this.cmdQueue = []
				this.clearToTx = true
				this.receiveBuffer = Buffer.from('')
				this.queryOnConnect()
			})
			this.socket.on('data', (chunk) => {
				console.log (`Chunk Recieved: ${chunk}`)
				this.clearToTx = true
				let i = 0,
					line = '',
					offset = 0
				this.receiveBuffer += chunk
				while ((i = this.receiveBuffer.indexOf(EOM, offset)) !== -1) {
					line = this.receiveBuffer.substring(offset, i)
					offset = i + 1
					this.processResponse(line.toString())
				}
				this.receiveBuffer = this.receiveBuffer.substring(offset)
			})
		} else {
			this.updateStatus(InstanceStatus.BadConfig)
		}
}