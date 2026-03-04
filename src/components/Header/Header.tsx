import { useApp } from '../../context';
import './Header.css';

interface HeaderProps {
  onAddBook: () => void;
  onImportPDFs: () => void;
  importing?: boolean;
}

export function Header({ onAddBook, onImportPDFs, importing }: HeaderProps) {
  const { state, dispatch } = useApp();

  const togglePanel = () => {
    dispatch({ type: 'TOGGLE_PANEL' });
  };

  const openSettings = () => {
    dispatch({ type: 'OPEN_SETTINGS' });
  };

  return (
    <header className="header">
      <div className="header__brand">
        <div className="header__logo" />
        <div className="header__brand-text">
          <div className="header__title">Booky</div>
          <div className="header__subtitle">Your eBook Library</div>
        </div>
      </div>

      <button className="header__toggle" onClick={togglePanel} title="Toggle Panel">
        {state.panelVisible ? '☰' : '☷'}
      </button>

      <button className="header__toggle" onClick={openSettings} title="Settings">
        ⚙
      </button>

      <div className="header__search">
        <span className="header__search-icon">⌕</span>
        <input
          type="text"
          className="header__search-input"
          placeholder="Search books..."
          value={state.search}
          onChange={(e) => dispatch({ type: 'SET_SEARCH', payload: e.target.value })}
        />
        <kbd className="header__shortcut">Ctrl K</kbd>
      </div>

      <div className="header__actions">
        <button className="btn btn--ghost" onClick={onImportPDFs} disabled={importing}>
          {importing ? 'Importing...' : 'Import Books'}
        </button>
        <button className="btn btn--primary" onClick={onAddBook}>
          + Add Book
        </button>
      </div>
    </header>
  );
}
