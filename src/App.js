import React from 'react';
import { Routes, Route } from 'react-router-dom';
import LobbyPage from './pages/LobbyPage';
import BroadcastPage from './pages/BroadcastPage';
import AudiencePage from './pages/AudiencePage';

function App() {
  return (
    <div className="min-h-screen bg-agora-light">
      <Routes>
        <Route path="/" element={<LobbyPage />} />
        <Route path="/broadcast/:channelName" element={<BroadcastPage />} />
        <Route path="/watch/:channelName" element={<AudiencePage />} />
      </Routes>
    </div>
  );
}

export default App;

