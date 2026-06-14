import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ucSeal from './assets/UC_Official_Seal.png'
import './App.css'

const STORAGE_KEY = 'formStudioLocalData'
const HISTORY_LIMIT = 50

const choiceTypes = ['multiple', 'checkboxes', 'dropdown']
const directAnswerTypes = ['short', 'paragraph', 'number', 'date', 'rating']

const questionTypes = [
  { value: 'short', label: 'Short answer' },
  { value: 'paragraph', label: 'Paragraph' },
  { value: 'multiple', label: 'Multiple choice' },
  { value: 'checkboxes', label: 'Checkboxes' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'rating', label: 'Rating' },
  { value: 'yesno', label: 'Yes or no' },
]

const roleCopy = {
  creator: 'Full access',
  editor: 'Edit form',
  respondent: 'Answer only',
}

function createId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

function createOption(label = 'Option') {
  return {
    id: createId(),
    label,
  }
}

function defaultOptions(type) {
  if (type === 'yesno') {
    return [createOption('Yes'), createOption('No')]
  }

  if (choiceTypes.includes(type)) {
    return [createOption('Option 1'), createOption('Option 2')]
  }

  return []
}

function createQuestion(type = 'short') {
  return {
    id: createId(),
    type,
    title: 'Untitled question',
    required: false,
    options: defaultOptions(type),
    points: 1,
    correctAnswers: [],
    correctText: '',
    feedbackCorrect: '',
    feedbackWrong: '',
  }
}

function createForm(name = 'Community interview form') {
  const firstQuestion = createQuestion('short')
  firstQuestion.title = 'Respondent name'
  firstQuestion.required = true

  const secondQuestion = createQuestion('multiple')
  secondQuestion.title = 'Which schedule works best?'
  secondQuestion.options = [
    createOption('Morning'),
    createOption('Afternoon'),
    createOption('Evening'),
  ]

  return {
    id: createId(),
    title: name,
    description: 'Use this form for interviews, surveys, or quizzes.',
    mode: 'form',
    showScore: true,
    links: {
      creator: createId(),
      editor: createId(),
      respondent: createId(),
    },
    questions: [firstQuestion, secondQuestion],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

function getStarterData() {
  const starterForm = createForm()

  return {
    forms: [starterForm],
    responses: [],
  }
}

function readStoredData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)

    if (!saved) {
      return getStarterData()
    }

    const parsed = JSON.parse(saved)

    if (!Array.isArray(parsed.forms) || !Array.isArray(parsed.responses)) {
      return getStarterData()
    }

    return parsed
  } catch {
    return getStarterData()
  }
}

function parseAccessFromHash() {
  const parts = window.location.hash.replace('#/', '').split('/')

  if (parts[0] !== 'access' || parts.length < 4) {
    return null
  }

  return {
    formId: parts[1],
    role: parts[2],
    token: parts[3],
  }
}

function buildShareLink(form, role) {
  const base = `${window.location.origin}${window.location.pathname}`
  return `${base}#/access/${form.id}/${role}/${form.links[role]}`
}

function normalizeAnswer(value) {
  return String(value ?? '').trim().toLowerCase()
}

function isChoiceQuestion(question) {
  return choiceTypes.includes(question.type) || question.type === 'yesno'
}

function getAnswerText(question, value) {
  if (Array.isArray(value)) {
    return value
      .map((optionId) => question.options.find((option) => option.id === optionId)?.label)
      .filter(Boolean)
      .join(', ')
  }

  if (isChoiceQuestion(question)) {
    return question.options.find((option) => option.id === value)?.label || ''
  }

  return value || ''
}

function isFilled(question, value) {
  if (question.type === 'checkboxes') {
    return Array.isArray(value) && value.length > 0
  }

  return String(value ?? '').trim().length > 0
}

function isCorrect(question, value) {
  if (!question.points) {
    return false
  }

  if (question.type === 'checkboxes') {
    const chosen = Array.isArray(value) ? [...value].sort() : []
    const correct = [...question.correctAnswers].sort()
    return chosen.length > 0 && JSON.stringify(chosen) === JSON.stringify(correct)
  }

  if (isChoiceQuestion(question)) {
    return question.correctAnswers[0] === value
  }

  if (directAnswerTypes.includes(question.type)) {
    return normalizeAnswer(value) === normalizeAnswer(question.correctText)
  }

  return false
}

function scoreResponse(form, answers) {
  return form.questions.reduce(
    (result, question) => {
      const points = Number(question.points) || 0
      const hasAnswerKey =
        (isChoiceQuestion(question) && question.correctAnswers.length > 0) ||
        (directAnswerTypes.includes(question.type) && question.correctText.trim())

      if (!hasAnswerKey) {
        return result
      }

      const earned = isCorrect(question, answers[question.id]) ? points : 0

      return {
        earned: result.earned + earned,
        possible: result.possible + points,
      }
    },
    { earned: 0, possible: 0 },
  )
}

function App() {
  const [data, setData] = useState(readStoredData)
  const [hashAccess, setHashAccess] = useState(parseAccessFromHash)
  const [activeFormId, setActiveFormId] = useState(() => hashAccess?.formId || data.forms[0]?.id || '')
  const [view, setView] = useState(() => (hashAccess?.role === 'respondent' ? 'respond' : 'builder'))
  const [answerDraft, setAnswerDraft] = useState({})
  const [submitResult, setSubmitResult] = useState(null)
  const [validation, setValidation] = useState({})
  const [copiedRole, setCopiedRole] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState(null)
  const [undoStack, setUndoStack] = useState([])
  const [redoStack, setRedoStack] = useState([])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }, [data])

  useEffect(() => {
    function handleHashChange() {
      const nextAccess = parseAccessFromHash()
      setHashAccess(nextAccess)

      if (nextAccess?.formId) {
        setActiveFormId(nextAccess.formId)
        setView(nextAccess.role === 'respondent' ? 'respond' : 'builder')
      }
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  const activeForm = useMemo(
    () => data.forms.find((form) => form.id === activeFormId) || data.forms[0],
    [activeFormId, data.forms],
  )

  const access = useMemo(() => {
    if (!hashAccess || !activeForm) {
      return { role: 'creator', allowed: true }
    }

    const validRoles = ['creator', 'editor', 'respondent']
    const allowed =
      validRoles.includes(hashAccess.role) &&
      activeForm.id === hashAccess.formId &&
      activeForm.links?.[hashAccess.role] === hashAccess.token

    return {
      role: allowed ? hashAccess.role : 'respondent',
      allowed,
    }
  }, [activeForm, hashAccess])

  const formResponses = useMemo(
    () => data.responses.filter((response) => response.formId === activeForm?.id),
    [activeForm, data.responses],
  )

  const isRespondentOnly = access.role === 'respondent'
  const isEditor = access.role === 'editor'
  const isCreator = access.role === 'creator'
  const canEditForm = isCreator || isEditor
  const canViewResponses = isCreator || isEditor
  const canShareLinks = isCreator
  const canManageForms = isCreator && !hashAccess
  const canSwitchForms = isCreator && !hashAccess
  const activeView = isRespondentOnly
    ? 'respond'
    : !canShareLinks && view === 'links'
      ? canEditForm ? 'builder' : 'respond'
      : view

  function updateData(nextData, options = {}) {
    const { recordHistory = true } = options

    if (recordHistory) {
      setUndoStack((history) => [
        ...history.slice(-(HISTORY_LIMIT - 1)),
        { data, activeFormId },
      ])
      setRedoStack([])
    }

    setData(nextData)
  }

  const restoreHistoryEntry = useCallback((entry) => {
    const nextFormId = entry.data.forms.some((form) => form.id === entry.activeFormId)
      ? entry.activeFormId
      : entry.data.forms[0]?.id || ''

    setData(entry.data)
    setActiveFormId(nextFormId)
    setConfirmDialog(null)
  }, [])

  const undoChange = useCallback(() => {
    const entry = undoStack[undoStack.length - 1]

    if (!entry) {
      return
    }

    setUndoStack((history) => history.slice(0, -1))
    setRedoStack((history) => [
      ...history.slice(-(HISTORY_LIMIT - 1)),
      { data, activeFormId },
    ])
    restoreHistoryEntry(entry)
  }, [activeFormId, data, restoreHistoryEntry, undoStack])

  const redoChange = useCallback(() => {
    const entry = redoStack[redoStack.length - 1]

    if (!entry) {
      return
    }

    setRedoStack((history) => history.slice(0, -1))
    setUndoStack((history) => [
      ...history.slice(-(HISTORY_LIMIT - 1)),
      { data, activeFormId },
    ])
    restoreHistoryEntry(entry)
  }, [activeFormId, data, redoStack, restoreHistoryEntry])

  function updateForm(patch) {
    updateData({
      ...data,
      forms: data.forms.map((form) =>
        form.id === activeForm.id
          ? {
              ...form,
              ...patch,
              updatedAt: new Date().toISOString(),
            }
          : form,
      ),
    })
  }

  function updateQuestions(questions) {
    updateForm({ questions })
  }

  function updateQuestion(questionId, patch) {
    updateQuestions(
      activeForm.questions.map((question) =>
        question.id === questionId
          ? {
              ...question,
              ...patch,
            }
          : question,
      ),
    )
  }

  function handleQuestionType(question, type) {
    updateQuestion(question.id, {
      type,
      options: defaultOptions(type),
      correctAnswers: [],
      correctText: '',
    })
  }

  function addQuestion(type = 'short') {
    updateQuestions([...activeForm.questions, createQuestion(type)])
  }

  function duplicateQuestion(question) {
    const index = activeForm.questions.findIndex((item) => item.id === question.id)
    const copy = {
      ...question,
      id: createId(),
      title: `${question.title} copy`,
      options: question.options.map((option) => ({ ...option, id: createId() })),
      correctAnswers: [],
    }
    const questions = [...activeForm.questions]
    questions.splice(index + 1, 0, copy)
    updateQuestions(questions)
  }

  function deleteQuestion(questionId) {
    if (activeForm.questions.length === 1) {
      return
    }

    updateQuestions(activeForm.questions.filter((question) => question.id !== questionId))
  }

  function requestDeleteQuestion(question) {
    if (activeForm.questions.length === 1) {
      return
    }

    const title = question.title.trim()

    if (!title || title.toLowerCase() === 'untitled question') {
      deleteQuestion(question.id)
      return
    }

    setConfirmDialog({
      type: 'delete-question',
      questionId: question.id,
      title: 'Delete question?',
      message: `"${title}" and its settings will be removed from this form.`,
      confirmLabel: 'Delete question',
      intent: 'danger',
    })
  }

  function moveQuestion(questionId, direction) {
    const index = activeForm.questions.findIndex((question) => question.id === questionId)
    const nextIndex = index + direction

    if (nextIndex < 0 || nextIndex >= activeForm.questions.length) {
      return
    }

    const questions = [...activeForm.questions]
    const [question] = questions.splice(index, 1)
    questions.splice(nextIndex, 0, question)
    updateQuestions(questions)
  }

  function addOption(question) {
    updateQuestion(question.id, {
      options: [...question.options, createOption(`Option ${question.options.length + 1}`)],
    })
  }

  function updateOption(question, optionId, label) {
    updateQuestion(question.id, {
      options: question.options.map((option) =>
        option.id === optionId
          ? {
              ...option,
              label,
            }
          : option,
      ),
    })
  }

  function deleteOption(question, optionId) {
    if (question.options.length <= 2) {
      return
    }

    updateQuestion(question.id, {
      options: question.options.filter((option) => option.id !== optionId),
      correctAnswers: question.correctAnswers.filter((id) => id !== optionId),
    })
  }

  function updateChoiceKey(question, optionId, checked) {
    if (question.type === 'checkboxes') {
      const next = checked
        ? [...question.correctAnswers, optionId]
        : question.correctAnswers.filter((id) => id !== optionId)

      updateQuestion(question.id, { correctAnswers: next })
      return
    }

    updateQuestion(question.id, { correctAnswers: [optionId] })
  }

  function requestNewForm() {
    setConfirmDialog({
      type: 'new-form',
      title: 'Create new form?',
      message: 'Your current form stays saved. A blank form opens in Builder.',
      confirmLabel: 'Create form',
      intent: 'primary',
    })
  }

  function performCreateNewForm() {
    const form = createForm('Untitled form')
    updateData({
      ...data,
      forms: [...data.forms, form],
    })
    setActiveFormId(form.id)
    setView('builder')
    setMenuOpen(false)
  }

  function requestDeleteForm(formId) {
    if (data.forms.length === 1) {
      return
    }

    const form = data.forms.find((item) => item.id === formId)

    setConfirmDialog({
      type: 'delete-form',
      formId,
      title: 'Delete form?',
      message: `${form?.title || 'This form'} and its responses will be removed from this device.`,
      confirmLabel: 'Delete form',
      intent: 'danger',
    })
  }

  function performDeleteForm(formId) {
    const remainingForms = data.forms.filter((form) => form.id !== formId)
    updateData({
      forms: remainingForms,
      responses: data.responses.filter((response) => response.formId !== formId),
    })
    setActiveFormId(remainingForms[0].id)
    setMenuOpen(false)
  }

  function closeConfirmDialog() {
    setConfirmDialog(null)
  }

  function confirmPendingAction() {
    if (!confirmDialog) {
      return
    }

    if (confirmDialog.type === 'new-form') {
      performCreateNewForm()
    }

    if (confirmDialog.type === 'delete-form') {
      performDeleteForm(confirmDialog.formId)
    }

    if (confirmDialog.type === 'delete-question') {
      deleteQuestion(confirmDialog.questionId)
    }

    setConfirmDialog(null)
  }

  function chooseView(nextView) {
    setView(nextView)
    setMenuOpen(false)
  }

  function regenerateLink(role) {
    const token = createId()

    updateForm({
      links: {
        ...activeForm.links,
        [role]: token,
      },
    })

    if (hashAccess?.formId === activeForm.id && hashAccess.role === role) {
      const nextAccess = { ...hashAccess, token }
      setHashAccess(nextAccess)
      window.history.replaceState(null, '', `#/access/${activeForm.id}/${role}/${token}`)
    }
  }

  async function copyLink(role) {
    const link = buildShareLink(activeForm, role)

    try {
      await navigator.clipboard.writeText(link)
      setCopiedRole(role)
      window.setTimeout(() => setCopiedRole(''), 1400)
    } catch {
      setCopiedRole('')
    }
  }

  function setAnswer(questionId, value) {
    setAnswerDraft({
      ...answerDraft,
      [questionId]: value,
    })
    setValidation({
      ...validation,
      [questionId]: '',
    })
  }

  function submitResponse(event) {
    event.preventDefault()

    const errors = {}
    activeForm.questions.forEach((question) => {
      if (question.required && !isFilled(question, answerDraft[question.id])) {
        errors[question.id] = 'Answer required'
      }
    })

    setValidation(errors)

    if (Object.keys(errors).length > 0) {
      return
    }

    const score = activeForm.mode === 'quiz' ? scoreResponse(activeForm, answerDraft) : null
    const response = {
      id: createId(),
      formId: activeForm.id,
      submittedAt: new Date().toISOString(),
      answers: answerDraft,
      score,
    }

    updateData({
      ...data,
      responses: [response, ...data.responses],
    }, { recordHistory: false })

    setSubmitResult(response)
    setAnswerDraft({})
  }

  useEffect(() => {
    if (!canEditForm) {
      return undefined
    }

    function handleHistoryShortcut(event) {
      if (!event.ctrlKey && !event.metaKey) {
        return
      }

      const key = event.key.toLowerCase()

      if (key === 'z') {
        event.preventDefault()

        if (event.shiftKey) {
          redoChange()
          return
        }

        undoChange()
      }

      if (key === 'y') {
        event.preventDefault()
        redoChange()
      }
    }

    window.addEventListener('keydown', handleHistoryShortcut)
    return () => window.removeEventListener('keydown', handleHistoryShortcut)
  }, [canEditForm, redoChange, undoChange])

  if (!activeForm) {
    return <main className="app-shell">No form found</main>
  }

  if (!access.allowed) {
    return (
      <main className="app-shell access-screen">
        <section className="access-panel">
          <p className="eyebrow">Access link</p>
          <h1>Link expired</h1>
          <p className="muted-text">Ask the form owner for a new link.</p>
        </section>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <aside
        className={`sidebar ${menuOpen ? 'menu-open' : ''}`}
        onClick={(event) => {
          if (menuOpen && event.target === event.currentTarget) {
            setMenuOpen(false)
          }
        }}
      >
        <div className="brand-lockup">
          <div className="brand-mark">
            <img src={ucSeal} alt="University of the Cordilleras seal" />
          </div>
          <div>
            <p className="eyebrow">Form ni Jerah 1-A</p>
            <h1>Interview forms</h1>
          </div>
          <button
            type="button"
            className={`menu-toggle ${menuOpen ? 'is-open' : ''}`}
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={menuOpen}
          >
            <span aria-hidden="true"></span>
            <span aria-hidden="true"></span>
            <span aria-hidden="true"></span>
          </button>
        </div>

        {canSwitchForms && (
          <div className="form-switcher">
            <label htmlFor="form-picker">Current form</label>
            <select
              id="form-picker"
              value={activeForm.id}
              onChange={(event) => setActiveFormId(event.target.value)}
            >
              {data.forms.map((form) => (
                <option key={form.id} value={form.id}>
                  {form.title}
                </option>
              ))}
            </select>
          </div>
        )}

        <nav className="nav-list" aria-label="Primary">
          {canEditForm && (
            <button
              type="button"
              className={activeView === 'builder' ? 'active' : ''}
              onClick={() => chooseView('builder')}
            >
              Builder
            </button>
          )}
          <button
            type="button"
            className={activeView === 'respond' ? 'active' : ''}
            onClick={() => chooseView('respond')}
          >
            Respondent view
          </button>
          {canViewResponses && (
            <button
              type="button"
              className={activeView === 'responses' ? 'active' : ''}
              onClick={() => chooseView('responses')}
            >
              Responses
            </button>
          )}
          {canShareLinks && (
            <button
              type="button"
              className={activeView === 'links' ? 'active' : ''}
              onClick={() => chooseView('links')}
            >
              Share links
            </button>
          )}
        </nav>

        {canManageForms && (
          <div className="sidebar-actions">
            <button type="button" className="primary-button" onClick={requestNewForm}>
              New form
            </button>
            {isCreator && data.forms.length > 1 && (
              <button type="button" className="danger-button" onClick={() => requestDeleteForm(activeForm.id)}>
                Delete form
              </button>
            )}
          </div>
        )}
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="topbar-copy">
            <p className="eyebrow">{roleCopy[access.role]}</p>
            <h2>{activeForm.title}</h2>
          </div>
          <div className="topbar-actions">
            {canEditForm && (
              <div className="history-controls" aria-label="Edit history">
                <button
                  type="button"
                  className="history-button"
                  onClick={undoChange}
                  disabled={undoStack.length === 0}
                  aria-label="Undo"
                  title="Undo"
                >
                  <span className="history-icon history-icon-undo" aria-hidden="true"></span>
                </button>
                <button
                  type="button"
                  className="history-button"
                  onClick={redoChange}
                  disabled={redoStack.length === 0}
                  aria-label="Redo"
                  title="Redo"
                >
                  <span className="history-icon history-icon-redo" aria-hidden="true"></span>
                </button>
              </div>
            )}

            <div className="stat-strip">
              <div>
                <span>{activeForm.questions.length}</span>
                Questions
              </div>
              <div>
                <span>{formResponses.length}</span>
                Responses
              </div>
              <div>
                <span>{activeForm.mode === 'quiz' ? 'Quiz' : 'Form'}</span>
                Mode
              </div>
            </div>
          </div>
        </header>

        {activeView === 'builder' && canEditForm && (
          <BuilderView
            activeForm={activeForm}
            isEditor={isEditor}
            updateForm={updateForm}
            updateQuestion={updateQuestion}
            handleQuestionType={handleQuestionType}
            addQuestion={addQuestion}
            duplicateQuestion={duplicateQuestion}
            deleteQuestion={requestDeleteQuestion}
            moveQuestion={moveQuestion}
            addOption={addOption}
            updateOption={updateOption}
            deleteOption={deleteOption}
            updateChoiceKey={updateChoiceKey}
          />
        )}

        {activeView === 'respond' && (
          <RespondentView
            activeForm={activeForm}
            answerDraft={answerDraft}
            validation={validation}
            submitResult={submitResult}
            setAnswer={setAnswer}
            submitResponse={submitResponse}
            resetResult={() => setSubmitResult(null)}
          />
        )}

        {activeView === 'responses' && canViewResponses && (
          <ResponsesView
            activeForm={activeForm}
            responses={formResponses}
          />
        )}

        {activeView === 'links' && canShareLinks && (
          <LinksView
            activeForm={activeForm}
            copiedRole={copiedRole}
            copyLink={copyLink}
            regenerateLink={regenerateLink}
          />
        )}
      </section>

      {confirmDialog && (
        <ConfirmDialog
          dialog={confirmDialog}
          onCancel={closeConfirmDialog}
          onConfirm={confirmPendingAction}
        />
      )}
    </main>
  )
}

function ConfirmDialog({ dialog, onCancel, onConfirm }) {
  return (
    <div className="modal-backdrop confirm-backdrop" role="presentation" onClick={onCancel}>
      <section
        className="confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="eyebrow">Confirm action</p>
        <h2 id="confirm-title">{dialog.title}</h2>
        <p className="muted-text">{dialog.message}</p>
        <div className="confirm-actions">
          <button type="button" className="text-button" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className={dialog.intent === 'danger' ? 'danger-button' : 'primary-button'}
            onClick={onConfirm}
          >
            {dialog.confirmLabel}
          </button>
        </div>
      </section>
    </div>
  )
}

function BuilderView({
  activeForm,
  isEditor,
  updateForm,
  updateQuestion,
  handleQuestionType,
  addQuestion,
  duplicateQuestion,
  deleteQuestion,
  moveQuestion,
  addOption,
  updateOption,
  deleteOption,
  updateChoiceKey,
}) {
  const [pickerOpen, setPickerOpen] = useState(false)

  function handleAddQuestion(type) {
    addQuestion(type)
    setPickerOpen(false)
  }

  return (
    <div className="builder-layout">
      <section className="builder-main">
        {!isEditor && (
          <div className="form-settings">
            <label>
              Form title
              <input
                value={activeForm.title}
                onChange={(event) => updateForm({ title: event.target.value })}
              />
            </label>

            <label>
              Description
              <textarea
                value={activeForm.description}
                onChange={(event) => updateForm({ description: event.target.value })}
                rows="3"
              />
            </label>

            <div className="settings-grid">
              <label>
                Mode
                <select
                  value={activeForm.mode}
                  onChange={(event) => updateForm({ mode: event.target.value })}
                >
                  <option value="form">Form</option>
                  <option value="quiz">Quiz</option>
                </select>
              </label>

              <label className="toggle-line">
                <input
                  type="checkbox"
                  checked={activeForm.showScore}
                  onChange={(event) => updateForm({ showScore: event.target.checked })}
                  disabled={activeForm.mode !== 'quiz'}
                />
                Show score after submit
              </label>
            </div>
          </div>
        )}

        <div className="question-stack">
          {activeForm.questions.map((question, index) => (
            <QuestionEditor
              key={question.id}
              question={question}
              index={index}
              formMode={activeForm.mode}
              questionCount={activeForm.questions.length}
              updateQuestion={updateQuestion}
              handleQuestionType={handleQuestionType}
              duplicateQuestion={duplicateQuestion}
              deleteQuestion={deleteQuestion}
              moveQuestion={moveQuestion}
              addOption={addOption}
              updateOption={updateOption}
              deleteOption={deleteOption}
              updateChoiceKey={updateChoiceKey}
            />
          ))}
        </div>

        <button
          type="button"
          className="add-question-card"
          onClick={() => setPickerOpen(true)}
          aria-label="Add question"
        >
          <span>+</span>
        </button>

        <button
          type="button"
          className="floating-add-question"
          onClick={() => setPickerOpen(true)}
          aria-label="Add question"
          title="Add question"
        >
          <span aria-hidden="true"></span>
        </button>
      </section>

      <aside className="builder-tools">
        <p className="eyebrow">Add question</p>
        <div className="tool-grid">
          {questionTypes.map((type) => (
            <button key={type.value} type="button" onClick={() => addQuestion(type.value)}>
              {type.label}
            </button>
          ))}
        </div>

        {isEditor && (
          <p className="small-text">
            Editor access updates form content. Creator-only settings stay hidden.
          </p>
        )}
      </aside>

      {pickerOpen && (
        <QuestionPicker onClose={() => setPickerOpen(false)} onSelect={handleAddQuestion} />
      )}
    </div>
  )
}

function QuestionPicker({ onClose, onSelect }) {
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="question-picker"
        role="dialog"
        aria-modal="true"
        aria-labelledby="question-picker-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="question-picker-head">
          <div>
            <p className="eyebrow">Add question</p>
            <h2 id="question-picker-title">Choose a type</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            x
          </button>
        </div>

        <div className="picker-grid">
          {questionTypes.map((type) => (
            <button key={type.value} type="button" onClick={() => onSelect(type.value)}>
              {type.label}
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}

function QuestionEditor({
  question,
  index,
  formMode,
  questionCount,
  updateQuestion,
  handleQuestionType,
  duplicateQuestion,
  deleteQuestion,
  moveQuestion,
  addOption,
  updateOption,
  deleteOption,
  updateChoiceKey,
}) {
  const showOptions = isChoiceQuestion(question)
  const showDirectAnswer = formMode === 'quiz' && directAnswerTypes.includes(question.type)
  const showChoiceKey = formMode === 'quiz' && showOptions

  return (
    <article className="question-card">
      <div className="question-toolbar">
        <span>Question {index + 1}</span>
        <div className="toolbar-actions">
          <button
            type="button"
            className="toolbar-button"
            onClick={() => moveQuestion(question.id, -1)}
            disabled={index === 0}
            aria-label="Move question up"
            title="Move question up"
          >
            <span className="tool-icon tool-icon-up" aria-hidden="true"></span>
            <span className="tool-label">Up</span>
          </button>
          <button
            type="button"
            className="toolbar-button"
            onClick={() => moveQuestion(question.id, 1)}
            disabled={index === questionCount - 1}
            aria-label="Move question down"
            title="Move question down"
          >
            <span className="tool-icon tool-icon-down" aria-hidden="true"></span>
            <span className="tool-label">Down</span>
          </button>
          <button
            type="button"
            className="toolbar-button"
            onClick={() => duplicateQuestion(question)}
            aria-label="Copy question"
            title="Copy question"
          >
            <span className="tool-icon tool-icon-copy" aria-hidden="true"></span>
            <span className="tool-label">Copy</span>
          </button>
          <button
            type="button"
            className="toolbar-button danger-control"
            onClick={() => deleteQuestion(question)}
            disabled={questionCount === 1}
            aria-label="Delete question"
            title="Delete question"
          >
            <span className="tool-icon tool-icon-delete" aria-hidden="true"></span>
            <span className="tool-label">Delete</span>
          </button>
        </div>
      </div>

      <div className="question-grid">
        <label>
          Question
          <AutoResizeTextarea
            value={question.title}
            onChange={(event) => updateQuestion(question.id, { title: event.target.value })}
          />
        </label>

        <label>
          Type
          <select
            value={question.type}
            onChange={(event) => handleQuestionType(question, event.target.value)}
          >
            {questionTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="question-switches">
        <label className="toggle-line">
          <input
            type="checkbox"
            checked={question.required}
            onChange={(event) => updateQuestion(question.id, { required: event.target.checked })}
          />
          Required
        </label>

        {formMode === 'quiz' && (
          <label className="points-input">
            Points
            <input
              type="number"
              min="0"
              value={question.points}
              onChange={(event) => updateQuestion(question.id, { points: Number(event.target.value) })}
            />
          </label>
        )}
      </div>

      {showOptions && (
        <div className="option-list">
          {question.options.map((option) => (
            <div className="option-row" key={option.id}>
              {showChoiceKey && (
                <input
                  type={question.type === 'checkboxes' ? 'checkbox' : 'radio'}
                  name={`correct-${question.id}`}
                  checked={question.correctAnswers.includes(option.id)}
                  onChange={(event) => updateChoiceKey(question, option.id, event.target.checked)}
                  aria-label="Correct answer"
                />
              )}
              <input
                value={option.label}
                onChange={(event) => updateOption(question, option.id, event.target.value)}
                disabled={question.type === 'yesno'}
              />
              {question.type !== 'yesno' && (
                <button type="button" onClick={() => deleteOption(question, option.id)}>
                  Remove
                </button>
              )}
            </div>
          ))}

          {question.type !== 'yesno' && (
            <button type="button" className="text-button" onClick={() => addOption(question)}>
              Add option
            </button>
          )}
        </div>
      )}

      {showDirectAnswer && (
        <label>
          Correct answer
          <input
            value={question.correctText}
            onChange={(event) => updateQuestion(question.id, { correctText: event.target.value })}
            placeholder={question.type === 'rating' ? 'Enter 1 to 5' : 'Answer key'}
          />
        </label>
      )}

      {formMode === 'quiz' && (
        <div className="feedback-grid">
          <label>
            Correct feedback
            <textarea
              value={question.feedbackCorrect}
              onChange={(event) => updateQuestion(question.id, { feedbackCorrect: event.target.value })}
              rows="2"
            />
          </label>
          <label>
            Wrong feedback
            <textarea
              value={question.feedbackWrong}
              onChange={(event) => updateQuestion(question.id, { feedbackWrong: event.target.value })}
              rows="2"
            />
          </label>
        </div>
      )}
    </article>
  )
}

function AutoResizeTextarea({ value, onChange }) {
  const textareaRef = useRef(null)

  useEffect(() => {
    const textarea = textareaRef.current

    if (!textarea) {
      return
    }

    textarea.style.height = 'auto'
    const borderHeight = textarea.offsetHeight - textarea.clientHeight
    textarea.style.height = `${textarea.scrollHeight + borderHeight}px`
  }, [value])

  return (
    <textarea
      ref={textareaRef}
      className="question-title-input"
      rows="1"
      value={value}
      onChange={onChange}
    />
  )
}

function RespondentView({
  activeForm,
  answerDraft,
  validation,
  submitResult,
  setAnswer,
  submitResponse,
  resetResult,
}) {
  const answeredCount = activeForm.questions.filter((question) => isFilled(question, answerDraft[question.id])).length
  const progress = Math.round((answeredCount / activeForm.questions.length) * 100)

  if (submitResult) {
    return (
      <section className="respondent-wrap">
        <div className="result-panel">
          <p className="eyebrow">Submitted</p>
          <h2>Response saved</h2>
          {activeForm.mode === 'quiz' && activeForm.showScore && submitResult.score && (
            <p className="score-line">
              Score: {submitResult.score.earned} of {submitResult.score.possible}
            </p>
          )}

          {activeForm.mode === 'quiz' && activeForm.showScore && (
            <div className="feedback-list">
              {activeForm.questions.map((question) => {
                const correct = isCorrect(question, submitResult.answers[question.id])
                const feedback = correct ? question.feedbackCorrect : question.feedbackWrong

                if (!feedback) {
                  return null
                }

                return (
                  <div key={question.id} className={correct ? 'feedback good' : 'feedback bad'}>
                    <strong>{question.title}</strong>
                    <span>{feedback}</span>
                  </div>
                )
              })}
            </div>
          )}

          <button type="button" className="primary-button" onClick={resetResult}>
            Submit another response
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="respondent-wrap">
      <form className="respondent-form" onSubmit={submitResponse}>
        <div className="form-intro">
          <p className="eyebrow">{activeForm.mode === 'quiz' ? 'Quiz form' : 'Interview form'}</p>
          <h2>{activeForm.title}</h2>
          <p>{activeForm.description}</p>
          <div className="progress-track" aria-label={`${progress}% complete`}>
            <span style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="answer-stack">
          {activeForm.questions.map((question, index) => (
            <AnswerQuestion
              key={question.id}
              question={question}
              index={index}
              value={answerDraft[question.id]}
              error={validation[question.id]}
              onChange={(value) => setAnswer(question.id, value)}
            />
          ))}
        </div>

        <button type="submit" className="submit-button">
          Submit response
        </button>
      </form>
    </section>
  )
}

function AnswerQuestion({ question, index, value, error, onChange }) {
  return (
    <article className={`answer-card ${error ? 'has-error' : ''}`}>
      <label className="answer-label">
        <span>
          {index + 1}. {question.title}
          {question.required && (
            <b className="required-mark" aria-label="Required question">
              *
            </b>
          )}
        </span>
      </label>

      {question.type === 'short' && (
        <input value={value || ''} onChange={(event) => onChange(event.target.value)} />
      )}

      {question.type === 'paragraph' && (
        <textarea value={value || ''} onChange={(event) => onChange(event.target.value)} rows="4" />
      )}

      {question.type === 'number' && (
        <input type="number" value={value || ''} onChange={(event) => onChange(event.target.value)} />
      )}

      {question.type === 'date' && (
        <input type="date" value={value || ''} onChange={(event) => onChange(event.target.value)} />
      )}

      {question.type === 'rating' && (
        <div className="rating-row">
          {[1, 2, 3, 4, 5].map((rating) => (
            <button
              key={rating}
              type="button"
              className={String(value) === String(rating) ? 'selected' : ''}
              onClick={() => onChange(String(rating))}
            >
              {rating}
            </button>
          ))}
        </div>
      )}

      {question.type === 'multiple' &&
        question.options.map((option) => (
          <label className="choice-row" key={option.id}>
            <input
              type="radio"
              name={question.id}
              checked={value === option.id}
              onChange={() => onChange(option.id)}
            />
            {option.label}
          </label>
        ))}

      {question.type === 'yesno' &&
        question.options.map((option) => (
          <label className="choice-row" key={option.id}>
            <input
              type="radio"
              name={question.id}
              checked={value === option.id}
              onChange={() => onChange(option.id)}
            />
            {option.label}
          </label>
        ))}

      {question.type === 'checkboxes' &&
        question.options.map((option) => {
          const current = Array.isArray(value) ? value : []

          return (
            <label className="choice-row" key={option.id}>
              <input
                type="checkbox"
                checked={current.includes(option.id)}
                onChange={(event) => {
                  if (event.target.checked) {
                    onChange([...current, option.id])
                    return
                  }

                  onChange(current.filter((id) => id !== option.id))
                }}
              />
              {option.label}
            </label>
          )
        })}

      {question.type === 'dropdown' && (
        <select value={value || ''} onChange={(event) => onChange(event.target.value)}>
          <option value="">Select answer</option>
          {question.options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      )}

      {error && <p className="error-text">{error}</p>}
    </article>
  )
}

function ResponsesView({ activeForm, responses }) {
  const [openResponses, setOpenResponses] = useState({})
  const [searchDraft, setSearchDraft] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const firstQuestion = activeForm.questions[0]
  const filteredResponses = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    if (!query) {
      return responses
    }

    return responses.filter((response) => {
      const submitted = new Date(response.submittedAt).toLocaleString()
      const score = response.score ? `${response.score.earned}/${response.score.possible}` : ''
      const answerText = activeForm.questions
        .map((question) => `${question.title} ${getAnswerText(question, response.answers[question.id])}`)
        .join(' ')

      return `${submitted} ${score} ${answerText}`.toLowerCase().includes(query)
    })
  }, [activeForm.questions, responses, searchQuery])

  function toggleResponse(responseId) {
    setOpenResponses((current) => ({
      ...current,
      [responseId]: !current[responseId],
    }))
  }

  function submitSearch(event) {
    event.preventDefault()
    setSearchQuery(searchDraft)
    event.currentTarget.querySelector('input')?.blur()
  }

  function clearSearch() {
    setSearchDraft('')
    setSearchQuery('')
    document.activeElement?.blur()
  }

  return (
    <section className="responses-view">
      <div className="section-head">
        <div>
          <p className="eyebrow">Saved locally</p>
          <h2>{filteredResponses.length} of {responses.length} responses</h2>
        </div>
        <form className="response-search" onSubmit={submitSearch}>
          <div className="search-field">
            <input
              type="search"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="Search names or answers"
              aria-label="Search responses"
            />
            <button
              type="button"
              className={`search-clear-button ${searchDraft ? '' : 'is-hidden'}`}
              onClick={clearSearch}
              disabled={!searchDraft}
              aria-label="Clear search"
            >
              <span aria-hidden="true"></span>
            </button>
          </div>
          <button type="submit" className="primary-button">
            Search
          </button>
        </form>
      </div>

      <div className="response-list">
        {responses.length === 0 && (
          <div className="empty-state">
            <h3>No responses yet</h3>
            <p>Use respondent view to test submissions.</p>
          </div>
        )}

        {responses.length > 0 && filteredResponses.length === 0 && (
          <div className="empty-state">
            <h3>No matching responses</h3>
            <p>Try another name, answer, date, or score.</p>
          </div>
        )}

        {filteredResponses.map((response) => {
          const isOpen = Boolean(openResponses[response.id])
          const firstAnswer = firstQuestion
            ? getAnswerText(firstQuestion, response.answers[firstQuestion.id]) || 'No answer'
            : 'No question'

          return (
            <article className="response-card" key={response.id}>
              <div className="response-summary">
                <div className="response-primary">
                  <span>{firstQuestion?.title || 'First question'}</span>
                  <strong>{firstAnswer}</strong>
                </div>

                <div className="response-time">
                  <span>Submitted</span>
                  <strong>{new Date(response.submittedAt).toLocaleString()}</strong>
                </div>

                <button
                  type="button"
                  className="response-toggle"
                  onClick={() => toggleResponse(response.id)}
                  aria-expanded={isOpen}
                >
                  {isOpen ? 'Hide answers' : 'View answers'}
                </button>
              </div>

              {isOpen && (
                <div className="response-answers">
                  {response.score && (
                    <div className="response-score">
                      <span>Score</span>
                      <strong>{response.score.earned}/{response.score.possible}</strong>
                    </div>
                  )}

                  {activeForm.questions.map((question) => (
                    <div key={question.id}>
                      <span>{question.title}</span>
                      <strong>{getAnswerText(question, response.answers[question.id]) || 'No answer'}</strong>
                    </div>
                  ))}
                </div>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}

function LinksView({ activeForm, copiedRole, copyLink, regenerateLink }) {
  return (
    <section className="links-view">
      <div className="section-head">
        <div>
          <p className="eyebrow">Share access</p>
          <h2>Generated links</h2>
        </div>
      </div>

      <div className="link-grid">
        {['creator', 'editor', 'respondent'].map((role) => (
          <article className="link-card" key={role}>
            <div>
              <p className="eyebrow">{roleCopy[role]}</p>
              <h3>{role[0].toUpperCase() + role.slice(1)} link</h3>
            </div>
            <input value={buildShareLink(activeForm, role)} readOnly />
            <div className="link-actions">
              <button type="button" className="primary-button" onClick={() => copyLink(role)}>
                {copiedRole === role ? 'Copied' : 'Copy link'}
              </button>
              <button type="button" onClick={() => regenerateLink(role)}>
                Regenerate
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

export default App
