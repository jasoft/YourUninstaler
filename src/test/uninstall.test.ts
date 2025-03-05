import { splitCommandLine } from '../main/utils/uninstall'
import * as fs from 'fs'
import '@jest/globals'
import { describe, expect, it, jest, beforeEach } from '@jest/globals'
// Mock fs.existsSync
jest.mock('fs')
const mockedExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>

describe('parseUninstallCommand', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        // 默认情况下,假设所有测试路径都存在
        mockedExistsSync.mockReturnValue(true)
    })

    describe('带引号的路径测试', () => {
        it('应正确解析带双引号的路径', () => {
            const result = splitCommandLine('"C:\\Program Files\\App\\uninstall.exe" /S')
            expect(result).toEqual({
                path: 'C:\\Program Files\\App\\uninstall.exe',
                args: '/S'
            })
        })

        it('应正确处理路径中包含空格的情况', () => {
            const result = splitCommandLine(
                '"C:\\Program Files (x86)\\My App\\uninstall.exe" /quiet'
            )
            expect(result).toEqual({
                path: 'C:\\Program Files (x86)\\My App\\uninstall.exe',
                args: '/quiet'
            })
        })

        it('应正确处理路径中包含特殊字符的情况', () => {
            const result = splitCommandLine('"C:\\Apps & Games\\Test (Beta)\\remove!.exe" /force')
            expect(result).toEqual({
                path: 'C:\\Apps & Games\\Test (Beta)\\remove!.exe',
                args: '/force'
            })
        })
    })

    describe('不带引号的路径测试', () => {
        it('应正确解析不带引号的基本路径', () => {
            const result = splitCommandLine('C:\\Apps\\uninstall.exe /S')
            expect(result).toEqual({
                path: 'C:\\Apps\\uninstall.exe',
                args: '/S'
            })
        })

        it('应正确处理正斜杠路径', () => {
            const result = splitCommandLine('C:/Apps/uninstall.exe /quiet')
            expect(result).toEqual({
                path: 'C:/Apps/uninstall.exe',
                args: '/quiet'
            })
        })

        it('应正确处理相对路径', () => {
            const result = splitCommandLine('.\\uninstall.exe /remove')
            expect(result).toEqual({
                path: '.\\uninstall.exe',
                args: '/remove'
            })
        })
    })

    describe('参数格式测试', () => {
        it('应正确处理带斜杠的参数', () => {
            const result = splitCommandLine('"C:\\App\\uninstall.exe" /S /quiet /norestart')
            expect(result).toEqual({
                path: 'C:\\App\\uninstall.exe',
                args: '/S /quiet /norestart'
            })
        })

        it('应正确处理带横线的参数', () => {
            const result = splitCommandLine('"C:\\App\\uninstall.exe" -s --no-confirm')
            expect(result).toEqual({
                path: 'C:\\App\\uninstall.exe',
                args: '-s --no-confirm'
            })
        })

        it('应正确处理带值的参数', () => {
            const result = splitCommandLine(
                '"C:\\App\\uninstall.exe" /mode=silent /log="C:\\logs\\uninstall.log"'
            )
            expect(result).toEqual({
                path: 'C:\\App\\uninstall.exe',
                args: '/mode=silent /log="C:\\logs\\uninstall.log"'
            })
        })
    })

    describe('边界情况测试', () => {
        it('当exe路径不存在时应返回null', () => {
            mockedExistsSync.mockReturnValue(false)
            const result = splitCommandLine('C:\\NonExist\\fake.exe /S')
            expect(result).toBeNull()
        })

        it('当命令字符串不包含.exe时应返回null', () => {
            const result = splitCommandLine('C:\\App\\uninstall.bat /S')
            expect(result).toBeNull()
        })

        it('应正确处理不完整的引号', () => {
            // 预期正确的行为应该是忽略不完整的引号，回退到.exe解析模式
            mockedExistsSync.mockImplementation((path) => {
                return path === 'C:\\App\\uninstall.exe'
            })

            const result = splitCommandLine('"C:\\App\\uninstall.exe /S')
            expect(result).toEqual(null)
        })

        it('应正确处理多余的引号', () => {
            mockedExistsSync.mockImplementation((path) => {
                return path === 'C:\\App\\uninstall.exe'
            })

            const result = splitCommandLine('C:\\App\\uninstall.exe" /S')
            expect(result).toEqual({
                path: 'C:\\App\\uninstall.exe',
                args: '\" /S'
            })
        })

        it('应处理命令字符串中含有多对引号的情况', () => {
            const result = splitCommandLine('"C:\\App\\uninstall.exe" /log="C:\\temp\\log.txt"')
            expect(result).toEqual({
                path: 'C:\\App\\uninstall.exe',
                args: '/log="C:\\temp\\log.txt"'
            })
        })

        it('应处理路径中含有引号字符的情况', () => {
            mockedExistsSync.mockImplementation((path) => {
                return path === 'C:\\App\\uninstall\\version.exe'
            })

            const result = splitCommandLine('"C:\\App\\uninstall\\"version.exe" /S')
            expect(result).toEqual(null)
        })

        it('应正确处理大小写混合的exe扩展名', () => {
            const result = splitCommandLine('C:\\App\\Uninstall.EXE /S')
            expect(result).toEqual({
                path: 'C:\\App\\Uninstall.EXE',
                args: '/S'
            })
        })

        it('应正确处理没有参数的命令', () => {
            const result = splitCommandLine('"C:\\App\\uninstall.exe"')
            expect(result).toEqual({
                path: 'C:\\App\\uninstall.exe',
                args: ''
            })
        })
    })

    describe('复杂路径测试', () => {
        it('应正确处理路径中包含多个空格和特殊字符', () => {
            const result = splitCommandLine(
                '"C:\\Program Files (x86)\\Company Name & Co\\App Name [v1.2]\\Uninstall Tool.exe" /S'
            )
            expect(result).toEqual({
                path: 'C:\\Program Files (x86)\\Company Name & Co\\App Name [v1.2]\\Uninstall Tool.exe',
                args: '/S'
            })
        })

        it('应正确处理UNC网络路径', () => {
            const result = splitCommandLine('"\\\\server\\share\\Apps\\uninstall.exe" /quiet')
            expect(result).toEqual({
                path: '\\\\server\\share\\Apps\\uninstall.exe',
                args: '/quiet'
            })
        })

        it('应正确处理环境变量路径', () => {
            const result = splitCommandLine('"$ProgramFiles\\App\\uninstall.exe" /S')
            expect(result).toEqual({
                path: '$ProgramFiles\\App\\uninstall.exe',
                args: '/S'
            })
        })
    })

    describe('路径回溯测试', () => {
        beforeEach(() => {
            mockedExistsSync.mockImplementation((path) => {
                if (path === 'C:\\Program Files\\App\\uninstall.exe') {
                    return true
                }
                return false
            })
        })

        it('应能找到部分匹配的exe路径', () => {
            const result = splitCommandLine('C:\\Program Files\\App\\uninstall.exe /S --extra-args')
            expect(result).toEqual({
                path: 'C:\\Program Files\\App\\uninstall.exe',
                args: '/S --extra-args'
            })
        })

        it('如果找不到有效路径应返回null', () => {
            mockedExistsSync.mockReturnValue(false)
            const result = splitCommandLine('C:\\Invalid\\Path\\fake.exe /S')
            expect(result).toBeNull()
        })
    })
})
