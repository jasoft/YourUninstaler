import { execSync } from 'child_process'
import log from 'electron-log'

export interface PowerShellResult {
    success: boolean
    output?: string
    error?: string
}

export function runPowerShellScript(scriptPath: string): PowerShellResult {
    try {
        const output = execSync(
            `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${scriptPath}"`,
            {
                encoding: 'utf8',
                maxBuffer: 1024 * 1024 * 10,
                windowsHide: true
            }
        ).toString()

        return { success: true, output: output.trim() }
    } catch (error) {
        log.error('PowerShell script execution failed:', error)
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
        }
    }
}

export function runPowerShellCommand(command: string): PowerShellResult {
    // Force UTF-8 input and output encoding
    const encodedCommand = `$OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ${command}`
    try {
        const output = execSync(
            `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "${encodedCommand}"`,
            {
                encoding: 'utf8',
                maxBuffer: 1024 * 1024 * 10,
                windowsHide: true
            }
        ).toString()

        return { success: true, output: output.trim() }
    } catch (error) {
        log.error('PowerShell command execution failed:', error)
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
        }
    }
}
