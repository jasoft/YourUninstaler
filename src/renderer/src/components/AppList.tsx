import { useState, useEffect } from 'react'
import type { InstalledApp } from '../types/InstalledApp'
import defaultAppIcon from '../assets/images/default_app.png'
import '../styles/AppList.css'

// 创建一个持久化的图标缓存
const globalIconCache = new Map<string, string>()

interface AppListProps {
    apps: InstalledApp[]
    onUninstall: () => void
    searchTerm: string
    onSearchChange: (term: string) => void
}

const AppList = ({ apps, onUninstall, searchTerm, onSearchChange }: AppListProps): JSX.Element => {
    const [, forceUpdate] = useState({})
    const [filteredApps, setFilteredApps] = useState(apps)
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
    const [selectedApps, setSelectedApps] = useState<Set<string>>(new Set())

    // 异步加载应用图标
    const loadAppIcons = async (appsToLoad: InstalledApp[]): Promise<void> => {
        const newApps = appsToLoad.filter(app => 
            app.DisplayIcon && 
            app.appId && 
            !globalIconCache.has(app.appId)
        )
        
        if (newApps.length === 0) return

        for (const app of newApps) {
            try {
                const iconPath = await window.electron.ipcRenderer.invoke(
                    'get-app-icon',
                    app.DisplayIcon
                )
                if (iconPath && app.appId) {
                    globalIconCache.set(app.appId!, iconPath)
                    forceUpdate({})  // 触发重新渲染
                }
            } catch (error) {
                console.error(`加载应用 ${app.DisplayName || '未知'} 的图标时出错:`, error)
            }
        }
    }

    useEffect(() => {
        // 只在组件初始化和新应用加入时加载图标
        const uncachedApps = apps.filter(app => app.appId && !globalIconCache.has(app.appId))
        if (uncachedApps.length > 0) {
            loadAppIcons(apps)
        }
    }, [apps])

    useEffect(() => {
        if (searchTerm.trim() === '') {
            setFilteredApps(apps)
        } else {
            const filtered = apps.filter(
                (app) =>
                    (app.DisplayName?.toLowerCase() ?? '').includes(searchTerm.toLowerCase()) ||
                    (app.Publisher?.toLowerCase() ?? '').includes(searchTerm.toLowerCase())
            )
            setFilteredApps(filtered)
        }
    }, [searchTerm, apps])

    const handleUninstall = async (uninstallString: string, appName: string): Promise<void> => {
        if (confirm(`确定要卸载 "${appName}" 吗？`)) {
            try {
                const result = await window.electron.ipcRenderer.invoke(
                    'uninstall-app',
                    uninstallString
                )
                if (result.success) {
                    onUninstall()
                } else {
                    alert(`"${appName}" 卸载失败\n\n${result.error}`)
                }
            } catch (error) {
                alert(`"${appName}" 卸载过程中发生错误`)
                console.error(error)
            }
        }
    }

    const handleBatchUninstall = async (): Promise<void> => {
        if (selectedApps.size === 0) {
            alert('请先选择要卸载的应用')
            return
        }

        if (confirm(`确定要卸载选中的 ${selectedApps.size} 个应用吗？`)) {
            const selectedAppsList = filteredApps.filter(
                (app) => app.appId && selectedApps.has(app.appId)
            )
            for (const app of selectedAppsList) {
                if (app.UninstallString) {
                    await handleUninstall(app.UninstallString, app.DisplayName)
                }
            }
            setSelectedApps(new Set())
        }
    }

    const toggleAppSelection = (appId: string): void => {
        setSelectedApps((prev) => {
            const newSelection = new Set(prev)
            if (newSelection.has(appId)) {
                newSelection.delete(appId)
            } else {
                newSelection.add(appId)
            }
            return newSelection
        })
    }

    const renderAppCard = (app: InstalledApp): JSX.Element => (
        <div key={app.appId} className="app-card">
            <div className="checkbox-wrapper">
                <label className="visually-hidden">
                    选择 {app.DisplayName}
                    <input
                        type="checkbox"
                        className="app-checkbox"
                        aria-label={`选择 ${app.DisplayName}`}
                        checked={app.appId ? selectedApps.has(app.appId) : false}
                        onChange={() => app.appId && toggleAppSelection(app.appId)}
                    />
                </label>
            </div>
            {app.appId && globalIconCache.has(app.appId) ? (
                <img
                    src={globalIconCache.get(app.appId)}
                    alt={`${app.DisplayName} 图标`}
                    className="app-icon"
                />
            ) : (
                <img
                    src={defaultAppIcon}
                    alt="默认应用图标"
                    className="app-icon"
                />
            )}
            <div className="app-info">
                <div className="app-name">{app.DisplayName || '未知'}</div>
                <div className="app-publisher">{app.Publisher || '未知'}</div>
                <div className="app-version">版本: {app.DisplayVersion || '未知'}</div>
            </div>
            <div className="app-actions">
                <button
                    className="btn btn-danger"
                    onClick={() =>
                        app.UninstallString &&
                        app.DisplayName &&
                        handleUninstall(app.UninstallString, app.DisplayName)
                    }
                >
                    卸载
                </button>
            </div>
        </div>
    )

    return (
        <>
            <div className="batch-actions">
                <button
                    className="btn btn-danger"
                    onClick={handleBatchUninstall}
                    disabled={selectedApps.size === 0}
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        width="20"
                        height="20"
                        style={{ marginRight: '0.5rem' }}
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                    </svg>
                    批量卸载
                </button>
                <button className="btn btn-primary">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        width="20"
                        height="20"
                        style={{ marginRight: '0.5rem' }}
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                    </svg>
                    导出选中
                </button>
            </div>

            <div className="search-bar">
                <label className="visually-hidden" htmlFor="app-search">
                    搜索应用
                </label>
                <input
                    id="app-search"
                    type="text"
                    className="search-input"
                    placeholder="搜索应用..."
                    value={searchTerm}
                    onChange={(e) => onSearchChange(e.target.value)}
                />
                <div className="grid-list-toggle">
                    <button
                        className={`toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
                        onClick={() => setViewMode('list')}
                        title="列表视图"
                        aria-label="切换到列表视图"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            width="20"
                            height="20"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M4 6h16M4 10h16M4 14h16M4 18h16"
                            />
                        </svg>
                    </button>
                    <button
                        className={`toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
                        onClick={() => setViewMode('grid')}
                        title="网格视图"
                        aria-label="切换到网格视图"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            width="20"
                            height="20"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zm0 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4zm-10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4z"
                            />
                        </svg>
                    </button>
                </div>
            </div>

            <div className={viewMode === 'grid' ? 'app-grid' : 'app-list'}>
                {filteredApps.length === 0 ? (
                    <div style={{ padding: '1rem', textAlign: 'center' }}>没有找到应用</div>
                ) : (
                    filteredApps.map(renderAppCard)
                )}
            </div>
        </>
    )
}

export default AppList
