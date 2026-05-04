import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Card, 
  Table, 
  Tag, 
  Button, 
  Space, 
  Typography, 
  Select, 
  Row, 
  Col, 
  Statistic,
  Alert,
  Spin,
  message,
  Tabs
} from 'antd';
import { 
  DownloadOutlined, 
  ArrowLeftOutlined, 
  BarChartOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { getScanResults, getScanStatus, exportScan, downloadFile, displayStrategyName } from '../services/api';
import { formatCurrency, formatPercentage , formatNumber  } from '../services/api';

const { Title, Text } = Typography;
const { Option } = Select;
const { TabPane } = Tabs;

const Results = () => {
  const { scanId } = useParams();
  const navigate = useNavigate();
  const [results, setResults] = useState([]);
  const [scanStatus, setScanStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedStrategy, setSelectedStrategy] = useState(null);
  const [strategies, setStrategies] = useState([]);

  useEffect(() => {
    console.info('[Growvest] Results page mounted for scan', scanId);
    loadResults();
    loadScanStatus();
  }, [scanId]);

  const loadResults = async () => {
    try {
      setLoading(true);
      const data = await getScanResults(scanId, selectedStrategy);
      setResults(data);
      
      // Extract unique strategies
      const uniqueStrategies = [...new Set(data.map(r => r.strategy_name))];
      setStrategies(uniqueStrategies);
    } catch (err) {
      setError('Failed to load results');
      console.error('Results load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadScanStatus = async () => {
    try {
      const data = await getScanStatus(scanId);
      setScanStatus(data);
    } catch (err) {
      console.error('Scan status load error:', err);
    }
  };

  const handleExport = async () => {
    try {
      console.info('[Growvest] Export Excel for scan', scanId);
      const blob = await exportScan(scanId);
      const filename = `scan_results_${scanId}_${new Date().toISOString().split('T')[0]}.xlsx`;
      downloadFile(blob, filename);
      message.success('Export ready');
    } catch (err) {
      message.error('Failed to export results');
      console.error('Export error:', err);
    }
  };

  const getStrategyColumns = (strategyName) => {
    const baseColumns = [
      {
        title: 'Symbol',
        dataIndex: 'symbol',
        key: 'symbol',
        width: 120,
        fixed: 'left',
      },
      {
        title: 'Current Price',
        dataIndex: 'current_price',
        key: 'current_price',
        width: 120,
        render: (value) => formatCurrency(value),
        sorter: (a, b) => a.current_price - b.current_price,
      },
      {
        title: 'Score',
        dataIndex: 'score',
        key: 'score',
        width: 100,
        render: (value) => value ? formatNumber(value, 2) : '-',
        sorter: (a, b) => (a.score || 0) - (b.score || 0),
      },
    ];

    // Strategy-specific columns
    const strategyColumns = {
      avwap_proximity: [
        {
          title: 'AVWAP',
          dataIndex: ['result_data', 'AVWAP'],
          key: 'avwap',
          width: 120,
          render: (value) => value ? formatCurrency(value) : '-',
        },
        {
          title: 'Difference %',
          dataIndex: ['result_data', 'Difference_%'],
          key: 'difference',
          width: 120,
          render: (value) => value ? formatPercentage(value) : '-',
          sorter: (a, b) => (a.result_data?.['Difference_%'] || 0) - (b.result_data?.['Difference_%'] || 0),
        },
      ],
      week_52_extremes: [
        {
          title: '52W High',
          dataIndex: ['result_data', '52W_High'],
          key: 'high',
          width: 120,
          render: (value) => value ? formatCurrency(value) : '-',
        },
        {
          title: '52W Low',
          dataIndex: ['result_data', '52W_Low'],
          key: 'low',
          width: 120,
          render: (value) => value ? formatCurrency(value) : '-',
        },
        {
          title: 'Extreme Type',
          dataIndex: ['result_data', 'Extreme_Type'],
          key: 'extreme_type',
          width: 140,
          render: (value) => {
            if (!value) return '-';
            const hasHigh = /high/i.test(value);
            const hasLow = /low/i.test(value);
            let color = 'default';
            if (hasHigh && hasLow) color = 'purple';
            else if (hasHigh) color = 'volcano';
            else if (hasLow) color = 'geekblue';
            return <Tag color={color}>{value}</Tag>;
          },
        },
      ],
      volume_breakout: [
        {
          title: 'Volume Ratio',
          dataIndex: ['result_data', 'Volume_Ratio'],
          key: 'volume_ratio',
          width: 120,
          render: (value) => value ? `${value}x` : '-',
          sorter: (a, b) => (a.result_data?.Volume_Ratio || 0) - (b.result_data?.Volume_Ratio || 0),
        },
        {
          title: 'Price Change %',
          dataIndex: ['result_data', 'Price_Change_%'],
          key: 'price_change',
          width: 120,
          render: (value) => value ? formatPercentage(value) : '-',
          sorter: (a, b) => (a.result_data?.['Price_Change_%'] || 0) - (b.result_data?.['Price_Change_%'] || 0),
        },
        {
          title: 'Breakout Type',
          dataIndex: ['result_data', 'Breakout_Type'],
          key: 'breakout_type',
          width: 120,
          render: (value) => value ? (
            <Tag color={value === 'Up' ? 'green' : 'red'}>{value}</Tag>
          ) : '-',
        },
      ],
      momentum: [
        {
          title: '5D Return %',
          dataIndex: ['result_data', 'Return_5D_%'],
          key: 'return_5d',
          width: 120,
          render: (value) => value ? formatPercentage(value) : '-',
          sorter: (a, b) =>  (a.result_data?.['Return_5D_%'] || 0) - (b.result_data?.['Return_5D_%'] || 0),
        },
        {
          title: '10D Return %',
          dataIndex: ['result_data', 'Return_10D_%'],
          key: 'return_10d',
          width: 120,
          render: (value) => value ? formatPercentage(value) : '-',
          sorter: (a, b) => (a.result_data?.['Return_10D_%'] || 0) - (b.result_data?.['Return_10D_%'] || 0),
        },
        {
          title: '20D Return %',
          dataIndex: ['result_data', 'Return_20D_%'],
          key: 'return_20d',
          width: 120,
          render: (value) => value ? formatPercentage(value) : '-',
          sorter: (a, b) => (a.result_data?.['Return_20D_%'] || 0) - (b.result_data?.['Return_20D_%'] || 0),
        },
        {
          title: 'Momentum Score',
          dataIndex: ['result_data', 'Momentum_Score'],
          key: 'momentum_score',
          width: 120,
          render: (value) => value ? formatPercentage(value) : '-',
          sorter: (a, b) => (a.result_data?.Momentum_Score || 0) - (b.result_data?.Momentum_Score || 0),
        },
      ],
    };

    return [...baseColumns, ...(strategyColumns[strategyName] || [])];
  };

  const getResultsByStrategy = () => {
    const grouped = {};
    results.forEach(result => {
      if (!grouped[result.strategy_name]) {
        grouped[result.strategy_name] = [];
      }
      grouped[result.strategy_name].push(result);
    });
    return grouped;
  };

  const resultsByStrategy = getResultsByStrategy();

  if (loading) {
    return (
      <div className="loading-container">
        <Spin size="large" />
        <Text style={{ marginTop: 16 }}>Loading results...</Text>
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
          <Button size="small" onClick={loadResults}>
            Retry
          </Button>
        }
      />
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <Button 
            icon={<ArrowLeftOutlined />} 
            onClick={() => navigate('/scans')}
            style={{ marginRight: 16 }}
          >
            Back to Scans
          </Button>
          <Title level={2} className="page-title">
            Scan Results #{scanId}
          </Title>
          <Text className="page-subtitle">
            Detailed results from your stock scan
          </Text>
        </div>
        <Space>
          <Button 
            icon={<ReloadOutlined />} 
            onClick={() => { console.info('[Growvest] Refresh results for scan', scanId); loadResults(); }}
          >
            Refresh
          </Button>
          <Button 
            type="primary" 
            icon={<DownloadOutlined />}
            onClick={handleExport}
          >
            Export Excel
          </Button>
        </Space>
      </div>

      {scanStatus && (
        <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title="Total Results"
                value={results.length}
                prefix={<BarChartOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title="Strategies"
                value={strategies.length}
                prefix={<BarChartOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title="Execution Time"
                value={scanStatus.execution_time || 0}
                suffix="s"
                valueStyle={{ color: '#fa8c16' }}
              />
            </Card>
          </Col>
        </Row>
      )}

      <Card className="results-container">
        <Tabs defaultActiveKey="all">
          <TabPane tab="All Results" key="all">
            <Table
              columns={[
                {
                  title: 'Strategy',
                  dataIndex: 'strategy_name',
                  key: 'strategy_name',
                  width: 150,
                  render: (value) => (
                    <Tag color="blue">
                      {displayStrategyName(value)}
                    </Tag>
                  ),
                },
                {
                  title: 'Symbol',
                  dataIndex: 'symbol',
                  key: 'symbol',
                  width: 120,
                },
                {
                  title: 'Current Price',
                  dataIndex: 'current_price',
                  key: 'current_price',
                  width: 120,
                  render: (value) => formatCurrency(value),
                },
                {
                  title: 'Score',
                  dataIndex: 'score',
                  key: 'score',
                  width: 100,
                  render: (value) => value ? formatNumber(value, 2) : '-',
                },
                {
                  title: 'Created',
                  dataIndex: 'created_at',
                  key: 'created_at',
                  width: 150,
                  render: (date) => new Date(date).toLocaleString(),
                },
              ]}
              dataSource={results}
              rowKey="id"
              pagination={{
                defaultPageSize: 20,
                pageSizeOptions: [20, 50, 100],
                showSizeChanger: true,
                showQuickJumper: true,
              }}
              scroll={{ x: 800 }}
            />
          </TabPane>
          
          {strategies.map(strategy => (
            <TabPane 
              tab={`${displayStrategyName(strategy)} (${resultsByStrategy[strategy]?.length || 0})`} 
              key={strategy}
            >
              <Table
                columns={getStrategyColumns(strategy)}
                dataSource={resultsByStrategy[strategy] || []}
                rowKey="id"
                pagination={{
                  defaultPageSize: 20,
                  pageSizeOptions: [20, 50, 100],
                  showSizeChanger: true,
                  showQuickJumper: true,
                }}
                scroll={{ x: 1000 }}
              />
            </TabPane>
          ))}
        </Tabs>
      </Card>
    </div>
  );
};

export default Results;
