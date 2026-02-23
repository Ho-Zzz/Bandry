/**
 * Assets View Component
 * 
 * Table view for managing local folders and files accessible to AI agents.
 * Shows file paths, categories (raw/output/reference), and item counts.
 */

import { Folder, FileText, HardDrive, MoreVertical, Plus, Upload } from 'lucide-react';
import { clsx } from 'clsx';
import { MOCK_ASSETS } from '../../data/mock';
import type { Asset } from '../../types/app';

/**
 * AssetIcon Component
 * Displays folder or file icon based on asset type
 */
const AssetIcon = ({ type }: { type: Asset['type'] }) => {
  if (type === 'folder') {
    return (
      <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
        <Folder className="w-5 h-5 text-blue-600" />
      </div>
    );
  }

  return (
    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
      <FileText className="w-5 h-5 text-gray-600" />
    </div>
  );
};

/**
 * CategoryBadge Component
 * Color-coded badge for asset category
 */
const CategoryBadge = ({ category }: { category: Asset['category'] }) => {
  const configs: Record<Asset['category'], { label: string; className: string }> = {
    raw: {
      label: 'Raw',
      className: 'bg-purple-100 text-purple-700',
    },
    output: {
      label: 'Output',
      className: 'bg-green-100 text-green-700',
    },
    reference: {
      label: 'Reference',
      className: 'bg-gray-100 text-gray-700',
    },
  };

  const config = configs[category];

  return (
    <span
      className={clsx(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        config.className
      )}
    >
      {config.label}
    </span>
  );
};

/**
 * AssetRow Component
 * Individual asset row in the table
 */
const AssetRow = ({ asset }: { asset: Asset }) => (
  <tr className="hover:bg-gray-50/50 transition-colors">
    <td className="px-6 py-4">
      <div className="flex items-center gap-3">
        <AssetIcon type={asset.type} />
        <div>
          <div className="font-medium text-gray-900">{asset.name}</div>
          <div className="text-sm text-gray-500 font-mono">{asset.path}</div>
        </div>
      </div>
    </td>
    <td className="px-6 py-4">
      <CategoryBadge category={asset.category} />
    </td>
    <td className="px-6 py-4">
      <span className="text-sm text-gray-600 capitalize">{asset.type}</span>
    </td>
    <td className="px-6 py-4">
      <span className="text-sm text-gray-600">
        {asset.items !== undefined ? `${asset.items} items` : '—'}
      </span>
    </td>
    <td className="px-6 py-4 text-right">
      <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
        <MoreVertical size={18} />
      </button>
    </td>
  </tr>
);

/**
 * Assets Component
 * 
 * File and folder management view for assets accessible to AI agents.
 * Organized in a table with category badges and item counts.
 * 
 * @example
 * ```tsx
 * <Assets />
 * ```
 */
export const Assets = () => {
  const totalItems = MOCK_ASSETS.reduce(
    (sum, asset) => sum + (asset.items || 0),
    0
  );

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Files</h1>
          <p className="text-gray-500">
            Manage folders and files accessible to your AI agents
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg transition-colors">
            <Upload size={16} />
            Upload
          </button>
          <button className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
            <Plus size={16} />
            Add Folder
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <HardDrive size={16} />
            <span className="text-sm">Total Assets</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {MOCK_ASSETS.length}
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <Folder size={16} />
            <span className="text-sm">Folders</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {MOCK_ASSETS.filter((a) => a.type === 'folder').length}
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <FileText size={16} />
            <span className="text-sm">Files</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {MOCK_ASSETS.filter((a) => a.type === 'file').length}
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <span className="text-sm">Total Items</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{totalItems}</div>
        </div>
      </div>

      {/* Assets Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Items
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {MOCK_ASSETS.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-12 text-center text-gray-500"
                  >
                    <HardDrive className="w-8 h-8 mx-auto mb-3 text-gray-300" />
                    <p>No assets configured</p>
                    <p className="text-sm mt-1">
                      Add folders or files to make them accessible to AI agents
                    </p>
                  </td>
                </tr>
              ) : (
                MOCK_ASSETS.map((asset) => (
                  <AssetRow key={asset.id} asset={asset} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Storage Info */}
      <div className="mt-6 flex items-center gap-2 text-sm text-gray-500">
        <HardDrive size={14} />
        <span>
          Assets are stored locally and accessible to AI agents based on their
          configuration
        </span>
      </div>
    </div>
  );
};
