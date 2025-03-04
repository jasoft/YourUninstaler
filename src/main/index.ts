import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { extractIconEx, registerIconProtocol } from './iconExtractor'
import log from 'electron-log'
import { executeCommandSync } from './utils/uninstall'
import { checkInvalidApps, getInvalidAppsSummary } from './utils/appChecker'
import { runPowerShellCommand } from './utils/powershell'
import { getInstalledApps } from './utils/appUtils'

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

// 设置IPC处理程序
function setupIpcHandlers(): void {
    // 获取已安装的软件列表（不包含图标）
    ipcMain.handle('get-installed-apps', async () => {
        log.info('获取已安装的软件列表')

        try {
            const formattedApps = await getInstalledApps()
            return formattedApps
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            log.error('获取应用列表时出错:', errorMessage)
            throw error
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

    // 检查无效应用
    ipcMain.handle('check-invalid-apps', async () => {
        try {
            // 获取所有应用列表
            log.info('开始检查无效应用')
            const formattedApps = await getInstalledApps()

            // 检查无效应用
            const invalidApps = checkInvalidApps(formattedApps)
            const summary = getInvalidAppsSummary(invalidApps)

            log.info('完成无效应用检查:', {
                totalApps: formattedApps.length,
                invalidApps: invalidApps.length
            })

            return { invalidApps, summary }
        } catch (error) {
            log.error('检查无效应用时出错:', error)
            return {
                invalidApps: [],
                summary: {
                    registryCount: 0,
                    fileCount: 0,
                    uninstallerCount: 0,
                    totalSize: '0 B'
                }
            }
        }
    })

    // 清理无效注册表项
    ipcMain.handle('cleanup-registry', async (_, registryKey: string) => {
        try {
            log.info('开始执行清理注册表命令:', registryKey)
            const command = `Remove-Item -Path "${registryKey}" -Force`
            const result = runPowerShellCommand(command)
            return { success: result.success, error: result.error }
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            }
        }
    })

    // 删除残留文件
    ipcMain.handle('cleanup-files', async (_, filePath: string) => {
        try {
            log.info('开始执行清理文件命令:', filePath)
            const command = `Remove-Item -Path "${filePath}" -Recurse -Force`
            const result = runPowerShellCommand(command)
            return { success: result.success, error: result.error }
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            }
        }
    })

    // 卸载软件
    ipcMain.handle('uninstall-app', async (_, uninstallString: string) => {
        try {
            // 处理卸载命令
            const command = uninstallString.trim()
            log.info(`执行卸载命令: ${command}`)
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

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(() => {
    // Set app user model id for windows
    electronApp.setAppUserModelId('com.electron')

    // 注册自定义图标协议
    registerIconProtocol()

    // Default open or close DevTools by F12 in development
    // and ignore CommandOrControl + R in production.
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
