import React, { useState } from 'react'

interface Issue {
  type: string
  category: string
  details: string
  path: string
  action: string
  actionType: 'warning' | 'danger'
  icon: string
}

interface SummaryItem {
  number: string | number
  label: string
}

export const InvalidApps: React.FC = () => {
  const [scanProgress, setScanProgress] = useState<number>(75)

  const summaryData: SummaryItem[] = [
    { number: 15, label: '无效注册表项' },
    { number: 8, label: '残留文件' },
    { number: 3, label: '损坏的卸载程序' },
    { number: '1.2GB', label: '可释放空间' }
  ]

  const issues: Issue[] = [
    {
      type: '注册表残留',
      category: 'HKEY_LOCAL_MACHINE',
      details: 'Adobe Photoshop 2021 的注册表项仍然存在，但安装目录已不存在',
      path: 'SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Adobe Photoshop 2021',
      action: '清理注册表项',
      actionType: 'warning',
      icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
    },
    {
      type: '残留文件',
      category: '程序数据',
      details: '发现已卸载软件的残留文件和文件夹，总计 258MB',
      path: 'C:\\ProgramData\\Adobe\\Photoshop 2021\\',
      action: '删除文件',
      actionType: 'danger',
      icon: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'
    },
    {
      type: '损坏的卸载程序',
      category: '卸载程序',
      details: '卸载程序文件不存在或已损坏',
      path: 'C:\\Program Files\\Common Files\\Adobe\\Uninstall.exe',
      action: '强制移除',
      actionType: 'danger',
      icon: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
    }
  ]

  const handleStartScan = (): void => {
    // 开始新的扫描
    setScanProgress(0)
    
    // 模拟扫描进度
    const interval = setInterval(() => {
      setScanProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval)
          return 100
        }
        return prev + 10
      })
    }, 500)
  }

  return (
    <div className="container">
      <aside className="sidebar">
        <nav>
          <ul className="nav-list">
            <li className="nav-item">
              <a href="#" className="nav-link">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                应用列表
              </a>
            </li>
            <li className="nav-item">
              <a href="#" className="nav-link active">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                无效安装
              </a>
            </li>
            <li className="nav-item">
              <a href="#" className="nav-link">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                系统工具
              </a>
            </li>
          </ul>
        </nav>
      </aside>

      <main className="main-content">
        <header className="header">
          <h1>无效安装</h1>
          <div>
            <button className="btn btn-primary" title="开始系统扫描" onClick={handleStartScan}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="20" height="20" style={{ marginRight: '0.5rem' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              开始扫描
            </button>
          </div>
        </header>

        <div className="summary-section">
          <div className="progress-bar">
            <div className="progress-value" style={{ width: `${scanProgress}%` }}></div>
          </div>
          <div className="summary-grid">
            {summaryData.map((item, index) => (
              <div className="summary-item" key={index}>
                <div className="summary-number">{item.number}</div>
                <div className="summary-label">{item.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="issues-container">
          {issues.map((issue, index) => (
            <div className="issue-card" key={index}>
              <div className="issue-type">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={issue.icon} />
                </svg>
                {issue.type}
              </div>
              <div className="cleanup-type">{issue.category}</div>
              <div className="issue-details">
                {issue.details}
              </div>
              <div className="file-path">
                {issue.path}
              </div>
              <button className={`btn btn-${issue.actionType}`}>{issue.action}</button>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}