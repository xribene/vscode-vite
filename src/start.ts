import { window } from 'vscode'
import { composeUrl, Config } from './config'
import { getName, tryPort, waitFor } from './utils'
import { ctx } from './Context'
import { endProcess, executeCommand } from './terminal'
import { updateStatusBar } from './statusBar'
import { closePanel } from './open'

export async function start({
  mode = 'dev',
  searchPort = !ctx.active,
  waitForStart = true,
  stopPrevious = true,
} = {}) {
  if (stopPrevious)
    stop()
  if (mode !== ctx.currentMode)
    closePanel()

  ctx.currentMode = mode as any

  if (!ctx.port || searchPort)
    ctx.port = await tryPort(Config.port)
  ctx.url = composeUrl(ctx.port)

  ctx.ext.globalState.update('port', ctx.port)

  if (mode === 'dev') {
    let command = Config.devCommand
    if (!command) {
      command = ctx.command === 'vitepress'
        ? Config.vitepressBase
          ? `npx vitepress dev ${Config.vitepressBase}`
          : 'npx vitepress'
        : 'npx vite'
    }

    const commandParts = command.split(' ')
    commandParts.splice(1, 0, `-C ${Config.root}`)
    command = commandParts.join(' ')

    command += ` --port=${ctx.port}`

    executeCommand(command)
  }
  else {
    if (Config.buildCommand) {
      let command = Config.buildCommand
      const commandParts = command.split(' ')
      commandParts.splice(1, 0, `-C ${Config.root}`)
      command = commandParts.join(' ')
      executeCommand(command)
    }

    if (ctx.command === 'vitepress') {
      let path = '.vitepress/dist'
      if (Config.vitepressBase)
        path = `${Config.vitepressBase}/${path}`

      executeCommand(`npx live-server ${path} --port=${ctx.port} --no-browser`)
    }
    else {
      executeCommand(`npx live-server -C ${Config.root}/dist --port=${ctx.port} --no-browser`)
    }
  }

  if (waitForStart) {
    if (!await waitFor(ctx.url, Config.pingInterval, Config.maximumTimeout)) {
      window.showErrorMessage('❗️ Failed to start the server')
      stop()
    }
    else {
      if (Config.notifyOnStarted) {
        window.showInformationMessage(
          mode === 'build'
            ? `📦 ${getName(ctx.command)} build served at ${ctx.url}`
            : `⚡️ ${getName(ctx.command)} started at ${ctx.url}`)
      }
    }
  }

  ctx.active = true

  updateStatusBar()
}

export function stop() {
  ctx.active = false
  endProcess()
  updateStatusBar()
}
