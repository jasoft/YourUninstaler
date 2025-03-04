import { jest, describe, expect, it, beforeEach } from '@jest/globals'
import { getInstalledApps } from '../main/utils/appManager'
import { InstalledApp } from '../main/types/InstalledApp'
import * as childProcess from 'child_process'

// 模拟 electron-log
jest.mock('electron-log', () => ({
    __esModule: true,
    default: {
        info: jest.fn(),
        error: jest.fn()
    }
}))

// 模拟 electron
jest.mock('electron', () => ({
    app: {
        getAppPath: jest.fn().mockReturnValue('/mock/app/path')
    }
}))

// 模拟 child_process
jest.mock('child_process', () => ({
    execSync: jest.fn()
}))

describe('appManager', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe('getInstalledApps', () => {
        it('应该成功返回格式化的应用列表', async () => {
            // 准备模拟数据
            const mockApps: InstalledApp[] = [
                {
                    DisplayName: 'Test App 1',
                    DisplayIcon: 'C:\\Program Files\\Test App 1\\icon.ico',
                    DisplayVersion: '1.0.0',
                    Publisher: 'Test Publisher',
                    InstallLocation: 'C:\\Program Files\\Test App 1',
                    UninstallString: 'C:\\Program Files\\Test App 1\\uninstall.exe',
                    InstallDate: '20230915',
                    RegistryKey:
                        'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\TestApp1',
                    appId: ''
                },
                {
                    DisplayName: 'Test App 2',
                    DisplayVersion: '2.0.0',
                    DisplayIcon: 'C:\\Program Files\\Test App 2\\icon.ico',
                    InstallDate: '20230915',
                    Publisher: 'Test Publisher 2',
                    InstallLocation: 'C:\\Program Files\\Test App 2',
                    UninstallString: 'C:\\Program Files\\Test App 2\\uninstall.exe',
                    RegistryKey:
                        'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\TestApp2',
                    appId: ''
                }
            ]

            const mockResult = {
                success: true,
                apps: mockApps
            }

            // 模拟 execSync 的返回值
            jest.spyOn(childProcess, 'execSync').mockReturnValue(
                Buffer.from(JSON.stringify(mockResult))
            )

            // 执行测试函数
            const result = await getInstalledApps()

            // 验证结果
            expect(result).toHaveLength(2)
            expect(result[0].DisplayName).toBe('Test App 1')
            expect(result[0].InstallDate).toBe('2023-09-15') // 验证日期格式化
            expect(result[0].appId).toBe('app-0') // 验证 appId 生成
            expect(result[1].appId).toBe('app-1')

            // 验证 execSync 被正确调用
            expect(childProcess.execSync).toHaveBeenCalledTimes(1)
            expect(childProcess.execSync).toHaveBeenCalledWith(
                '\\mock\\app\\path\\resources\\get-installed-apps.exe'
            )
        })

        it('应该处理没有安装日期的应用', async () => {
            // 准备模拟数据
            const mockApps: InstalledApp[] = [
                {
                    DisplayName: 'App Without Date',
                    UninstallString: 'C:\\uninstall.exe',
                    RegistryKey: 'HKLM\\Path',
                    appId: '',
                    DisplayVersion: '',
                    Publisher: '',
                    InstallDate: '',
                    InstallLocation: '',
                    DisplayIcon: ''
                }
            ]

            const mockResult = {
                success: true,
                apps: mockApps
            }

            // 模拟返回值
            jest.spyOn(childProcess, 'execSync').mockReturnValue(
                Buffer.from(JSON.stringify(mockResult))
            )

            // 执行测试
            const result = await getInstalledApps()

            // 验证没有日期的应用处理正确
            expect(result[0].InstallDate).toBe('')
            expect(result[0].appId).toBe('app-0')
        })

        it('应该处理错误情况', async () => {
            // 模拟失败结果
            const mockErrorResult = {
                success: false,
                error: '获取应用列表失败的错误信息'
            }

            jest.spyOn(childProcess, 'execSync').mockReturnValue(
                Buffer.from(JSON.stringify(mockErrorResult))
            )

            // 验证抛出异常
            await expect(getInstalledApps()).rejects.toThrow('获取应用列表失败的错误信息')
        })

        it('应该处理空应用列表', async () => {
            // 模拟空列表
            const mockEmptyResult = {
                success: true,
                apps: []
            }

            jest.spyOn(childProcess, 'execSync').mockReturnValue(
                Buffer.from(JSON.stringify(mockEmptyResult))
            )

            // 验证返回空数组
            const result = await getInstalledApps()
            expect(result).toEqual([])
            expect(result.length).toBe(0)
        })
    })
})
