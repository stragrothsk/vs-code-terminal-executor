import * as vscode from 'vscode';

interface CommandMessage {
	type: 'save' | 'run';
	command?: string;
}

interface ExecutorConfigFile {
	command?: string;
}

class CommandViewProvider {
	private command = "";
	private isRunning = false;
	private shellExecutionDisposal?: vscode.Disposable;
	public readonly statusBarItem: vscode.StatusBarItem;

	constructor(private readonly context: vscode.ExtensionContext) {
		this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
		this.statusBarItem.command = 'executor.toggleConfiguredCommand';
		this.loadSettings()
		this.updateToolbarState();
	}

	public loadSettings(): void{
		
		let command:any = vscode.workspace.getConfiguration().get('settingsExecutorCommand');
		if(command){
			this.command = command
		}
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

	public async runConfiguredCommand(): Promise<void> {
		let commandToRun = this.command.trim();
		
		if (!commandToRun) {
			vscode.window.showWarningMessage("No command found! Please add a command in the settings!")
			return;
		}

		const terminal = this.getOrCreateExecutorTerminal();
		terminal.sendText(commandToRun, true);

		this.shellExecutionDisposal = vscode.window.onDidEndTerminalShellExecution((event) => {
			if (event.terminal === terminal) {
				vscode.window.showInformationMessage("Prozess beendet");
				this.cleanupExecution();
			}
		});
		this.setRunningState(true);
	}

	public stopConfiguredCommand(): void {
		const terminal = vscode.window.terminals.find((candidate) => candidate.name === 'Executor' && candidate.exitStatus === undefined);
		if (!terminal) {
			this.cleanupExecution();
			return;
		}

		terminal.sendText('\u0003', false);
		this.cleanupExecution();
	}

	private updateToolbarState(): void {
		this.statusBarItem.text = this.isRunning ? '$(debug-stop) Executor running' : '$(play) Executor';
		this.statusBarItem.tooltip = this.isRunning ? 'Stop configured command' : 'Run configured command';
		this.statusBarItem.show();
		void vscode.commands.executeCommand('setContext', 'executor.running', this.isRunning);
	}

	private setRunningState(running: boolean): void {
		if (this.isRunning === running) {
			this.updateToolbarState();
			return;
		}

		this.isRunning = running;
		this.updateToolbarState();
	}

	private cleanupExecution(): void {
		if (this.shellExecutionDisposal) {
			this.shellExecutionDisposal.dispose();
			this.shellExecutionDisposal = undefined;
		}
		this.setRunningState(false);
	}
}

export function activate(context: vscode.ExtensionContext): void {
	console.log('Executor extension is now active.');
	
	const provider = new CommandViewProvider(context);
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

	context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e =>{
		if (e.affectsConfiguration("settingsExecutorCommand")){
			provider.loadSettings()
		}
	}))

	context.subscriptions.push(provider.statusBarItem);
	provider.statusBarItem.show();

}

export function deactivate(): void {
	// No-op.
}
