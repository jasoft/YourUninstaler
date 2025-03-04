package main

import (
	"encoding/json"
	"fmt"
	"os"
	"sort"
	"strconv"
	"strings"

	"golang.org/x/sys/windows/registry"
)

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

func main() {
	// 设置输出编码为UTF-8
	// (在Go中这是默认行为，无需特别设置)

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

		subKeyNames, err := key.ReadSubKeyNames(-1) // 修复: 添加参数 -1 表示读取所有子键
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
					RegistryKey:     getKeyName(pathInfo.baseKey) + `\` + pathInfo.path + `\` + subKeyName, // 修复: 使用自定义函数获取键名
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

	// 输出JSON结果
	jsonData, err := json.MarshalIndent(result, "", "  ")
	if err != nil {
		errorResult := Result{
			Success: false,
			Error:   err.Error(),
		}
		jsonData, _ = json.Marshal(errorResult)
		fmt.Println(string(jsonData))
		os.Exit(1)
	}
	fmt.Println(string(jsonData))
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
