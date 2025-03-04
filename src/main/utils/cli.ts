import { runFullBenchmark } from './benchmark'

/**
 * 处理命令行参数
 */
export function handleCliArguments(args: string[]): void {
    if (args.includes('--benchmark')) {
        const iterationsArg = args.find((arg) => arg.startsWith('--iterations='))
        const iterations = iterationsArg ? parseInt(iterationsArg.split('=')[1], 10) : 100

        console.log(`正在启动性能测试，迭代次数: ${iterations}`)
        runFullBenchmark(iterations)
            .then(() => console.log('性能测试完成'))
            .catch((err) => console.error('性能测试失败:', err))
    }
}
