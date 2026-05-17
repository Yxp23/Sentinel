import { useState, useEffect } from 'react'
import { AnimatePresence } from 'framer-motion'
import IntroScreen from './components/IntroScreen'
import LandingScreen from './components/LandingScreen'
import DataInputScreen from './components/DataInputScreen'
import AnalysisScreen from './components/AnalysisScreen'
import CommandCenter from './components/CommandCenter'
import InvestigationView from './components/InvestigationView'

export default function App() {
  const [screen, setScreen] = useState('intro')
  const [data, setData] = useState(null)
  const [selectedProvider, setSelectedProvider] = useState(null)
  const [activeTab, setActiveTab] = useState('command')
  const [graphMode, setGraphMode] = useState('idle')

  useEffect(() => {
    fetch('/results.json')
      .then(r => r.json())
      .then(setData)
      .catch(err => console.error('Failed to load results.json:', err))
  }, [])

  const openInvestigation = (provId) => {
    const cf = data?.case_files?.find(c => c.provider_id === provId)
    setSelectedProvider(cf)
    setScreen('investigation')
  }

  return (
    <AnimatePresence mode="wait">
      {screen === 'intro' && (
        <IntroScreen key="intro" onDone={() => setScreen('landing')} />
      )}
      {screen === 'landing' && (
        <LandingScreen
          key="landing"
          data={data}
          onBegin={() => setScreen('dataInput')}
        />
      )}
      {screen === 'dataInput' && (
        <DataInputScreen
          key="dataInput"
          data={data}
          onBegin={() => setScreen('analysis')}
        />
      )}
      {screen === 'analysis' && (
        <AnalysisScreen
          key="analysis"
          data={data}
          onDone={() => setScreen('command')}
          setGraphMode={setGraphMode}
        />
      )}
      {screen === 'command' && (
        <CommandCenter
          key="command"
          data={data}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onInvestigate={openInvestigation}
          graphMode={graphMode}
        />
      )}
      {screen === 'investigation' && (
        <InvestigationView
          key="investigation"
          data={data}
          provider={selectedProvider}
          onBack={() => setScreen('command')}
        />
      )}
    </AnimatePresence>
  )
}
