import * as vscode from 'vscode';

interface CommandMessage {
	type: 'save' | 'run';
	command?: string;
}

interface ExecutorConfigFile {
	command?: string;
}

class CommandViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'executor.commandView';
	private static readonly configFileName = '.executor.json';

	private view?: vscode.WebviewView;
	private command = '';
	private isRunning = false;
	public readonly statusBarItem: vscode.StatusBarItem;

	constructor(private readonly context: vscode.ExtensionContext) {
		this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
		this.statusBarItem.command = 'executor.toggleConfiguredCommand';
		this.initializeCommand();
		this.updateToolbarState();
	}

	private async initializeCommand(): Promise<void> {
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
		const localCommand = await this.loadCommandFromLocalConfig(workspaceFolder?.uri);
		if (localCommand) {
			this.command = localCommand;
			return;
		}

		const savedCommand = this.context.globalState.get<string>('configuredCommand');
		if (savedCommand) {
			this.command = savedCommand;
		}
	}

	private async loadCommandFromLocalConfig(workspaceUri?: vscode.Uri): Promise<string | undefined> {
		if (!workspaceUri) {
			return undefined;
		}

		const configUri = vscode.Uri.joinPath(workspaceUri, CommandViewProvider.configFileName);
		try {
			const encoded = await vscode.workspace.fs.readFile(configUri);
			const text = Buffer.from(encoded).toString('utf8');
			const value = JSON.parse(text) as ExecutorConfigFile;
			if (typeof value.command === 'string' && value.command.trim().length > 0) {
				return value.command.trim();
			}
		} catch {
			return undefined;
		}

		return undefined;
	}

	private async saveCommandToLocalConfig(command: string): Promise<void> {
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
		if (!workspaceFolder) {
			return;
		}

		const configUri = vscode.Uri.joinPath(workspaceFolder.uri, CommandViewProvider.configFileName);
		const payload = JSON.stringify({ command }, null, 2);
		await vscode.workspace.fs.writeFile(configUri, Buffer.from(payload, 'utf8'));
	}

	public resolveWebviewView(webviewView: vscode.WebviewView): void {
		this.view = webviewView;
		webviewView.webview.options = { enableScripts: true };
		webviewView.webview.html = this.getHtml();
		this.updateView();

		webviewView.webview.onDidReceiveMessage((message: CommandMessage) => {
			if (message.type === 'save' && typeof message.command === 'string') {
				void this.setConfiguredCommand(message.command);
			}

			if (message.type === 'run') {
				this.toggleConfiguredCommand();
			}
		});
	}

	public getConfiguredCommand(): string {
		return this.command;
	}

	private getOrCreateExecutorTerminal(): vscode.Terminal {
		const existingTerminal = vscode.window.terminals.find((terminal) => {
			return terminal.name === 'Executor' && terminal.exitStatus === undefined;
		});

		if (existingTerminal) {
			existingTerminal.show(false);
			return existingTerminal;
		}

		const newTerminal = vscode.window.createTerminal({ name: 'Executor' });
		newTerminal.show(true);
		return newTerminal;
	}

	public toggleConfiguredCommand(): void {
		if (this.isRunning) {
			this.stopConfiguredCommand();
			return;
		}

		this.runConfiguredCommand();
	}

	public runConfiguredCommand(): void {
		this.initializeCommand();
		const commandToRun = this.command.trim();
		
		if (!commandToRun) {
			vscode.window.showWarningMessage('Set a command in the Executor activity bar view first.');
			return;
		}

		const terminal = this.getOrCreateExecutorTerminal();
		terminal.sendText(commandToRun, true);
		this.setRunningState(true);
	}

	public stopConfiguredCommand(): void {
		const terminal = vscode.window.terminals.find((candidate) => candidate.name === 'Executor');
		if (!terminal) {
			this.setRunningState(false);
			return;
		}

		terminal.sendText('\u0003', false);
		this.setRunningState(false);
	}

	public async setConfiguredCommand(nextCommand: string): Promise<void> {
		this.command = nextCommand.trim();
		await this.context.globalState.update('configuredCommand', this.command);
		await this.saveCommandToLocalConfig(this.command);
		this.updateView();
		vscode.window.showInformationMessage('Executor command saved to workspace config.');
	}

	private updateToolbarState(): void {
		this.statusBarItem.text = this.isRunning ? '$(debug-stop) Executor running' : '$(play) Executor';
		this.statusBarItem.tooltip = this.isRunning ? 'Stop configured command' : 'Run configured command';
		this.statusBarItem.show();
		void vscode.commands.executeCommand('setContext', 'executor.running', this.isRunning);
		if (this.view) {
			this.view.webview.postMessage({ type: 'setRunning', running: this.isRunning });
		}
	}

	private setRunningState(running: boolean): void {
		if (this.isRunning === running) {
			this.updateToolbarState();
			return;
		}

		this.isRunning = running;
		this.updateToolbarState();
	}

	private updateView(): void {
		if (this.view) {
			this.view.webview.postMessage({ type: 'setCommand', command: this.command });
			this.view.webview.postMessage({ type: 'setRunning', running: this.isRunning });
		}
	}

	private getHtml(): string {
		const escapedCommand = this.command
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;');

		return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<title>Executor</title>
				<style>
					body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); padding: 12px; }
					label { display: block; font-weight: 600; margin-bottom: 6px; }
					input { width: 100%; box-sizing: border-box; padding: 8px; margin-bottom: 8px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); }
					button { width: 100%; padding: 8px; margin-bottom: 8px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; cursor: pointer; }
					button.secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
					small { display: block; opacity: 0.75; }
				</style>
			</head>
			<body>
				<label for="command">Command</label>
				<input id="command" value="${escapedCommand}" spellcheck="false" />
				<button id="save">Save command</button>
				<button id="run" class="secondary">Run command</button>
				<small>Use the editor toolbar button to run the saved command at any time.</small>
				<script>
					const vscode = acquireVsCodeApi();
					const commandInput = document.getElementById('command');
					const saveButton = document.getElementById('save');
					const runButton = document.getElementById('run');

					const updateRunButtonState = (running) => {
						runButton.textContent = running ? 'Stop command' : 'Run command';
						runButton.classList.toggle('secondary', !running);
					};

					saveButton.addEventListener('click', () => {
						vscode.postMessage({ type: 'save', command: commandInput.value });
					});

					runButton.addEventListener('click', () => {
						vscode.postMessage({ type: 'run' });
					});

					window.addEventListener('message', event => {
						if (event.data.type === 'setCommand') {
							commandInput.value = event.data.command;
						}

						if (event.data.type === 'setRunning') {
							updateRunButtonState(event.data.running);
						}
					});

					updateRunButtonState(false);
				</script>
			</body>
			</html>`;
	}
}

export function activate(context: vscode.ExtensionContext): void {
	console.log('Executor extension is now active.');

	const provider = new CommandViewProvider(context);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(CommandViewProvider.viewType, provider)
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('executor.toggleConfiguredCommand', () => {
			provider.toggleConfiguredCommand();
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('executor.runConfiguredCommand', () => {
			provider.runConfiguredCommand();
		})
	);

	context.subscriptions.push(
			vscode.commands.registerCommand('executor.stopConfiguredCommand', () => {
				provider.stopConfiguredCommand();
			})
		);

	context.subscriptions.push(provider.statusBarItem);
	provider.statusBarItem.show();
}

export function deactivate(): void {
	// No-op.
}
