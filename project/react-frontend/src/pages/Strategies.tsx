import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { strategiesApi } from '@/services/api';
import { MainLayout } from '@/components/layout/MainLayout';
import { useTheme } from '@/context/ThemeContext';
import { Settings, Check, X, Loader2, Plus, Sparkles, Layers, Trash2, PlayCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import type { Strategy, UserStrategy } from '@/types';

export function Strategies() {
  const queryClient = useQueryClient();
  const { theme } = useTheme();

  // Fetch available strategies
  const { data: strategies, isLoading: strategiesLoading } = useQuery({
    queryKey: ['strategies'],
    queryFn: strategiesApi.list,
  });

  // Fetch user's configured strategies
  const { data: userStrategies, isLoading: userStrategiesLoading } = useQuery({
    queryKey: ['user-strategies'],
    queryFn: strategiesApi.listUserStrategies,
  });

  // Configure strategy mutation
  const configureMutation = useMutation({
    mutationFn: strategiesApi.configureStrategy,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-strategies'] });
      toast.success('Strategy enabled');
    },
    onError: (error: any) => {
      if (error?.response?.status === 409) {
        // Strategy already configured - just refresh the list
        queryClient.invalidateQueries({ queryKey: ['user-strategies'] });
        toast.success('Strategy already configured');
      } else {
        toast.error('Failed to enable strategy');
      }
    },
  });

  // Update user strategy mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { is_enabled?: boolean } }) =>
      strategiesApi.updateUserStrategy(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-strategies'] });
      toast.success('Strategy updated');
    },
    onError: () => {
      toast.error('Failed to update strategy');
    },
  });

  // Delete user strategy mutation
  const deleteMutation = useMutation({
    mutationFn: strategiesApi.deleteUserStrategy,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-strategies'] });
      toast.success('Strategy removed');
    },
    onError: () => {
      toast.error('Failed to remove strategy');
    },
  });

  const isLoading = strategiesLoading || userStrategiesLoading;

  const getUserStrategy = (strategyId: string): UserStrategy | undefined => {
    return userStrategies?.find((us) => us.strategy_id === strategyId);
  };

  const handleEnableStrategy = (strategy: Strategy) => {
    configureMutation.mutate({
      strategy_id: strategy.id,
      is_enabled: true,
    });
  };

  const handleToggleStrategy = (userStrategy: UserStrategy) => {
    updateMutation.mutate({
      id: userStrategy.id,
      data: { is_enabled: !userStrategy.is_enabled },
    });
  };

  const enabledCount = userStrategies?.filter((s) => s.is_enabled).length || 0;

  return (
    <MainLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="animate-fade-in">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-xl icon-wrapper-primary">
              <Layers className="w-6 h-6 text-primary-500" />
            </div>
            <h1 className="text-3xl font-display font-bold text-theme-primary">Strategies</h1>
          </div>
          <p className="text-theme-secondary ml-14">Configure and manage your scanning strategies</p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {strategies?.map((strategy, index) => {
              const userStrategy = getUserStrategy(strategy.id);
              const isConfigured = !!userStrategy;
              const isEnabled = userStrategy?.is_enabled;

              return (
                <div 
                  key={strategy.id} 
                  className={cn(
                    "card-hover animate-slide-up",
                    isEnabled && "border-primary-500/30"
                  )}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="p-6">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-12 h-12 rounded-xl flex items-center justify-center",
                          isEnabled 
                            ? "icon-wrapper-primary" 
                            : theme === 'dark' ? "bg-surface-800/50" : "bg-surface-100"
                        )}>
                          <Settings className={cn(
                            "w-6 h-6",
                            isEnabled ? "text-primary-500" : "text-theme-tertiary"
                          )} />
                        </div>
                        <div>
                          <h3 className="font-semibold text-theme-primary">{strategy.display_name}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="badge-info text-xs">{strategy.category}</span>
                            {strategy.is_system && (
                              <span className="badge-neutral text-xs">System</span>
                            )}
                          </div>
                        </div>
                      </div>
                      {isConfigured ? (
                        <span className={isEnabled ? 'badge-success' : 'badge-warning'}>
                          {isEnabled ? 'Enabled' : 'Disabled'}
                        </span>
                      ) : (
                        <span className="badge-neutral">Not Configured</span>
                      )}
                    </div>

                    {/* Description */}
                    <p className="text-sm text-theme-secondary mb-4 leading-relaxed">
                      {strategy.description}
                    </p>

                    {/* Parameters Preview */}
                    {strategy.parameters && Object.keys(strategy.parameters).length > 0 && (
                      <div className={cn(
                        "mb-4 p-4 rounded-xl border",
                        theme === 'dark' 
                          ? "bg-surface-800/30 border-surface-700/50"
                          : "bg-surface-50 border-surface-200"
                      )}>
                        <h5 className="text-xs font-medium text-theme-tertiary uppercase tracking-wider mb-3">
                          Default Parameters
                        </h5>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          {Object.entries(strategy.parameters).slice(0, 4).map(([key, value]) => (
                            <div key={key} className="flex justify-between">
                              <span className="text-theme-secondary">
                                {key.replace(/_/g, ' ')}
                              </span>
                              <span className="font-mono text-theme-primary">
                                {String(value)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-3">
                      {isConfigured ? (
                        <>
                          <button
                            className={cn(
                              "flex-1",
                              isEnabled ? "btn-secondary" : "btn-primary"
                            )}
                            onClick={() => handleToggleStrategy(userStrategy!)}
                            disabled={updateMutation.isPending}
                          >
                            {updateMutation.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : isEnabled ? (
                              <X className="w-4 h-4" />
                            ) : (
                              <Check className="w-4 h-4" />
                            )}
                            {isEnabled ? 'Disable' : 'Enable'}
                          </button>
                          <button
                            className="btn-ghost p-2.5 text-danger-500 hover:bg-danger-500/10"
                            onClick={() => {
                              if (confirm('Remove this strategy configuration?')) {
                                deleteMutation.mutate(userStrategy!.id);
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <button
                          className="btn-primary flex-1"
                          onClick={() => handleEnableStrategy(strategy)}
                          disabled={configureMutation.isPending}
                        >
                          {configureMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Plus className="w-4 h-4" />
                          )}
                          Enable Strategy
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Summary */}
        {userStrategies && userStrategies.length > 0 && (
          <div className="card-glow p-6 animate-slide-up">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl icon-wrapper-primary flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-primary-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-theme-primary">Ready to Scan</h3>
                  <p className="text-sm text-theme-secondary">
                    {enabledCount} of {userStrategies.length} strategies enabled
                  </p>
                </div>
              </div>
              <Link to="/scans">
                <button className="btn-primary">
                  <PlayCircle className="w-4 h-4" />
                  Start Scan
                </button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
