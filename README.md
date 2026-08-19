# Executor

A lightweight VS Code extension for running a saved terminal command from the Activity Bar and editor toolbar.

## Features

- Save a custom command in a dedicated Activity Bar panel
- Run it in the integrated terminal with one click
- Reuse the same Executor terminal when it is available
- Show a live running state in the editor toolbar
- Switch from Run to Stop while the command is active

## How it works

1. Open the Executor view in the Activity Bar.
2. Enter the shell command you want to run.
3. Click Save command.
4. Use the Run button in the editor toolbar or the sidebar button to execute it.
5. While the command is running, the toolbar button changes to Stop, and the terminal is reused if still active.

## Example commands

```bash
npm run dev
```

```bash
ros2 node list
```

## Usage

### Activity Bar

The Executor panel is available from the VS Code Activity Bar. It lets you update the command and run it directly from the sidebar.

### Editor toolbar

When a command is configured, the editor toolbar exposes the Run command action. While it is active, the toolbar switches to a Stop command action so you can interrupt the process quickly.

## Requirements

- VS Code 1.125 or newer
- A terminal-compatible shell available in your environment

## Known limitations

- The extension currently manages a single named Executor terminal and reuses it when available.
- The command is stored in VS Code global state for the current user.
- The extension is currently not able to destinguise if the command is still running or not.

## Release notes

### 0.0.2
- Added settings
  - custom commands can now be edited in the settings 
- Removed extension from activity bar
- Reads no more from files in the workspace

### 0.0.1

- Initial release with:
  - custom command editor in the Activity Bar
  - editor toolbar run/stop action

