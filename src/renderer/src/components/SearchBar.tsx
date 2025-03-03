import { useEffect, useCallback } from 'react'
import { matchesPinyinSearch } from '../utils/pinyin'
import '../styles/AppList.css'

interface SearchBarProps {
    searchTerm: string
    setSearchTerm: (term: string) => void
    onRefresh: () => void
    apps: any[]
    setFilteredApps: (apps: any[]) => void
}

const SearchBar = ({
    searchTerm,
    setSearchTerm,
    onRefresh,
    apps,
    setFilteredApps
}: SearchBarProps): JSX.Element => {
    // 过滤应用列表
    const filterApps = useCallback(() => {
        if (!searchTerm.trim()) {
            setFilteredApps(apps)
        } else {
            const term = searchTerm.toLowerCase().trim()
            const filtered = apps.filter(
                (app) =>
                    (app.DisplayName && matchesPinyinSearch(app.DisplayName, term)) ||
                    (app.Publisher && matchesPinyinSearch(app.Publisher, term))
            )
            setFilteredApps(filtered)
        }
    }, [searchTerm, apps, setFilteredApps])

    useEffect(() => {
        filterApps()
    }, [searchTerm, apps, filterApps])

    return (
        <div className="search-container">
            <input
                type="text"
                placeholder="搜索软件..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button onClick={onRefresh}>刷新列表</button>
        </div>
    )
}

export default SearchBar
