# 设置输出编码
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$OutputEncoding = [Text.Encoding]::UTF8

# 错误处理设置
$ErrorActionPreference = "Stop"

try {
    # 初始化结果对象
    $result = @{
        success = $true
        apps    = @()
    }

    # 获取所有应用的临时列表
    $tempApps = @{}

    # 扫描两个注册表路径
    $paths = @(
        "HKLM:\Software\Wow6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*",
        "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
        "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
        "HKCU:\Software\Wow6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*"
    )

    foreach ($path in $paths) {
        $items = Get-ItemProperty $path -ErrorAction SilentlyContinue
        foreach ($item in $items) {
            if ($item.DisplayName -and $item.UninstallString) {
                $key = $item.DisplayName.Trim()
                
                # 如果是新应用或者版本更新，则更新记录
                if (-not $tempApps.ContainsKey($key) -or 
                    [version]::TryParse($item.DisplayVersion, [ref]$null)) {
                    
                    # 创建应用对象
                    $app = @{
                        DisplayName     = $key
                        DisplayVersion  = $item.DisplayVersion
                        Publisher       = $item.Publisher
                        InstallDate     = $item.InstallDate
                        UninstallString = $item.UninstallString
                        InstallLocation = $item.InstallLocation
                        DisplayIcon     = $item.DisplayIcon
                        RegistryKey     = $item.PSPath
                        EstimatedSize   = $item.EstimatedSize
                
                    }

                    # 更新临时列表
                    $tempApps[$key] = $app
                }
            }
        }
    }

    #去掉displayname相同的项
    $tempApps = $tempApps | Group-Object -Property DisplayName | ForEach-Object {
        $_.Group | Sort-Object -Property DisplayVersion -Descending | Select-Object -First 1
    }


    # 转换为数组并添加到结果中
    $result.apps = @($tempApps.Values)

    # 输出 JSON 结果
    ConvertTo-Json -InputObject $result -Depth 10 

}
catch {
    @{
        success = $false
        error   = $_.Exception.Message
    } | ConvertTo-Json -Compress
    exit 1
}