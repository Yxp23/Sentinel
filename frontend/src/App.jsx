import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import IntroScreen from './components/IntroScreen'
import LandingScreen from './components/LandingScreen'
import DataInputScreen from './components/DataInputScreen'
import AnalysisScreen from './components/AnalysisScreen'
import CommandCenter from './components/CommandCenter'
import InvestigationView from './components/InvestigationView'
import SentinelChat from './components/SentinelChat'
import { ErrorBoundary } from './components/shared/ErrorBoundary'

function ScrollToTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let elRef = null

    const onWin = () => setVisible(window.scrollY > 300)
    const onEl  = (e) => setVisible(e.target.scrollTop > 300)

    const attach = () => {
      const el = document.querySelector('[data-scroll-root]')
      if (el && el !== elRef) {
        if (elRef) elRef.removeEventListener('scroll', onEl)
        el.addEventListener('scroll', onEl, { passive: true })
        elRef = el
      } else if (!el && elRef) {
        elRef.removeEventListener('scroll', onEl)
        elRef = null
        setVisible(false)
      }
    }

    window.addEventListener('scroll', onWin, { passive: true })
    attach()
    const obs = new MutationObserver(attach)
    obs.observe(document.body, { childList: true, subtree: true })

    return () => {
      window.removeEventListener('scroll', onWin)
      if (elRef) elRef.removeEventListener('scroll', onEl)
      obs.disconnect()
    }
  }, [])

  const scrollUp = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    document.querySelector('[data-scroll-root]')?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.2 }}
          onClick={scrollUp}
          style={{
            position: 'fixed', bottom: 28, right: 28, zIndex: 999,
            width: 44, height: 44, borderRadius: '50%',
            background: 'var(--bg)', border: 'none', cursor: 'pointer',
            boxShadow: '5px 5px 12px var(--shadow-d), -4px -4px 10px var(--shadow-l)',
            color: 'var(--amber)', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.92 }}
        >
          ↑
        </motion.button>
      )}
    </AnimatePresence>
  )
}

export default function App() {
  const [screen, setScreen] = useState('intro')
  const [data, setData] = useState(null)
  const [sampleData, setSampleData] = useState(null)  // original pre-computed data, never overwritten
  const [selectedProvider, setSelectedProvider] = useState(null)
  const [activeTab, setActiveTab] = useState('command')
  const [graphMode, setGraphMode] = useState('idle')

  useEffect(() => {
    // Always load pre-computed sample from public/results.json — never from /api/results
    // (which reflects the last upload and would corrupt the sample dataset)
    fetch('/results.json').then(r => r.json()).then(d => { setData(d); setSampleData(d) }).catch(() => {})
  }, [])

  const openInvestigation = (provId) => {
    const cf = data?.case_files?.find(c => c.provider_id === provId)
    setSelectedProvider(cf)
    setScreen('investigation')
  }

  const chatPage = screen === 'investigation' ? 'investigation'
                 : screen === 'command' ? (activeTab === 'validation' ? 'validation' : 'command')
                 : null

  const chatMeta = data ? {
    provider_count: data.metadata?.provider_count ?? data.case_files?.length ?? 0,
    case_count: data.case_files?.length ?? 0,
    high_risk_count: data.case_files?.filter(c => c.overall_risk_level === 'HIGH').length ?? 0,
    medium_risk_count: data.case_files?.filter(c => c.overall_risk_level === 'MEDIUM').length ?? 0,
    estimated_fraud_total: data.case_files?.reduce((s, c) => s + (c.estimated_fraud_amount || 0), 0) ?? 0,
    collusion_rings: data.metadata?.collusion_rings ?? 0,
    temporal_anomalies: data.metadata?.temporal_anomalies ?? 0,
  } : null

  return (
    <>
    <ScrollToTop />
    {chatPage && (
      <SentinelChat
        page={chatPage}
        provider={screen === 'investigation' ? selectedProvider : null}
        meta={chatMeta}
      />
    )}
    <ErrorBoundary>
    <AnimatePresence mode="wait">
      {screen === 'intro' && (
        <IntroScreen key="intro" onDone={() => setScreen('landing')} />
      )}
      {screen === 'landing' && (
        <LandingScreen
          key="landing"
          data={sampleData || data}
          onBegin={() => setScreen('dataInput')}
        />
      )}
      {screen === 'dataInput' && (
        <DataInputScreen
          key="dataInput"
          sampleData={sampleData}
          onBack={() => setScreen('landing')}
          onBegin={(newData) => {
            const d = newData || sampleData
            setData(d)
            setSelectedProvider(null)
            setActiveTab('command')
            setScreen('analysis')
          }}
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
          onChangeDataset={() => { setSelectedProvider(null); setScreen('dataInput') }}
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
    </ErrorBoundary>
    </>
  )
}
