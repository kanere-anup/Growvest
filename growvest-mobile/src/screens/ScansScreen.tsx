import React, {useState, useEffect} from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Alert,
  ActivityIndicator, Modal,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import {ALL_STRATEGIES} from '../services/strategies';
import {runScan, ScanRecord, ScanResultItem} from '../services/scanner';
import {getScans, saveScan, getEnabledStrategies} from '../services/storage';
import {useTheme} from '../context/ThemeContext';
import {formatDateTime, formatDuration, formatCurrency, getSignalColor} from '../utils/formatting';

export default function ScansScreen() {
  const {colors} = useTheme();
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [selectedScan, setSelectedScan] = useState<ScanRecord | null>(null);
  const [showNewScan, setShowNewScan] = useState(false);
  const [selectedStrategies, setSelectedStrategies] = useState<string[]>([]);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState({done: 0, total: 0});

  useEffect(() => { loadScans(); }, []);
  const loadScans = async () => setScans(await getScans());

  const openNewScan = async () => {
    const saved = await getEnabledStrategies();
    setSelectedStrategies(saved || ALL_STRATEGIES.map(s => s.info.name));
    setShowNewScan(true);
  };

  const toggleStrategy = (name: string) => {
    setSelectedStrategies(prev => prev.includes(name) ? prev.filter(s => s !== name) : [...prev, name]);
  };

  const handleStartScan = async () => {
    if (selectedStrategies.length === 0) { Alert.alert('Error', 'Select at least one strategy'); return; }
    setScanning(true);
    setProgress({done: 0, total: 0});
    try {
      const result = await runScan(selectedStrategies, (done, total) => setProgress({done, total}));
      await saveScan(result);
      await loadScans();
      setShowNewScan(false);
      Alert.alert('Done', `${result.matchedStocks} stocks matched, ${result.results.length} signals.`);
    } catch (err: any) { Alert.alert('Error', err.message || 'Scan failed'); }
    setScanning(false);
  };

  if (selectedScan) {
    return (
      <View style={{flex: 1, backgroundColor: colors.background}}>
        <View style={{flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12}}>
          <TouchableOpacity
            onPress={() => setSelectedScan(null)}
            style={{
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
              borderWidth: 1, borderColor: colors.border,
            }}>
            <MaterialIcons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={{fontSize: 18, fontWeight: '700', color: colors.text, flex: 1}} numberOfLines={1}>{selectedScan.name}</Text>
        </View>
        <View style={{flexDirection: 'row', gap: 16, paddingHorizontal: 16, paddingBottom: 8}}>
          <Text style={{fontSize: 11, color: colors.textMuted}}>{selectedScan.matchedStocks} matched / {selectedScan.totalStocks}</Text>
          <Text style={{fontSize: 11, color: colors.textMuted}}>{formatDuration(selectedScan.executionTimeMs)}</Text>
          <Text style={{fontSize: 11, color: colors.textMuted}}>{formatDateTime(selectedScan.createdAt)}</Text>
        </View>
        <FlatList
          data={selectedScan.results}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={{padding: 16, paddingBottom: 80}}
          ItemSeparatorComponent={() => <View style={{height: 8}} />}
          renderItem={({item}: {item: ScanResultItem}) => (
            <View style={{backgroundColor: colors.surface, borderRadius: 12, padding: 16}}>
              <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
                <View>
                  <Text style={{fontSize: 17, fontWeight: '700', color: colors.text}}>{item.symbol}</Text>
                  <Text style={{fontSize: 11, color: colors.textMuted}} numberOfLines={1}>{item.stockName}</Text>
                </View>
                <View style={{backgroundColor: getSignalColor(item.signal) + '20', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20}}>
                  <Text style={{fontSize: 11, fontWeight: '700', color: getSignalColor(item.signal)}}>{item.signal.toUpperCase()}</Text>
                </View>
              </View>
              <View style={{marginTop: 8, gap: 2}}>
                <Text style={{fontSize: 13, color: colors.textSecondary}}>Price: <Text style={{color: colors.text, fontWeight: '500'}}>{formatCurrency(item.currentPrice)}</Text></Text>
                <Text style={{fontSize: 13, color: colors.textSecondary}}>Score: <Text style={{color: colors.text, fontWeight: '500'}}>{item.score.toFixed(2)}</Text></Text>
                <Text style={{fontSize: 13, color: colors.textSecondary}}>Strategy: <Text style={{color: colors.text, fontWeight: '500'}}>{item.strategyDisplayName}</Text></Text>
              </View>
              {Object.keys(item.resultData).length > 0 && (
                <View style={{marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 6}}>
                  {Object.entries(item.resultData).map(([k, v]) => (
                    <Text key={k} style={{fontSize: 10, color: colors.textMuted, backgroundColor: colors.background, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4}}>
                      {k.replace(/_/g, ' ')}: {typeof v === 'number' ? v.toFixed(2) : String(v)}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          )}
          ListEmptyComponent={<Text style={{textAlign: 'center', color: colors.textMuted, fontSize: 15, marginTop: 40}}>No matches found</Text>}
        />
      </View>
    );
  }

  return (
    <View style={{flex: 1, backgroundColor: colors.background}}>
      <TouchableOpacity style={{margin: 16, marginBottom: 0, backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center'}} onPress={openNewScan}>
        <Text style={{color: '#fff', fontSize: 15, fontWeight: '700'}}>+ New Scan</Text>
      </TouchableOpacity>

      <FlatList
        data={scans}
        keyExtractor={item => item.id}
        contentContainerStyle={{padding: 16, paddingBottom: 80}}
        ItemSeparatorComponent={() => <View style={{height: 8}} />}
        renderItem={({item}) => (
          <TouchableOpacity style={{backgroundColor: colors.surface, borderRadius: 12, padding: 16}} onPress={() => setSelectedScan(item)}>
            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
              <Text style={{fontSize: 15, fontWeight: '600', color: colors.text, flex: 1, marginRight: 8}} numberOfLines={1}>{item.name}</Text>
              <Text style={{fontSize: 11, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, overflow: 'hidden', backgroundColor: 'rgba(34,197,94,0.15)', color: colors.success}}>{item.status}</Text>
            </View>
            <View style={{flexDirection: 'row', gap: 16, marginTop: 6}}>
              <Text style={{fontSize: 11, color: colors.textMuted}}>{item.matchedStocks} matches</Text>
              <Text style={{fontSize: 11, color: colors.textMuted}}>{formatDuration(item.executionTimeMs)}</Text>
              <Text style={{fontSize: 11, color: colors.textMuted}}>{formatDateTime(item.createdAt)}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={{textAlign: 'center', color: colors.textMuted, fontSize: 15, marginTop: 40}}>No scans yet. Tap + New Scan to get started!</Text>}
      />

      <Modal visible={showNewScan} animationType="slide" transparent>
        <View style={{flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end'}}>
          <View style={{backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '80%'}}>
            {scanning ? (
              <View style={{alignItems: 'center', paddingVertical: 40}}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={{fontSize: 18, color: colors.text, fontWeight: '600', marginTop: 16}}>Scanning stocks...</Text>
                {progress.total > 0 && <Text style={{fontSize: 13, color: colors.textSecondary, marginTop: 8}}>{progress.done} / {progress.total} stocks</Text>}
                <View style={{width: '100%', height: 6, backgroundColor: colors.surfaceLight, borderRadius: 3, marginTop: 12, overflow: 'hidden'}}>
                  <View style={{height: '100%', backgroundColor: colors.primary, borderRadius: 3, width: progress.total > 0 ? `${(progress.done / progress.total) * 100}%` : '0%'}} />
                </View>
              </View>
            ) : (
              <>
                <Text style={{fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 4}}>New Scan</Text>
                <Text style={{fontSize: 13, color: colors.textSecondary, marginBottom: 12}}>Select strategies to scan with:</Text>
                <TouchableOpacity style={{alignSelf: 'flex-end', marginBottom: 8}} onPress={() => setSelectedStrategies(p => p.length === ALL_STRATEGIES.length ? [] : ALL_STRATEGIES.map(s => s.info.name))}>
                  <Text style={{color: colors.primaryLight, fontSize: 13, fontWeight: '600'}}>{selectedStrategies.length === ALL_STRATEGIES.length ? 'Deselect All' : 'Select All'}</Text>
                </TouchableOpacity>
                <FlatList
                  data={ALL_STRATEGIES}
                  keyExtractor={item => item.info.name}
                  style={{maxHeight: 300}}
                  renderItem={({item}) => (
                    <TouchableOpacity
                      style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 8, marginBottom: 4, backgroundColor: selectedStrategies.includes(item.info.name) ? colors.primaryDark + '30' : colors.background, borderWidth: selectedStrategies.includes(item.info.name) ? 1 : 0, borderColor: colors.primary}}
                      onPress={() => toggleStrategy(item.info.name)}>
                      <Text style={{fontSize: 15, color: colors.text}}>{item.info.displayName}</Text>
                      {selectedStrategies.includes(item.info.name) && <Text style={{color: colors.success, fontWeight: '700'}}>OK</Text>}
                    </TouchableOpacity>
                  )}
                />
                <View style={{flexDirection: 'row', gap: 8, marginTop: 16}}>
                  <TouchableOpacity style={{flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center', backgroundColor: colors.surfaceLight}} onPress={() => setShowNewScan(false)}>
                    <Text style={{color: colors.text, fontSize: 15, fontWeight: '600'}}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={{flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center', backgroundColor: colors.primary}} onPress={handleStartScan}>
                    <Text style={{color: '#fff', fontSize: 15, fontWeight: '700'}}>Start Scan</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
