import '@jest/globals'
import { describe, expect, it, beforeAll, jest } from '@jest/globals'
import { readFileSync } from 'fs'
import { join } from 'path'
import { runPowerShellScript } from '../main/utils/powershell'
import { InstalledApp } from '../main/types/InstalledApp'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

interface AppListResult {
    success: boolean
    apps: InstalledApp[]
    error?: string
}

// 设置较长的超时时间，因为扫描注册表可能需要一些时间
jest.setTimeout(30000)

describe('Get Installed Apps Script', () => {
    const scriptPath = join(__dirname, '../main/scripts/get-installed-apps.ps1')

    beforeAll(() => {
        // 确保脚本文件存在
        expect(readFileSync(scriptPath, 'utf8')).toBeTruthy()
    })

    it('should read PowerShell script successfully', () => {
        const script = readFileSync(scriptPath, 'utf8')
        expect(script).toContain('$OutputEncoding = [Text.Encoding]::UTF8')
        expect(script).toContain('$ErrorActionPreference = "Stop"')
    })

    it('should return valid app list', () => {
        const result = runPowerShellScript(scriptPath)

        console.log('PowerShell script result:', result)
        // 验证结果
        expect(result.success).toBe(true)
        expect(result.output).toBeDefined()

        // 解析结果
        const data = JSON.parse(result.output!) as AppListResult
        expect(data.success).toBe(true)
        expect(Array.isArray(data.apps)).toBe(true)

        // 验证应用列表不为空
        expect(data.apps.length).toBeGreaterThan(0)

        // 验证每个应用的必要字段
        const app = data.apps[0]
        expect(app.DisplayName).toBeDefined()
        expect(app.UninstallString).toBeDefined()
        expect(app.RegistryKey).toBeDefined()

        // 输出一些调试信息
        console.log('Total apps found:', data.apps.length)
        console.log('Sample app:', JSON.stringify(app, null, 2))
    })

    it('should handle duplicate apps correctly', () => {
        const result = runPowerShellScript(scriptPath)
        const data = JSON.parse(result.output!) as AppListResult

        // 检查是否有重复的 DisplayName
        const displayNames = data.apps.map((app) => app.DisplayName)
        const uniqueDisplayNames = new Set(displayNames)

        expect(displayNames.length).toBe(uniqueDisplayNames.size)
        console.log('Unique apps count:', uniqueDisplayNames.size)

        // 验证所有必要字段都不为空
        data.apps.forEach((app) => {
            expect(app.DisplayName).toBeTruthy()
            expect(app.UninstallString).toBeTruthy()
            expect(app.RegistryKey).toBeTruthy()
        })
    })
})
