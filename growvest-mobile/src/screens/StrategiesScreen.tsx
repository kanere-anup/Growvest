import React, {useState, useEffect} from 'react';
import {View, Text, FlatList, Switch} from 'react-native';
import {ALL_STRATEGIES} from '../services/strategies';
import {getEnabledStrategies, setEnabledStrategies} from '../services/storage';
import {useTheme} from '../context/ThemeContext';

export default function StrategiesScreen() {
  const {colors} = useTheme();
  const [enabled, setEnabled] = useState<Set<string>>(new Set(ALL_STRATEGIES.map(s => s.info.name)));
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const saved = await getEnabledStrategies();
      if (saved) setEnabled(new Set(saved));
      setLoaded(true);
    })();
  }, []);

  const toggleStrategy = async (name: string) => {
    const next = new Set(enabled);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setEnabled(next);
    await setEnabledStrategies([...next]);
  };

  if (!loaded) return null;

  return (
    <View style={{flex: 1, backgroundColor: colors.background}}>
      <View style={{padding: 16, paddingBottom: 0}}>
        <Text style={{fontSize: 13, color: colors.textSecondary, fontWeight: '600'}}>
          {enabled.size} Enabled / {ALL_STRATEGIES.length} Total
        </Text>
      </View>

      <FlatList
        data={ALL_STRATEGIES}
        keyExtractor={item => item.info.name}
        contentContainerStyle={{padding: 16, paddingBottom: 80}}
        ItemSeparatorComponent={() => <View style={{height: 8}} />}
        renderItem={({item}) => (
          <View style={{backgroundColor: colors.surface, borderRadius: 12, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
            <View style={{flex: 1, marginRight: 12}}>
              <Text style={{fontSize: 15, fontWeight: '700', color: colors.text}}>{item.info.displayName}</Text>
              <Text style={{fontSize: 13, color: colors.textSecondary, marginTop: 2}} numberOfLines={2}>{item.info.description}</Text>
              <View style={{alignSelf: 'flex-start', marginTop: 4, backgroundColor: colors.primaryDark + '30', paddingHorizontal: 8, paddingVertical: 1, borderRadius: 20}}>
                <Text style={{fontSize: 10, color: colors.primaryLight, fontWeight: '600'}}>{item.info.category}</Text>
              </View>
            </View>
            <Switch
              value={enabled.has(item.info.name)}
              onValueChange={() => toggleStrategy(item.info.name)}
              trackColor={{false: colors.surfaceLight, true: colors.primaryLight}}
              thumbColor={enabled.has(item.info.name) ? colors.primary : colors.textMuted}
            />
          </View>
        )}
      />
    </View>
  );
}
