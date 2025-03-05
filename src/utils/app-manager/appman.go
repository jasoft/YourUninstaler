package main

import (
"encoding/json"
"fmt"
"os"
"os/exec"
"sort"
"strconv"
"strings"
"time"

"github.com/shirou/gopsutil/v3/process"
"golang.org/x/sys/windows"
"golang.org/x/sys/windows/registry"
)

// STILL_ACTIVE is the exit code that indicates a process is still running
const STILL_ACTIVE uint32 = 259

type App struct {
	DisplayName     string `json:"DisplayName"`
	DisplayVersion  string `json:"DisplayVersion"`
	Publisher       string `json:"Publisher"`
	InstallDate     string `json:"InstallDate"`
	UninstallString string `json:"UninstallString"`
	InstallLocation string `json:"InstallLocation"`
	DisplayIcon     string `json:"DisplayIcon"`
	RegistryKey     string `json:"RegistryKey"`
	EstimatedSize   uint32 `json:"EstimatedSize"`
}

type Result struct {
	Success bool   `json:"success"`
	Apps    []App  `json:"apps"`
	Error   string `json:"error,omitempty"`
}

type UninstallResult struct {
Success bool   `json:"success"`
Message string `json:"message,omitempty"`
Error   string `json:"error,omitempty"`
Matches []App  `json:"matches,omitempty"` // 添加匹配的应用列表
}

// 查找所有名称包含指定字符串的应用
func findMatchingApps(apps []App, name string) []App {
    var matches []App
    lowerName := strings.ToLower(name)
    
    for _, app := range apps {
        appLowerName := strings.ToLower(app.DisplayName)
        if strings.Contains(appLowerName, lowerName) {
            matches = append(matches, app)
        }
    }
    
    return matches
}

// 获取注册表根键的字符串表示
func getKeyName(key registry.Key) string {
	switch key {
	case registry.CLASSES_ROOT:
		return "HKCR"
	case registry.CURRENT_USER:
		return "HKCU"
	case registry.LOCAL_MACHINE:
		return "HKLM"
	case registry.USERS:
		return "HKU"
	case registry.CURRENT_CONFIG:
		return "HKCC"
	default:
		return "UNKNOWN_KEY_" + strconv.Itoa(int(key))
	}
}

// 解析卸载命令，将其分离为路径和参数
func parseUninstallCommand(cmdStr string) (string, []string, error) {
	var cmd string
	var args []string

	cmdStr = strings.TrimSpace(cmdStr)

	// 处理已用引号包裹的路径
	if strings.HasPrefix(cmdStr, "\"") {
		endIdx := strings.Index(cmdStr[1:], "\"")
		if endIdx == -1 {
			return "", nil, fmt.Errorf("invalid command format: %s", cmdStr)
		}
		endIdx += 1 // 调整索引到原始字符串

		cmd = cmdStr[1:endIdx]
		if !isFileExists(cmd) {
			return "", nil, fmt.Errorf("executable not found: %s", cmd)
		}

		// 将剩余部分分割为参数
		remainingStr := strings.TrimSpace(cmdStr[endIdx+1:])
		if remainingStr != "" {
			args = parseArgs(remainingStr)
		}
	} else {
		// 没有引号的情况，寻找可能的.exe
		parts := strings.Split(cmdStr, " ")
		cmdPart := ""

		// 查找包含.exe的部分
		for i, part := range parts {
			cmdPart += part
			if strings.HasSuffix(strings.ToLower(cmdPart), ".exe") {
				cmd = cmdPart
				args = parts[i+1:]
				break
			}
			cmdPart += " "
		}

		if cmd == "" {
			return "", nil, fmt.Errorf("no executable found in command: %s", cmdStr)
		}

		if !isFileExists(cmd) {
			return "", nil, fmt.Errorf("executable not found: %s", cmd)
		}
	}

	return cmd, args, nil
}

// 辅助函数：解析命令行参数
func parseArgs(argsStr string) []string {
	var args []string
	var currentArg string
	inQuotes := false

	for _, char := range argsStr {
		switch char {
		case '"':
			inQuotes = !inQuotes
			currentArg += string(char)
		case ' ':
			if inQuotes {
				currentArg += string(char)
			} else if currentArg != "" {
				args = append(args, currentArg)
				currentArg = ""
			}
		default:
			currentArg += string(char)
		}
	}

	if currentArg != "" {
		args = append(args, currentArg)
	}

	return args
}

// 检查文件是否存在
func isFileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

// 启动进程并返回其PID
func startProcess(cmd string, args []string) (int, error) {
	// 处理命令路径，使用单引号包裹
	cmdPath := fmt.Sprintf("'%s'", strings.Trim(cmd, `"`))

	// 构建PowerShell命令
	var psCmd string
	if len(args) > 0 {
		// 如果有参数，添加-ArgumentList
		argsStr := fmt.Sprintf("'%s'", strings.Join(args, " "))
		psCmd = fmt.Sprintf(`Start-Process -FilePath %s -ArgumentList %s -Verb RunAs -Wait`, cmdPath, argsStr)
	} else {
		// 如果没有参数，不添加-ArgumentList
		psCmd = fmt.Sprintf(`Start-Process -FilePath %s -Verb RunAs -Wait`, cmdPath)
	}

	// 执行PowerShell命令
	command := exec.Command("powershell", "-NoProfile", "-NonInteractive", "-Command", psCmd)
	command.Stdout = os.Stdout
	command.Stderr = os.Stderr

	err := command.Run()
	if err != nil {
		return 0, fmt.Errorf("执行卸载命令失败: %v", err)
	}

	return command.Process.Pid, nil
}

// 获取进程的所有子进程PID
func getChildProcesses(pid int) ([]int, error) {
	var childPids []int
	processes, err := process.Processes()
	if err != nil {
		return nil, err
	}

	for _, proc := range processes {
		ppid, err := proc.Ppid()
		if err == nil && int(ppid) == pid {
			childPids = append(childPids, int(proc.Pid))
		}
	}

	return childPids, nil
}

// 递归获取所有后代进程
func getAllDescendants(pid int, visited map[int]bool) ([]int, error) {
	if visited[pid] {
		return nil, nil
	}
	visited[pid] = true

	var descendants []int
	children, err := getChildProcesses(pid)
	if err != nil {
		return nil, err
	}

	for _, childPid := range children {
		descendants = append(descendants, childPid)
		childDescendants, err := getAllDescendants(childPid, visited)
		if err != nil {
			return nil, err
		}
		descendants = append(descendants, childDescendants...)
	}

	return descendants, nil
}

// 检查进程是否仍在运行
func isProcessRunning(pid int) bool {
	handle, err := windows.OpenProcess(windows.PROCESS_QUERY_INFORMATION, false, uint32(pid))
	defer windows.CloseHandle(handle)

	var exitCode uint32
	err = windows.GetExitCodeProcess(handle, &exitCode)
	return err == nil && exitCode == STILL_ACTIVE
}

// 卸载应用并等待所有子进程结束
func (app *App) Uninstall() *UninstallResult {
	result := &UninstallResult{
		Success: false,
	}

	// 解析卸载命令
	cmd, args, err := parseUninstallCommand(app.UninstallString)
	if err != nil {
		result.Error = err.Error()
		return result
	}

	// 启动卸载进程
	pid, err := startProcess(cmd, args)
	if err != nil {
		result.Error = fmt.Sprintf("启动卸载进程失败: %s", err.Error())
		return result
	}

	// 监控进程树
	timeout := time.After(10 * time.Minute) // 10分钟超时
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			// 获取所有相关进程
			visited := make(map[int]bool)
			descendants, err := getAllDescendants(pid, visited)
			if err != nil {
				continue
			}

			// 检查主进程是否仍在运行
			mainProcessRunning := isProcessRunning(pid)

			// 检查是否还有子进程在运行
			anyChildRunning := false
			for _, descendantPid := range descendants {
				if isProcessRunning(descendantPid) {
					anyChildRunning = true
					break
				}
			}

			// 如果主进程和所有子进程都已结束，退出循环
			if !mainProcessRunning && !anyChildRunning {
				result.Success = true
				result.Message = fmt.Sprintf("应用 %s 已成功卸载", app.DisplayName)
				return result
			}

		case <-timeout:
			result.Error = "卸载超时，可能有进程仍在运行"
			return result
		}
	}
}

// 根据应用名称查找应用
func findAppByName(apps []App, name string) *App {
	lowerName := strings.ToLower(name)
	for _, app := range apps {
		if strings.ToLower(app.DisplayName) == lowerName {
			return &app
		}
	}
	return nil
}

// 获取所有已安装的应用列表
func getAllApps() (*Result, error) {
	result := &Result{
		Success: true,
		Apps:    []App{},
	}

	// 使用map存储临时应用列表，键为DisplayName
	tempApps := make(map[string]App)

	// 扫描注册表路径
	paths := []struct {
		baseKey registry.Key
		path    string
	}{
		{registry.LOCAL_MACHINE, `Software\Wow6432Node\Microsoft\Windows\CurrentVersion\Uninstall`},
		{registry.LOCAL_MACHINE, `Software\Microsoft\Windows\CurrentVersion\Uninstall`},
		{registry.CURRENT_USER, `Software\Microsoft\Windows\CurrentVersion\Uninstall`},
		{registry.CURRENT_USER, `Software\Wow6432Node\Microsoft\Windows\CurrentVersion\Uninstall`},
	}

	for _, pathInfo := range paths {
		key, err := registry.OpenKey(pathInfo.baseKey, pathInfo.path, registry.READ)
		if err != nil {
			continue
		}

		subKeyNames, err := key.ReadSubKeyNames(-1)
		if err != nil {
			key.Close()
			continue
		}

		for _, subKeyName := range subKeyNames {
			subKey, err := registry.OpenKey(key, subKeyName, registry.READ)
			if err != nil {
				continue
			}

			// 读取DisplayName和UninstallString
			displayName, _, _ := subKey.GetStringValue("DisplayName")
			uninstallString, _, _ := subKey.GetStringValue("UninstallString")

			// 检查SystemComponent值，如果为1则跳过
			systemComponent, _, err := subKey.GetIntegerValue("SystemComponent")
			if err == nil && systemComponent == 1 {
				subKey.Close()
				continue
			}

			if displayName != "" && uninstallString != "" {
				displayName = strings.TrimSpace(displayName)

				// 读取其他信息
				displayVersion, _, _ := subKey.GetStringValue("DisplayVersion")
				publisher, _, _ := subKey.GetStringValue("Publisher")
				installDate, _, _ := subKey.GetStringValue("InstallDate")
				installLocation, _, _ := subKey.GetStringValue("InstallLocation")
				displayIcon, _, _ := subKey.GetStringValue("DisplayIcon")
				estimatedSize, _, _ := subKey.GetIntegerValue("EstimatedSize")

				// 创建应用对象
				app := App{
					DisplayName:     displayName,
					DisplayVersion:  displayVersion,
					Publisher:       publisher,
					InstallDate:     installDate,
					UninstallString: uninstallString,
					InstallLocation: installLocation,
					DisplayIcon:     displayIcon,
					RegistryKey:     getKeyName(pathInfo.baseKey) + `\` + pathInfo.path + `\` + subKeyName,
					EstimatedSize:   uint32(estimatedSize),
				}

				// 检查是否需要更新临时列表
				existingApp, exists := tempApps[displayName]
				if !exists || compareVersions(displayVersion, existingApp.DisplayVersion) > 0 {
					tempApps[displayName] = app
				}
			}
			subKey.Close()
		}
		key.Close()
	}

	// 将map转换为数组
	apps := make([]App, 0, len(tempApps))
	for _, app := range tempApps {
		apps = append(apps, app)
	}

	// 按DisplayName排序
	sort.Slice(apps, func(i, j int) bool {
		return apps[i].DisplayName < apps[j].DisplayName
	})

	result.Apps = apps
	return result, nil
}

// 简单的版本比较函数
func compareVersions(v1, v2 string) int {
	if v1 == v2 {
		return 0
	}

	parts1 := strings.Split(v1, ".")
	parts2 := strings.Split(v2, ".")

	maxLen := len(parts1)
	if len(parts2) > maxLen {
		maxLen = len(parts2)
	}

	for i := 0; i < maxLen; i++ {
		var num1, num2 int
		if i < len(parts1) {
			fmt.Sscanf(parts1[i], "%d", &num1)
		}
		if i < len(parts2) {
			fmt.Sscanf(parts2[i], "%d", &num2)
		}

		if num1 < num2 {
			return -1
		} else if num1 > num2 {
			return 1
		}
	}

	return 0
}

func init() {
    // 设置控制台输入输出编码为UTF8
    kernel32 := windows.NewLazySystemDLL("kernel32.dll")
    setConsoleOutputCP := kernel32.NewProc("SetConsoleOutputCP")
    setConsoleInputCP := kernel32.NewProc("SetConsoleCP")
    
    // 同时设置输入和输出编码
    setConsoleOutputCP.Call(uintptr(65001)) // UTF-8
    setConsoleInputCP.Call(uintptr(65001))  // UTF-8
    
    // 强制刷新控制台设置
    fmt.Print("")
}

func main() {
    if len(os.Args) < 2 {
		fmt.Println("用法: appman <command> [arguments]")
		fmt.Println("可用命令:")
		fmt.Println("  list              - 列出所有已安装的应用名称")
		fmt.Println("  export            - 导出所有应用的详细信息(JSON格式)")
		fmt.Println("  uninstall <name>  - 卸载指定的应用")
		os.Exit(1)
	}

	command := os.Args[1]

	switch command {
	case "list":
		result, err := getAllApps()
		if err != nil {
			fmt.Printf("错误: 无法获取应用列表: %v\n", err)
			os.Exit(1)
		}
		for _, app := range result.Apps {
			fmt.Println(app.DisplayName)
		}

	case "export":
		result, err := getAllApps()
		if err != nil {
			errorResult := Result{
				Success: false,
				Error:   err.Error(),
			}
			jsonData, _ := json.Marshal(errorResult)
			fmt.Println(string(jsonData))
			os.Exit(1)
		}
		jsonData, _ := json.MarshalIndent(result, "", "  ")
		fmt.Println(string(jsonData))

	case "uninstall":
	    if len(os.Args) < 3 {
	        fmt.Println("错误: 请指定要卸载的应用名称")
	        os.Exit(1)
	    }

	    appName := os.Args[2]
	    result, err := getAllApps()
	    if err != nil {
	        fmt.Printf("错误: 无法获取应用列表: %v\n", err)
	        os.Exit(1)
	    }

	    matches := findMatchingApps(result.Apps, appName)
	    if len(matches) == 0 {
	        uninstallResult := UninstallResult{
	            Success: false,
	            Error:   fmt.Sprintf("未找到包含 '%s' 的应用", appName),
	        }
	        jsonData, _ := json.MarshalIndent(uninstallResult, "", "  ")
	        fmt.Println(string(jsonData))
	        os.Exit(1)
	    }

	    if len(matches) > 1 {
	        // 使用标准error输出，确保正确显示中文
	        width := 80  // 增加表格宽度
	        fmt.Fprintf(os.Stderr, "\n")
	        fmt.Fprintf(os.Stderr, "+--- 搜索到 %d 个匹配程序 ", len(matches))
	        fmt.Fprintf(os.Stderr, strings.Repeat("-", width-len(fmt.Sprintf("--- 搜索到 %d 个匹配程序 ", len(matches)))-2))
	        fmt.Fprintf(os.Stderr, "+\n")
	        
	        for i, app := range matches {
	            displayName := app.DisplayName
	            if len(displayName) > width-8 {
	                displayName = displayName[:width-11] + "..."
	            }
	            fmt.Fprintf(os.Stderr, "| %2d) %-*s |\n", i+1, width-6, displayName)
	        }
	        
	        fmt.Fprintf(os.Stderr, "+"+strings.Repeat("-", width-2)+"+\n")
	        fmt.Fprintf(os.Stderr, "\n提示：找到多个匹配项，请选择并复制完整名称后重新运行命令\n\n")
	        os.Exit(1)
	    }

	    // 只有一个匹配项时执行卸载
	    uninstallResult := matches[0].Uninstall()
	    jsonData, _ := json.MarshalIndent(uninstallResult, "", "  ")
	    fmt.Println(string(jsonData))

	default:
		fmt.Printf("错误: 未知命令 '%s'\n", command)
		os.Exit(1)
	}
}
