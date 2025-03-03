package main

import (
	"image/png"
	"os"
	"testing"
)

func TestExtractVCRedistIcon(t *testing.T) {
	exePath := `C:\ProgramData\Package Cache\{f65db027-aff3-4070-886a-0d87064aabb1}\vcredist_x86.exe`
	index := 0

	// Skip if file doesn't exist on test system
	if _, err := os.Stat(exePath); os.IsNotExist(err) {
		t.Skip("Test file not found:", exePath)
	}

	outputPath, err := extractIcon(exePath, index)
	if err != nil {
		t.Fatal("Failed to extract icon:", err)
	}

	// Verify the output file exists and has content
	stat, err := os.Stat(outputPath)
	if err != nil {
		t.Fatal("Output file not found:", err)
	}

	if stat.Size() == 0 {
		t.Error("Output file is empty")
	}
}

func TestIconCountFunction(t *testing.T) {
	// This test checks if getIconCount returns a positive number for files known to have icons
	exePath := `C:\Windows\System32\shell32.dll`

	// Skip if file doesn't exist on test system
	if _, err := os.Stat(exePath); os.IsNotExist(err) {
		t.Skip("Test file not found:", exePath)
	}

	count := getIconCount(exePath)
	if count <= 0 {
		t.Errorf("Expected positive icon count for shell32.dll, got %d", count)
	}
}

func TestExtractingInvalidIcon(t *testing.T) {
	exePath := `C:\Windows\System32\notepad.exe`

	// Skip if file doesn't exist on test system
	if _, err := os.Stat(exePath); os.IsNotExist(err) {
		t.Skip("Test file not found:", exePath)
	}

	// Try to extract an invalid index
	count := getIconCount(exePath)
	if count > 0 {
		_, err := extractIcon(exePath, count+10) // Use an index that's guaranteed to be invalid
		if err == nil {
			t.Error("Expected error when extracting invalid icon index, but got nil")
		}
	}
}

func TestOutputFileHasValidContent(t *testing.T) {
	exePath := `C:\ProgramData\Package Cache\{f65db027-aff3-4070-886a-0d87064aabb1}\vcredist_x86.exe`

	// Skip if file doesn't exist on test system
	if _, err := os.Stat(exePath); os.IsNotExist(err) {
		t.Skip("Test file not found:", exePath)
	}

	outputPath, err := extractIcon(exePath, 0)
	if err != nil {
		t.Fatal("Failed to extract icon:", err)
	}

	// Read the image file to verify it's not just empty pixels
	file, err := os.Open(outputPath)
	if err != nil {
		t.Fatal("Failed to open output file:", err)
	}
	defer file.Close()

	img, err := png.Decode(file)
	if err != nil {
		t.Fatal("Failed to decode PNG file:", err)
	}

	// Check if image contains non-transparent pixels
	bounds := img.Bounds()
	allTransparent := true

	for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
		for x := bounds.Min.X; x < bounds.Max.X; x++ {
			_, _, _, a := img.At(x, y).RGBA()
			if a > 0 {
				allTransparent = false
				break
			}
		}
		if !allTransparent {
			break
		}
	}

	if allTransparent {
		t.Error("Output image contains only transparent pixels")
	}
}
