import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Button, 
  Form, 
  Select, 
  InputNumber, 
  Space, 
  Typography, 
  Table, 
  Tag, 
  // Progress, 
  Alert,
  Spin,
  // Modal,
  message
} from 'antd';
import { 
  PlayCircleOutlined, 
  StopOutlined, 
  EyeOutlined, 
  DownloadOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getRecentScans, startScan, cancelScan, deleteScanRecords, displayStrategyName, exportScanAndDownload } from '../services/api';

const { Title, Text } = Typography;
const { Option } = Select;

const Scans = () => {
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [form] = Form.useForm();
  const navigate = useNavigate();

  useEffect(() => {
    console.info('[Growvest] Scans page mounted');
    loadScans();
  }, []);

  const loadScans = async () => {
    try {
      setLoading(true);
      const data = await getRecentScans(20);
      setScans(data);
    } catch (err) {
      setError('Failed to load scans');
      console.error('Scans load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartScan = async (values) => {
    try {
      console.info('[Growvest] Start scan with params:', values);
      setScanning(true);
      await startScan(values);
      message.success('Scan started successfully');
      loadScans();
    } catch (err) {
      message.error('Failed to start scan');
      console.error('Scan start error:', err);
    } finally {
      setScanning(false);
    }
  };

  const handleCancelScan = async (scanId) => {
    try {
      console.info('[Growvest] Cancel scan:', scanId);
      await cancelScan(scanId);
      message.success('Scan cancelled');
      loadScans();
    } catch (err) {
      message.error('Failed to cancel scan');
      console.error('Cancel scan error:', err);
    }
  };

  const handleDeleteScan = async (scanId) => {
    try {
      console.info('[Growvest] Delete scan:', scanId);
      await deleteScanRecords(scanId);
      message.success('Scan deleted');
      loadScans();
    } catch (err) {
      message.error('Failed to delete scan');
      console.error('Delete scan error:', err);
    }
  };

  const handleExportScan = async (scanId) => {
    try {
      console.info('[Growvest] Export scan:', scanId);
      const { filename } = await exportScanAndDownload(scanId);
      message.success(`Export started: ${filename}`);
    } catch (err) {
      message.error('Failed to export scan');
      console.error('Export scan error:', err);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'success';
      case 'running': return 'processing';
      case 'failed': return 'error';
      default: return 'default';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'completed': return 'Completed';
      case 'running': return 'Running';
      case 'failed': return 'Failed';
      default: return 'Unknown';
    }
  };

  const columns = [
    {
      title: 'Scan ID',
      dataIndex: 'scan_id',
      key: 'scan_id',
      width: 100,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => (
        <Tag color={getStatusColor(status)}>
          {getStatusText(status)}
        </Tag>
      ),
    },
    {
      title: 'Strategies',
      dataIndex: 'strategies_run',
      key: 'strategies_run',
      render: (strategies) => (
        <Space wrap>
          {strategies?.map((strategy) => (
            <Tag key={strategy} size="small">
              {displayStrategyName(strategy)}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: 'Stocks',
      key: 'stocks',
      width: 100,
      render: (_, record) => (
        <Text>{record.successful_stocks || 0}</Text>
      ),
    },
    {
      title: 'Duration',
      dataIndex: 'execution_time',
      key: 'execution_time',
      width: 100,
      render: (time) => time ? `${time.toFixed(1)}s` : '-',
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (date) => new Date(date).toLocaleString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/results/${record.scan_id}`)}
          >
            View
          </Button>
          {record.status === 'running' ? (
            <Button
              type="link"
              danger
              icon={<StopOutlined />}
              onClick={() => handleCancelScan(record.scan_id)}
            >
              Cancel
            </Button>
          ) : (
            <>
              <Button
                type="link"
                icon={<DownloadOutlined />}
                onClick={() => handleExportScan(record.scan_id)}
              >
                Download
              </Button>
              <Button
                type="link"
                danger
                onClick={() => handleDeleteScan(record.scan_id)}
              >
                Delete
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="loading-container">
        <Spin size="large" />
        <Text style={{ marginTop: 16 }}>Loading scans...</Text>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <Title level={2} className="page-title">Stock Scans</Title>
          <Text className="page-subtitle">
            Manage and monitor your stock scanning sessions
          </Text>
        </div>
        <Button 
          icon={<ReloadOutlined />} 
          onClick={loadScans}
        >
          Refresh
        </Button>
      </div>

      <Card title="Start New Scan" className="scan-controls">
        <Form
          form={form}
          layout="inline"
          onFinish={handleStartScan}
          style={{ marginBottom: 16 }}
        >
          <Form.Item
            name="strategies"
            label="Strategies"
            style={{ minWidth: 200 }}
          >
            <Select
              mode="multiple"
              placeholder="Select strategies"
              style={{ width: '100%' }}
            >
              <Option value="avwap_proximity">AVWAP Proximity</Option>
              <Option value="week_52_extremes">52-Week Extremes</Option>
              <Option value="volume_breakout">Volume Breakout</Option>
              <Option value="momentum">Momentum</Option>
            </Select>
          </Form.Item>
          
          <Form.Item
            name="max_concurrent"
            label="Max Concurrent"
            style={{ minWidth: 150 }}
          >
            <InputNumber
              min={1}
              max={50}
              defaultValue={15}
              style={{ width: '100%' }}
            />
          </Form.Item>
          
          <Form.Item>
            <Button 
              type="primary" 
              htmlType="submit"
              icon={<PlayCircleOutlined />}
              loading={scanning}
            >
              Start Scan
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {error && (
        <Alert
          message="Error"
          description={error}
          type="error"
          showIcon
          action={
            <Button size="small" onClick={loadScans}>
              Retry
            </Button>
          }
        />
      )}

      <Card title="Recent Scans" className="results-container">
        <Table
          columns={columns}
          dataSource={scans}
          rowKey="scan_id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
          }}
          loading={loading}
        />
      </Card>
    </div>
  );
};

export default Scans;
