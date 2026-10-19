import { InstanceBase, InstanceStatus, type SomeCompanionConfigField } from '@companion-module/base'
import { clampDisplays, GetConfigFields, validPort, type ModuleConfig } from './config.js'
import { UpgradeScripts } from './upgrades.js'
import { UpdateActions, type ActionSchema } from './actions.js'
import { keepaliveProbe, listScripts, SymphonyConnection, type Request } from './api/index.js'

export type ModuleTypes = {
	config: ModuleConfig
	secrets: undefined
	actions: ActionSchema
	/** The module defines none */
	feedbacks: Record<string, never>
	/** The module defines none */
	variables: Record<string, never>
}

export { UpgradeScripts }

export default class EvertzSymphonyInstance extends InstanceBase<ModuleTypes> {
	config!: ModuleConfig // Setup in init()
	/** The scripts the MVP last listed, for the Run Script action. Kept across a config change, as the 1.x module did */
	scripts: string[] = []
	#connection: SymphonyConnection | undefined

	constructor(internal: unknown) {
		super(internal)
	}

	get displayCount(): number {
		return clampDisplays(this.config.display)
	}

	async init(config: ModuleConfig): Promise<void> {
		await this.configUpdated(config)
	}

	// When module gets deleted
	async destroy(): Promise<void> {
		this.log('debug', `destroy ${this.id}`)
		this.#closeConnection()
		this.updateStatus(InstanceStatus.Disconnected)
	}

	async configUpdated(config: ModuleConfig): Promise<void> {
		this.config = config
		this.#closeConnection()
		this.updateActions()
		this.#openConnection()
	}

	getConfigFields(): SomeCompanionConfigField[] {
		return GetConfigFields()
	}

	updateActions(): void {
		UpdateActions(this)
	}

	/**
	 * Queues a request for the unit
	 * @param signal an action's context.signal, so a request the user no longer wants is dropped before it is sent
	 */
	async send(request: Request, signal?: AbortSignal): Promise<void> {
		if (this.#connection === undefined) throw new Error('Not connected to unit')
		await this.#connection.send(request, signal)
	}

	#openConnection(): void {
		const host = this.config.host?.trim()
		const port = validPort(this.config.port)
		if (!host) {
			this.updateStatus(InstanceStatus.BadConfig, 'No host')
			return
		}
		if (port === undefined) {
			this.updateStatus(InstanceStatus.BadConfig, `Invalid port ${String(this.config.port)}`)
			return
		}
		const connection = new SymphonyConnection({
			host,
			port,
			keepalive: this.config.model === 'mvp' ? listScripts() : keepaliveProbe(),
			log: (level, message) => this.log(level, message),
		})
		connection.on('status', (status, message) => this.updateStatus(status, message))
		connection.on('scripts', (scripts) => this.#onScripts(scripts))
		this.#connection = connection
		connection.connect()
	}

	#closeConnection(): void {
		this.#connection?.destroy()
		this.#connection = undefined
	}

	/** The MVP answers every keepalive with its scripts, so the actions are set again only when the list changes */
	#onScripts(scripts: string[]): void {
		if (scripts.length === this.scripts.length && scripts.every((script, i) => script === this.scripts[i])) return
		this.log('debug', `New scripts found in List Scripts response, updating actions: ${scripts.join(', ')}`)
		this.scripts = scripts
		this.updateActions()
	}
}
