package main

import (
"encoding/json"
"errors"
"fmt"
"image"
"image/png"
"os"
"path/filepath"
"strconv"
"syscall"
"unsafe"
)

var (
moduser32  = syscall.NewLazyDLL("user32.dll")
modshell32 = syscall.NewLazyDLL("shell32.dll")
modgdi32   = syscall.NewLazyDLL("gdi32.dll")

procExtractIconExW    = modshell32.NewProc("ExtractIconExW")
procDestroyIcon       = moduser32.NewProc("DestroyIcon")
procGetIconInfo       = moduser32.NewProc("GetIconInfo")
procGetDIBits        = modgdi32.NewProc("GetDIBits")
procGetObject        = modgdi32.NewProc("GetObjectW")
procCreateCompatibleDC = modgdi32.NewProc("CreateCompatibleDC")
procDeleteDC         = modgdi32.NewProc("DeleteDC")
procDeleteObject     = modgdi32.NewProc("DeleteObject")
procSelectObject     = modgdi32.NewProc("SelectObject")

procExtractIconW = modshell32.NewProc("ExtractIconW")
)

const (
DIB_RGB_COLORS = 0
BI_RGB = 0
)

func alignTo4(n int32) int32 {
return (n + 3) & ^int32(3)
}

type IconResult struct {
Success bool   `json:"success"`
Path    string `json:"path"`
Error   string `json:"error,omitempty"`
}

type BITMAP struct {
BmType       int32
BmWidth      int32
BmHeight     int32
BmWidthBytes int32
BmPlanes     uint16
BmBitsPixel  uint16
BmBits       uintptr
}

type ICONINFO struct {
FIcon    int32
XHotspot uint32
YHotspot uint32
HbmMask  syscall.Handle
HbmColor syscall.Handle
}

type BITMAPINFOHEADER struct {
BiSize          uint32
BiWidth         int32
BiHeight        int32
BiPlanes        uint16
BiBitCount      uint16
BiCompression   uint32
BiSizeImage     uint32
BiXPelsPerMeter int32
BiYPelsPerMeter int32
BiClrUsed       uint32
BiClrImportant  uint32
}

func getIconCount(exePath string) int {
exePathUTF16, err := syscall.UTF16PtrFromString(exePath)
if err != nil {
return 0
}

count, _, _ := procExtractIconW.Call(
0,
uintptr(unsafe.Pointer(exePathUTF16)),
0xFFFFFFFF,
)

return int(count)
}

func HICONToImage(hicon syscall.Handle) (image.Image, error) {
var iconInfo ICONINFO
ret, _, _ := procGetIconInfo.Call(
uintptr(hicon),
uintptr(unsafe.Pointer(&iconInfo)),
)
if ret == 0 {
return nil, errors.New("GetIconInfo调用失败")
}
defer procDeleteObject.Call(uintptr(iconInfo.HbmColor))
defer procDeleteObject.Call(uintptr(iconInfo.HbmMask))

var bm BITMAP
ret, _, _ = procGetObject.Call(
uintptr(iconInfo.HbmColor),
uintptr(unsafe.Sizeof(bm)),
uintptr(unsafe.Pointer(&bm)),
)
if ret == 0 {
return nil, errors.New("GetObject调用失败")
}

width := int(bm.BmWidth)
height := int(bm.BmHeight)

if width <= 0 || height <= 0 {
return nil, errors.New("无效的图标尺寸")
}

hdc, _, _ := procCreateCompatibleDC.Call(0)
if hdc == 0 {
return nil, errors.New("CreateCompatibleDC调用失败")
}
defer procDeleteDC.Call(hdc)

oldBmp, _, _ := procSelectObject.Call(hdc, uintptr(iconInfo.HbmColor))
if oldBmp == 0 {
return nil, errors.New("SelectObject调用失败")
}
defer procSelectObject.Call(hdc, oldBmp)

stride := alignTo4(int32(width) * 4)

bi := BITMAPINFOHEADER{
BiSize:          uint32(unsafe.Sizeof(BITMAPINFOHEADER{})),
BiWidth:         int32(width),
BiHeight:        int32(-height),
BiPlanes:        1,
BiBitCount:      32,
BiCompression:   BI_RGB,
BiSizeImage:     uint32(int(stride) * height),
BiXPelsPerMeter: 0,
BiYPelsPerMeter: 0,
BiClrUsed:       0,
BiClrImportant:  0,
}

img := image.NewNRGBA(image.Rect(0, 0, width, height))

ret, _, _ = procGetDIBits.Call(
uintptr(hdc),
uintptr(iconInfo.HbmColor),
0,
uintptr(height),
uintptr(unsafe.Pointer(&img.Pix[0])),
uintptr(unsafe.Pointer(&bi)),
DIB_RGB_COLORS,
)
if ret == 0 {
return nil, errors.New("GetDIBits调用失败")
}

// 转换BGRA到RGBA并初始化Alpha通道
hasAlphaChannel := false
for i := 0; i < len(img.Pix); i += 4 {
// Convert BGRA to RGBA
b := img.Pix[i]
img.Pix[i] = img.Pix[i+2]
img.Pix[i+2] = b

// Check if the image has a valid alpha channel
if img.Pix[i+3] > 0 {
hasAlphaChannel = true
}
}

// 处理掩码
if iconInfo.HbmMask != 0 {
oldMaskBmp, _, _ := procSelectObject.Call(hdc, uintptr(iconInfo.HbmMask))
if oldMaskBmp != 0 {
defer procSelectObject.Call(hdc, oldMaskBmp)

maskRowSize := alignTo4((int32(width) + 7) / 8)
maskData := make([]byte, int(maskRowSize) * height)

biMask := bi
biMask.BiBitCount = 1
biMask.BiSizeImage = uint32(len(maskData))

ret, _, _ = procGetDIBits.Call(
uintptr(hdc),
uintptr(iconInfo.HbmMask),
0,
uintptr(height),
uintptr(unsafe.Pointer(&maskData[0])),
uintptr(unsafe.Pointer(&biMask)),
DIB_RGB_COLORS,
)

if ret != 0 {
// If the image doesn't have an alpha channel, use the mask to determine transparency
if !hasAlphaChannel {
for y := 0; y < height; y++ {
for x := 0; x < width; x++ {
byteIndex := y*int(maskRowSize) + x/8
bitMask := byte(0x80 >> uint(x%8))
imgIndex := y*img.Stride + x*4

if maskData[byteIndex]&bitMask != 0 {
// If mask bit is 1, the pixel should be transparent
img.Pix[imgIndex+3] = 0
} else {
// If mask bit is 0, the pixel should be opaque
img.Pix[imgIndex+3] = 255
}
}
}
} else {
// If the image has an alpha channel, only use mask for pixels with alpha = 0
for y := 0; y < height; y++ {
for x := 0; x < width; x++ {
byteIndex := y*int(maskRowSize) + x/8
bitMask := byte(0x80 >> uint(x%8))
imgIndex := y*img.Stride + x*4

if img.Pix[imgIndex+3] == 0 {
if maskData[byteIndex]&bitMask != 0 {
// Keep it transparent
img.Pix[imgIndex+3] = 0
} else {
// Make it opaque
img.Pix[imgIndex+3] = 255
}
}
}
}
}
}
}
} else if !hasAlphaChannel {
// If there's no mask and no alpha channel, make non-black pixels opaque
for i := 0; i < len(img.Pix); i += 4 {
if img.Pix[i] > 0 || img.Pix[i+1] > 0 || img.Pix[i+2] > 0 {
img.Pix[i+3] = 255
} else {
img.Pix[i+3] = 0
}
}
}

return img, nil
}

func extractIcon(exePath string, index int) (string, error) {
if _, err := os.Stat(exePath); os.IsNotExist(err) {
return "", errors.New("文件不存在")
}

iconCount := getIconCount(exePath)
if iconCount <= 0 {
return "", errors.New("文件中不包含图标")
}

if index < 0 || index >= iconCount {
return "", fmt.Errorf("无效的图标索引，文件包含 %d 个图标，有效索引范围是 0-%d", iconCount, iconCount-1)
}

exePathUTF16, err := syscall.UTF16PtrFromString(exePath)
if err != nil {
return "", err
}

var largeIcon syscall.Handle
ret, _, _ := procExtractIconExW.Call(
uintptr(unsafe.Pointer(exePathUTF16)),
uintptr(index),
uintptr(unsafe.Pointer(&largeIcon)),
0,
1,
)

if ret == 0 || largeIcon == 0 {
return "", errors.New("无法提取图标或指定索引的图标不存在")
}
defer procDestroyIcon.Call(uintptr(largeIcon))

outputDir := "icons"
if err := os.MkdirAll(outputDir, 0755); err != nil {
return "", err
}

baseName := filepath.Base(exePath)
outputPath := filepath.Join(outputDir, fmt.Sprintf("%s_icon_%d.png", baseName, index))

img, err := HICONToImage(largeIcon)
if err != nil {
return "", err
}

file, err := os.Create(outputPath)
if err != nil {
return "", err
}
defer file.Close()

if err := png.Encode(file, img); err != nil {
return "", err
}

absPath, err := filepath.Abs(outputPath)
if err != nil {
return outputPath, nil
}
return absPath, nil
}

func main() {
if len(os.Args) < 2 {
result := IconResult{
Success: false,
Error:   "用法: extract-icon <exe路径> [图标索引]",
}
json.NewEncoder(os.Stdout).Encode(result)
return
}

exePath := os.Args[1]
index := 0 // 默认提取第一个图标

if len(os.Args) > 2 {
var err error
index, err = strconv.Atoi(os.Args[2])
if err != nil {
result := IconResult{
Success: false,
Error:   "无效的图标索引",
}
json.NewEncoder(os.Stdout).Encode(result)
return
}
}

outputPath, err := extractIcon(exePath, index)
result := IconResult{
Success: err == nil,
Path:    outputPath,
}
if err != nil {
result.Error = err.Error()
}

json.NewEncoder(os.Stdout).Encode(result)
}
