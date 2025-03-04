/**
 * 已安装应用程序的接口定义
 */
export interface InstalledApp {
    DisplayName: string
    DisplayVersion: string
    Publisher: string
    InstallDate: string
    UninstallString: string
    InstallLocation: string
    DisplayIcon: string
    appId?: string
    RegistryKey: string // 注册表项路径
}
