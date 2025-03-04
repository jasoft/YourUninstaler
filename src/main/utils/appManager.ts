import log from 'electron-log'
import { InstalledApp } from '../types/InstalledApp'
import path from 'path'
import { app } from 'electron'
import { execSync } from 'child_process'

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
    const getInstalledAppScript = path.join(app.getAppPath(), 'resources', 'get-installed-apps.exe')
    let cmdResult: string
    try {
        cmdResult = execSync(getInstalledAppScript).toString()
        log.info('获取appslist命令执行结果:', cmdResult)
    } catch (error) {
        log.error('执行PowerShell脚本失败:', error)
        throw new Error('执行PowerShell脚本失败')
    }

    let result: PowerShellAppsResult
    try {
        result = JSON.parse(cmdResult) as PowerShellAppsResult
    } catch (error) {
        log.error('解析PowerShell脚本结果失败:', error)
        throw new Error('解析PowerShell脚本结果失败')
    }

    if (!result.success) {
        log.error('PowerShell脚本返回错误:', result.error)
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
