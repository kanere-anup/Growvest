import React, {useState, useEffect} from 'react';
import {View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions} from 'react-native';
import Svg, {Polyline, Line, Rect} from 'react-native-svg';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import {useTheme} from '../context/ThemeContext';
import {fetchHistoricalData, fetchQuote, OHLCVData, QuoteData} from '../services/yahoo';
import {formatCurrency, formatPercentage, formatNumber} from '../utils/formatting';

const PERIOD_OPTIONS = [
  {label: '1W', days: 7},
  {label: '1M', days: 30},
  {label: '3M', days: 90},
  {label: '6M', days: 180},
  {label: '1Y', days: 365},
  {label: '3Y', days: 1095},
];

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_WIDTH = SCREEN_WIDTH - 32;
const CHART_HEIGHT = 220;

export default function StockDetailScreen({route, navigation}: any) {
  const {colors} = useTheme();
  const {symbol, stockName, sector} = route.params;
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [chartData, setChartData] = useState<OHLCVData[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
  const [period, setPeriod] = useState(365);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadChart();
  }, [period]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [q, data] = await Promise.all([
        fetchQuote(symbol),
        fetchHistoricalData(symbol, period),
      ]);
      setQuote(q);
      setChartData(data);
    } catch {}
    setLoading(false);
  };

  const loadChart = async () => {
    setChartLoading(true);
    try {
      const data = await fetchHistoricalData(symbol, period);
      setChartData(data);
    } catch {}
    setChartLoading(false);
  };

  const renderChart = () => {
    if (chartData.length < 2) return null;
    const closes = chartData.map(d => d.close);
    const minVal = Math.min(...closes);
    const maxVal = Math.max(...closes);
    const range = maxVal - minVal || 1;
    const padding = 10;
    const w = CHART_WIDTH;
    const h = CHART_HEIGHT - padding * 2;

    const points = closes.map((c, i) => {
      const x = (i / (closes.length - 1)) * w;
      const y = padding + h - ((c - minVal) / range) * h;
      return `${x},${y}`;
    }).join(' ');

    const isUp = closes[closes.length - 1] >= closes[0];
    const lineColor = isUp ? colors.success : colors.danger;

    return (
      <Svg width={w} height={CHART_HEIGHT}>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
          const y = padding + h * (1 - pct);
          const val = minVal + range * pct;
          return (
            <React.Fragment key={i}>
              <Line x1={0} y1={y} x2={w} y2={y} stroke={colors.border} strokeWidth={0.5} strokeDasharray="4,4" />
            </React.Fragment>
          );
        })}
        <Polyline points={points} fill="none" stroke={lineColor} strokeWidth={2} />
      </Svg>
    );
  };

  const priceLabels = () => {
    if (chartData.length < 2) return null;
    const closes = chartData.map(d => d.close);
    const minVal = Math.min(...closes);
    const maxVal = Math.max(...closes);
    const range = maxVal - minVal || 1;
    return (
      <View style={{position: 'absolute', right: 4, top: 0, bottom: 0, justifyContent: 'space-between', paddingVertical: 10}}>
        {[1, 0.75, 0.5, 0.25, 0].map((pct, i) => (
          <Text key={i} style={{fontSize: 9, color: colors.textMuted}}>
            {formatNumber(minVal + range * pct, 0)}
          </Text>
        ))}
      </View>
    );
  };

  if (loading) {
    return <View style={{flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background}}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  const change = quote?.change || 0;
  const changePct = quote?.changePercent || 0;
  const isUp = change >= 0;

  return (
    <ScrollView style={{flex: 1, backgroundColor: colors.background}}>
      {/* Header */}
      <View style={{padding: 16}}>
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4}}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <MaterialIcons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={{flex: 1}}>
            <Text style={{fontSize: 22, fontWeight: '800', color: colors.text}}>{symbol}</Text>
            <Text style={{fontSize: 13, color: colors.textSecondary}}>{stockName}</Text>
          </View>
          <View style={{backgroundColor: colors.surface, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8}}>
            <Text style={{fontSize: 11, color: colors.textMuted, fontWeight: '600'}}>{sector}</Text>
          </View>
        </View>

        {/* Price */}
        <View style={{marginTop: 12}}>
          <Text style={{fontSize: 36, fontWeight: '800', color: colors.text}}>
            {quote ? formatCurrency(quote.price) : '—'}
          </Text>
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4}}>
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 2,
              backgroundColor: isUp ? colors.success + '18' : colors.danger + '18',
              paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
            }}>
              <MaterialIcons name={isUp ? 'arrow-drop-up' : 'arrow-drop-down'} size={20} color={isUp ? colors.success : colors.danger} />
              <Text style={{fontSize: 14, fontWeight: '700', color: isUp ? colors.success : colors.danger}}>
                {isUp ? '+' : ''}{change.toFixed(2)} ({isUp ? '+' : ''}{changePct.toFixed(2)}%)
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Chart */}
      <View style={{paddingHorizontal: 16, marginBottom: 8}}>
        <View style={{position: 'relative'}}>
          {chartLoading ? (
            <View style={{height: CHART_HEIGHT, justifyContent: 'center', alignItems: 'center'}}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <>
              {renderChart()}
              {priceLabels()}
            </>
          )}
        </View>

        {/* Period selector */}
        <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 12}}>
          {PERIOD_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.days}
              onPress={() => setPeriod(opt.days)}
              style={{
                paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
                backgroundColor: period === opt.days ? colors.primary : colors.surface,
              }}>
              <Text style={{
                fontSize: 13, fontWeight: '700',
                color: period === opt.days ? '#fff' : colors.textSecondary,
              }}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Key Stats */}
      <View style={{padding: 16}}>
        <Text style={{fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 12}}>Key Statistics</Text>
        <View style={{backgroundColor: colors.surface, borderRadius: 14, padding: 16}}>
          {[
            {label: '52W High', value: quote?.high52w ? formatCurrency(quote.high52w) : '—'},
            {label: '52W Low', value: quote?.low52w ? formatCurrency(quote.low52w) : '—'},
            {label: 'Volume', value: quote?.volume ? formatNumber(quote.volume, 0) : '—'},
            {label: 'Day Range', value: chartData.length > 0 ? `${formatNumber(chartData[chartData.length - 1].low, 2)} - ${formatNumber(chartData[chartData.length - 1].high, 2)}` : '—'},
          ].map((stat, i) => (
            <View key={i} style={{
              flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10,
              borderBottomWidth: i < 3 ? 1 : 0, borderBottomColor: colors.border,
            }}>
              <Text style={{fontSize: 14, color: colors.textSecondary}}>{stat.label}</Text>
              <Text style={{fontSize: 14, fontWeight: '600', color: colors.text}}>{stat.value}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={{height: 40}} />
    </ScrollView>
  );
}
