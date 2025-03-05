import fs from 'fs'
import { InstalledApp } from '../types/InstalledApp'
import { splitCommandLine } from './uninstall'

export interface InvalidApp {
    name: string
    type: 'registry' | 'file' | 'uninstaller'
    category: string
    details: string
    path: string
    action: string
}

export function checkInvalidApps(apps: InstalledApp[]): InvalidApp[] {
    const invalidApps: InvalidApp[] = []

    for (const app of apps) {
        // 检查安装目录是否存在
        if (app.InstallLocation && !fs.existsSync(app.InstallLocation)) {
            invalidApps.push({
                name: app.DisplayName,
                type: 'registry',
                category: 'HKEY_LOCAL_MACHINE',
                details: `${app.DisplayName} 的注册表项仍然存在，但安装目录已不存在`,
                path: app.RegistryKey,
                action: '清理注册表项'
            })
        }

        // 检查卸载字符串是否有效
        const parsedUninstallString = splitCommandLine(app.UninstallString)
        if (
            !app.UninstallString ||
            !parsedUninstallString ||
            !fs.existsSync(parsedUninstallString.path)
        ) {
            invalidApps.push({
                name: app.DisplayName,
                type: 'uninstaller',
                category: '卸载程序',
                details: '卸载程序文件不存在或已损坏',
                path: app.UninstallString || '未知',
                action: '强制移除'
            })
        }

        // 检查是否有残留的程序数据
        const programDataPath = `C:\\ProgramData\\${app.Publisher}\\${app.DisplayName}`
        if (fs.existsSync(programDataPath)) {
            invalidApps.push({
                name: app.DisplayName,
                type: 'file',
                category: '程序数据',
                details: '发现已卸载软件的残留文件和文件夹',
                path: programDataPath,
                action: '删除文件'
            })
        }
    }

    return invalidApps
}

export interface InvalidAppsSummary {
    registryCount: number
    fileCount: number
    uninstallerCount: number
    totalSize: string
}

export function getInvalidAppsSummary(invalidApps: InvalidApp[]): InvalidAppsSummary {
    return {
        registryCount: invalidApps.filter((app) => app.type === 'registry').length,
        fileCount: invalidApps.filter((app) => app.type === 'file').length,
        uninstallerCount: invalidApps.filter((app) => app.type === 'uninstaller').length,
        totalSize: '1.2GB' // TODO: 实现实际文件大小计算
    }
}
