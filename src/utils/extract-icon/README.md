# EXE 图标提取工具

从 Windows 可执行文件中提取图标并保存为 PNG 格式的命令行工具。

## 功能

- 从 EXE 文件中提取图标
- 支持指定索引号
- 以 JSON 格式返回结果
- 提供操作状态、生成的 PNG 路径和错误信息

## 用法

```bash
extract-icon <exe路径> [图标索引]
```

示例：

```bash
# 提取第一个图标（默认）
extract-icon C:\Windows\System32\notepad.exe

# 提取指定索引的图标
extract-icon C:\Windows\System32\shell32.dll 4
```

## 返回值

工具以 JSON 格式返回结果：

```json
{
  "success": true,
  "path": "C:\\icons\\notepad.exe_icon_0.png",
  "error": ""
}
```

或在失败时：

```json
{
  "success": false,
  "path": "",
  "error": "错误详情"
}
```

## 编译

```bash
go build -o extract-icon.exe
```
