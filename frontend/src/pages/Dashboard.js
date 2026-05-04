import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, Button, Space, Typography, Spin, Alert } from 'antd';
import { PlayCircleOutlined, BarChartOutlined, SearchOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getStrategies, getRecentScans, startScan } from '../services/api';

const { Title, Text } = Typography;

const Dashboard = () => {
  const [strategies, setStrategies] = useState([]);
  const [recentScans, setRecentScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [scanning, setScanning] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    console.info('[Growvest] Dashboard mounted');
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [strategiesData, scansData] = await Promise.all([
        getStrategies(),
        getRecentScans(5)
      ]);
      setStrategies(strategiesData);
      setRecentScans(scansData);
    } catch (err) {
      setError('Failed to load dashboard data');
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartScan = async () => {
    try {
      console.info('[Growvest] Start Scan clicked');
      setScanning(true);
      await startScan();
      navigate(`/scans`);
    } catch (err) {
      setError('Failed to start scan');
      console.error('Scan start error:', err);
    } finally {
      setScanning(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <Spin size="large" />
        <Text style={{ marginTop: 16 }}>Loading dashboard...</Text>
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
          <Button size="small" onClick={loadDashboardData}>
            Retry
          </Button>
        }
      />
    );
  }

  const totalStrategies = strategies.length;
  const enabledStrategies = strategies.filter(s => s.enabled).length;
  const recentScanCount = recentScans.length;
  const completedScans = recentScans.filter(s => s.status === 'completed').length;

  return (
    <div className="page-container">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src="/growvest-logo.svg" alt="Growvest" style={{ height: 36 }} />
          <div>
            <Title level={2} className="page-title" style={{ margin: 0 }}>Growvest</Title>
            <Text className="page-subtitle">
              Grow + Invest — Intelligent stock market scanning and analytics for individuals and businesses
            </Text>
          </div>
        </div>
        <Button 
          type="primary" 
          size="large" 
          icon={<PlayCircleOutlined />}
          loading={scanning}
          onClick={handleStartScan}
        >
          Start New Scan
        </Button>
      </div>

      <Row gutter={[24, 24]}>
        <Col xs={24}>
          <Card className="strategy-card" style={{ display: 'flex', alignItems: 'center' }}>
            <img src="/market-illustration.svg" alt="Market" style={{ width: 220, maxWidth: '35%', marginRight: 16 }} />
            <div>
              <Title level={4} style={{ marginTop: 0 }}>Invest with Insight</Title>
              <Text>
                The stock market can be a powerful tool for long-term growth. Always review terms and conditions, do your own research,
                and beware of scams. Growvest helps you make informed decisions with data-driven insights.
              </Text>
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[24, 24]} align="stretch">
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card">
            <Statistic
              title="Total Strategies"
              value={totalStrategies}
              prefix={<BarChartOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card">
            <Statistic
              title="Active Strategies"
              value={enabledStrategies}
              prefix={<SearchOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card">
            <Statistic
              title="Recent Scans"
              value={recentScanCount}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card">
            <Statistic
              title="Completed Scans"
              value={completedScans}
              prefix={<BarChartOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={16}>
          <Card title="Available Strategies" className="strategy-card">
            <Row gutter={[16, 16]}>
              {strategies.map((strategy) => (
                <Col xs={24} sm={12} key={strategy.name}>
                  <Card 
                    size="small" 
                    title={strategy.display_name}
                    extra={
                      <Button 
                        type={strategy.enabled ? "primary" : "default"} 
                        size="small"
                      >
                        {strategy.enabled ? "Enabled" : "Disabled"}
                      </Button>
                    }
                  >
                    <Text type="secondary">{strategy.description}</Text>
                  </Card>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>
        
        <Col xs={24} lg={8}>
          <Card title="Recent Scans" className="strategy-card">
            <Space direction="vertical" style={{ width: '100%' }}>
              {recentScans.length > 0 ? (
                recentScans.map((scan) => (
                  <Card key={scan.scan_id} size="small">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <Text strong>Scan #{scan.scan_id}</Text>
                        <br />
                        <Text type="secondary">
                          {new Date(scan.created_at).toLocaleString()}
                        </Text>
                      </div>
                      <Button 
                        type="link" 
                        onClick={() => navigate(`/results/${scan.scan_id}`)}
                      >
                        View Results
                      </Button>
                    </div>
                  </Card>
                ))
              ) : (
                <Text type="secondary">No recent scans</Text>
              )}
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
