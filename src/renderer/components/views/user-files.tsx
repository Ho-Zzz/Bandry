/**
 * User Files View Component
 *
 * File manager for user-managed files that sync to OpenViking.
 * Supports creating folders, uploading files, deleting, and renaming.
 */

import { useState, useEffect } from 'react';
import { Folder, FileText, Plus, Trash2, Edit2, ChevronRight, Home } from 'lucide-react';
import { clsx } from 'clsx';
import type { FileEntry } from '../../../shared/ipc';

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

const formatDate = (timestamp: number): string => {
  return new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const UserFiles = () => {
  const [currentPath, setCurrentPath] = useState<string>('');
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<FileEntry | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [renameEntry, setRenameEntry] = useState<FileEntry | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const loadDirectory = async (path: string) => {
    setLoading(true);
    try {
      const result = await window.api.userFilesList({ dirPath: path });
      setEntries(result.entries);
      setCurrentPath(path);
    } catch (error) {
      console.error('Failed to load directory:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDirectory('');
  }, []);

  const handleNavigate = (entry: FileEntry) => {
    if (entry.type === 'directory') {
      loadDirectory(entry.path);
      setSelectedEntry(null);
    } else {
      setSelectedEntry(entry);
    }
  };

  const handleGoUp = () => {
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    const newPath = parts.join('/');
    loadDirectory(newPath);
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;

    try {
      const folderPath = currentPath ? `${currentPath}/${newFolderName}` : newFolderName;
      await window.api.userFilesCreateDir({ dirPath: folderPath });
      setNewFolderName('');
      setShowNewFolderInput(false);
      await loadDirectory(currentPath);
    } catch (error) {
      console.error('Failed to create folder:', error);
      alert('Failed to create folder');
    }
  };

  const handleDelete = async (entry: FileEntry) => {
    if (!confirm(`Are you sure you want to delete "${entry.name}"?`)) return;

    try {
      await window.api.userFilesDelete({
        filePath: entry.path,
        recursive: entry.type === 'directory'
      });
      await loadDirectory(currentPath);
      if (selectedEntry?.path === entry.path) {
        setSelectedEntry(null);
      }
    } catch (error) {
      console.error('Failed to delete:', error);
      alert('Failed to delete file/folder');
    }
  };

  const handleRename = async () => {
    if (!renameEntry || !renameValue.trim()) return;

    try {
      const pathParts = renameEntry.path.split('/');
      pathParts[pathParts.length - 1] = renameValue;
      const newPath = pathParts.join('/');

      await window.api.userFilesRename({
        oldPath: renameEntry.path,
        newPath: newPath
      });

      setRenameEntry(null);
      setRenameValue('');
      await loadDirectory(currentPath);
    } catch (error) {
      console.error('Failed to rename:', error);
      alert('Failed to rename file/folder');
    }
  };

  const pathBreadcrumbs = currentPath.split('/').filter(Boolean);

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">User Files</h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage your files - all files automatically sync to OpenViking
            </p>
          </div>
          <button
            onClick={() => setShowNewFolderInput(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus size={16} />
            New Folder
          </button>
        </div>

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm">
          <button
            onClick={() => loadDirectory('')}
            className="flex items-center gap-1 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <Home size={14} />
            <span>Home</span>
          </button>
          {pathBreadcrumbs.map((part, index) => (
            <div key={index} className="flex items-center gap-2">
              <ChevronRight size={14} className="text-gray-400" />
              <button
                onClick={() => {
                  const path = pathBreadcrumbs.slice(0, index + 1).join('/');
                  loadDirectory(path);
                }}
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                {part}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* File List */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* New Folder Input */}
          {showNewFolderInput && (
            <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateFolder();
                    if (e.key === 'Escape') {
                      setShowNewFolderInput(false);
                      setNewFolderName('');
                    }
                  }}
                  placeholder="Folder name"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
                <button
                  onClick={handleCreateFolder}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Create
                </button>
                <button
                  onClick={() => {
                    setShowNewFolderInput(false);
                    setNewFolderName('');
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Back Button */}
          {currentPath && (
            <button
              onClick={handleGoUp}
              className="flex items-center gap-2 px-4 py-2 mb-4 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Folder size={16} />
              <span>.. (Go up)</span>
            </button>
          )}

          {/* Entries */}
          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading...</div>
          ) : entries.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Folder className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>This folder is empty</p>
              <p className="text-sm mt-1">Create a new folder to get started</p>
            </div>
          ) : (
            <div className="space-y-2">
              {entries.map((entry) => (
                <div
                  key={entry.path}
                  className={clsx(
                    'flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors cursor-pointer',
                    selectedEntry?.path === entry.path && 'border-blue-500 bg-blue-50'
                  )}
                  onClick={() => handleNavigate(entry)}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {entry.type === 'directory' ? (
                      <Folder className="w-5 h-5 text-blue-500 flex-shrink-0" />
                    ) : (
                      <FileText className="w-5 h-5 text-gray-500 flex-shrink-0" />
                    )}
                    {renameEntry?.path === entry.path ? (
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRename();
                          if (e.key === 'Escape') {
                            setRenameEntry(null);
                            setRenameValue('');
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                      />
                    ) : (
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 truncate">{entry.name}</div>
                        {entry.type === 'file' && entry.size && (
                          <div className="text-sm text-gray-500">{formatBytes(entry.size)}</div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-4" onClick={(e) => e.stopPropagation()}>
                    {renameEntry?.path === entry.path ? (
                      <>
                        <button
                          onClick={handleRename}
                          className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                          title="Save"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setRenameEntry(null);
                            setRenameValue('');
                          }}
                          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Cancel"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setRenameEntry(entry);
                            setRenameValue(entry.name);
                          }}
                          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Rename"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(entry)}
                          className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Details Panel */}
        {selectedEntry && (
          <div className="w-80 bg-white border-l border-gray-200 p-6 overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">File Details</h3>
            <div className="space-y-4">
              <div>
                <div className="text-sm text-gray-500 mb-1">Name</div>
                <div className="text-sm font-medium text-gray-900">{selectedEntry.name}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500 mb-1">Type</div>
                <div className="text-sm text-gray-900 capitalize">{selectedEntry.type}</div>
              </div>
              {selectedEntry.size && (
                <div>
                  <div className="text-sm text-gray-500 mb-1">Size</div>
                  <div className="text-sm text-gray-900">{formatBytes(selectedEntry.size)}</div>
                </div>
              )}
              {selectedEntry.mimeType && (
                <div>
                  <div className="text-sm text-gray-500 mb-1">MIME Type</div>
                  <div className="text-sm text-gray-900">{selectedEntry.mimeType}</div>
                </div>
              )}
              {selectedEntry.createdAt && (
                <div>
                  <div className="text-sm text-gray-500 mb-1">Created</div>
                  <div className="text-sm text-gray-900">{formatDate(selectedEntry.createdAt)}</div>
                </div>
              )}
              {selectedEntry.updatedAt && (
                <div>
                  <div className="text-sm text-gray-500 mb-1">Modified</div>
                  <div className="text-sm text-gray-900">{formatDate(selectedEntry.updatedAt)}</div>
                </div>
              )}
              <div>
                <div className="text-sm text-gray-500 mb-1">Path</div>
                <div className="text-xs text-gray-600 font-mono break-all">{selectedEntry.path}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
