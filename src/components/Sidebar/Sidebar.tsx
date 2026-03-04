import { useMemo } from 'react';
import { useApp } from '../../context';
import { CollectionTree } from '../CollectionTree';
import type { SortOption } from '../../types';
import './Sidebar.css';

// SVG Icons
const icons = {
  books: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
    </svg>
  ),
  grid: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/>
      <rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/>
      <rect x="3" y="14" width="7" height="7"/>
    </svg>
  ),
  sort: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="6" x2="16" y2="6"/>
      <line x1="4" y1="12" x2="12" y2="12"/>
      <line x1="4" y1="18" x2="8" y2="18"/>
      <polyline points="15 15 18 18 21 15"/>
    </svg>
  ),
  folder: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  bookmark: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  library: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
      <line x1="3" y1="9" x2="21" y2="9"/>
      <line x1="9" y1="21" x2="9" y2="9"/>
    </svg>
  ),
  minus: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
      <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),
  plus: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19"/>
      <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),
};

export function Sidebar() {
  const { state, dispatch } = useApp();

  const filteredCount = useMemo(() => {
    return state.books.filter((b) => {
      if (state.filterReadLater && !b.readLater) return false;
      if (state.activeCollection && !b.collections.includes(state.activeCollection)) return false;
      if (state.search) {
        const hay = `${b.title} ${b.author} ${b.tags.join(' ')}`.toLowerCase();
        if (!hay.includes(state.search.toLowerCase())) return false;
      }
      return true;
    }).length;
  }, [state.books, state.filterReadLater, state.activeCollection, state.search]);

  const handleGoToShelf = () => {
    dispatch({ type: 'SET_ACTIVE_COLLECTION', payload: null });
    dispatch({ type: 'SET_FILTER_READ_LATER', payload: false });
    dispatch({ type: 'SET_SEARCH', payload: '' });
  };

  return (
    <aside className={`sidebar ${!state.panelVisible ? 'sidebar--hidden' : ''}`}>
      <div className="sidebar__scroll">
        <div className="sidebar__header">
          {icons.library}
          <h3 className="sidebar__title">Library</h3>
        </div>

        {/* Quick Shelf Button */}
        <button
          className={`sidebar__shelf-btn ${!state.activeCollection && !state.filterReadLater ? 'sidebar__shelf-btn--active' : ''}`}
          onClick={handleGoToShelf}
        >
          {icons.books}
          <span>My Shelf</span>
        </button>

        {/* Grid Size Slider */}
        <div className="sidebar__section">
          <label className="sidebar__label">
            {icons.grid}
            <span>View Size</span>
          </label>
          <div className="sidebar__slider-row">
            <button 
              className="sidebar__slider-btn"
              onClick={() => dispatch({
                type: 'SET_GRID_SETTINGS',
                payload: { shelfWidth: Math.max(120, state.gridSettings.shelfWidth - 20) },
              })}
            >
              {icons.minus}
            </button>
            <input
              type="range"
              className="sidebar__range"
              min="120"
              max="280"
              step="10"
              value={state.gridSettings.shelfWidth}
              onChange={(e) =>
                dispatch({
                  type: 'SET_GRID_SETTINGS',
                  payload: { shelfWidth: Number(e.target.value) },
                })
              }
            />
            <button 
              className="sidebar__slider-btn"
              onClick={() => dispatch({
                type: 'SET_GRID_SETTINGS',
                payload: { shelfWidth: Math.min(280, state.gridSettings.shelfWidth + 20) },
              })}
            >
              {icons.plus}
            </button>
          </div>
          <span className="sidebar__hint">{state.gridSettings.shelfWidth}px</span>
        </div>

        <div className="sidebar__section">
          <label className="sidebar__label">
            {icons.sort}
            <span>Sort By</span>
          </label>
          <select
            className="sidebar__select"
            value={state.sort}
            onChange={(e) => dispatch({ type: 'SET_SORT', payload: e.target.value as SortOption })}
          >
            <option value="custom">Custom Order</option>
            <option value="updated_desc">Recently Updated</option>
            <option value="title_asc">Title (A→Z)</option>
            <option value="author_asc">Author (A→Z)</option>
            <option value="year_desc">Year (Newest)</option>
            <option value="year_asc">Year (Oldest)</option>
          </select>
        </div>

        <div className="sidebar__section">
          <label className="sidebar__label">
            {icons.folder}
            <span>Collections</span>
          </label>
          <CollectionTree />
        </div>

        <div className="sidebar__section">
          <label className="sidebar__checkbox">
            <input
              type="checkbox"
              checked={state.filterReadLater}
              onChange={(e) => dispatch({ type: 'SET_FILTER_READ_LATER', payload: e.target.checked })}
            />
            <span className="sidebar__checkbox-icon">{icons.bookmark}</span>
            <span>Read Later only</span>
          </label>
        </div>

        <div className="sidebar__stats">
          <div className="sidebar__stat">
            <div className="sidebar__stat-value">{state.books.length}</div>
            <div className="sidebar__stat-label">Total Books</div>
          </div>
          <div className="sidebar__stat-divider" />
          <div className="sidebar__stat">
            <div className="sidebar__stat-value">{filteredCount}</div>
            <div className="sidebar__stat-label">Showing</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
