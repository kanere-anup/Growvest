import React, { useEffect, useState } from 'react';
import { Card, Typography, Button, Table, Tag, Space, Modal, Form, Input, InputNumber, Switch, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, DatabaseOutlined } from '@ant-design/icons';
import { getStocks, createStock, updateStock, deleteStock } from '../services/api';

const { Title, Text } = Typography;

const Stocks = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);

  const load = async (p = page, ps = pageSize) => {
    try {
      setLoading(true);
      const safeP = Number.isFinite(Number(p)) && Number(p) > 0 ? Number(p) : 1;
      const safePs = Number.isFinite(Number(ps)) && Number(ps) > 0 ? Number(ps) : (Number(pageSize) || 20);
      const offset = (safeP - 1) * safePs;
      const { items: rows, total: t } = await getStocks({ limit: safePs, offset });
      setItems(rows);
      setTotal(typeof t === 'number' ? t : rows.length);
      setPage(safeP);
      setPageSize(safePs);
    } catch (e) {
      setError('Failed to load stocks');
      console.error('[Growvest] Stocks load error', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.info('[Growvest] Stocks page mounted');
    load(1, pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onAdd = () => {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };

  const onEdit = (record) => {
    setEditing(record);
    form.setFieldsValue({
      symbol: record.symbol,
      name: record.name,
      sector: record.sector,
      market_cap: record.market_cap,
      is_active: record.is_active,
    });
    setModalOpen(true);
  };

  const onDelete = async (record) => {
    try {
      await deleteStock(record.id);
      message.success('Stock deleted');
      load();
    } catch (e) {
      message.error('Delete failed');
    }
  };

  const onSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editing) {
        await updateStock(editing.id, values);
        message.success('Stock updated');
      } else {
        await createStock(values);
        message.success('Stock created');
      }
      setModalOpen(false);
      load();
    } catch (e) {
      // handled by form or API
    }
  };

  const columns = [
    { title: 'Symbol', dataIndex: 'symbol', key: 'symbol', width: 120 },
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Sector', dataIndex: 'sector', key: 'sector', width: 160 },
    { title: 'Market Cap', dataIndex: 'market_cap', key: 'market_cap', width: 140, render: (v) => v ? new Intl.NumberFormat('en-IN').format(v) : '-' },
    { title: 'Active', dataIndex: 'is_active', key: 'is_active', width: 100, render: (v) => <Tag color={v ? 'green' : 'default'}>{v ? 'Yes' : 'No'}</Tag> },
    {
      title: 'Actions', key: 'actions', width: 160, render: (_, record) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => onEdit(record)}>Edit</Button>
          <Button danger icon={<DeleteOutlined />} onClick={() => onDelete(record)}>Delete</Button>
        </Space>
      )
    }
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <Title level={2} className="page-title">Stocks</Title>
          <Text className="page-subtitle">Manage the universe of stocks used for scans</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={onAdd}>Add Stock</Button>
        </Space>
      </div>

      <Card>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={items}
          columns={columns}
          pagination={{
            current: page,
            pageSize: pageSize,
            total: total,
            showSizeChanger: true,
            pageSizeOptions: [20, 50, 100],
          }}
          onChange={(pagination) => {
            const p = pagination?.current || 1;
            const ps = pagination?.pageSize || pageSize;
            load(p, ps);
          }}
        />
      </Card>

      <Modal
        title={editing ? 'Edit Stock' : 'Add Stock'}
        open={modalOpen}
        onOk={onSubmit}
        onCancel={() => setModalOpen(false)}
        okText={editing ? 'Update' : 'Create'}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="symbol" label="Symbol" rules={[{ required: true, message: 'Symbol is required' }]}>
            <Input placeholder="e.g., TCS or TCS.NS" />
          </Form.Item>
          <Form.Item name="name" label="Name">
            <Input placeholder="Company name" />
          </Form.Item>
          <Form.Item name="sector" label="Sector">
            <Input placeholder="e.g., Technology" />
          </Form.Item>
          <Form.Item name="market_cap" label="Market Cap">
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item name="is_active" label="Active" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Stocks;
