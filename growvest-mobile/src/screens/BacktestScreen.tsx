import React, {useState} from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, StyleSheet,
} from 'react-native';
import {NSE_STOCKS, searchStocks} from '../services/stocks';
import {fetchHistoricalData} from '../services/yahoo';
import {ALL_STRATEGIES} from '../services/strategies';
import {runBacktest, BacktestResult} from '../services/backtest';
import {useTheme} from '../context/ThemeContext';
import {formatCurrency, formatPercentage} from '../utils/formatting';

const LOOKBACK_OPTIONS = [
  {label: '3M', value: 90},
  {label: '6M', value: 180},
  {label: '1Y', value: 365},
  {label: '2Y', value: 730},
  {label: '3Y', value: 1095},
];

export default function BacktestScreen() {
  const {colors} = useTheme();
  const [symbol, setSymbol] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState('');
  const [lookbackDays, setLookbackDays] = useState(365);
  const [initialCapital, setInitialCapital] = useState('100000');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);

  const searchResults = searchQuery.length >= 1 ? searchStocks(NSE_STOCKS, searchQuery).slice(0, 10) : [];

  const handleRun = async () => {
    if (!symbol) { Alert.alert('Error', 'Please select a stock'); return; }
    if (!selectedStrategy) { Alert.alert('Error', 'Please select a strategy'); return; }
    setRunning(true);
    setResult(null);
    try {
      const data = await fetchHistoricalData(symbol, lookbackDays);
      if (data.length < 30) { Alert.alert('Error', `Only ${data.length} days of data. Need 30+.`); setRunning(false); return; }
      const res = runBacktest(data, selectedStrategy, symbol, Number(initialCapital) || 100000);
      if (!res) Alert.alert('Error', 'Backtest failed');
      else setResult(res);
    } catch (err: any) { Alert.alert('Error', err.message || 'Failed'); }
    setRunning(false);
  };

  return (
    <ScrollView style={{flex: 1, backgroundColor: colors.background}} keyboardShouldPersistTaps="handled">
      <View style={{padding: 16}}>
        <Text style={{fontSize: 13, color: colors.textSecondary, marginBottom: 4, marginTop: 8}}>Stock Symbol</Text>
        <TouchableOpacity style={{backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12}} onPress={() => setShowSearch(true)}>
          <Text style={{color: symbol ? colors.text : colors.textMuted, fontSize: 15}}>{symbol || 'Search for a stock...'}</Text>
        </TouchableOpacity>

        {showSearch && (
          <View style={{backgroundColor: colors.surface, borderRadius: 10, padding: 12, marginTop: 4}}>
            <TextInput
              style={{backgroundColor: colors.background, borderRadius: 8, padding: 12, color: colors.text, fontSize: 15, marginBottom: 8}}
              placeholder="Type stock name or symbol..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
            {searchResults.map(s => (
              <TouchableOpacity key={s.symbol} style={{flexDirection: 'row', alignItems: 'center', padding: 8, gap: 8}} onPress={() => { setSymbol(s.symbol); setSearchQuery(''); setShowSearch(false); }}>
                <Text style={{fontSize: 15, fontWeight: '700', color: colors.primary, width: 100}}>{s.symbol}</Text>
                <Text style={{fontSize: 13, color: colors.textSecondary, flex: 1}} numberOfLines={1}>{s.name}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={{alignItems: 'center', padding: 8, marginTop: 4}} onPress={() => setShowSearch(false)}>
              <Text style={{color: colors.danger, fontWeight: '600'}}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={{fontSize: 13, color: colors.textSecondary, marginBottom: 4, marginTop: 16}}>Strategy</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 4}}>
          {ALL_STRATEGIES.map(s => (
            <TouchableOpacity
              key={s.info.name}
              style={{paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: selectedStrategy === s.info.name ? colors.primary : colors.surface, marginRight: 8}}
              onPress={() => { setSelectedStrategy(s.info.name); setResult(null); }}>
              <Text style={{fontSize: 13, color: selectedStrategy === s.info.name ? '#fff' : colors.textSecondary, fontWeight: '600'}}>{s.info.displayName}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={{fontSize: 13, color: colors.textSecondary, marginBottom: 4, marginTop: 16}}>Initial Capital</Text>
        <TextInput
          style={{backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, color: colors.text, fontSize: 15}}
          value={initialCapital}
          onChangeText={v => { setInitialCapital(v); setResult(null); }}
          keyboardType="numeric"
          placeholder="100000"
          placeholderTextColor={colors.textMuted}
        />

        <Text style={{fontSize: 13, color: colors.textSecondary, marginBottom: 4, marginTop: 16}}>Lookback Period</Text>
        <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8}}>
          {LOOKBACK_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={{paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: lookbackDays === opt.value ? colors.primary : colors.surface}}
              onPress={() => { setLookbackDays(opt.value); setResult(null); }}>
              <Text style={{fontSize: 13, color: lookbackDays === opt.value ? '#fff' : colors.textSecondary, fontWeight: '600'}}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={{backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 20, opacity: running ? 0.6 : 1}}
          onPress={handleRun}
          disabled={running}>
          {running ? (
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              <ActivityIndicator color="#fff" />
              <Text style={{color: '#fff', fontSize: 17, fontWeight: '700', marginLeft: 8}}>Running...</Text>
            </View>
          ) : (
            <Text style={{color: '#fff', fontSize: 17, fontWeight: '700'}}>Run Backtest</Text>
          )}
        </TouchableOpacity>

        {result && (
          <View style={{marginTop: 24}}>
            <Text style={{fontSize: 20, fontWeight: '700', color: colors.text}}>{result.symbol}</Text>
            <Text style={{fontSize: 13, color: colors.textSecondary, marginBottom: 12}}>{result.strategyDisplayName}</Text>

            <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8}}>
              {[
                {l: 'Total Return', v: formatPercentage(result.totalReturn), p: result.totalReturn >= 0},
                {l: 'Final Value', v: formatCurrency(result.finalCapital)},
                {l: 'Annual Return', v: formatPercentage(result.annualReturn), p: result.annualReturn >= 0},
                {l: 'Total Trades', v: String(result.totalTrades)},
                {l: 'Win Rate', v: formatPercentage(result.winRate), p: result.winRate >= 50},
                {l: 'Max Drawdown', v: formatPercentage(result.maxDrawdown), p: false},
                {l: 'Sharpe Ratio', v: result.sharpeRatio.toFixed(2), p: result.sharpeRatio > 0},
                {l: 'Profit Factor', v: result.profitFactor.toFixed(2), p: result.profitFactor > 1},
              ].map((m, i) => (
                <View key={i} style={{backgroundColor: colors.surfaceLight, borderRadius: 10, padding: 12, minWidth: '47%', flex: 1}}>
                  <Text style={{fontSize: 17, fontWeight: '700', color: m.p === true ? colors.success : m.p === false ? colors.danger : colors.text}}>{m.v}</Text>
                  <Text style={{fontSize: 11, color: colors.textSecondary, marginTop: 2}}>{m.l}</Text>
                </View>
              ))}
            </View>

            {result.trades.length > 0 && (
              <View style={{marginTop: 20}}>
                <Text style={{fontSize: 17, fontWeight: '600', color: colors.text, marginBottom: 8}}>Trades ({result.trades.length})</Text>
                {result.trades.slice(0, 30).map((t, i) => (
                  <View key={i} style={{flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 8, padding: 12, marginBottom: 4, gap: 12}}>
                    <Text style={{fontSize: 13, fontWeight: '700', width: 40, color: t.type === 'entry' ? colors.success : colors.danger}}>
                      {t.type === 'entry' ? 'BUY' : 'SELL'}
                    </Text>
                    <Text style={{fontSize: 13, color: colors.textSecondary, flex: 1}}>{t.date}</Text>
                    <Text style={{fontSize: 13, color: colors.text, fontWeight: '500'}}>{formatCurrency(t.price)}</Text>
                  </View>
                ))}
                {result.trades.length > 30 && <Text style={{textAlign: 'center', color: colors.textMuted, fontSize: 13, marginTop: 4}}>...and {result.trades.length - 30} more</Text>}
              </View>
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
