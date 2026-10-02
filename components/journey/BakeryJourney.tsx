'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, ArrowUpRight, BookOpen, Check, Coffee, Compass, MapPin, MessageCircle, RotateCcw, ShoppingBag, Sun, Undo2, Volume2 } from 'lucide-react'
import BrandLogo from '@/components/layout/BrandLogo'
import PressableCard from '@/components/motion/PressableCard'
import FeedbackMotion from '@/components/motion/FeedbackMotion'
import MotionProvider from '@/components/motion/MotionProvider'
import { EASE_OUT_SOFT, MOTION, useReducedMotionSafe } from '@/lib/motion'
import styles from './BakeryJourney.module.css'

type Stage = 'intro' | 'discover' | 'order' | 'dialogue' | 'complete'
type Feedback = { correct: boolean; text: string }

const WORDS = [
  { id: 'roll', article: 'das', noun: 'Brötchen', example: 'Ein Brötchen.', icon: BookOpen },
  { id: 'coffee', article: 'der', noun: 'Kaffee', example: 'Ein Kaffee.', icon: Coffee },
  { id: 'bag', article: 'die', noun: 'Tüte', example: 'Eine Tüte.', icon: ShoppingBag },
] as const
const PIECES = ['ein Brötchen', 'und', 'einen Kaffee', 'bitte'] as const
const DISPLAY_PIECES = [2, 3, 0, 1]
const ORDER_SENTENCE = 'Ich möchte ein Brötchen und einen Kaffee bitte.'
const STATIONS = [
  { title: 'Wörter entdecken', detail: 'Drei Wörter für dein Frühstück' },
  { title: 'Höflich bestellen', detail: 'Ein Satz, den du wirklich brauchst' },
  { title: 'Im Gespräch', detail: 'Eine Frage. Deine Antwort.' },
]
const STAGE_NUMBERS: Record<Stage, number> = { intro: 0, discover: 1, order: 2, dialogue: 3, complete: 3 }
const STAGE_TITLES: Record<Stage, string> = {
  intro: 'Ein kleiner Satz. Ein großer Schritt.',
  discover: 'Drei Wörter. Dein Frühstück.',
  order: 'Jetzt bist du dran.',
  dialogue: 'Einfach im Gespräch.',
  complete: 'Dein erster Reisestempel.',
}

/** A public practice scene. Its progress stays here and does not write learning records. */
export default function BakeryJourney({ homeHref = '/de', onSpeak }: {
  homeHref?: string
  /** Optional audio adapter for a locally recorded reference. */
  onSpeak?: (text: string) => void | Promise<void>
}) {
  const reduced = useReducedMotionSafe()
  const [stage, setStage] = useState<Stage>('intro')
  const [discovered, setDiscovered] = useState<string[]>([])
  const [activeWord, setActiveWord] = useState<string | null>(null)
  const [chosen, setChosen] = useState<number[]>([])
  const [orderFeedback, setOrderFeedback] = useState<Feedback | null>(null)
  const [dialogueFeedback, setDialogueFeedback] = useState<Feedback | null>(null)
  const [dialogueComplete, setDialogueComplete] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [audioMessage, setAudioMessage] = useState('')
  const panelTitle = useRef<HTMLHeadingElement>(null)
  const dialogueAction = useRef<HTMLButtonElement>(null)
  const previousStage = useRef<Stage>('intro')
  const referenceAudio = useRef<HTMLAudioElement | null>(null)
  const audioGeneration = useRef(0)

  useEffect(() => {
    if (previousStage.current !== stage) panelTitle.current?.focus()
    previousStage.current = stage
    return () => {
      audioGeneration.current += 1
      if (referenceAudio.current) {
        referenceAudio.current.pause()
        referenceAudio.current.currentTime = 0
        referenceAudio.current = null
      }
    }
  }, [stage, dialogueComplete])

  useEffect(() => {
    if (dialogueComplete && stage === 'dialogue') dialogueAction.current?.focus()
  }, [dialogueComplete, stage])

  function nextStage(next: Stage) {
    setSpeaking(false)
    setAudioMessage('')
    setStage(next)
  }

  function restart() {
    setDiscovered([])
    setActiveWord(null)
    setChosen([])
    setOrderFeedback(null)
    setDialogueFeedback(null)
    setDialogueComplete(false)
    nextStage('intro')
  }

  async function speak(text: string, filename: string) {
    const generation = ++audioGeneration.current
    setAudioMessage('')
    if (referenceAudio.current) {
      referenceAudio.current.pause()
      referenceAudio.current.currentTime = 0
      referenceAudio.current = null
    }
    setSpeaking(false)
    if (onSpeak) {
      try { await onSpeak(text) }
      catch { if (generation === audioGeneration.current) setAudioMessage('Die Hörvorschau ist gerade nicht verfügbar. Du kannst den Satz hier lesen und selbst sprechen.') }
      return
    }
    const reference = new Audio(`/Bilder/deutschreise/audio/${filename}.m4a`)
    reference.onended = () => {
      if (generation === audioGeneration.current) { referenceAudio.current = null; setSpeaking(false) }
    }
    reference.onerror = () => {
      if (generation === audioGeneration.current) {
        referenceAudio.current = null
        setSpeaking(false)
        setAudioMessage('Die Hörvorschau konnte nicht abgespielt werden. Die deutschen Sätze bleiben zum Nachlesen sichtbar.')
      }
    }
    referenceAudio.current = reference
    try {
      await reference.play()
      if (generation === audioGeneration.current) setSpeaking(true)
      else reference.pause()
    } catch {
      if (generation === audioGeneration.current) {
        referenceAudio.current = null
        setSpeaking(false)
        setAudioMessage('Die Hörvorschau konnte nicht abgespielt werden. Die deutschen Sätze bleiben zum Nachlesen sichtbar.')
      }
    }
  }

  function discover(id: string) {
    setActiveWord(id)
    setDiscovered(previous => previous.includes(id) ? previous : [...previous, id])
  }

  function choosePiece(index: number) {
    if (chosen.includes(index) || orderFeedback?.correct) return
    setChosen(previous => [...previous, index])
    setOrderFeedback(null)
  }

  function checkOrder() {
    const correct = chosen.length === PIECES.length && chosen.every((piece, index) => piece === index)
    setOrderFeedback({ correct, text: correct
      ? 'Das passt! „Ein Brötchen“ und „einen Kaffee“ sind deine Bestellung. „Bitte“ macht sie höflich.'
      : 'Fast! Beginne nach „Ich möchte“ mit „ein Brötchen“. Dann folgen „und“, „einen Kaffee“ und „bitte“. Du kannst die Reihenfolge noch ändern.' })
  }

  function answerDialogue(answer: string) {
    if (dialogueComplete) return
    const correct = answer === 'Ja, bitte.'
    setDialogueFeedback({ correct, text: correct
      ? 'Genau. Mit „Ja, bitte“ nimmst du die Tüte freundlich an.'
      : answer === 'Ich heiße Anna.'
        ? 'So stellst du dich vor. Mia fragt gerade nach einer Tüte. Welche Antwort passt zu dieser Frage?'
        : '„Guten Abend“ ist eine Begrüßung am Abend. Mia fragt, ob du eine Tüte möchtest. Versuch es noch einmal.' })
    if (correct) {
      setSpeaking(false)
      setAudioMessage('')
      setDialogueComplete(true)
    }
  }

  const selectedWord = WORDS.find(word => word.id === activeWord)
  const wordReference = selectedWord ? `${selectedWord.article.charAt(0).toUpperCase()}${selectedWord.article.slice(1)} ${selectedWord.noun}. ${selectedWord.example}` : ''
  const stageNumber = STAGE_NUMBERS[stage]
  const bakerText = stage === 'dialogue'
    ? dialogueComplete ? 'Hier, bitte!\nGuten Appetit!' : 'Möchten Sie eine Tüte?'
    : stage === 'complete' ? 'Hier, bitte!\nGuten Appetit!'
      : 'Guten Morgen!\nWas darf es sein?'
  // The scene owns its reference independently of the selected vocabulary card.
  const sceneReference = stage === 'order' ? ORDER_SENTENCE
    : stage === 'dialogue' ? dialogueComplete ? 'Hier, bitte! Guten Appetit!' : 'Möchten Sie eine Tüte?'
      : stage === 'complete' ? 'Hier, bitte! Guten Appetit!'
        : 'Guten Morgen! Was darf es sein?'
  const sceneAudioFilename = stage === 'order' ? 'order' : stage === 'complete' ? 'thanks' : stage === 'dialogue' ? dialogueComplete ? 'thanks' : 'question' : 'intro'
  const wordAudioFilename = selectedWord?.id === 'roll' ? 'broetchen' : selectedWord?.id === 'coffee' ? 'kaffee' : 'tuete'
  const sceneMotion = stage === 'intro' ? { scale: 1, x: '0%', y: '0%' }
    : stage === 'discover' ? { scale: 1.065, x: '1%', y: '-1.5%' }
      : stage === 'order' ? { scale: 1.045, x: '-1%', y: '0%' }
        : stage === 'dialogue' ? { scale: 1.07, x: '-2%', y: '1%' }
          : { scale: 1, x: '0%', y: '0%' }

  return <MotionProvider><div className={styles.journey} data-stage={stage}>
    <header className={styles.header}>
      <Link href={homeHref} className={styles.brand} aria-label="Sitov Academy – zur Startseite">
        <BrandLogo name="Sitov Academy" descriptor="DEUTSCH LERNEN. WEITERKOMMEN." />
      </Link>
      <nav className={styles.previewNav} aria-label="Vorschau-Navigation">
        <span className={styles.previewLabel}>DESIGN-VORSCHAU</span>
        <Link href={homeHref}>Zur Academy <ArrowUpRight size={16} aria-hidden="true" /></Link>
      </nav>
    </header>

    <div className={styles.heading}>
      <div><p className={styles.eyebrow}>DEINE DEUTSCHREISE&nbsp; / &nbsp;KAPITEL 01</p><h1>Deutsch wird dein Alltag.</h1></div>
      <div className={styles.chapterMeta}><Compass size={18} aria-hidden="true" /><span>A1.1</span><Coffee size={18} aria-hidden="true" /><span className={styles.duration}>3 Min.</span></div>
    </div>

    <div className={styles.chapter}>
      <section className={styles.scene} aria-label="Beim Bäcker in Hannover">
        <motion.div className={styles.sceneArt} initial={false} animate={reduced ? { scale: 1, x: '0%', y: '0%' } : sceneMotion}
          transition={{ duration: reduced ? 0 : 0.8, ease: EASE_OUT_SOFT }}>
          <Image src="/Bilder/deutschreise/bakery-scene.png" alt="Eine freundliche Bäckerin hinter einer Theke mit frischem Gebäck in einer sonnigen Bäckerei." fill preload
            sizes="(max-width: 1000px) calc(100vw - 40px), (max-width: 1439px) 65vw, 868px" className={styles.sceneImage} />
        </motion.div>
        <div className={styles.sceneWash} aria-hidden="true" />
        <AnimatePresence initial={false}>
          {stage === 'intro' && <motion.div key="scene-intro" className={styles.sceneIntro} initial={false} exit={{ opacity: 0, y: reduced ? 0 : -8 }} transition={{ duration: reduced ? 0 : MOTION.slow }}>
            <p className={styles.location}><MapPin size={16} aria-hidden="true" />HANNOVER · 08:30 UHR</p>
            <h2>Guten Morgen,<br />Deutschland.</h2>
            <p className={styles.sceneDescription}>Der Duft von frischen Brötchen.<br />Und du mittendrin.</p>
          </motion.div>}
          {stage !== 'intro' && <motion.div key="scene-live" className={styles.sceneLive} initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: reduced ? 0 : MOTION.slow, delay: reduced ? 0 : MOTION.base }}>
            <p className={styles.location}><MapPin size={16} aria-hidden="true" />HANNOVER · 08:30 UHR</p>
            <p className={styles.sceneStageTitle}>{stage === 'discover' ? <>Ein Morgen.<br />Deine Worte.</> : stage === 'order' ? <>Dein Frühstück.<br />Deine Bestellung.</> : stage === 'dialogue' ? <>Eine Frage.<br />Deine Antwort.</> : <>Frühstück dabei.<br />Und ein guter Anfang.</>}</p>
            <p className={styles.sceneDescription}>{stage === 'complete' ? 'Ein kleiner Moment, den du dir erarbeitet hast.' : 'Nimm dir Zeit. Mia wartet auf dich.'}</p>
          </motion.div>}
        </AnimatePresence>
        <motion.div key={`${stage}-${dialogueComplete}`} className={styles.bakerSpeech} initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduced ? 0 : MOTION.slow, ease: EASE_OUT_SOFT }}>
          <p>MIA · DEINE BÄCKERIN</p><p className={styles.bakerText}>{bakerText}</p>
        </motion.div>
        <div className={styles.sceneControls}>
          <span>01 / BEIM BÄCKER</span>
          <PressableCard className={styles.listenButton} onClick={() => { void speak(sceneReference, sceneAudioFilename) }} aria-label="Deutsche Referenz anhören" aria-busy={speaking}>
            <Volume2 size={18} aria-hidden="true" />{speaking ? 'Du hörst …' : 'Szene anhören'}
          </PressableCard>
        </div>
      </section>

      <section className={`${styles.panel} ${stage === 'intro' ? styles.introPanel : styles.activePanel}`} aria-label="Dein Lernmoment">
        <div className={styles.missionLabel}><Sun size={18} aria-hidden="true" /><span>{stage === 'intro' ? 'DEIN MOMENT HEUTE' : stage === 'complete' ? 'DEIN MOMENT GESCHAFFT' : `STATION 0${stageNumber} VON 03`}</span></div>
        <h2 ref={panelTitle} tabIndex={-1} className={styles.panelTitle}>{stage === 'intro' ? <>Ein kleiner Satz.<br />Ein großer Schritt.</> : STAGE_TITLES[stage]}</h2>

        {stage === 'intro' && <>
          <p className={styles.panelDescription}>Du bestellst dein Frühstück.<br />Ganz auf Deutsch. Schritt für Schritt.</p>
          <ol className={styles.stations}>{STATIONS.map((station, index) => <li key={station.title}>
            <span className={styles.stationNumber}>0{index + 1}</span><div><h3>{station.title}</h3><p>{station.detail}</p></div>
          </li>)}</ol>
          <PressableCard className={styles.primaryButton} onClick={() => nextStage('discover')}>Bäckerei betreten <ArrowRight size={20} aria-hidden="true" /></PressableCard>
          <p className={styles.panelNote}>In deinem Tempo. Ohne Punktedruck.</p>
        </>}

        {stage === 'discover' && <>
          <p className={styles.panelDescription}>Tippe jedes Wort an. Schau auf den Artikel: Er gehört zum Wort dazu.</p>
          <div className={styles.wordCards}>{WORDS.map(word => <PressableCard key={word.id} className={styles.wordCard} onClick={() => discover(word.id)} aria-pressed={activeWord === word.id}>
            <span className={styles.wordIcon}><word.icon size={21} aria-hidden="true" /></span>
            <span><span className={styles.article}>{word.article}</span> <strong>{word.noun}</strong></span>
            {discovered.includes(word.id) && <Check size={18} className={styles.wordCheck} aria-label="Entdeckt" />}
          </PressableCard>)}</div>
          <div className={styles.wordExample} aria-live="polite"><p>{selectedWord ? wordReference : 'Das Brötchen siehst du in der Auslage. Kaffee und Tüte gehören zu unserem Wortschatz für die Bestellung.'}</p>
            {selectedWord && <PressableCard className={styles.textButton} onClick={() => { void speak(wordReference, wordAudioFilename) }}><Volume2 size={17} aria-hidden="true" />Wort anhören</PressableCard>}
          </div>
          <div className={styles.panelBottom}><p className={styles.smallProgress}>{discovered.length} von 3 Wörtern entdeckt</p>
            <PressableCard className={styles.primaryButton} disabled={discovered.length !== WORDS.length} onClick={() => nextStage('order')}>Zur Bestellung <ArrowRight size={20} aria-hidden="true" /></PressableCard></div>
        </>}

        {stage === 'order' && <>
          <p className={styles.panelDescription}>Baue genau diesen Beispielsatz nach. Tippe die Satzteile in der passenden Reihenfolge.</p>
          <p className={styles.targetSentence}>„{ORDER_SENTENCE}“</p>
          <div className={styles.sentenceBox} aria-label="Deine zusammengestellte Bestellung" aria-live="polite">
            <span className={styles.sentenceStart}>Ich möchte</span>
            {chosen.map((piece, index) => <span key={piece} className={styles.chosenPiece}><span className={styles.srOnly}>Satzteil {index + 1}: </span>{PIECES[piece]}</span>)}
            {chosen.length === 0 && <span className={styles.sentencePlaceholder}>…</span>}{chosen.length === PIECES.length && <span>.</span>}
          </div>
          <div className={styles.chipPool} aria-label="Satzteile zur Auswahl">{DISPLAY_PIECES.map(piece => <PressableCard key={piece} className={styles.wordChip} disabled={chosen.includes(piece) || orderFeedback?.correct} onClick={() => choosePiece(piece)}>{PIECES[piece]}</PressableCard>)}</div>
          {!orderFeedback?.correct && <div className={styles.editActions}>
            <PressableCard className={styles.textButton} disabled={chosen.length === 0} onClick={() => { setChosen(previous => previous.slice(0, -1)); setOrderFeedback(null) }}><Undo2 size={17} aria-hidden="true" />Rückgängig</PressableCard>
            <PressableCard className={styles.textButton} disabled={chosen.length === 0} onClick={() => { setChosen([]); setOrderFeedback(null) }}><RotateCcw size={16} aria-hidden="true" />Neu sortieren</PressableCard>
          </div>}
          {orderFeedback && <FeedbackMotion key={`${orderFeedback.correct}-${chosen.join('-')}`} correct={orderFeedback.correct} className={styles.feedback}><p role="status">{orderFeedback.text}</p></FeedbackMotion>}
          <div className={styles.panelBottom}><PressableCard className={styles.primaryButton} disabled={!orderFeedback?.correct && chosen.length !== PIECES.length} onClick={() => orderFeedback?.correct ? nextStage('dialogue') : checkOrder()}>{orderFeedback?.correct ? 'Weiter ins Gespräch' : 'Bestellung prüfen'}<ArrowRight size={20} aria-hidden="true" /></PressableCard></div>
        </>}

        {stage === 'dialogue' && <>
          <p className={styles.panelDescription}>{dialogueComplete ? 'Mia gibt dir deine Bestellung. Mit einem „Danke“ wird aus dem Satz ein Gespräch.' : 'Mia fragt nach. Du möchtest eine Tüte für dein Frühstück. Welche Antwort passt?'}</p>
          <div className={styles.question}><MessageCircle size={20} aria-hidden="true" /><p>{dialogueComplete ? 'Hier, bitte!' : 'Möchten Sie eine Tüte?'}</p></div>
          {!dialogueComplete && <div className={styles.answerOptions}>{['Ja, bitte.', 'Ich heiße Anna.', 'Guten Abend.'].map(answer => <PressableCard key={answer} className={styles.answerButton} onClick={() => answerDialogue(answer)}>{answer}<ArrowRight size={17} aria-hidden="true" /></PressableCard>)}</div>}
          {dialogueFeedback && <FeedbackMotion key={dialogueFeedback.text} correct={dialogueFeedback.correct} className={styles.feedback}><p role="status">{dialogueFeedback.text}</p></FeedbackMotion>}
          {dialogueComplete && <>
            <div className={styles.thanks}><span>DEINE ANTWORT</span><p>Danke!</p></div>
            <div className={styles.panelBottom}><PressableCard ref={dialogueAction} className={styles.primaryButton} onClick={() => nextStage('complete')}>Frühstück mitnehmen <ArrowRight size={20} aria-hidden="true" /></PressableCard></div>
          </>}
          {!dialogueComplete && <p className={styles.panelNote}>Probier es aus. Fehlversuche kosten keine Punkte.</p>}
        </>}

        {stage === 'complete' && <>
          <p className={styles.panelDescription}>Du hast deine erste Bestellung zusammengesetzt und auf eine Rückfrage geantwortet.</p>
          <motion.div className={styles.stamp} initial={reduced ? false : { scale: 1.15, rotate: -14, opacity: 0 }} animate={{ scale: 1, rotate: -8, opacity: 1 }} transition={{ duration: reduced ? 0 : MOTION.slower, ease: EASE_OUT_SOFT }}>
            <Sun size={29} aria-hidden="true" /><span>DEINE DEUTSCHREISE</span><strong>Erste Bestellung</strong><span>HANNOVER · KAPITEL 01</span>
          </motion.div>
          <ul className={styles.results}><li><Check size={18} aria-hidden="true" />Drei Wörter mit Artikel entdeckt</li><li><Check size={18} aria-hidden="true" />Eine höfliche Bestellung gebaut</li><li><Check size={18} aria-hidden="true" />Die Tütenfrage passend beantwortet</li></ul>
          <div className={styles.panelBottom}><PressableCard className={styles.primaryButton} onClick={restart}>Noch einmal erleben <RotateCcw size={19} aria-hidden="true" /></PressableCard><p className={styles.panelNote}>Ein guter Anfang. In deinem Tempo.</p></div>
        </>}
        {audioMessage && <p className={styles.audioNote} role="status">{audioMessage}</p>}
      </section>
    </div>

    <footer className={styles.thread}>
      <div><p>Eine Geschichte. Alles verbunden.</p><p>Wörter werden zu Sätzen. Sätze werden zu echten Gesprächen.</p></div>
      <div className={styles.modeConnection}><BookOpen size={20} aria-hidden="true" /><span>Wörter</span><ArrowRight size={16} aria-hidden="true" /><MessageCircle size={20} aria-hidden="true" /><span>Alltag</span></div>
    </footer>
    <div className={styles.srOnly} role="status" aria-live="polite" aria-atomic="true">{stage === 'intro' ? 'Deutschreise: Beim Bäcker. Deutschsprachige Design-Vorschau.' : stage === 'complete' ? 'Deutschreise abgeschlossen. Erste Bestellung.' : `Station ${stageNumber} von 3. ${STAGE_TITLES[stage]}`}</div>
    <div className={styles.srOnly} role="status" aria-live="polite">{speaking ? 'Hörvorschau wird abgespielt.' : 'Hörvorschau pausiert oder beendet.'}</div>
  </div></MotionProvider>
}
