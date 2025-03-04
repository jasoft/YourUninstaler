import '@jest/globals'
import { describe, expect, it, beforeAll, jest } from '@jest/globals'
import path from 'path'

// 模拟 electron-log
jest.mock('electron-log', () => ({
    __esModule: true,
    default: {
        info: jest.fn(),
        error: jest.fn()
    }
}))

// 模拟 electron
jest.mock('electron', () => {
    // Create a mock path that represents workspace root
    const workspaceRoot = path.resolve(__dirname, '../../')

    return {
        app: {
            getAppPath: jest.fn().mockReturnValue(workspaceRoot)
        }
    }
})

// 最后导入被测试的模块，这样它就会使用上面设置的模拟
import { getInstalledApps } from '../main/utils/appManager'

// 设置较长的超时时间，因为扫描注册表可能需要一些时间
jest.setTimeout(30000)

describe('Get Installed Apps Script', () => {
    beforeAll(() => {
        // 确保脚本文件存在
    })

    it('should return valid app list', async () => {
        const result = await getInstalledApps()
        // Check that we have a reasonable number of apps
        expect(result.length).toBeGreaterThan(10)

        console.log('PowerShell script result:', result)
        // 验证结果
    })

    it('should return apps with meaningful DisplayName and UninstallString', async () => {
        const result = await getInstalledApps()

        // Check that all apps have a DisplayName
        for (const app of result) {
            expect(app.DisplayName).toBeDefined()
            expect(app.DisplayName.trim()).not.toBe('')
        }

        // Check that all apps have an UninstallString
        for (const app of result) {
            expect(app.UninstallString).toBeDefined()
            expect(app.UninstallString.trim()).not.toBe('')
        }

        // Log a few examples for manual verification
        console.log('Sample app entries:')
        console.log(result.slice(0, 3))
    })
})
