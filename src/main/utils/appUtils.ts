import log from 'electron-log'
import { InstalledApp } from '../types/InstalledApp'
import { runPowerShellScript } from './powershell'
import path from 'path'
import { app } from 'electron'

// PowerShell脚本结果接口
interface PowerShellAppsResult {
    success: boolean
    apps?: InstalledApp[]
    error?: string
}

/**
 * 获取已安装的应用列表
 * @param scriptPath PowerShell脚本路径
 * @returns 已格式化的应用列表
 */
export async function getInstalledApps(): Promise<InstalledApp[]> {
    log.info('开始执行PowerShell命令获取应用列表')
    const getInstalledAppScript = path.join(app.getAppPath(), 'resources', 'get-installed-apps.ps1')
    const cmdResult = runPowerShellScript(getInstalledAppScript)
    log.info('PowerShell命令执行结果:', cmdResult)

    if (!cmdResult.success || !cmdResult.output) {
        throw new Error(cmdResult.error || '执行PowerShell命令失败')
    }

    const result = JSON.parse(cmdResult.output) as PowerShellAppsResult
    if (!result.success) {
        throw new Error(result.error || '获取应用列表失败')
    }

    const rawApps: InstalledApp[] = result.apps || []
    log.info('获取到原始应用列表:', { count: rawApps.length })

    // 处理每个应用，格式化安装日期和分配唯一ID
    const formattedApps: InstalledApp[] = rawApps.map((app, index) => ({
        ...app,
        InstallDate: app.InstallDate
            ? `${app.InstallDate.substring(0, 4)}-${app.InstallDate.substring(4, 6)}-${app.InstallDate.substring(6, 8)}`
            : '',
        appId: `app-${index}`
    }))

    log.info('应用列表处理完成:', { count: formattedApps.length })
    return formattedApps
}
