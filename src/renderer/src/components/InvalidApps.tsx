import React, { useEffect, useState } from 'react'
import '../styles/InvalidApps.css'

interface Issue {
  name: string
  type: 'registry' | 'file' | 'uninstaller'
  category: string
  details: string
  path: string
  action: string
}

interface Summary {
  registryCount: number
  fileCount: number
  uninstallerCount: number
  totalSize: string
}

const iconPaths = {
  registry: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  file: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  uninstaller: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
}

export const InvalidApps: React.FC = () => {
  const [scanProgress, setScanProgress] = useState<number>(0)
  const [scanning, setScanning] = useState<boolean>(false)
  const [issues, setIssues] = useState<Issue[]>([])
  const [summary, setSummary] = useState<Summary>({
    registryCount: 0,
    fileCount: 0,
    uninstallerCount: 0,
    totalSize: '0 B'
  })

  const handleStartScan = async (): Promise<void> => {
    setScanning(true)
    setScanProgress(0)

    // 启动扫描进度动画
    const interval = setInterval(() => {
      setScanProgress(prev => {
        if (prev >= 90) {
          clearInterval(interval)
          return 90
        }
        return prev + 10
      })
    }, 500)

    try {
      const result = await window.electron.ipcRenderer.invoke('check-invalid-apps')
      setIssues(result.invalidApps)
      setSummary(result.summary)
      setScanProgress(100)
    } catch (error) {
      console.error('扫描无效安装时出错:', error)
    } finally {
      setScanning(false)
      clearInterval(interval)
    }
  }

  const handleCleanup = async (issue: Issue): Promise<void> => {
    try {
      let result;
      
      // 根据问题类型执行相应的清理操作
      if (issue.type === 'registry') {
        result = await window.electron.ipcRenderer.invoke('cleanup-registry', issue.path)
      } else if (issue.type === 'file') {
        result = await window.electron.ipcRenderer.invoke('cleanup-files', issue.path)
      } else {
        result = await window.electron.ipcRenderer.invoke('uninstall-app', issue.path)
      }

      if (result.success) {
        setIssues(prev => prev.filter(item => item.path !== issue.path))
        // 更新统计数据
        setSummary(prev => ({
          ...prev,
          registryCount: issue.type === 'registry' ? prev.registryCount - 1 : prev.registryCount,
          fileCount: issue.type === 'file' ? prev.fileCount - 1 : prev.fileCount,
          uninstallerCount: issue.type === 'uninstaller' ? prev.uninstallerCount - 1 : prev.uninstallerCount
        }))
      }
    } catch (error) {
      console.error('清理时出错:', error)
    }
  }

  useEffect(() => {
    handleStartScan()
  }, [])

  return (
    <>
      <header className="header">
        <h1>无效安装</h1>
        <div>
          <button 
            className="btn btn-primary" 
            title="开始系统扫描" 
            onClick={handleStartScan}
            disabled={scanning}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="20" height="20" style={{ marginRight: '0.5rem' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {scanning ? '扫描中...' : '开始扫描'}
          </button>
        </div>
      </header>

      <div className="summary-section">
        <div className="progress-bar">
          <div className="progress-value" style={{ width: `${scanProgress}%` }}></div>
        </div>
        <div className="summary-grid">
          <div className="summary-item">
            <div className="summary-number">{summary.registryCount}</div>
            <div className="summary-label">无效注册表项</div>
          </div>
          <div className="summary-item">
            <div className="summary-number">{summary.fileCount}</div>
            <div className="summary-label">残留文件</div>
          </div>
          <div className="summary-item">
            <div className="summary-number">{summary.uninstallerCount}</div>
            <div className="summary-label">损坏的卸载程序</div>
          </div>
          <div className="summary-item">
            <div className="summary-number">{summary.totalSize}</div>
            <div className="summary-label">可释放空间</div>
          </div>
        </div>
      </div>

      <div className="issues-container">
        {issues.map((issue, index) => (
          <div className="issue-card" key={index}>
            <div className="issue-type">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={iconPaths[issue.type]} />
              </svg>
              {issue.type === 'registry' ? '注册表残留' : 
               issue.type === 'file' ? '残留文件' : '损坏的卸载程序'}
            </div>
            <div className="cleanup-type">{issue.category}</div>
            <div className="issue-details">
              {issue.details}
            </div>
            <div className="file-path">
              {issue.path}
            </div>
            <button 
              className={`btn btn-${issue.type === 'registry' ? 'warning' : 'danger'}`}
              onClick={() => handleCleanup(issue)}
            >
              {issue.type === 'registry' ? '清理注册表项' : 
               issue.type === 'file' ? '删除文件' : '强制移除'}
            </button>
          </div>
        ))}
      </div>
    </>
  )
}