import React from 'react';
import { Button, Card, Form, Input, Space, Typography } from 'antd';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

const { Title, Text } = Typography;

const Login = () => {
  const { login, loading } = useAuth();
  const navigate = useNavigate();

  const onFinish = async (values) => {
    const ok = await login(values);
    if (ok) navigate('/');
  };

  return (
    <div className="page-container" style={{ maxWidth: 420, margin: '40px auto' }}>
      <Card>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Title level={3} style={{ margin: 0 }}>Login</Title>
          <Form layout="vertical" onFinish={onFinish}>
            <Form.Item label="Email" name="email" rules={[{ required: true, type: 'email' }]}>
              <Input placeholder="you@example.com" autoComplete="email" />
            </Form.Item>
            <Form.Item label="Password" name="password" rules={[{ required: true }]}>
              <Input.Password placeholder="••••••••" autoComplete="current-password" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" block loading={loading}>Sign in</Button>
            </Form.Item>
          </Form>
          <Text>Don't have an account? <Link to="/register">Sign up</Link></Text>
        </Space>
      </Card>
    </div>
  );
};

export default Login;
