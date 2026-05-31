import React, {useState, useEffect, useMemo, useCallback, useRef} from 'react';
import {View, Text, FlatList, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Modal} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Svg, {Polyline} from 'react-native-svg';
import {NSE_STOCKS, getUniqueSectors, searchStocks, StockInfo} from '../services/stocks';
import {fetchQuote, QuoteData} from '../services/yahoo';
import {useTheme} from '../context/ThemeContext';
import {formatCurrency, formatNumber} from '../utils/formatting';

type SortField = 'symbol' | 'price' | 'change' | 'changePct';
type SortDir = 'asc' | 'desc';

export default function StocksScreen({navigation}: any) {
  const {colors} = useTheme();
  const [search, setSearch] = useState('');
  const [selectedSector, setSelectedSector] = useState('all');
  const [quotes, setQuotes] = useState<Map<string, QuoteData>>(new Map());
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [sortField, setSortField] = useState<SortField>('symbol');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [showSortModal, setShowSortModal] = useState(false);
  const mountedRef = useRef(true);

  const sectors = useMemo(() => getUniqueSectors(NSE_STOCKS), []);

  const filteredStocks = useMemo(() => {
    let list = NSE_STOCKS;
    if (search) list = searchStocks(list, search);
    if (selectedSector !== 'all') list = list.filter(s => s.sector === selectedSector);

    list = [...list].sort((a, b) => {
      const qa = quotes.get(a.symbol);
      const qb = quotes.get(b.symbol);
      let cmp = 0;
      switch (sortField) {
        case 'symbol': cmp = a.symbol.localeCompare(b.symbol); break;
        case 'price': cmp = (qa?.price || 0) - (qb?.price || 0); break;
        case 'change': cmp = (qa?.change || 0) - (qb?.change || 0); break;
        case 'changePct': cmp = (qa?.changePercent || 0) - (qb?.changePercent || 0); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [search, selectedSector, quotes, sortField, sortDir]);

  useEffect(() => {
    mountedRef.current = true;
    loadQuotes();
    return () => { mountedRef.current = false; };
  }, []);

  const loadQuotes = async () => {
    setLoadingQuotes(true);
    const symbols = NSE_STOCKS.map(s => s.symbol);
    const newQuotes = new Map<string, QuoteData>();

    for (let i = 0; i < symbols.length; i += 8) {
      if (!mountedRef.current) return;
      const batch = symbols.slice(i, i + 8);
      const results = await Promise.allSettled(
        batch.map(sym => fetchQuote(sym))
      );
      results.forEach((r, idx) => {
        if (r.status === 'fulfilled' && r.value) {
          newQuotes.set(batch[idx], r.value);
        }
      });
      if (mountedRef.current) {
        setQuotes(new Map(newQuotes));
      }
    }
    if (mountedRef.current) setLoadingQuotes(false);
  };

  const renderMiniChart = useCallback((q: QuoteData) => {
    const isUp = q.change >= 0;
    const color = isUp ? colors.success : colors.danger;
    const w = 50, h = 24;
    const mid = h / 2;
    const end = isUp ? h * 0.3 : h * 0.7;
    const points = `0,${mid} ${w * 0.3},${mid + (isUp ? 2 : -2)} ${w * 0.6},${end + (isUp ? -3 : 3)} ${w},${end}`;
    return (
      <Svg width={w} height={h}>
        <Polyline points={points} fill="none" stroke={color} strokeWidth={1.5} />
      </Svg>
    );
  }, [colors]);

  const renderStockItem = useCallback(({item}: {item: StockInfo}) => {
    const q = quotes.get(item.symbol);
    const isUp = (q?.change || 0) >= 0;

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => navigation.navigate('StockDetail', {
          symbol: item.symbol,
          stockName: item.name,
          sector: item.sector,
        })}
        style={{
          backgroundColor: colors.surface,
          paddingHorizontal: 14,
          paddingVertical: 12,
          flexDirection: 'row',
          alignItems: 'center',
          borderBottomWidth: 0.5,
          borderBottomColor: colors.border,
        }}>
        {/* Symbol & Name */}
        <View style={{flex: 1, marginRight: 8}}>
          <Text style={{fontSize: 15, fontWeight: '700', color: colors.text}}>{item.symbol}</Text>
          <Text style={{fontSize: 11, color: colors.textSecondary, marginTop: 1}} numberOfLines={1}>
            {item.name}
          </Text>
        </View>

        {/* Mini chart */}
        {q && <View style={{marginRight: 10}}>{renderMiniChart(q)}</View>}

        {/* Price & Change */}
        <View style={{alignItems: 'flex-end', minWidth: 90}}>
          {q ? (
            <>
              <Text style={{fontSize: 15, fontWeight: '700', color: colors.text}}>
                {formatNumber(q.price, 2)}
              </Text>
              <View style={{flexDirection: 'row', alignItems: 'center', marginTop: 2}}>
                <MaterialIcons
                  name={isUp ? 'arrow-drop-up' : 'arrow-drop-down'}
                  size={16}
                  color={isUp ? colors.success : colors.danger}
                />
                <Text style={{
                  fontSize: 11, fontWeight: '600',
                  color: isUp ? colors.success : colors.danger,
                }}>
                  {isUp ? '+' : ''}{q.changePercent.toFixed(2)}%
                </Text>
              </View>
            </>
          ) : (
            <ActivityIndicator size="small" color={colors.textMuted} />
          )}
        </View>
      </TouchableOpacity>
    );
  }, [quotes, colors, navigation, renderMiniChart]);

  const sortOptions: {field: SortField; label: string; icon: string}[] = [
    {field: 'symbol', label: 'Name', icon: 'sort-by-alpha'},
    {field: 'price', label: 'Price', icon: 'attach-money'},
    {field: 'change', label: 'Change', icon: 'trending-up'},
    {field: 'changePct', label: 'Change %', icon: 'percent'},
  ];

  return (
    <View style={{flex: 1, backgroundColor: colors.background}}>
      {/* Search bar with sort */}
      <View style={{flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 10}}>
        <View style={{
          flex: 1, flexDirection: 'row', alignItems: 'center',
          backgroundColor: colors.surface, borderRadius: 10,
          paddingHorizontal: 10, borderWidth: 1, borderColor: colors.border,
        }}>
          <MaterialIcons name="search" size={20} color={colors.textMuted} />
          <TextInput
            style={{flex: 1, paddingVertical: 9, paddingHorizontal: 8, color: colors.text, fontSize: 14}}
            placeholder="Search stocks..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <MaterialIcons name="close" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          onPress={() => setShowSortModal(true)}
          style={{marginLeft: 10, padding: 8, backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.border}}>
          <MaterialIcons name="sort" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Stock count & loading */}
      <View style={{flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4}}>
        <Text style={{fontSize: 12, color: colors.textSecondary, fontWeight: '600'}}>
          {filteredStocks.length} Stocks
        </Text>
        {loadingQuotes && (
          <View style={{flexDirection: 'row', alignItems: 'center', marginLeft: 8}}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={{fontSize: 11, color: colors.textMuted, marginLeft: 4}}>Loading prices...</Text>
          </View>
        )}
        <TouchableOpacity onPress={loadQuotes} style={{marginLeft: 'auto', padding: 4}}>
          <MaterialIcons name="refresh" size={18} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Sector filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{paddingHorizontal: 14, paddingBottom: 10, alignItems: 'center'}}
        style={{flexGrow: 0, minHeight: 44}}>
        {['all', ...sectors].map(item => {
          const isSelected = selectedSector === item;
          return (
            <TouchableOpacity
              key={item}
              onPress={() => setSelectedSector(item)}
              style={{
                paddingHorizontal: 16,
                height: 34,
                borderRadius: 17,
                marginRight: 8,
                backgroundColor: isSelected ? colors.primary : colors.surface,
                borderWidth: 1,
                borderColor: isSelected ? colors.primary : colors.border,
                justifyContent: 'center',
                alignItems: 'center',
              }}>
              <Text style={{
                fontSize: 13,
                fontWeight: '700',
                color: isSelected ? '#ffffff' : colors.text,
                lineHeight: 16,
                includeFontPadding: false,
                textAlignVertical: 'center',
              }}>
                {item === 'all' ? 'All' : item}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Stock list */}
      <FlatList
        data={filteredStocks}
        keyExtractor={item => item.symbol}
        renderItem={renderStockItem}
        contentContainerStyle={{paddingBottom: 80}}
        initialNumToRender={20}
        maxToRenderPerBatch={15}
        windowSize={10}
        getItemLayout={(_, index) => ({length: 60, offset: 60 * index, index})}
      />

      {/* Sort Modal */}
      <Modal visible={showSortModal} transparent animationType="fade">
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setShowSortModal(false)}
          style={{flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end'}}>
          <View style={{
            backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
            padding: 20, paddingBottom: 40,
          }}>
            <Text style={{fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 16}}>Sort By</Text>
            {sortOptions.map(opt => (
              <TouchableOpacity
                key={opt.field}
                onPress={() => {
                  if (sortField === opt.field) {
                    setSortDir(d => d === 'asc' ? 'desc' : 'asc');
                  } else {
                    setSortField(opt.field);
                    setSortDir(opt.field === 'changePct' ? 'desc' : 'asc');
                  }
                  setShowSortModal(false);
                }}
                style={{
                  flexDirection: 'row', alignItems: 'center', paddingVertical: 14,
                  borderBottomWidth: 0.5, borderBottomColor: colors.border,
                }}>
                <MaterialIcons name={opt.icon} size={22} color={sortField === opt.field ? colors.primary : colors.textSecondary} />
                <Text style={{
                  flex: 1, fontSize: 16, fontWeight: '600', marginLeft: 14,
                  color: sortField === opt.field ? colors.primary : colors.text,
                }}>{opt.label}</Text>
                {sortField === opt.field && (
                  <MaterialIcons
                    name={sortDir === 'asc' ? 'arrow-upward' : 'arrow-downward'}
                    size={20} color={colors.primary}
                  />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
