import React from 'react';
import {View, Text, ScrollView, TouchableOpacity, Linking, Image} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import {useTheme} from '../context/ThemeContext';
import {NSE_STOCKS} from '../services/stocks';
import {ALL_STRATEGIES} from '../services/strategies';

export default function AboutScreen() {
  const {colors, theme, toggleTheme} = useTheme();

  return (
    <ScrollView style={{flex: 1, backgroundColor: colors.background}}>
      <View style={{padding: 20}}>

        {/* Theme Toggle */}
        <TouchableOpacity
          onPress={toggleTheme}
          style={{
            flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end',
            backgroundColor: colors.surface, paddingHorizontal: 14, paddingVertical: 8,
            borderRadius: 20, gap: 6, borderWidth: 1, borderColor: colors.border,
          }}>
          <MaterialIcons name={theme === 'dark' ? 'light-mode' : 'dark-mode'} size={16} color={colors.primary} />
          <Text style={{fontSize: 12, fontWeight: '600', color: colors.text}}>
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </Text>
        </TouchableOpacity>

        {/* Logo & Hero */}
        <View style={{alignItems: 'center', marginTop: 16, marginBottom: 28}}>
          <View style={{
            width: 88, height: 88, borderRadius: 24, alignItems: 'center', justifyContent: 'center',
            backgroundColor: colors.primary, marginBottom: 16,
          }}>
            <MaterialIcons name="trending-up" size={40} color="#fff" />
          </View>
          <Text style={{fontSize: 34, fontWeight: '800', color: colors.text, letterSpacing: -1}}>GrowVest</Text>
          <Text style={{fontSize: 15, fontWeight: '600', color: colors.primary, marginTop: 2}}>Smart Stock Screening</Text>
          <Text style={{fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 10, lineHeight: 20, paddingHorizontal: 10}}>
            A powerful stock screening & analysis platform for investors who want to make data-driven decisions with confidence.
          </Text>
        </View>

        {/* Stats */}
        <View style={{
          flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 16,
          padding: 20, marginBottom: 24,
        }}>
          {[
            {val: String(NSE_STOCKS.length), label: 'Stocks', icon: 'show-chart'},
            {val: String(ALL_STRATEGIES.length), label: 'Strategies', icon: 'tune'},
            {val: '0', label: 'Servers', icon: 'cloud-off'},
            {val: 'Free', label: 'Forever', icon: 'favorite'},
          ].map((s, i) => (
            <View key={i} style={{flex: 1, alignItems: 'center'}}>
              <MaterialIcons name={s.icon} size={20} color={colors.primary} />
              <Text style={{fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 4}}>{s.val}</Text>
              <Text style={{fontSize: 10, color: colors.textSecondary, marginTop: 2}}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Features */}
        <Text style={{fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 12}}>Features</Text>
        {[
          {icon: 'bolt', title: 'Lightning Fast', desc: 'Scan all stocks in seconds, entirely on your phone.', color: '#f59e0b'},
          {icon: 'tune', title: 'Multiple Strategies', desc: 'RSI, MACD, Bollinger Bands, AVWAP, 52-Week Extremes, and more.', color: colors.primary},
          {icon: 'science', title: 'Full Backtesting', desc: 'Walk-forward simulation with Sharpe ratio, drawdown, equity curves.', color: colors.success},
          {icon: 'phone-android', title: 'No Backend Needed', desc: 'Everything runs on device. Install & go. Share the APK with anyone.', color: '#ec4899'},
        ].map((f, i) => (
          <View key={i} style={{
            backgroundColor: colors.surface, borderRadius: 14, padding: 16, marginBottom: 8,
            flexDirection: 'row', alignItems: 'center', gap: 14,
          }}>
            <View style={{
              width: 44, height: 44, borderRadius: 12, backgroundColor: f.color + '18',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <MaterialIcons name={f.icon} size={22} color={f.color} />
            </View>
            <View style={{flex: 1}}>
              <Text style={{fontSize: 15, fontWeight: '700', color: colors.text}}>{f.title}</Text>
              <Text style={{fontSize: 12, color: colors.textSecondary, marginTop: 2, lineHeight: 18}}>{f.desc}</Text>
            </View>
          </View>
        ))}

        {/* Tech Stack */}
        <Text style={{fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 12, marginTop: 16}}>Built With</Text>
        <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24}}>
          {[
            {name: 'React Native', icon: 'phone-android'},
            {name: 'TypeScript', icon: 'code'},
            {name: 'Yahoo Finance', icon: 'cloud-download'},
            {name: 'AsyncStorage', icon: 'storage'},
          ].map((t, i) => (
            <View key={i} style={{
              flex: 1, minWidth: '46%', backgroundColor: colors.surface, borderRadius: 12,
              padding: 16, alignItems: 'center',
            }}>
              <MaterialIcons name={t.icon} size={24} color={colors.primary} />
              <Text style={{fontSize: 14, fontWeight: '700', color: colors.text, marginTop: 6}}>{t.name}</Text>
            </View>
          ))}
        </View>

        {/* Founder */}
        <Text style={{fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 12}}>Meet the Founder</Text>
        <View style={{
          backgroundColor: colors.surface, borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 24,
        }}>
          <Image
            source={require('../assets/founder.jpg')}
            style={{
              width: 100, height: 100, borderRadius: 50, marginBottom: 14,
              borderWidth: 3, borderColor: colors.primary,
            }}
            resizeMode="cover"
          />
          <Text style={{fontSize: 22, fontWeight: '700', color: colors.text}}>Anup Kanere</Text>
          <Text style={{fontSize: 13, fontWeight: '600', color: colors.primary, marginTop: 2}}>Founder & CEO</Text>
          <Text style={{fontSize: 12, color: colors.textSecondary, textAlign: 'center', marginTop: 10, lineHeight: 20}}>
            A passionate Software Development Engineer building tools to revolutionize how retail investors approach the stock market.
          </Text>

          <View style={{flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 14}}>
            {['Full-Stack Dev', 'Financial Markets', 'Product Innovation'].map(t => (
              <View key={t} style={{backgroundColor: colors.background, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8}}>
                <Text style={{fontSize: 11, color: colors.textSecondary, fontWeight: '500'}}>{t}</Text>
              </View>
            ))}
          </View>

          <View style={{flexDirection: 'row', gap: 12, marginTop: 18}}>
            <TouchableOpacity
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#0077B515',
                paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12,
              }}
              onPress={() => Linking.openURL('https://www.linkedin.com/in/02a021205')}>
              <MaterialIcons name="link" size={16} color="#0077B5" />
              <Text style={{color: '#0077B5', fontWeight: '600', fontSize: 13}}>LinkedIn</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary + '15',
                paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12,
              }}
              onPress={() => Linking.openURL('mailto:kanereanup@gmail.com')}>
              <MaterialIcons name="email" size={16} color={colors.primary} />
              <Text style={{color: colors.primary, fontWeight: '600', fontSize: 13}}>Email</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Footer */}
        <View style={{alignItems: 'center', paddingBottom: 30}}>
          <Text style={{fontSize: 11, color: colors.textMuted}}>GrowVest v1.0.0</Text>
          <Text style={{fontSize: 11, color: colors.textMuted, marginTop: 2}}>Made with passion in India</Text>
        </View>
      </View>
    </ScrollView>
  );
}
