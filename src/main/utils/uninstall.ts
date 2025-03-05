import { spawn } from 'child_process'
import { join } from 'path'
import { InstalledApp } from '../types/InstalledApp'
import fs from 'fs'
import { execSync } from 'child_process'

export function splitCommandLine(str: string): { path: string; args: string } | null {
    // 处理已用引号包裹的路径
    if (str.startsWith('"')) {
        const endIdx = str.indexOf('"', 1)
        if (endIdx !== -1) {
            const path = str.substring(1, endIdx)
            const args = str.substring(endIdx + 1).trim()

            // 检查路径是否有效（不包含额外引号且文件存在）
            if (path.includes('"') || !fs.existsSync(path)) {
                return null
            }

            return { path, args }
        }
    }

    // 查找可能的.exe路径
    const exeIndex = str.toLowerCase().indexOf('.exe')
    if (exeIndex === -1) return null

    const pathPart = str.substring(0, exeIndex + 4)
    const argsPart = str.substring(exeIndex + 4).trim()

    // 检查路径是否存在
    if (fs.existsSync(pathPart)) {
        return { path: pathPart, args: argsPart }
    }

    // 回溯查找正确路径
    let lastSlash = pathPart.lastIndexOf('\\')
    while (lastSlash > 0) {
        const candidate = pathPart.substring(0, lastSlash)
        if (fs.existsSync(candidate) && candidate.toLowerCase().endsWith('.exe')) {
            const remaining = str.substring(candidate.length).trim()
            return { path: candidate, args: remaining }
        }
        lastSlash = candidate.lastIndexOf('\\')
    }

    return null
}

export function executeCommandSync(commandStr: string): void {
    const parsed = splitCommandLine(commandStr)
    if (!parsed) {
        console.error(`无法解析命令: ${commandStr}`)
        return
    }

    // 构造带引号的命令
    const fullCommand = `"${parsed.path}" ${parsed.args}`

    try {
        const output = execSync(fullCommand, {
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'inherit'] // 将标准错误输出到控制台
        })
        console.log('输出:', output)
    } catch (error) {
        console.error('执行失败:', error)
        // 可根据需要处理退出码: error.status
    }
}

/**
 * 使用appman.exe执行应用卸载
 * @param app 要卸载的应用程序对象
 * @returns Promise，解析为卸载结果
 */
export async function uninstallApp(
    app: InstalledApp
): Promise<{ success: boolean; message?: string; error?: string }> {
    return new Promise((resolve) => {
        try {
            const appmanPath = join(__dirname, '../../../resources/appman.exe')
            const childProcess = spawn(appmanPath, ['uninstall', app.DisplayName], {
                shell: true,
                windowsHide: false
            })

            console.log(`开始卸载 ${app.DisplayName}`)

            const timeout = setTimeout(
                () => {
                    resolve({
                        success: false,
                        error: '卸载操作超时'
                    })
                },
                10 * 60 * 1000
            )

            childProcess.on('error', (error: Error) => {
                clearTimeout(timeout)
                resolve({
                    success: false,
                    error: `卸载进程启动失败: ${error.message}`
                })
            })

            childProcess.on('exit', (code, signal) => {
                clearTimeout(timeout)
                if (code === 0) {
                    resolve({
                        success: true,
                        message: `应用 ${app.DisplayName} 已成功卸载`
                    })
                } else {
                    resolve({
                        success: false,
                        error: `卸载进程以非零状态退出 (${code || signal})`
                    })
                }
            })
        } catch (error) {
            resolve({
                success: false,
                error: `执行卸载命令时出错: ${(error as Error).message || String(error)}`
            })
        }
    })
}
