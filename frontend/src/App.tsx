import { useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { ChatArea } from './components/ChatArea'

function App() {
  const [activeSessionId, setActiveSessionId] = useState<string>('')

  return (
    <div className="app-container">
      <Sidebar onSessionStart={(id) => setActiveSessionId(id)} />
      <ChatArea sessionId={activeSessionId} />
    </div>
  )
}

export default App
