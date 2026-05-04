import React from 'react';
import { Layout, Menu, Button, Space, Typography } from 'antd';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  DashboardOutlined, 
  SearchOutlined, 
  BarChartOutlined, 
  DatabaseOutlined,
  // SettingOutlined,
  PlayCircleOutlined
} from '@ant-design/icons';
import { useAuth } from '../AuthContext';

const { Header: AntHeader } = Layout;
const { Title } = Typography;

const Header = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  
  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: <Link to="/">Dashboard</Link>,
    },
    {
      key: '/scans',
      icon: <SearchOutlined />,
      label: <Link to="/scans">Scans</Link>,
    },
    {
      key: '/stocks',
      icon: <DatabaseOutlined />,
      label: <Link to="/stocks">Stocks</Link>,
    },
    {
      key: '/analytics',
      icon: <BarChartOutlined />,
      label: <Link to="/analytics">Analytics</Link>,
    },
  ];

  // Add Profile menu item without icon on the right side by extending items
  const profileItem = {
    key: '/profile',
    label: <Link to="/profile">Profile</Link>,
  };

  return (
    <AntHeader style={{ 
      background: '#001529', 
      padding: '0 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <img src="/growvest-logo-light.svg" alt="Growvest" style={{ height: 28, marginRight: 12 }} />
        <Title level={4} style={{ color: 'white', margin: 0 }}>
          Growvest
        </Title>
      </div>
      
      <Menu
        theme="dark"
        mode="horizontal"
        selectedKeys={[location.pathname]}
        items={[...menuItems, profileItem]}
        style={{ 
          flex: 1, 
          justifyContent: 'center',
          background: 'transparent',
          border: 'none'
        }}
      />
      
      <Space>
        {!user ? (
          <>
            <Button onClick={() => navigate('/login')}>Login</Button>
            <Button type="primary" onClick={() => navigate('/register')}>Sign Up</Button>
          </>
        ) : (
          <>
            <span style={{ color: '#fff' }}>{user.email}</span>
            <Button onClick={logout}>Logout</Button>
          </>
        )}
      </Space>
    </AntHeader>
  );
};

export default Header;
