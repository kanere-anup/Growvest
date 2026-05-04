import React from 'react';
import { Button, Card, Form, Input, Space, Typography } from 'antd';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

const { Title, Text } = Typography;

const Register = () => {
  const { register, loading } = useAuth();
  const navigate = useNavigate();

  const onFinish = async (values) => {
    const ok = await register(values);
    if (ok) navigate('/');
  };

  return (
    <div className="page-container" style={{ maxWidth: 420, margin: '40px auto' }}>
      <Card>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Title level={3} style={{ margin: 0 }}>Create account</Title>
          <Form layout="vertical" onFinish={onFinish}>
            <Form.Item label="Full name" name="full_name">
              <Input placeholder="Your name" autoComplete="name" />
            </Form.Item>
            <Form.Item label="Email" name="email" rules={[{ required: true, type: 'email' }]}>
              <Input placeholder="you@example.com" autoComplete="email" />
            </Form.Item>
            <Form.Item label="Password" name="password" rules={[{ required: true, min: 8 }]}>
              <Input.Password placeholder="At least 8 characters" autoComplete="new-password" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" block loading={loading}>Sign up</Button>
            </Form.Item>
          </Form>
          <Text>Already have an account? <Link to="/login">Login</Link></Text>
        </Space>
      </Card>
    </div>
  );
};

export default Register;
