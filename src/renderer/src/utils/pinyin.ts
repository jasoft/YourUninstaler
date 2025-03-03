// 简化版拼音处理工具

// 用于汉字转拼音的映射表（仅包含常用汉字示例）
const pinyinMap: Record<string, string> = {
  啊: 'a',
  爱: 'ai',
  安: 'an',
  把: 'ba',
  百: 'bai',
  好: 'hao',
  你: 'ni',
  我: 'wo',
  中: 'zhong',
  国: 'guo'
  // 实际应用中需要更完整的映射表
}

// 获取字符的拼音首字母
function getPinyinInitial(char: string): string {
  if (/[a-zA-Z]/.test(char)) {
    return char.toLowerCase()
  }
  const pinyin = pinyinMap[char]
  return pinyin ? pinyin[0] : char
}

// 按拼音排序
export function sortByPinyin<T>(array: T[], keyFunc: (item: T) => string): T[] {
  return [...array].sort((a, b) => {
    const nameA = keyFunc(a) || ''
    const nameB = keyFunc(b) || ''

    // 使用拼音首字母进行排序
    return nameA.localeCompare(nameB, 'zh-CN')
  })
}

// 拼音搜索匹配
export function matchesPinyinSearch(text: string, searchTerm: string): boolean {
  if (!text || !searchTerm) return false

  // 直接字符串匹配
  if (text.toLowerCase().includes(searchTerm.toLowerCase())) {
    return true
  }

  // 拼音首字母匹配
  const pinyinInitials = text.split('').map(getPinyinInitial).join('')
  return pinyinInitials.includes(searchTerm.toLowerCase())
}
