import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Dashboard from './pages/Dashboard.jsx'
import TestSetUpload from './pages/TestSetUpload.jsx'
import PromptEditor from './pages/PromptEditor.jsx'
import Evaluation from './pages/Evaluation.jsx'
import ABTest from './pages/ABTest.jsx'
import Badcase from './pages/Badcase.jsx'
import Versions from './pages/Versions.jsx'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/testset" element={<TestSetUpload />} />
        <Route path="/prompt" element={<PromptEditor />} />
        <Route path="/evaluation" element={<Evaluation />} />
        <Route path="/abtest" element={<ABTest />} />
        <Route path="/badcase" element={<Badcase />} />
        <Route path="/versions" element={<Versions />} />
      </Routes>
    </Layout>
  )
}
