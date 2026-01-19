import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { QuestionnairePage } from './pages/QuestionnairePage';
import { ChecklistPage } from './pages/ChecklistPage';
import { ExclusionsPage } from './pages/ExclusionsPage';

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<AppLayout />}>
                    <Route index element={<Navigate to="/questionnaire" replace />} />
                    <Route path="questionnaire" element={<QuestionnairePage />} />
                    <Route path="checklist" element={<ChecklistPage />} />
                    <Route path="exclusions" element={<ExclusionsPage />} />
                </Route>
            </Routes>
        </BrowserRouter>
    );
}

export default App;
