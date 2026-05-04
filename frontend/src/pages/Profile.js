import React from 'react';
import { Typography, Card, Row, Col, Space, Divider } from 'antd';
import { MailOutlined, PhoneOutlined, EnvironmentOutlined, UserOutlined, FundOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

const Profile = () => {
  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src="/growvest-logo.svg" alt="Growvest" style={{ height: 36 }} />
          <div>
            <Title level={2} className="page-title" style={{ margin: 0 }}>Growvest</Title>
            <Text className="page-subtitle">Grow + Invest — Financial and stock market intelligence</Text>
          </div>
        </div>
      </div>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={16}>
          <Card>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <img src="/profile.jpg" alt="Anup Kanere" style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: '2px solid #e6f7ff' }} />
                <div>
                  <Space align="center">
                    <UserOutlined style={{ fontSize: 24, color: '#1890ff' }} />
                    <Title level={3} style={{ margin: 0 }}>Anup Kanere</Title>
                  </Space>
                  <div style={{ marginTop: 6 }}>
                    <a href="https://anupkanere.github.io/profile/anup_portfolio.html" target="_blank" rel="noreferrer">View full portfolio</a>
                  </div>
                </div>
              </div>

              <Paragraph>
                I’m Anup Kanere, a software developer skilled in Python, Golang, Rust, and Java. I specialize in backend development, API design, and dynamic report generation using FastAPI, PostgreSQL, MySQL, DuckDB, and SQL Server. I focus on creating efficient, scalable, and reliable software solutions that help businesses achieve growth.
              </Paragraph>

              <Divider />

              <Row gutter={[16, 16]}>
                <Col xs={24} sm={12}>
                  <Card size="small">
                    <Title level={5} style={{ marginBottom: 8 }}>Skills</Title>
                    <Paragraph style={{ marginBottom: 4 }}>
                      <Text strong>Languages:</Text> Python, Golang, Rust, Java
                    </Paragraph>
                    <Paragraph style={{ marginBottom: 4 }}>
                      <Text strong>Backend:</Text> FastAPI, RESTful APIs, Async IO
                    </Paragraph>
                    <Paragraph style={{ marginBottom: 0 }}>
                      <Text strong>Data/DB:</Text> PostgreSQL, MySQL, SQL Server, DuckDB
                    </Paragraph>
                  </Card>
                </Col>
                <Col xs={24} sm={12}>
                  <Card size="small">
                    <Title level={5} style={{ marginBottom: 8 }}>Focus Areas</Title>
                    <Paragraph style={{ marginBottom: 4 }}>
                      API design and backend scalability
                    </Paragraph>
                    <Paragraph style={{ marginBottom: 4 }}>
                      Data-driven reporting and analytics
                    </Paragraph>
                    <Paragraph style={{ marginBottom: 0 }}>
                      Reliable, production-grade systems
                    </Paragraph>
                  </Card>
                </Col>
              </Row>
            </Space>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Card>
              <Space direction="vertical" size={8}>
                <Title level={4} style={{ margin: 0 }}>Contact</Title>
                <Space>
                  <MailOutlined />
                  <a href="mailto:kanereanup@gmail.com">kanereanup@gmail.com</a>
                </Space>
                <Space>
                  <PhoneOutlined />
                  <a href="tel:+917720888632">+91 7720888632</a>
                </Space>
                <Space>
                  <EnvironmentOutlined />
                  <Text>Maharashtra, India</Text>
                </Space>
              </Space>
            </Card>

            <Card>
              <Space direction="vertical" size={8}>
                <Space align="center">
                  <FundOutlined style={{ color: '#52c41a' }} />
                  <Title level={4} style={{ margin: 0 }}>Growvest</Title>
                </Space>
                <Paragraph style={{ marginBottom: 0 }}>
                  Growvest stands for Grow + Invest. We help individuals and businesses grow intelligently through innovative software solutions, data-driven insights, and strategic tools.
                </Paragraph>
              </Space>
            </Card>
          </Space>
        </Col>
      </Row>
    </div>
  );
};

export default Profile;
