import log from 'electron-log'
import { runPowerShellScript, runPowerShellCommand } from './powershell'
import path from 'path'
import { app } from 'electron'
import fs from 'fs'
import { extractIconEx } from './iconExtractor'

/**
 * 运行提取已安装程序的性能测试
 * @param iterations 迭代次数
 * @returns 测试结果
 */
export async function runExtractionBenchmark(iterations: number = 10): Promise<{
    totalTimeMs: number
    averageTimeMs: number
    minTimeMs: number
    maxTimeMs: number
    successRate: number
    avgProgramCount: number
}> {
    log.info(`开始执行提取已安装程序性能测试，迭代次数: ${iterations}`)

    const results: { timeMs: number; success: boolean; programCount: number }[] = []
    let successCount = 0
    let totalProgramCount = 0

    const startTime = Date.now()

    for (let i = 0; i < iterations; i++) {
        const iterationStart = Date.now()
        try {
            const programs = await extractIconEx('c:\\windows\\system32\\notepad.exe', 0)
            console.log(programs)
            const success = Array.isArray(programs)

            if (success) {
                successCount++
                totalProgramCount += programs.length
            }

            const timeMs = Date.now() - iterationStart
            results.push({
                timeMs,
                success,
                programCount: success ? programs.length : 0
            })

            log.debug(
                `提取迭代 ${i + 1}/${iterations}: ${timeMs}ms, 成功: ${success}, 程序数: ${success ? programs.length : 0}`
            )
        } catch (error) {
            const timeMs = Date.now() - iterationStart
            results.push({ timeMs, success: false, programCount: 0 })
            log.error(`提取迭代 ${i + 1}/${iterations} 失败:`, error)
        }
    }

    const totalTimeMs = Date.now() - startTime
    const timesArray = results.map((r) => r.timeMs)
    const averageTimeMs = timesArray.reduce((a, b) => a + b, 0) / results.length
    const minTimeMs = Math.min(...timesArray)
    const maxTimeMs = Math.max(...timesArray)
    const successRate = (successCount / iterations) * 100
    const avgProgramCount = successCount > 0 ? totalProgramCount / successCount : 0

    const benchmarkResult = {
        totalTimeMs,
        averageTimeMs,
        minTimeMs,
        maxTimeMs,
        successRate,
        avgProgramCount
    }

    log.info('提取已安装程序性能测试完成:', benchmarkResult)

    return benchmarkResult
}
/**
 * 运行简单的 PowerShell echo 命令性能测试
 * @param iterations 迭代次数
 * @returns 测试结果
 * 大概500ms左右
 */
export async function runSimpleEchoBenchmark(iterations: number = 100): Promise<{
    totalTimeMs: number
    averageTimeMs: number
    minTimeMs: number
    maxTimeMs: number
    successRate: number
}> {
    log.info(`开始执行简单 PowerShell echo 命令性能测试，迭代次数: ${iterations}`)

    const results: { timeMs: number; success: boolean }[] = []
    let successCount = 0

    const startTime = Date.now()

    for (let i = 0; i < iterations; i++) {
        const iterationStart = Date.now()
        try {
            const cmdResult = runPowerShellCommand('echo hello')
            const success = cmdResult.success && cmdResult.output === 'hello\r\n'

            if (success) {
                successCount++
            }

            const timeMs = Date.now() - iterationStart
            results.push({ timeMs, success })

            log.debug(`Echo 迭代 ${i + 1}/${iterations}: ${timeMs}ms, 成功: ${success}`)
        } catch (error) {
            const timeMs = Date.now() - iterationStart
            results.push({ timeMs, success: false })
            log.error(`Echo 迭代 ${i + 1}/${iterations} 失败:`, error)
        }
    }

    const totalTimeMs = Date.now() - startTime
    const timesArray = results.map((r) => r.timeMs)
    const averageTimeMs = timesArray.reduce((a, b) => a + b, 0) / results.length
    const minTimeMs = Math.min(...timesArray)
    const maxTimeMs = Math.max(...timesArray)
    const successRate = (successCount / iterations) * 100

    const benchmarkResult = {
        totalTimeMs,
        averageTimeMs,
        minTimeMs,
        maxTimeMs,
        successRate
    }

    log.info('简单 PowerShell echo 命令性能测试完成:', benchmarkResult)

    return benchmarkResult
}
/**
 * PowerShell 高频调用性能测试
 * @param iterations 迭代次数
 * @returns 测试结果
 * 大概1600ms左右
 */
export async function runPowerShellBenchmark(iterations: number = 100): Promise<{
    totalTimeMs: number
    averageTimeMs: number
    minTimeMs: number
    maxTimeMs: number
    successRate: number
}> {
    log.info(`开始执行 PowerShell 性能测试，迭代次数: ${iterations}`)

    const getInstalledAppScript = path.join(app.getAppPath(), 'resources', 'get-installed-apps.ps1')

    // 确保脚本文件存在
    if (!fs.existsSync(getInstalledAppScript)) {
        throw new Error(`脚本文件不存在: ${getInstalledAppScript}`)
    }

    const results: { timeMs: number; success: boolean }[] = []
    let successCount = 0

    const startTime = Date.now()

    for (let i = 0; i < iterations; i++) {
        const iterationStart = Date.now()
        try {
            const cmdResult = runPowerShellScript(getInstalledAppScript)
            const success = cmdResult.success && !!cmdResult.output

            if (success) {
                successCount++
            }

            const timeMs = Date.now() - iterationStart
            results.push({ timeMs, success })

            log.debug(`迭代 ${i + 1}/${iterations}: ${timeMs}ms, 成功: ${success}`)
        } catch (error) {
            const timeMs = Date.now() - iterationStart
            results.push({ timeMs, success: false })
            log.error(`迭代 ${i + 1}/${iterations} 失败:`, error)
        }
    }

    const totalTimeMs = Date.now() - startTime
    const timesArray = results.map((r) => r.timeMs)
    const averageTimeMs = timesArray.reduce((a, b) => a + b, 0) / results.length
    const minTimeMs = Math.min(...timesArray)
    const maxTimeMs = Math.max(...timesArray)
    const successRate = (successCount / iterations) * 100

    const benchmarkResult = {
        totalTimeMs,
        averageTimeMs,
        minTimeMs,
        maxTimeMs,
        successRate
    }

    log.info('PowerShell 性能测试完成:', benchmarkResult)

    return benchmarkResult
}

/**
 * 保存测试结果到文件
 */
export function saveBenchmarkResults(
    results: any,
    filename: string = 'powershell-benchmark.json'
): void {
    try {
        const savePath = path.join(app.getPath('userData'), filename)
        const data = {
            timestamp: new Date().toISOString(),
            results,
            system: {
                platform: process.platform,
                arch: process.arch,
                nodeVersion: process.version,
                electronVersion: process.versions.electron
            }
        }

        fs.writeFileSync(savePath, JSON.stringify(data, null, 2))
        log.info(`性能测试结果已保存到: ${savePath}`)
    } catch (error) {
        log.error('保存性能测试结果失败:', error)
    }
}

/**
 * 运行完整的测试并保存结果
 */
export async function runFullBenchmark(iterations: number = 100): Promise<void> {
    try {
        log.info('开始运行 PowerShell 高频调用性能测试')
        const results = await runExtractionBenchmark(iterations)

        // 将结果格式化为易读的形式并记录
        const summary = `
            测试结果摘要:
            ------------------------
            总执行时间: ${results.totalTimeMs}ms
            平均执行时间: ${results.averageTimeMs.toFixed(2)}ms
            最快执行时间: ${results.minTimeMs}ms
            最慢执行时间: ${results.maxTimeMs}ms
            成功率: ${results.successRate.toFixed(2)}%
            ------------------------
        `
        log.info(summary)

        // 保存测试结果
        saveBenchmarkResults(results)
    } catch (error) {
        log.error('性能测试执行失败:', error)
    }
}
