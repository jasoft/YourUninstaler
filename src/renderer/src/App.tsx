import { useState, useEffect } from 'react'
import './styles/App.css'
import './styles/InvalidApps.css'
import AppList from './components/AppList'
import Loading from './components/Loading'
import { InvalidApps } from './components/InvalidApps'
import { InstalledApp } from './types/InstalledApp'

function App(): JSX.Element {
    const [filteredApps, setFilteredApps] = useState<InstalledApp[]>([])
    const [isLoading, setIsLoading] = useState<boolean>(true)
    const [searchTerm, setSearchTerm] = useState<string>('')
    const [currentView, setCurrentView] = useState<'apps' | 'invalid' | 'tools'>('apps')

    const loadApps = async (): Promise<void> => {
        setIsLoading(true)
        try {
            const installedApps = await window.electron.ipcRenderer.invoke('get-installed-apps')
            setFilteredApps(installedApps)
        } catch (error) {
            console.error('加载应用列表时出错:', error)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        loadApps()
    }, [])

    return (
        <div className="container">
            <aside className="sidebar">
                <nav>
                    <ul className="nav-list">
                        <li className="nav-item">
                            <a 
                                href="#" 
                                className={`nav-link ${currentView === 'apps' ? 'active' : ''}`}
                                onClick={() => setCurrentView('apps')}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                                </svg>
                                应用列表
                            </a>
                        </li>
                        <li className="nav-item">
                            <a 
                                href="#" 
                                className={`nav-link ${currentView === 'invalid' ? 'active' : ''}`}
                                onClick={() => setCurrentView('invalid')}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                无效安装
                            </a>
                        </li>
                        <li className="nav-item">
                            <a 
                                href="#" 
                                className={`nav-link ${currentView === 'tools' ? 'active' : ''}`}
                                onClick={() => setCurrentView('tools')}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                系统工具
                            </a>
                        </li>
                    </ul>
                </nav>
            </aside>

            <main className="main-content">
                {currentView === 'apps' && (
                    <>
                        <header className="header">
                            <h1>应用管理器</h1>
                            <div>
                                <button className="btn btn-primary" onClick={loadApps}>
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="20" height="20" style={{ marginRight: '0.5rem' }}>
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    刷新列表
                                </button>
                            </div>
                        </header>
                        {isLoading ? (
                            <Loading />
                        ) : (
                            <AppList 
                                apps={filteredApps} 
                                onUninstall={loadApps} 
                                searchTerm={searchTerm}
                                onSearchChange={setSearchTerm}
                            />
                        )}
                    </>
                )}
                {currentView === 'invalid' && <InvalidApps />}
                {currentView === 'tools' && (
                    <div className="header">
                        <h1>系统工具</h1>
                    </div>
                )}
            </main>
        </div>
    )
}

export default App
