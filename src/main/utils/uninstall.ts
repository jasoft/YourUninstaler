import { execSync } from 'child_process'
import * as fs from 'fs'

function parseUninstallCommand(str: string): { path: string; args: string } | null {
    // 处理已用引号包裹的路径
    if (str.startsWith('"')) {
        const endIdx = str.indexOf('"', 1)
        if (endIdx !== -1) {
            return {
                path: str.substring(1, endIdx),
                args: str.substring(endIdx + 1).trim()
            }
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
    const parsed = parseUninstallCommand(commandStr)
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
