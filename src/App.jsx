import { HashRouter, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import CategoryPage from './pages/CategoryPage.jsx'
import CheatSheetsPage from './pages/CheatSheetsPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import FlashcardsPage from './pages/FlashcardsPage.jsx'
import FrameworkPage from './pages/FrameworkPage.jsx'
import MockPage from './pages/MockPage.jsx'
import PracticeSitePage from './pages/PracticeSitePage.jsx'
import ProblemPage from './pages/ProblemPage.jsx'
import ProgressPage from './pages/ProgressPage.jsx'
import ReviewPage from './pages/ReviewPage.jsx'
import SearchPage from './pages/SearchPage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'

export default function App() {
  return (
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/progress" element={<ProgressPage />} />
          <Route path="/review" element={<ReviewPage />} />
          <Route path="/flashcards" element={<FlashcardsPage />} />
          <Route path="/mock" element={<MockPage />} />
          <Route path="/cheatsheets" element={<CheatSheetsPage />} />
          <Route path="/cheatsheets/:slug" element={<CheatSheetsPage />} />
          <Route path="/practice-site" element={<PracticeSitePage />} />
          <Route path="/framework" element={<FrameworkPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/:category" element={<CategoryPage />} />
          <Route path="/:category/:problemId" element={<ProblemPage />} />
        </Routes>
      </Layout>
    </HashRouter>
  )
}
