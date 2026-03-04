import { useState, useEffect, useMemo, useCallback } from 'react';
import { useApp } from '../../context';
import './CollectionTree.css';

interface ContextMenu {
  x: number;
  y: number;
  collection: string;
}

export function CollectionTree() {
  const {
    state,
    dispatch,
    createCollection,
    deleteCollection,
    renameCollection,
    getAllCollections,
  } = useApp();

  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);

  const collections = useMemo(() => getAllCollections(), [state.books, state.collections]);

  // Get book count per collection
  const collectionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    state.books.forEach((book) => {
      book.collections.forEach((c) => {
        counts[c] = (counts[c] || 0) + 1;
      });
    });
    return counts;
  }, [state.books]);

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu]);

  const handleContextMenu = useCallback((e: React.MouseEvent, collection: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, collection });
  }, []);

  const handleAddCollection = () => {
    const name = prompt('Enter collection name:');
    if (!name?.trim()) return;
    createCollection(name.trim());
  };

  const handleRename = async () => {
    if (!contextMenu) return;
    const newName = prompt('Enter new name:', contextMenu.collection);
    if (!newName?.trim() || newName === contextMenu.collection) return;
    await renameCollection(contextMenu.collection, newName.trim());
    setContextMenu(null);
  };

  const handleDelete = async () => {
    if (!contextMenu) return;
    if (!confirm(`Delete "${contextMenu.collection}"? Books will NOT be deleted.`)) return;
    await deleteCollection(contextMenu.collection);
    setContextMenu(null);
  };

  const handleOpen = () => {
    if (!contextMenu) return;
    dispatch({ type: 'SET_ACTIVE_COLLECTION', payload: contextMenu.collection });
    setContextMenu(null);
  };

  return (
    <div className="collection-tree">
      {/* All Books */}
      <button
        className={`collection-tree__item collection-tree__all-books ${!state.activeCollection ? 'collection-tree__item--active' : ''}`}
        onClick={() => dispatch({ type: 'SET_ACTIVE_COLLECTION', payload: null })}
      >
        <span className="collection-tree__icon">📚</span>
        <span className="collection-tree__name">All Books</span>
        <span className="collection-tree__count">{state.books.length}</span>
      </button>

      {/* Collections */}
      {collections.length > 0 ? (
        collections.map((name) => (
          <button
            key={name}
            className={`collection-tree__item ${state.activeCollection === name ? 'collection-tree__item--active' : ''}`}
            onClick={() => dispatch({ type: 'SET_ACTIVE_COLLECTION', payload: name })}
            onContextMenu={(e) => handleContextMenu(e, name)}
          >
            <span className="collection-tree__icon">📁</span>
            <span className="collection-tree__name">{name}</span>
            <span className="collection-tree__count">{collectionCounts[name] || 0}</span>
          </button>
        ))
      ) : (
        <div className="collection-tree__empty">No collections yet</div>
      )}

      {/* Add Collection Button */}
      <button className="collection-tree__add-btn" onClick={handleAddCollection}>
        + New Collection
      </button>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="collection-tree__menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button className="collection-tree__menu-item" onClick={handleOpen}>
            📂 Open
          </button>
          <button className="collection-tree__menu-item" onClick={handleRename}>
            ✏️ Rename
          </button>
          <div className="collection-tree__menu-sep" />
          <button className="collection-tree__menu-item collection-tree__menu-item--danger" onClick={handleDelete}>
            🗑️ Delete
          </button>
        </div>
      )}
    </div>
  );
}
