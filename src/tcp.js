import { InstanceStatus, TCPHelper } from '@companion-module/base'
import {
	choices,
	command,
	STX,
	ETX,
	keep_alive_timeout,
	msg_delay,
	proto_version,
	clearToTx_timeout,
} from './consts.js'

export function queryOnConnect() {
	//function to make initial queries and start message command queue
	this.cmdTimer = setTimeout(() => {
		this.processCmdQueue()
	}, msg_delay)
	if (this.config.model === choices.device[0].id) {
		this.addCmdtoQueue({ proto: proto_version, type: command.list_scripts, label: '', props: [] })
	} else {
		this.keepAlive()
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

export function clearToTxTimeout() {
	if (this.clearToTxTimer !== undefined) {
		clearTimeout(this.clearToTxTimer)
	}
	this.clearToTx = true
}

export function keepAlive() {
	if (this.config.model == choices.device[0].id) {
		this.addCmdtoQueue({ proto: proto_version, type: command.list_scripts, label: '', props: [] })
	} else {
		//for any unit other than MVP send msg with invalid protocol version
		this.addCmdtoQueue({ proto: '99', type: command.list_scripts, label: '', props: [] })
	}
}

export function processCmdQueue() {
	if (this.cmdQueue?.length > 0 && this.clearToTx) {
		//dont send command if still waiting for response from last command
		this.sendCommand(this.cmdQueue.shift())
	}
	this.cmdTimer = setTimeout(() => {
		this.processCmdQueue()
	}, msg_delay)
}

export function sendCommand(cmd) {
	if (cmd !== undefined && cmd instanceof Object) {
		if (this.socket !== undefined && this.socket.isConnected) {
			if (this.keepAliveTimer) {
				clearTimeout(this.keepAliveTimer)
			}
			let sequence = this.returnSequence()
			let msg = STX + cmd.proto + sequence + cmd.type + '(' + cmd.label + ')'
			let properties = '{'
			for (let i = 0; i < cmd.props.length; i++) {
				properties += ` ${cmd.props[i].name} = ${cmd.props[i].value}`
			}
			msg += properties + ' }' + ETX
			//this.log('debug', `Sending Command: ${msg}`)
			this.clearToTx = false
			this.socket.send(msg)
			if (this.mvp.msgStore === undefined) {
				this.mvp.msgStore = []
			}
			this.mvp.msgStore[sequence] = cmd
			this.keepAliveTimer = setTimeout(() => {
				this.keepAlive()
			}, keep_alive_timeout)
			this.clearToTxTimer = setTimeout(() => {
				this.clearToTxTimeout()
			}, clearToTx_timeout)
			return sequence
		} else {
			this.log('warn', `Socket not connected, tried to send: ${JSON.stringify(cmd)}`)
		}
	} else {
		this.log('warn', 'Command undefined')
	}
	return undefined
}

export function initTCP() {
	this.log('debug', 'initTCP')
	if (this.socket !== undefined) {
		this.socket.destroy()
		delete this.socket
	}
	if (this.config.host) {
		this.log('debug', 'Creating New Socket')

		this.updateStatus(`Connecting to ${this.config.model}: ${this.config.host}:${this.config.port}`)
		this.socket = new TCPHelper(this.config.host, this.config.port)

		this.socket.on('status_change', (status, message) => {
			this.updateStatus(status, message)
		})
		this.socket.on('error', (err) => {
			this.log('error', `Network error: ${err.message}`)
			this.updateStatus(InstanceStatus.ConnectionFailure, err.message)
			delete this.mvp.msgStore
			this.cmdQueue = []
		})
		this.socket.on('connect', () => {
			this.log('info', `Connected to ${this.config.host}:${this.config.port}`)
			this.updateStatus(InstanceStatus.Ok, 'Connected')
			this.cmdQueue = []
			this.clearToTx = true
			this.receiveBuffer = Buffer.from('')
			this.queryOnConnect()
			this.clearToTxTimeout()
		})
		this.socket.on('data', (chunk) => {
			//console.log (`Chunk Recieved: ${chunk}`)
			this.clearToTxTimeout()
			let i = 0,
				line = '',
				offset = 0
			this.receiveBuffer += chunk
			while ((i = this.receiveBuffer.indexOf(ETX, offset)) !== -1) {
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
