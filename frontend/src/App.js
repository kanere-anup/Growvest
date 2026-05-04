import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Layout } from 'antd';
// import { StockOutlined, ... } from '@ant-design/icons';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import Scans from './pages/Scans';
import Results from './pages/Results';
import Analytics from './pages/Analytics';
import Profile from './pages/Profile';
import Stocks from './pages/Stocks';
import Login from './pages/Login';
import Register from './pages/Register';
import { AuthProvider } from './AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import './App.css';

const { Content } = Layout;

function App() {
  return (
    <AuthProvider>
      <Layout className="layout">
        <Header />
        <Content className="content">
          <Routes>
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            <Route path="/scans" element={<ProtectedRoute><Scans /></ProtectedRoute>} />
            <Route path="/results/:scanId" element={<ProtectedRoute><Results /></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
            <Route path="/stocks" element={<ProtectedRoute><Stocks /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          </Routes>
        </Content>
      </Layout>
    </AuthProvider>
  );
}

export default App;
