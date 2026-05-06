import { useState } from "react";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { ConfigProvider, Layout, Button, Tabs } from "antd";
import { SettingOutlined } from "@ant-design/icons";
import zhCN from "antd/locale/zh_CN";
import DefectForm from "./pages/defect-form";
import PrdTestCase from "./pages/prd-test-case";
import Settings from "./pages/settings";

const { Header, Content } = Layout;

function MainLayout() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("defect");

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Header style={{ background: "#fff", padding: "0 24px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f0f0f0" }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          style={{ marginBottom: 0 }}
          items={[
            { key: "defect", label: "缺陷自动创建" },
            { key: "prd", label: "测试用例自动创建" },
          ]}
        />
        <Button icon={<SettingOutlined />} type="text" onClick={() => navigate("/settings")}>设置</Button>
      </Header>
      <Content style={{ padding: 24, maxWidth: 1200, margin: "0 auto", width: "100%" }}>
        {activeTab === "defect" && <DefectForm />}
        {activeTab === "prd" && <PrdTestCase />}
      </Content>
    </Layout>
  );
}

function App() {
  return (
    <ConfigProvider locale={zhCN}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MainLayout />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}

export default App;
