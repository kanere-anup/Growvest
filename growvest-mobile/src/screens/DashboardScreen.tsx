import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import {NSE_STOCKS} from '../services/stocks';
import {fetchMultipleQuotes, QuoteData} from '../services/yahoo';
import {ALL_STRATEGIES} from '../services/strategies';
import {getScans} from '../services/storage';
import {ScanRecord} from '../services/scanner';
import {useTheme} from '../context/ThemeContext';
import {formatCurrency, formatDateTime, formatPercentage} from '../utils/formatting';
import AnimatedRupee from '../components/AnimatedRupee';

const TOP_SYMBOLS = ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK'];

export default function DashboardScreen({navigation}: any) {
  const {colors} = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [topQuotes, setTopQuotes] = useState<Map<string, QuoteData>>(new Map());
  const [scanHistory, setScanHistory] = useState<ScanRecord[]>([]);

  const loadData = async () => {
    try {
      const [quotes, scans] = await Promise.all([
        fetchMultipleQuotes(TOP_SYMBOLS),
        getScans(),
      ]);
      setTopQuotes(quotes);
      setScanHistory(scans);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const totalStocks = NSE_STOCKS.length;
  const activeStocks = NSE_STOCKS.filter(s => s.isActive).length;
  const lastScan = scanHistory.length > 0 ? scanHistory[0] : null;

  if (loading) {
    return <View style={[s.center, {backgroundColor: colors.background}]}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  return (
    <ScrollView
      style={{flex: 1, backgroundColor: colors.background, padding: 16}}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>
      <View style={{marginBottom: 12, marginTop: 8}}>
        <Text style={{fontSize: 15, color: colors.textSecondary}}>Welcome to</Text>
        <Text style={{fontSize: 26, fontWeight: '700', color: colors.text}}>GrowVest Screener</Text>
      </View>

      {/* Animated ₹ symbol */}
      <View style={{
        marginBottom: 16,
        backgroundColor: colors.surface,
        borderRadius: 16,
        paddingVertical: 14,
        overflow: 'hidden',
      }}>
        <AnimatedRupee size={Dimensions.get('window').width - 64} />
      </View>

      <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20}}>
        {[
          {val: totalStocks, label: 'Total Stocks'},
          {val: activeStocks, label: 'Active'},
          {val: ALL_STRATEGIES.length, label: 'Strategies', color: colors.primary},
          {val: scanHistory.length, label: 'Scans'},
        ].map((st, i) => (
          <View key={i} style={{flex: 1, minWidth: '45%', backgroundColor: colors.surface, borderRadius: 12, padding: 16, alignItems: 'center'}}>
            <Text style={{fontSize: 26, fontWeight: '700', color: st.color || colors.text}}>{st.val}</Text>
            <Text style={{fontSize: 11, color: colors.textSecondary, marginTop: 4}}>{st.label}</Text>
          </View>
        ))}
      </View>

      <Text style={{fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 10}}>Quick Actions</Text>
      <View style={{flexDirection: 'row', gap: 8, marginBottom: 20}}>
        <TouchableOpacity style={{flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center', backgroundColor: colors.primary}} onPress={() => navigation.navigate('Scans')}>
          <Text style={{color: '#fff', fontSize: 15, fontWeight: '700'}}>New Scan</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center', backgroundColor: colors.success}} onPress={() => navigation.navigate('Backtest')}>
          <Text style={{color: '#fff', fontSize: 15, fontWeight: '700'}}>Backtest</Text>
        </TouchableOpacity>
      </View>

      {lastScan && (
        <View style={{marginBottom: 20}}>
          <Text style={{fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 10}}>Last Scan</Text>
          <View style={{backgroundColor: colors.surface, borderRadius: 12, padding: 16}}>
            {[
              {l: 'Name', v: lastScan.name},
              {l: 'Status', v: lastScan.status},
              {l: 'Matches', v: `${lastScan.matchedStocks} / ${lastScan.totalStocks} stocks`},
              {l: 'Date', v: formatDateTime(lastScan.createdAt)},
            ].map((r, i) => (
              <View key={i} style={{flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6}}>
                <Text style={{fontSize: 13, color: colors.textSecondary}}>{r.l}</Text>
                <Text style={{fontSize: 13, color: colors.text, fontWeight: '500'}} numberOfLines={1}>{r.v}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {topQuotes.size > 0 && (
        <View style={{marginBottom: 20}}>
          <Text style={{fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 10}}>Market Overview</Text>
          <View style={{backgroundColor: colors.surface, borderRadius: 12, padding: 16}}>
            {TOP_SYMBOLS.map((sym, i) => {
              const q = topQuotes.get(sym);
              if (!q) return null;
              return (
                <View key={sym} style={[{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6}, i < TOP_SYMBOLS.length - 1 && {borderBottomWidth: 1, borderBottomColor: colors.border}]}>
                  <Text style={{fontSize: 15, fontWeight: '600', color: colors.text, flex: 1}}>{sym}</Text>
                  <Text style={{fontSize: 15, color: colors.text, flex: 1, textAlign: 'center'}}>{formatCurrency(q.price)}</Text>
                  <Text style={{fontSize: 13, fontWeight: '700', flex: 0.7, textAlign: 'right', color: q.change >= 0 ? colors.success : colors.danger}}>
                    {q.change >= 0 ? '+' : ''}{formatPercentage(q.changePercent)}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}
      <View style={{height: 40}} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  center: {flex: 1, justifyContent: 'center', alignItems: 'center'},
});
