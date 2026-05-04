import React, { useState, useEffect, useCallback } from 'react';
import { 
  Card, 
  Row, 
  Col, 
  Typography, 
  Select, 
  Spin, 
  Alert,
  Statistic,
  Table,
  Tag,
  Button,
  InputNumber
} from 'antd';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  Line
} from 'recharts';
import { getStrategyPerformance, getRecentScans, displayStrategyName, getTopStocks, getStockTrend } from '../services/api';

const { Title, Text } = Typography;
const { Option } = Select;

const Analytics = () => {
  const [performance, setPerformance] = useState(null);
  const [recentScans, setRecentScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState(30);

  // Top stocks
  const [topStrategy, setTopStrategy] = useState(null);
  const [topDays, setTopDays] = useState(30);
  const [topLimit, setTopLimit] = useState(10);
  const [topStocks, setTopStocks] = useState([]);

  // Stock trend
  const [selectedSymbol, setSelectedSymbol] = useState(null);
  const [trendDays, setTrendDays] = useState(5);
  const [trendSeries, setTrendSeries] = useState([]);

  const loadAnalytics = useCallback(async () => {
    try {
      console.info('[Growvest] Analytics load start', { days: timeRange });
      setLoading(true);
      const [performanceData, scansData] = await Promise.all([
        getStrategyPerformance(timeRange),
        getRecentScans(50)
      ]);
      setPerformance(performanceData);
      setRecentScans(scansData);
      console.info('[Growvest] Analytics load success', {
        strategies: performanceData?.strategies?.length || 0,
        recentScans: scansData?.length || 0
      });
    } catch (err) {
      setError('Failed to load analytics data');
      console.error('[Growvest] Analytics load error:', err);
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    loadAnalytics();
  }, [timeRange, loadAnalytics]);

  // Load top stocks when filters change
  useEffect(() => {
    (async () => {
      try {
        const data = await getTopStocks({ days: topDays, strategy: topStrategy, limit: topLimit });
        setTopStocks(data);
      } catch (e) {
        console.error('[Growvest] Top stocks load error', e);
      }
    })();
  }, [topDays, topStrategy, topLimit]);

  // Load stock trend when selection changes
  useEffect(() => {
    (async () => {
      if (!selectedSymbol) { setTrendSeries([]); return; }
      try {
        const d = await getStockTrend(selectedSymbol, trendDays);
        setTrendSeries(d.series || []);
      } catch (e) {
        console.error('[Growvest] Stock trend load error', e);
      }
    })();
  }, [selectedSymbol, trendDays]);

  const getStrategyColors = () => {
    return {
      'avwap_proximity': '#1890ff',
      'week_52_extremes': '#52c41a',
      'volume_breakout': '#fa8c16',
      'momentum': '#f759ab',
    };
  };

  const getChartData = () => {
    if (!performance?.strategies) return [];
    
    return performance.strategies.map(strategy => ({
      name: displayStrategyName(strategy.name),
      total_results: strategy.total_results,
      unique_stocks: strategy.unique_stocks,
      avg_results_per_stock: strategy.unique_stocks > 0 ? 
        (strategy.total_results / strategy.unique_stocks).toFixed(2) : 0
    }));
  };

  const getPieData = () => {
    if (!performance?.strategies) return [];
    
    const colors = getStrategyColors();
    return performance.strategies.map(strategy => ({
      name: displayStrategyName(strategy.name),
      value: strategy.total_results,
      color: colors[strategy.name] || '#8884d8'
    }));
  };

  const getScanTrendData = () => {
    // Group scans by date and count
    const grouped = {};
    recentScans.forEach(scan => {
      const date = new Date(scan.created_at).toISOString().split('T')[0];
      if (!grouped[date]) {
        grouped[date] = 0;
      }
      grouped[date]++;
    });
    
    return Object.entries(grouped)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(-7); // Last 7 days
  };

  const getTopPerformingStrategies = () => {
    if (!performance?.strategies) return [];
    
    return performance.strategies
      .sort((a, b) => b.total_results - a.total_results)
      .slice(0, 5);
  };

  const columns = [
    {
      title: 'Strategy',
      dataIndex: 'name',
      key: 'name',
      render: (name) => (
        <Tag color={getStrategyColors()[name]}>
          {displayStrategyName(name)}
        </Tag>
      ),
    },
    {
      title: 'Total Results',
      dataIndex: 'total_results',
      key: 'total_results',
      sorter: (a, b) => a.total_results - b.total_results,
    },
    {
      title: 'Unique Stocks',
      dataIndex: 'unique_stocks',
      key: 'unique_stocks',
      sorter: (a, b) => a.unique_stocks - b.unique_stocks,
    },
    {
      title: 'Avg Results/Stock',
      dataIndex: 'avg_results_per_stock',
      key: 'avg_results_per_stock',
      render: (value) => parseFloat(value).toFixed(2),
      sorter: (a, b) => parseFloat(a.avg_results_per_stock) - parseFloat(b.avg_results_per_stock),
    },
  ];

  // Extra/dynamic charts state
  const [extraCharts, setExtraCharts] = useState([]);

  // Additional chart data builders
  const getUniqueStocksData = () => {
    if (!performance?.strategies) return [];
    return performance.strategies.map(s => ({
      name: displayStrategyName(s.name),
      unique_stocks: s.unique_stocks,
    }));
  };

  const getAvgResultsPerStockData = () => {
    if (!performance?.strategies) return [];
    return performance.strategies.map(s => ({
      name: displayStrategyName(s.name),
      avg_results_per_stock: s.unique_stocks > 0 ? (s.total_results / s.unique_stocks) : 0,
    }));
  };

  const getStatusBreakdownData = () => {
    if (!recentScans?.length) return [];
    const counts = recentScans.reduce((acc, s) => {
      const st = (s.status || 'unknown').toLowerCase();
      acc[st] = (acc[st] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts).map(([status, count]) => ({ status, count }));
  };

  if (loading) {
    return (
      <div className="loading-container">
        <Spin size="large" />
        <Text style={{ marginTop: 16 }}>Loading analytics...</Text>
      </div>
    );
  }

  if (error) {
    return (
      <Alert
        message="Error"
        description={error}
        type="error"
        showIcon
        action={
          <Button size="small" onClick={loadAnalytics}>
            Retry
          </Button>
        }
      />
    );
  }

  const chartData = getChartData();
  const pieData = getPieData();
  const scanTrendData = getScanTrendData();
  const topStrategies = getTopPerformingStrategies();

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <Title level={2} className="page-title">Analytics</Title>
          <Text className="page-subtitle">
            Performance insights and strategy analytics
          </Text>
        </div>
        <Select
          value={timeRange}
          onChange={setTimeRange}
          style={{ width: 120 }}
        >
          <Option value={7}>Last 7 days</Option>
          <Option value={30}>Last 30 days</Option>
          <Option value={90}>Last 90 days</Option>
        </Select>
      </div>

      <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic
              title="Total Results"
              value={performance?.strategies?.reduce((sum, s) => sum + s.total_results, 0) || 0}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic
              title="Unique Stocks"
              value={performance?.strategies?.reduce((sum, s) => sum + s.unique_stocks, 0) || 0}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic
              title="Active Strategies"
              value={performance?.strategies?.length || 0}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic
              title="Recent Scans"
              value={recentScans.length}
              valueStyle={{ color: '#f759ab' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={12}>
          <Card title="Strategy Performance" className="chart-container">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="total_results" fill="#1890ff" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        
        <Col xs={24} lg={12}>
          <Card title="Results Distribution" className="chart-container">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={12}>
          <Card title="Scan Activity Trend" className="chart-container">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={scanTrendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#52c41a" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        
        <Col xs={24} lg={12}>
          <Card title="Top Performing Strategies" className="results-container">
            <Table
              columns={columns}
              dataSource={topStrategies}
              rowKey="name"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={12}>
          <Card title="Top Stocks">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
              <Select
                allowClear
                placeholder="Strategy (optional)"
                value={topStrategy}
                onChange={setTopStrategy}
                style={{ minWidth: 220 }}
              >
                {(performance?.strategies || []).map(s => (
                  <Option key={s.name} value={s.name}>{displayStrategyName(s.name)}</Option>
                ))}
              </Select>
              <Select value={topLimit} onChange={setTopLimit} style={{ width: 120 }}>
                <Option value={5}>Top 5</Option>
                <Option value={10}>Top 10</Option>
                <Option value={20}>Top 20</Option>
              </Select>
              <InputNumber min={1} max={90} value={topDays} onChange={setTopDays} />
              <Text type="secondary">days</Text>
            </div>
            <Table
              size="small"
              dataSource={topStocks}
              rowKey="symbol"
              pagination={{ pageSize: 10 }}
              columns={[
                { title: 'Symbol', dataIndex: 'symbol', key: 'symbol', render: (sym) => (
                  <Button type="link" onClick={() => setSelectedSymbol(sym)}>{sym}</Button>
                )},
                { title: 'Hits', dataIndex: 'hits', key: 'hits', sorter: (a,b) => a.hits - b.hits },
                { title: 'Avg Score', dataIndex: 'avg_score', key: 'avg_score', render: (v) => v != null ? parseFloat(v).toFixed(2) : '-' },
                { title: 'Last Seen', dataIndex: 'last_seen', key: 'last_seen', render: (d) => new Date(d).toLocaleString() },
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title={selectedSymbol ? `Stock Trend — ${selectedSymbol}` : 'Stock Trend'}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Text type="secondary">Days:</Text>
              <InputNumber min={1} max={90} value={trendDays} onChange={setTrendDays} />
            </div>
            {trendSeries && trendSeries.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={trendSeries}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Bar yAxisId="right" dataKey="volume_ratio" fill="#845EC2" name="Volume Ratio" />
                  <Line yAxisId="left" type="monotone" dataKey="close" stroke="#1890ff" dot={false} name="Close" />
                  <Line yAxisId="left" type="monotone" dataKey="avwap" stroke="#52c41a" dot={false} name="AVWAP" />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <Text type="secondary">Select a symbol from Top Stocks to view trend.</Text>
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
        <Col xs={24}>
          <Card title="More Insights">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <Text type="secondary">Add charts:</Text>
              <Select
                mode="multiple"
                value={extraCharts}
                onChange={setExtraCharts}
                placeholder="Select additional charts"
                style={{ minWidth: 320 }}
                options={[
                  { label: 'Unique Stocks by Strategy', value: 'unique' },
                  { label: 'Avg Results per Stock', value: 'avg' },
                  { label: 'Recent Scans by Status', value: 'status' },
                ]}
              />
            </div>
            <Row gutter={[24, 24]}>
              {extraCharts.includes('unique') && (
                <Col xs={24} lg={12}>
                  <Card title="Unique Stocks by Strategy" className="chart-container">
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={getUniqueStocksData()}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="unique_stocks" fill="#845EC2" />
                      </BarChart>
                    </ResponsiveContainer>
                  </Card>
                </Col>
              )}
              {extraCharts.includes('avg') && (
                <Col xs={24} lg={12}>
                  <Card title="Average Results per Stock" className="chart-container">
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={getAvgResultsPerStockData()}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="avg_results_per_stock" fill="#FF8066" />
                      </BarChart>
                    </ResponsiveContainer>
                  </Card>
                </Col>
              )}
              {extraCharts.includes('status') && (
                <Col xs={24} lg={12}>
                  <Card title="Recent Scans by Status" className="chart-container">
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={getStatusBreakdownData()}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="status" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="count" fill="#00C9A7" />
                      </BarChart>
                    </ResponsiveContainer>
                  </Card>
                </Col>
              )}
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Analytics;
