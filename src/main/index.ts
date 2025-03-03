import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { execSync } from 'child_process'
import { extractIconEx, registerIconProtocol } from './iconExtractor'
import log from 'electron-log'
import { InstalledApp } from './types/InstalledApp'
import { executeCommandSync } from './utils/uninstall'

function createWindow(): void {
    // Create the browser window.
    const mainWindow = new BrowserWindow({
        width: 900,
        height: 700,
        show: false,
        autoHideMenuBar: true,
        ...(process.platform === 'linux' ? { icon } : {}),
        webPreferences: {
            preload: join(__dirname, '../preload/index.js'),
            sandbox: false,
            nodeIntegration: true,
            contextIsolation: true
        }
    })

    mainWindow.on('ready-to-show', () => {
        mainWindow.show()
    })

    mainWindow.webContents.setWindowOpenHandler((details) => {
        shell.openExternal(details.url)
        return { action: 'deny' }
    })

    // HMR for renderer base on electron-vite cli.
    // Load the remote URL for development or the local html file for production.
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
        mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
        mainWindow.webContents.openDevTools()
    } else {
        mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
    }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
    // Set app user model id for windows
    electronApp.setAppUserModelId('com.electron')

    // 注册自定义图标协议
    registerIconProtocol()

    // Default open or close DevTools by F12 in development
    // and ignore CommandOrControl + R in production.
    // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
    app.on('browser-window-created', (_, window) => {
        optimizer.watchWindowShortcuts(window)
    })

    // 设置IPC处理程序
    setupIpcHandlers()

    createWindow()

    app.on('activate', function () {
        // On macOS it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

// 设置IPC处理程序
function setupIpcHandlers(): void {
    // 执行PowerShell命令的函数，支持UTF-8编码
    function runPowerShellCommand(command: string): {
        success: boolean
        output?: string
        error?: string
    } {
        try {
            // 确保命令使用UTF-8编码
            const encodedCommand =
                `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ${command};`.replace(
                    /\r?\n/g,
                    ' '
                )

            // 替换命令中的换行符，并使用execSync执行
            const finalCommand = `powershell -command "${encodedCommand}"`
            log.info(`执行PowerShell命令: ${finalCommand}`)
            const result = execSync(finalCommand, {
                encoding: 'utf8',
                maxBuffer: 1024 * 1024 * 10 // 10MB buffer for large outputs
            }).toString()

            return { success: true, output: result }
        } catch (error: unknown) {
            console.error('执行PowerShell命令时出错:', error)
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            }
        }
    }

    // 获取已安装的软件列表（不包含图标）
    ipcMain.handle('get-installed-apps', async () => {
        log.info('获取已安装的软件列表')
        try {
            // 使用PowerShell命令获取已安装软件
            const command = `
        Get-ItemProperty HKLM:\\Software\\Wow6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\* | 
        Select-Object DisplayName, DisplayVersion, Publisher, InstallDate, UninstallString, InstallLocation, DisplayIcon |
        Where-Object { $_.DisplayName -and $_.UninstallString } |
        ConvertTo-Json -Depth 1
      `

            const result = runPowerShellCommand(command)
            if (!result.success) {
                throw new Error(result.error)
            }

            const output = result.output
            if (!output) {
                throw new Error('未从PowerShell命令中收到输出')
            }

            let apps = JSON.parse(output)

            // 确保返回的是数组
            if (!Array.isArray(apps)) {
                apps = [apps]
            }

            // 处理每个应用，格式化安装日期和分配唯一ID
            // 使用导入的 InstalledApp 接口
            ;(apps as InstalledApp[]).forEach((app: InstalledApp, index: number) => {
                // 格式化安装日期
                if (app.InstallDate) {
                    const year: string = app.InstallDate.substring(0, 4)
                    const month: string = app.InstallDate.substring(4, 6)
                    const day: string = app.InstallDate.substring(6, 8)
                    app.InstallDate = `${year}-${month}-${day}`
                }

                // 分配唯一ID
                app.appId = `app-${index}`
            })

            return apps
        } catch (error) {
            console.error('获取应用列表时出错:', error)
            return []
        }
    })

    // 获取应用图标
    ipcMain.handle('get-app-icon', async (_, displayIcon: string) => {
        try {
            if (!displayIcon) {
                log.info('获取图标失败: 无效的displayIcon路径')
                return null
            }

            // 处理路径中的引号
            const iconPath = displayIcon.replace(/"/g, '')
            log.info('处理图标路径:', { original: displayIcon, cleaned: iconPath })

            // 处理不同格式: some.exe,1 或 some.exe 或 some.ico
            if (iconPath.includes(',')) {
                // 格式是 some.exe,1 这种情况
                const cleanPath = iconPath.split(',')[0]
                const index = parseInt(iconPath.split(',')[1] || '0')
                log.info('提取exe中的图标:', { cleanPath, index })
                const result = await extractIconEx(cleanPath, index)
                log.info('exe图标提取结果:', { cleanPath, index, result })
                return result
            } else if (iconPath.toLowerCase().endsWith('.ico')) {
                // 直接是 .ico 文件 - 使用自定义协议
                const result = `app-icon://${encodeURIComponent(iconPath)}`
                log.info('使用ico文件:', { iconPath, result })
                return result
            } else {
                // 普通可执行文件
                log.info('提取普通可执行文件图标:', { iconPath })
                const result = await extractIconEx(iconPath, 0)
                log.info('可执行文件图标提取结果:', { iconPath, result })
                return result
            }
        } catch (error) {
            log.error('获取应用图标失败:', { 
                displayIcon,
                error: error instanceof Error ? error.message : String(error)
            })
            return null
        }
    })

    // 卸载软件
    ipcMain.handle('uninstall-app', async (_, uninstallString: string) => {
        try {
            // 处理卸载命令
            const command = uninstallString.trim()

            log.info(`执行卸载命令1: ${command}`)

            executeCommandSync(command)

            return { success: true }
        } catch (error) {
            log.error('卸载应用时出错:', error)
            const errorText = error instanceof Error ? error.message : String(error)
            // 移除PowerShell错误输出中的多余字符
            const cleanError = errorText
                .replace(/At line:\d+/, '')
                .replace(/char:\d+/, '')
                .trim()
            return {
                success: false,
                error: cleanError
            }
        }
    })
}
