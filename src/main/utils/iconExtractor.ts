import { execSync } from 'child_process'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { app, protocol } from 'electron'
import log from 'electron-log'

// 创建永久图标缓存目录
const iconCacheDir = path.join(app.getPath('userData'), 'iconcache')
if (!fs.existsSync(iconCacheDir)) {
    fs.mkdirSync(iconCacheDir, { recursive: true })
    log.info('创建图标缓存目录:', iconCacheDir)
}

// 默认图标路径
const defaultIconPath = path.join(app.getAppPath(), 'resources', 'default_app.png')

// 生成缓存文件名
function generateCacheKey(exePath: string, iconIndex: number): string {
    const hash = crypto.createHash('md5').update(`${exePath}:${iconIndex}`).digest('hex')
    return hash + '.png'
}

// 检查图标是否已缓存
function isIconCached(cacheKey: string): boolean {
    const cachePath = path.join(iconCacheDir, cacheKey)
    return fs.existsSync(cachePath)
}

// 从缓存获取图标
function getIconFromCache(cacheKey: string): string {
    const cachePath = path.join(iconCacheDir, cacheKey)
    log.info('从缓存获取图标:', cachePath)
    return `app-icon://${encodeURIComponent(cachePath)}`
}

// 保存图标到缓存
function saveIconToCache(tempIconPath: string, cacheKey: string): void {
    const cachePath = path.join(iconCacheDir, cacheKey)
    fs.copyFileSync(tempIconPath, cachePath)
    log.info('图标已保存到缓存:', { cachePath })
}

// 获取默认图标URL
function getDefaultIconUrl(): string {
    return `app-icon://${encodeURIComponent(defaultIconPath)}`
}

// 注册自定义协议处理图标
export function registerIconProtocol(): void {
    protocol.handle('app-icon', (request) => {
        const url = request.url.replace('app-icon://', '')
        try {
            // 解码 URL，确保路径正确
            const filePath = decodeURIComponent(url)
            // Create a buffer from the file and use it in the Response
            const buffer = fs.readFileSync(filePath)
            return new Response(buffer)
        } catch (error) {
            log.error('访问图标文件失败:', error)
            return new Response(null, { status: 404 })
        }
    })
}

// 使用 extracticon.exe 从可执行文件提取图标，优先使用缓存
export async function extractIconEx(
    exePath: string,
    iconIndex: number = 0
): Promise<string | null> {
    try {
        // 确保路径存在
        if (!fs.existsSync(exePath)) {
            log.warn(`图标路径不存在，使用默认图标: ${exePath}`)
            return getDefaultIconUrl()
        }

        // 生成缓存键并检查缓存
        const cacheKey = generateCacheKey(exePath, iconIndex)
        if (isIconCached(cacheKey)) {
            log.info('使用缓存图标:', { exePath, iconIndex })
            return getIconFromCache(cacheKey)
        }

        log.info('从可执行文件提取图标:', { exePath, iconIndex })

        // 获取 extracticon.exe 的路径
        const extractIconExePath = path.join(app.getAppPath(), 'resources', 'extracticon.exe')

        if (!fs.existsSync(extractIconExePath)) {
            log.error(`提取图标工具不存在，使用默认图标: ${extractIconExePath}`)
            return getDefaultIconUrl()
        }

        // 执行提取图标命令
        const result = execSync(`"${extractIconExePath}" "${exePath}" ${iconIndex}`).toString()

        // 解析 JSON 结果
        try {
            const extractResult = JSON.parse(result)
            if (extractResult && extractResult.path) {
                // 保存到缓存
                log.info('提取图标成功:', { exePath, iconIndex, result: extractResult })
                saveIconToCache(extractResult.path, cacheKey)
                // 返回缓存路径
                return getIconFromCache(cacheKey)
            } else {
                log.warn(`无法提取图标，使用默认图标: ${exePath}`)
                saveIconToCache(defaultIconPath, cacheKey)
                return getIconFromCache(cacheKey)
            }
        } catch (parseError) {
            log.error(`解析提取图标结果时出错，使用默认图标: ${parseError}`)
            return getDefaultIconUrl()
        }
    } catch (error) {
        log.error('提取图标时出错，使用默认图标:', {
            error: error instanceof Error ? error.message : String(error)
        })
        return getDefaultIconUrl()
    }
}
