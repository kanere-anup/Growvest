import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import {useTheme} from '../context/ThemeContext';

import DashboardScreen from '../screens/DashboardScreen';
import StocksScreen from '../screens/StocksScreen';
import StockDetailScreen from '../screens/StockDetailScreen';
import ScansScreen from '../screens/ScansScreen';
import BacktestScreen from '../screens/BacktestScreen';
import StrategiesScreen from '../screens/StrategiesScreen';
import AboutScreen from '../screens/AboutScreen';

const Tab = createBottomTabNavigator();
const StocksStack = createNativeStackNavigator();

function StocksStackScreen() {
  const {colors} = useTheme();
  return (
    <StocksStack.Navigator screenOptions={{headerShown: false}}>
      <StocksStack.Screen name="StocksList" component={StocksScreen} />
      <StocksStack.Screen
        name="StockDetail"
        component={StockDetailScreen}
        options={{
          animation: 'slide_from_right',
        }}
      />
    </StocksStack.Navigator>
  );
}

const TAB_ICONS: Record<string, string> = {
  Home: 'dashboard',
  Stocks: 'show-chart',
  Scans: 'radar',
  Backtest: 'science',
  Strategies: 'tune',
  About: 'info-outline',
};

export default function AppNavigator() {
  const {colors} = useTheme();

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({route}) => ({
          headerStyle: {backgroundColor: colors.background, elevation: 0, shadowOpacity: 0},
          headerTintColor: colors.text,
          headerTitleStyle: {fontWeight: '700', fontSize: 20},
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            borderTopWidth: 1,
            height: 65,
            paddingBottom: 10,
            paddingTop: 6,
          },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarLabelStyle: {fontSize: 10, fontWeight: '600'},
          tabBarIcon: ({color, size}) => (
            <MaterialIcons name={TAB_ICONS[route.name] || 'circle'} size={22} color={color} />
          ),
        })}>
        <Tab.Screen name="Home" component={DashboardScreen} />
        <Tab.Screen name="Stocks" component={StocksStackScreen} options={{headerShown: false}} />
        <Tab.Screen name="Scans" component={ScansScreen} />
        <Tab.Screen name="Backtest" component={BacktestScreen} />
        <Tab.Screen name="Strategies" component={StrategiesScreen} />
        <Tab.Screen name="About" component={AboutScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
