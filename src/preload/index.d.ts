import { ElectronAPI } from '@electron-toolkit/preload'
import { InstalledApp } from '../main/types/InstalledApp'

interface InvalidApp {
    name: string
    type: 'registry' | 'file' | 'uninstaller'
    category: string
    details: string
    path: string
    action: string
}

interface InvalidAppsSummary {
    registryCount: number
    fileCount: number
    uninstallerCount: number
    totalSize: string
}

interface CleanupResult {
    success: boolean
    error?: string
}

declare global {
    interface Window {
        electron: ElectronAPI
        api: {
            ipcRenderer: {
                invoke(channel: 'get-installed-apps'): Promise<InstalledApp[]>
                invoke(channel: 'check-invalid-apps'): Promise<{
                    invalidApps: InvalidApp[]
                    summary: InvalidAppsSummary
                }>
                invoke(channel: 'cleanup-registry', path: string): Promise<CleanupResult>
                invoke(channel: 'cleanup-files', path: string): Promise<CleanupResult>
                invoke(channel: 'uninstall-app', path: string): Promise<CleanupResult>
                invoke(channel: string, ...args: unknown[]): Promise<unknown>
                send(channel: string, ...args: unknown[]): void
            }
        }
    }
}

export {}

