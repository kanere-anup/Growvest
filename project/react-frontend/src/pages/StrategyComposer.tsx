import React from 'react';
import { useState, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/MainLayout';
import { backtestApi, strategiesApi } from '@/services/api';
import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';
import {
  GripVertical,
  Plus,
  X,
  Save,
  ChevronDown,
  ChevronUp,
  Loader2,
  Layers,
  Zap,
  Puzzle,
  ArrowRight,
  Hash,
  Sliders,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { StrategyInfo, ConfigureStrategyRequest } from '@/types';

interface ComposerBlock {
  id: string;
  strategyName: string;
  displayName: string;
  description: string;
  parameters: Record<string, unknown>;
  weight: number;
  expanded: boolean;
}

const categoryColors: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  momentum: { bg: 'bg-blue-500/10', text: 'text-blue-500', border: 'border-blue-500/20', dot: 'bg-blue-500' },
  trend: { bg: 'bg-green-500/10', text: 'text-green-500', border: 'border-green-500/20', dot: 'bg-green-500' },
  volume: { bg: 'bg-purple-500/10', text: 'text-purple-500', border: 'border-purple-500/20', dot: 'bg-purple-500' },
  volatility: { bg: 'bg-orange-500/10', text: 'text-orange-500', border: 'border-orange-500/20', dot: 'bg-orange-500' },
  mean_reversion: { bg: 'bg-pink-500/10', text: 'text-pink-500', border: 'border-pink-500/20', dot: 'bg-pink-500' },
};

export function StrategyComposer() {
  const { theme } = useTheme();
  const [blocks, setBlocks] = useState<ComposerBlock[]>([]);
  const [composerName, setComposerName] = useState('My Custom Strategy');
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const { data: availableStrategies } = useQuery({
    queryKey: ['backtest-strategies'],
    queryFn: backtestApi.strategies,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: ConfigureStrategyRequest) => {
      return strategiesApi.configureStrategy(data);
    },
    onSuccess: () => toast.success('Strategy saved!'),
    onError: () => toast.error('Failed to save strategy'),
  });

  const addBlock = useCallback(
    (strategy: StrategyInfo) => {
      const newBlock: ComposerBlock = {
        id: `${strategy.name}-${Date.now()}`,
        strategyName: strategy.name,
        displayName: strategy.display_name,
        description: strategy.description,
        parameters: { ...(strategy.default_params || {}) },
        weight: 1,
        expanded: true,
      };
      setBlocks((prev) => [...prev, newBlock]);
    },
    []
  );

  const removeBlock = useCallback((id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const toggleExpand = useCallback((id: string) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, expanded: !b.expanded } : b))
    );
  }, []);

  const updateParam = useCallback(
    (blockId: string, key: string, value: string) => {
      setBlocks((prev) =>
        prev.map((b) => {
          if (b.id !== blockId) return b;
          const numVal = Number(value);
          return {
            ...b,
            parameters: {
              ...b.parameters,
              [key]: isNaN(numVal) ? value : numVal,
            },
          };
        })
      );
    },
    []
  );

  const updateWeight = useCallback((blockId: string, weight: number) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === blockId ? { ...b, weight } : b))
    );
  }, []);

  const handleDragStart = (idx: number) => {
    setDraggedIdx(idx);
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIdx(idx);
  };

  const handleDrop = (idx: number) => {
    if (draggedIdx === null || draggedIdx === idx) return;
    setBlocks((prev) => {
      const updated = [...prev];
      const [removed] = updated.splice(draggedIdx, 1);
      updated.splice(idx, 0, removed);
      return updated;
    });
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  const handleSaveFirst = () => {
    if (blocks.length === 0) {
      toast.error('Add at least one strategy block');
      return;
    }
    const first = blocks[0];
    saveMutation.mutate({
      strategy_id: '',
      custom_name: composerName,
      parameters: first.parameters,
      is_enabled: true,
      priority: 0,
    });
  };

  const totalWeight = blocks.reduce((sum, b) => sum + b.weight, 0);

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl icon-wrapper-primary">
              <Puzzle className="w-6 h-6 text-primary-500" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-bold text-theme-primary">
                Strategy Composer
              </h1>
              <p className="text-theme-secondary mt-0.5">
                Build custom screening pipelines with drag-and-drop
              </p>
            </div>
          </div>
          <button
            onClick={handleSaveFirst}
            disabled={blocks.length === 0 || saveMutation.isPending}
            className="btn-primary flex items-center gap-2"
          >
            {saveMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Pipeline
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Available Strategies Panel */}
          <div className="lg:col-span-1">
            <div className="card sticky top-20 animate-slide-up">
              <div className="card-header">
                <h3 className="font-semibold text-theme-primary flex items-center gap-2">
                  <Layers className="w-4 h-4 text-primary-500" />
                  Strategy Blocks
                </h3>
                <p className="text-xs text-theme-tertiary mt-1">Click to add to pipeline</p>
              </div>
              <div className="p-3 space-y-2 max-h-[60vh] overflow-y-auto">
                {availableStrategies?.map((s: StrategyInfo) => {
                  const colors = categoryColors[s.category] || { bg: 'bg-surface-100', text: 'text-surface-600', border: 'border-surface-200', dot: 'bg-surface-400' };
                  return (
                    <button
                      key={s.name}
                      onClick={() => addBlock(s)}
                      className={cn(
                        'w-full text-left p-3 rounded-xl border transition-all duration-200 group',
                        theme === 'dark'
                          ? 'bg-surface-800/30 border-surface-700/50 hover:border-primary-500/40 hover:bg-surface-800/60'
                          : 'bg-white border-surface-200 hover:border-primary-500/40 hover:bg-surface-50'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={cn("w-2 h-2 rounded-full", colors.dot)} />
                          <span className="font-medium text-theme-primary text-sm">
                            {s.display_name}
                          </span>
                        </div>
                        <Plus className="w-4 h-4 text-theme-tertiary group-hover:text-primary-500 transition-colors" />
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 ml-4">
                        <span className={cn(
                          'text-xs px-2 py-0.5 rounded-full border',
                          colors.bg, colors.text, colors.border
                        )}>
                          {s.category}
                        </span>
                      </div>
                      <p className="text-xs text-theme-tertiary mt-1.5 ml-4 line-clamp-2">
                        {s.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Composer Canvas */}
          <div className="lg:col-span-2 space-y-4 animate-slide-up animate-delay-100">
            {/* Pipeline name */}
            <div className="card p-4">
              <label className="label flex items-center gap-2">
                <Sliders className="w-3.5 h-3.5 text-primary-500" />
                Pipeline Name
              </label>
              <input
                type="text"
                value={composerName}
                onChange={(e) => setComposerName(e.target.value)}
                className="input"
                placeholder="Enter a descriptive name..."
              />
            </div>

            {blocks.length === 0 ? (
              <div
                className={cn(
                  'border-2 border-dashed rounded-2xl p-12 text-center',
                  theme === 'dark' ? 'border-surface-700' : 'border-surface-300'
                )}
              >
                <div className={cn(
                  "w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center",
                  theme === 'dark' ? "bg-surface-800/50" : "bg-surface-100"
                )}>
                  <Zap className="w-8 h-8 text-theme-tertiary" />
                </div>
                <p className="text-theme-primary font-semibold text-lg mb-2">
                  Build Your Pipeline
                </p>
                <p className="text-sm text-theme-tertiary max-w-sm mx-auto">
                  Click strategy blocks from the left panel to add them here. Drag to reorder and adjust weights to customize signal strength.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {blocks.map((block, idx) => (
                  <div key={block.id}>
                    <div
                      draggable
                      onDragStart={() => handleDragStart(idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDrop={() => handleDrop(idx)}
                      onDragEnd={handleDragEnd}
                      className={cn(
                        'card transition-all duration-200',
                        draggedIdx === idx && 'opacity-50 scale-[0.98]',
                        dragOverIdx === idx && 'ring-2 ring-primary-500 ring-offset-2',
                        theme === 'dark' ? 'ring-offset-surface-950' : 'ring-offset-white'
                      )}
                    >
                      <div className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="cursor-grab active:cursor-grabbing text-theme-tertiary hover:text-theme-secondary transition-colors">
                            <GripVertical className="w-5 h-5" />
                          </div>

                          <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold",
                            theme === 'dark' ? "bg-primary-500/10 text-primary-400" : "bg-primary-50 text-primary-600"
                          )}>
                            <Hash className="w-3.5 h-3.5" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono text-theme-tertiary">
                                Step {idx + 1}
                              </span>
                              <span className="font-semibold text-theme-primary">
                                {block.displayName}
                              </span>
                            </div>
                            <p className="text-xs text-theme-tertiary truncate mt-0.5">
                              {block.description}
                            </p>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5">
                              <label className="text-xs text-theme-tertiary font-medium">Weight</label>
                              <input
                                type="number"
                                min={0}
                                max={10}
                                step={0.5}
                                value={block.weight}
                                onChange={(e) =>
                                  updateWeight(block.id, Number(e.target.value))
                                }
                                className="input w-16 text-sm text-center py-1"
                              />
                            </div>

                            <button
                              onClick={() => toggleExpand(block.id)}
                              className={cn(
                                "p-1.5 rounded-lg transition-colors",
                                theme === 'dark' ? "hover:bg-surface-800" : "hover:bg-surface-100"
                              )}
                            >
                              {block.expanded ? (
                                <ChevronUp className="w-4 h-4 text-theme-tertiary" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-theme-tertiary" />
                              )}
                            </button>

                            <button
                              onClick={() => removeBlock(block.id)}
                              className={cn(
                                "p-1.5 rounded-lg transition-colors",
                                "text-theme-tertiary hover:text-red-500",
                                theme === 'dark' ? "hover:bg-red-500/10" : "hover:bg-red-50"
                              )}
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {block.expanded && Object.keys(block.parameters).length > 0 && (
                          <div className={cn(
                            "mt-4 ml-11 p-4 rounded-xl border",
                            theme === 'dark' ? "bg-surface-800/30 border-surface-700/50" : "bg-surface-50 border-surface-200"
                          )}>
                            <h5 className="text-xs font-medium text-theme-tertiary uppercase tracking-wider mb-3">
                              Parameters
                            </h5>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                              {Object.entries(block.parameters).map(([key, val]) => (
                                <div key={key}>
                                  <label className="text-xs text-theme-tertiary capitalize font-medium">
                                    {key.replace(/_/g, ' ')}
                                  </label>
                                  <input
                                    type={typeof val === 'number' ? 'number' : 'text'}
                                    value={String(val)}
                                    onChange={(e) =>
                                      updateParam(block.id, key, e.target.value)
                                    }
                                    className="input text-sm py-1.5 mt-1"
                                    step={typeof val === 'number' && val < 1 ? 0.1 : 1}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Arrow connector between blocks */}
                    {idx < blocks.length - 1 && (
                      <div className="flex justify-center py-1">
                        <div className={cn(
                          "w-0.5 h-4",
                          theme === 'dark' ? "bg-surface-700" : "bg-surface-300"
                        )} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Pipeline visualization */}
            {blocks.length > 0 && (
              <div className={cn(
                "card p-4",
                theme === 'dark' ? "bg-surface-900/40" : "bg-surface-50/90"
              )}>
                <h4 className="text-xs font-medium text-theme-tertiary uppercase tracking-wider mb-3">
                  Pipeline Preview
                </h4>
                <div className="flex items-center gap-2 flex-wrap">
                  {blocks.map((b, i) => (
                    <React.Fragment key={b.id}>
                      <div className={cn(
                        "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm",
                        theme === 'dark'
                          ? "bg-surface-800 border-surface-700"
                          : "bg-white border-surface-200"
                      )}>
                        <span className="font-medium text-theme-primary">{b.displayName}</span>
                        <span className={cn(
                          "text-xs px-1.5 py-0.5 rounded font-mono",
                          theme === 'dark' ? "bg-surface-700 text-theme-tertiary" : "bg-surface-100 text-theme-tertiary"
                        )}>
                          {b.weight}x
                        </span>
                      </div>
                      {i < blocks.length - 1 && (
                        <ArrowRight className="w-4 h-4 text-theme-tertiary flex-shrink-0" />
                      )}
                    </React.Fragment>
                  ))}
                </div>
                <div className="mt-3 text-xs text-theme-tertiary">
                  {blocks.length} block{blocks.length !== 1 ? 's' : ''} • Total weight: {totalWeight.toFixed(1)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
