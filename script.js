/* AI Resume Analyzer — Pure JavaScript (client-side)
   Features:
     - Multi-step animated UI
     - PDF and TXT parsing
     - ATS scoring heuristics
     - Role detection
     - Issues detection and improvement strategies
     - Enhanced resume generator & editable output
     - Download TXT / DOC / PDF (client-side)
*/

const state = {
  rawText: '',
  cleanedText: '',
  analysis: null,
  enhanced: ''
}

// --- UI Elements
const step1 = document.getElementById('step1')
const step2 = document.getElementById('step2')
const step3 = document.getElementById('step3')
const fileInput = document.getElementById('fileInput')
const uploadBox = document.getElementById('uploadBox')
const goAnalyze = document.getElementById('goAnalyze')
const skipToStep2 = document.getElementById('skipToStep2')
const backToStep1 = document.getElementById('backToStep1')
const prevStep2 = document.getElementById('prevStep2')
const toStep3 = document.getElementById('toStep3')
const backToStep2 = document.getElementById('backToStep2')
const enhancedEditor = document.getElementById('enhancedEditor')
const preview = document.getElementById('preview')
const atsScore = document.getElementById('atsScore')
const descriptionEl = document.getElementById('description')
const rolesEl = document.getElementById('roles')
const issuesEl = document.getElementById('issues')
const strategiesEl = document.getElementById('strategies')
const toggleScrollDesc = document.getElementById('toggleScrollDesc')
const toggleFullDesc = document.getElementById('toggleFullDesc')
const downloadBtn = document.getElementById('downloadBtn')
const fileFormat = document.getElementById('fileFormat')
const startOverBtn = document.getElementById('startOverBtn')
const finalizeBtn = document.getElementById('finalizeBtn')
const demoTemplate = document.getElementById('demoTextTemplate')
// API settings UI elements (REMOVED from UI; when present kept for backward compatibility)
let apiBase = null
let apiKeyInput = null
let saveApiKeyBtn = null
let clearApiKeyBtn = null
let apiStatus = null
let rememberKeyCheckbox = null
let useApiToggle = null

// runtime values
let apiKey = ''
let apiBaseUrl = ''
let useApi = false
// helper to safely show API status (may be absent if UI removed)
function setApiStatus(msg) { try { if (typeof apiStatus !== 'undefined' && apiStatus) { apiStatus.innerText = msg } else { console.log('API Status:', msg) } } catch (e) { } }
// Gemini credentials (optional): set your Gemini API key here for direct use
// Security warning: Storing API keys in client-side JS is insecure. Only do this for testing.
const GEMINI_API_KEY = 'AIzaSyC21CW4VAcbBOUjo9EyjNo0JyYEUj8Tpeg' // <- replace with your Gemini API Key
const GEMINI_MODEL = 'models/gemini-1.5-flash' // change to your target model name (e.g., 'models/gemini-1.0')

// Setup PDF.js worker (CDN script should be loaded)
if (window.pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js'
}

// initialize API settings from localstorage if available
// loadApiSettings was removed as keys are embedded in the code. For security, prefer a server-side proxied API.
// loadApiSettings() removed; the IDE expects direct key embedding in `GEMINI_API_KEY`.
// If GEMINI_API_KEY is set in code, prefer that and hide API settings UI
if (typeof GEMINI_API_KEY !== 'undefined' && GEMINI_API_KEY && GEMINI_API_KEY.length > 8 && GEMINI_API_KEY !== 'type your key here') {
  useApi = true
  try { setApiStatus('Gemini key loaded from code (embedded)') } catch (e) { }
  try { document.getElementById('apiSettings')?.remove() } catch (e) { }
}
// Validate the embedded key at startup (if present)
if (typeof GEMINI_API_KEY !== 'undefined' && GEMINI_API_KEY && GEMINI_API_KEY !== 'type your key here') {
  validateGeminiKey().then(valid => {
    if (!valid) { setApiStatus('Embedded Gemini key invalid — check GEMINI_API_KEY in script.js') }
  })
}

// call API endpoint helper
async function callAPI(path, payload = {}) {
  // If GEMINI_API_KEY is provided in code, prefer direct Gemini calls
  if (typeof GEMINI_API_KEY !== 'undefined' && GEMINI_API_KEY && GEMINI_API_KEY.length > 8 && GEMINI_API_KEY !== 'type your key here') {
    // Use Gemini prompts for '/analyze' and '/enhance'
    if (path === '/analyze') {
      return await callGeminiAnalyze(payload.text || '')
    }
    if (path === '/enhance') {
      return await callGeminiEnhance(payload.text || '', payload.analysis || {})
    }
    // For custom paths, we may fall back to a general Gemini prompt wrapper
    return { result: await callGeminiModel(JSON.stringify(payload)) }
  }
  const base = (apiBaseUrl || '').trim()
  if (!base) throw new Error('No API base URL configured')
  const url = base.replace(/\/$/, '') + (path.startsWith('/') ? path : '/' + path)
  const headers = { 'Content-Type': 'application/json' }
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`
  const resp = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload) })
  const json = await resp.json()
  if (!resp.ok) throw new Error(json?.error || resp.statusText || 'API request failed')
  return json
}

// --- Gemini helper functions
async function callGeminiModel(promptText, opts = {}) {
  const model = GEMINI_MODEL || 'gemini-1.5-flash'
  const key = GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY not configured')
  // Use the latest v1 stable API
  const url = `https://generativelanguage.googleapis.com/v1/${model}:generateContent?key=${encodeURIComponent(key)}`
  const body = {
    contents: [{
      parts: [{ text: promptText }]
    }],
    generationConfig: {
      temperature: opts.temperature || 0.2,
      maxOutputTokens: opts.maxOutputTokens || 800
    }
  }
  const headers = { 'Content-Type': 'application/json' }
  const resp = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
  if (!resp.ok) {
    const errorData = await resp.json().catch(() => ({}))
    throw new Error(`Gemini API error: ${resp.status} - ${errorData.error?.message || resp.statusText}`)
  }
  const data = await resp.json()
  // parse content from Gemini v1 API response
  const content = data?.candidates?.[0]?.content?.parts?.[0]?.text || JSON.stringify(data)
  return content
}

// simple test function to validate Gemini key and endpoint
async function validateGeminiKey() {
  if (!(typeof GEMINI_API_KEY !== 'undefined' && GEMINI_API_KEY && GEMINI_API_KEY !== 'type your key here')) {
    setApiStatus('No embedded Gemini key configured')
    return false
  }
  try {
    setApiStatus('Validating Gemini key...')
    const test = await callGeminiModel('Hello from ResumeX — please reply with: OK')
    const ok = (test && test.toLowerCase && test.toLowerCase().includes('ok'))
    if (ok) { setApiStatus('Gemini key validated — OK'); return true }
    setApiStatus('Gemini responded but content not recognized (non-OK)')
    console.log('Gemini Response for validation:', test)
    return true
  } catch (e) {
    setApiStatus('Gemini validation failed: ' + (e?.message || e))
    console.error(e)
    return false
  }
}

function parseJSONFromText(txt) {
  if (!txt) return null
  // try to extract JSON block
  const m = txt.match(/\{[\s\S]*\}/)
  if (m) {
    try { return JSON.parse(m[0]) } catch (e) { try { return JSON.parse(txt) } catch (e2) { return null } }
  }
  return null
}

async function callGeminiAnalyze(rawText) {
  const prompt = `You are a resume analyzer. Given the resume text delimited by triple backticks, analyze the resume and return ONLY a JSON object with the following schema: {"analysis": {"description": "one paragraph description/profile", "summary":"concise summary", "roles": [...], "skills": [...], "issues": [...], "strategies": [...], "atsScore": number}}. If fields are missing provide empty arrays or reasonable defaults. Respond with JSON only. Resume:\n\n\`\`\`\n${rawText}\n\`\`\``
  const res = await callGeminiModel(prompt, { temperature: 0.0, maxOutputTokens: 800 })
  // parse JSON
  const parsed = parseJSONFromText(res)
  if (parsed && parsed.analysis) return parsed.analysis
  // fallback: return a basic analysis with only description set
  return { description: res.slice(0, 600), summary: res.slice(0, 240), roles: [], skills: [], issues: [], strategies: [], atsScore: 50 }
}

async function callGeminiEnhance(rawText, analysis) {
  const roles = (analysis && analysis.roles && analysis.roles.join(', ')) || ''
  const prompt = `Rewrite and enhance the resume text in triple backticks to make it ATS-friendly, professional, and optimized for roles: ${roles}. Return the enhanced resume in plain text only (no JSON or commentary).:\n\n\`\`\`\n${rawText}\n\`\`\``
  const res = await callGeminiModel(prompt, { temperature: 0.0, maxOutputTokens: 1200 })
  return { enhanced: res }
}

// API UI handlers removed; the application uses embedded GEMINI_API_KEY or optional `apiBaseUrl` instead.

function switchStep(n) {
  const cur = document.querySelector('.step.active')
  const next = document.querySelector(`#step${n}`)
  if (cur === next) return
  const ANIM_OUT = 'animate-out'
  const ANIM_IN = 'animate-in'
  // If there's a current active step, animate it out first
  if (cur) {
    cur.classList.remove('animate-in')
    cur.classList.add(ANIM_OUT)
    // animate the card content out as well
    const curCard = cur.querySelector('.card')
    if (curCard) { curCard.classList.add('animate-out'); curCard.classList.remove('animate-in') }
    cur.addEventListener('animationend', function outHandler(e) {
      cur.classList.remove('active', ANIM_OUT)
      if (curCard) { curCard.classList.remove('animate-out') }
      cur.removeEventListener('animationend', outHandler)
      // Wait a tick then bring in next
      next.classList.add('active')
      next.classList.remove(ANIM_OUT)
      // animate the incoming step and card
      setTimeout(() => {
        next.classList.add(ANIM_IN)
        const nextCard = next.querySelector('.card')
        if (nextCard) { nextCard.classList.add('animate-in'); setTimeout(() => nextCard.classList.remove('animate-in'), 700) }
        expandCardForStep(n)
        // remove animate-in after it completes to keep DOM clean
        next.addEventListener('animationend', function inHandler(e2) { if (e2.animationName === 'stepIn') next.classList.remove(ANIM_IN); next.removeEventListener('animationend', inHandler) })
      }, 10)
    })
  } else {
    // no current, just activate next
    next.classList.add('active')
    setTimeout(() => { next.classList.add('animate-in'); const nextCard = next.querySelector('.card'); if (nextCard) { nextCard.classList.add('animate-in'); setTimeout(() => nextCard.classList.remove('animate-in'), 700) } }, 10)
    expandCardForStep(n)
    // also cleanup animate-in
    next.addEventListener('animationend', function inHandler(e) { if (e.animationName === 'stepIn') { next.classList.remove('animate-in'); next.removeEventListener('animationend', inHandler) } })
  }
  expandCardForStep(n)
}
// Also ensure expanded class on the active step's card for a clearer visual
function expandCardForStep(n) {
  document.querySelectorAll('.card').forEach(c => c.classList.remove('expanded'))
  // only expand for step 2 or 3
  if (n === 2 || n === 3) {
    const c = document.querySelector(`#step${n} .card`)
    if (c) c.classList.add('expanded')
  }
}

// NOTE: expandCardForStep defined above (restricted to Step 2/3); second duplicate removed

// Drag & drop / file selection
uploadBox.addEventListener('click', () => fileInput.click())
fileInput.addEventListener('change', async (ev) => {
  const file = ev.target.files[0]
  if (!file) return
  await loadFile(file)
})

uploadBox.addEventListener('dragover', (ev) => { ev.preventDefault(); uploadBox.classList.add('drag') })
uploadBox.addEventListener('dragleave', (ev) => { uploadBox.classList.remove('drag') })
uploadBox.addEventListener('drop', async (ev) => {
  ev.preventDefault(); uploadBox.classList.remove('drag')
  const file = ev.dataTransfer.files[0]
  if (!file) return
  await loadFile(file)
})

// Demo Resume
skipToStep2.addEventListener('click', async () => {
  const txt = demoTemplate.innerText.trim()
  state.rawText = txt
  completeLoad()
  await analyzeAndRender()
  switchStep(2)
})

// Back navigation
backToStep1.addEventListener('click', () => switchStep(1))
prevStep2.addEventListener('click', () => switchStep(1))
backToStep2.addEventListener('click', () => switchStep(2))

// Controls
goAnalyze.addEventListener('click', async () => {
  // perform analysis, then display step 2
  try {
    console.log('goAnalyze clicked: starting analysis')
    await analyzeAndRender()
    switchStep(2)
  } catch (err) {
    console.error('Analyze failed:', err)
    alert('Analysis failed: ' + (err?.message || err))
    setApiStatus('Analysis error: ' + (err?.message || err))
  }
})

toStep3.addEventListener('click', async () => {
  try {
    console.log('toStep3 clicked: generating enhanced resume')
    await generateEnhanced()
    switchStep(3)
  } catch (err) {
    console.error('Generate Enhanced failed:', err)
    alert('Enhance generation failed: ' + (err?.message || err))
    setApiStatus('Enhance generation error: ' + (err?.message || err))
  }
})

startOverBtn.addEventListener('click', () => {
  // reset
  state.rawText = ''
  state.analysis = null
  state.enhanced = ''
  atsScore.textContent = '--'
  descriptionEl.innerHTML = 'Upload a file to see description.'
  rolesEl.textContent = '—'
  issuesEl.textContent = '—'
  strategiesEl.textContent = '—'
  enhancedEditor.textContent = ''
  preview.textContent = ''
  switchStep(1)
})

finalizeBtn.addEventListener('click', () => downloadEnhanced())
downloadBtn.addEventListener('click', () => downloadEnhanced())

// Live update preview from editor
enhancedEditor.addEventListener('input', () => {
  preview.innerHTML = formatPreview(enhancedEditor.innerText)
})

// Load file using FileReader; supports PDF via pdf.js and text files
async function loadFile(file) {
  console.log('📄 loadFile called with:', file.name, 'type:', file.type, 'size:', file.size, 'bytes')
  // Show loading state
  uploadBox.innerHTML = '⏳ Loading file...'
  uploadBox.style.borderColor = 'rgba(123, 97, 255, 0.4)'

  const type = file.type
  const filename = file.name

  if (type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    // parse via pdfjs
    try {
      console.log('📖 Starting PDF parsing...')
      const arrayBuf = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: arrayBuf }).promise
      const maxPages = pdf.numPages
      console.log('📄 PDF has', maxPages, 'pages')
      let text = ''
      for (let i = 1; i <= maxPages; i++) {
        const page = await pdf.getPage(i)
        const tokenized = await page.getTextContent()
        const pageStr = tokenized.items.map(it => it.str).join(' ')
        text += pageStr + '\n\n'
      }
      state.rawText = text
      console.log('✓ PDF parsed, rawText length:', text.length)
      completeLoad(filename)
      if (state.rawText.length < 50) {
        uploadBox.innerHTML = '⚠️ PDF appears to be scanned/image-based<br><small>Text extraction failed. Use a text-based PDF or TXT file.</small>'
        uploadBox.style.borderColor = 'rgba(255, 193, 7, 0.4)'
        goAnalyze.disabled = true
        alert('It looks like this PDF may contain scanned images. Text extraction failed. Use a text-based PDF or a TXT file for best results.');
      }
    } catch (err) {
      console.error('❌ PDF parsing error:', err)
      uploadBox.innerHTML = '❌ Failed to parse PDF<br><small>Please try a different file or use TXT format</small>'
      uploadBox.style.borderColor = 'rgba(255, 82, 82, 0.4)'
      alert('Failed to parse PDF locally. Error: ' + (err.message || err));
      return
    }
  } else if (type.startsWith('text') || file.name.toLowerCase().endsWith('.txt')) {
    console.log('📝 Loading text file...')
    const fr = new FileReader()
    fr.onload = () => {
      state.rawText = fr.result
      console.log('✓ Text file loaded, rawText length:', fr.result.length)
      completeLoad(filename)
    }
    fr.onerror = () => {
      console.error('❌ FileReader error:', fr.error)
      uploadBox.innerHTML = '❌ Failed to read file<br><small>Please try again</small>'
      uploadBox.style.borderColor = 'rgba(255, 82, 82, 0.4)'
      alert('Failed to read file: ' + (fr.error?.message || 'Unknown error'))
    }
    fr.readAsText(file)
  } else {
    console.warn('⚠️ Unsupported file type:', type, filename)
    uploadBox.innerHTML = `❌ Unsupported file type<br><small>Please use PDF or TXT files</small>`
    uploadBox.style.borderColor = 'rgba(255, 82, 82, 0.4)'
    alert('Unsupported file type: ' + (type || 'unknown') + '\nPlease provide PDF or TXT files.')
  }
}

function completeLoad(filename = '') {
  console.log('completeLoad called, rawText length:', state.rawText?.length)
  if (!state.rawText || state.rawText.length === 0) {
    console.error('completeLoad called but state.rawText is empty!')
    uploadBox.innerHTML = '⚠️ No content detected. Please try another file.'
    return
  }
  // enable analyze button and show brief preview
  goAnalyze.disabled = false
  // Update upload box to show success
  const wordCount = state.rawText.split(/\s+/).length
  uploadBox.innerHTML = `✓ Resume loaded${filename ? ': ' + filename : ''} (${wordCount} words)<br><small style="opacity:0.7">Click to upload a different file</small>`
  uploadBox.style.borderColor = 'rgba(0, 212, 255, 0.3)'
  // show the full raw text by default in the description on load
  descriptionEl.innerText = state.rawText
  // mark the 'Full' toggle pressed by default for clarity
  try { if (toggleFullDesc) toggleFullDesc.setAttribute('aria-pressed', 'true') } catch (e) { }
  // compute a quick sanitized version for analysis
  state.cleanedText = sanitizeText(state.rawText)
  console.log('✓ completeLoad done, cleanedText length:', state.cleanedText?.length)
  // if user has full toggle on, update view
  updateDescriptionView()
}

function sanitizeText(txt) {
  // Remove multiple spaces & odd characters
  return txt.replace(/[\t\r]+/g, ' ').replace(/\n{2,}/g, '\n').replace(/\s{2,}/g, ' ').trim()
}

// --- Analysis heuristics
function analyzeText(txt) {
  const analysis = {}
  analysis.wordCount = countWords(txt)
  analysis.contactInfo = detectContactInfo(txt)
  analysis.sections = detectSections(txt)
  analysis.skills = detectSkills(txt)
  analysis.topics = detectTopics(txt)
  analysis.roles = detectRoles(txt)
  analysis.issues = detectIssues(analysis, txt)
  analysis.atsScore = computeATSSscore(analysis, txt)
  analysis.summary = summarizeText(txt)
  analysis.description = detectDescription(txt)
  analysis.strategies = generateStrategies(analysis, txt)
  return analysis
}

// ensure analysis has consistent types and defaults
function normalizeAnalysis(a) {
  if (!a) a = {}
  return {
    wordCount: typeof a.wordCount === 'number' ? a.wordCount : (a.wordcount || 0),
    contactInfo: a.contactInfo || { email: '', phone: '', linkedin: '' },
    sections: a.sections || {},
    skills: Array.isArray(a.skills) ? a.skills : (typeof a.skills === 'string' ? [a.skills] : (a.skills ? Object.values(a.skills) : [])),
    topics: Array.isArray(a.topics) ? a.topics : (a.topics ? [a.topics] : []),
    roles: Array.isArray(a.roles) ? a.roles : (a.roles ? (typeof a.roles === 'string' ? [a.roles] : Object.values(a.roles)) : []),
    issues: Array.isArray(a.issues) ? a.issues : (a.issues ? [a.issues] : []),
    strategies: Array.isArray(a.strategies) ? a.strategies : (a.strategies ? [a.strategies] : []),
    atsScore: typeof a.atsScore === 'number' ? a.atsScore : parseInt(a.atsScore) || 0,
    summary: a.summary || '',
    description: a.description || ''
  }
}

function detectDescription(txt) {
  if (!txt) return ''
  // look for explicit section headings and return content under them
  const lines = txt.split('\n')
  const headingKeywords = ['summary', 'professional summary', 'about', 'about me', 'profile', 'objective']
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase().trim()
    for (const key of headingKeywords) {
      if (line.startsWith(key) || line === key + ':' || line.includes(key + ':')) {
        // gather following non-empty lines until the next heading or blank line
        let out = []
        for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
          const l = lines[j].trim()
          if (!l) break
          // stop if a likely new section header (all caps or ends with ':')
          if (/^[A-Z\s]{3,}$/.test(l) || l.endsWith(':')) break
          out.push(l)
        }
        if (out.length) return out.join(' ')
      }
    }
  }
  // fallback: first paragraph or first 1-2 sentences from top
  const para = lines.map(l => l.trim()).filter(l => l).slice(0, 4).join(' ')
  const sentences = para.split(/[.!?]\s+/).filter(s => s.trim().length > 12)
  return sentences.slice(0, 2).join('. ') + (sentences[0]?.endsWith('.') ? '' : '.')
}

function countWords(txt) {
  return (txt || '').match(/\w+/g)?.length || 0
}

function detectContactInfo(txt) {
  const email = (txt.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/g) || [])[0]
  const phone = (txt.match(/(\+?\d[\d\s-]{7,}\d)/g) || [])[0]
  const linkedin = (txt.match(/linkedin\.com\/[\w-]+/i) || [])[0]
  return { email, phone, linkedin }
}

function detectSections(txt) {
  const sections = {}
  const lines = txt.split('\n')
  const keys = ['summary', 'objective', 'experience', 'work experience', 'skills', 'education', 'projects', 'certification', 'certifications']
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].toLowerCase()
    for (const k of keys) { if (l.includes(k)) { sections[k] = true } }
  }
  return sections
}

function detectTopics(txt) {
  // find top repeated tech words & nouns
  const words = (txt.toLowerCase().match(/[a-z]{2,}/g) || [])
  const stop = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'was', 'worked', 'years', 'use', 'using', 'skill', 'skills'])
  const freq = {}
  for (const w of words) { if (!stop.has(w) && w.length > 1) { freq[w] = (freq[w] || 0) + 1 } }
  const pairs = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 30).map(x => x[0])
  return pairs
}

function detectSkills(txt) {
  const lookup = ['javascript', 'react', 'node', 'python', 'sql', 'aws', 'docker', 'kubernetes', 'html', 'css', 'selenium', 'java', 'c#', 'typescript', 'pandas', 'numpy', 'machine learning', 'tensorflow', 'pytorch', 'git', 'rest']
  const found = []
  for (const s of lookup) { if (txt.toLowerCase().includes(s)) found.push(s) }
  return found
}

function detectRoles(txt) {
  const map = {
    'Software Developer': ['javascript', 'react', 'node', 'typescript', 'python', 'java', 'c#'],
    'QA / Tester': ['test', 'qa', 'selenium', 'cypress', 'automation', 'pytest'],
    'Data Analyst': ['pandas', 'numpy', 'sql', 'tableau', 'excel', 'dashboards'],
    'Data Scientist': ['machine learning', 'tensorflow', 'pytorch', 'scikit', 'ml', 'model'],
    'DevOps': ['docker', 'kubernetes', 'aws', 'azure', 'ci/cd'],
    'Product/PM': ['roadmap', 'product', 'stakeholder', 'metrics']
  }
  const score = {}
  for (const role in map) {
    score[role] = map[role].reduce((s, k) => s + (txt.toLowerCase().includes(k) ? 1 : 0), 0)
  }
  const sorted = Object.entries(score).sort((a, b) => b[1] - a[1])
  const top = sorted.filter(x => x[1] > 0).slice(0, 3).map(x => x[0])
  return top.length ? top : ['General']
}

function detectIssues(analysis, txt) {
  const issues = []
  if (!analysis.contactInfo.email && !analysis.contactInfo.phone) issues.push('Missing clear contact information (email/phone)')
  if (!analysis.sections['work experience'] && !analysis.sections['experience']) issues.push('No clearly labeled Work Experience section')
  if (analysis.wordCount < 150) issues.push('Resume is very short; consider adding more details')
  if (analysis.wordCount > 2000) issues.push('Resume is unusually long; aim for concise bullet points')
  if (analysis.skills.length === 0) issues.push('No technical skills detected')
  if (!txt.match(/\d+%|\d+ years|\d+\+|\d+ months/)) issues.push('No measurable accomplishments or metrics found')
  // paragraphs/formatting checks
  if (txt.split('\n').length < 8) issues.push('Formatting: few line breaks; add sections and bullets')
  return issues
}

function computeATSSscore(analysis, txt) {
  // STRICT ATS scoring - 50+ points requires near-perfect resume
  let score = 0
  const breakdown = {}
  const penalties = []

  // === CRITICAL REQUIREMENTS (25 points max, but with penalties) ===

  // Contact Information - BOTH required (10 points total)
  if (analysis.contactInfo && analysis.contactInfo.email) {
    score += 5;
    breakdown.email = 5
  } else {
    score -= 5;
    breakdown.email = -5
    penalties.push('Missing email (-5)')
  }

  if (analysis.contactInfo && analysis.contactInfo.phone) {
    score += 5;
    breakdown.phone = 5
  } else {
    score -= 5;
    breakdown.phone = -5
    penalties.push('Missing phone (-5)')
  }

  // Work Experience Section - Must be clearly labeled (10 points)
  if (analysis.sections && (analysis.sections['experience'] || analysis.sections['work experience'])) {
    score += 10;
    breakdown.experience = 10
  } else if (txt.toLowerCase().includes('experience')) {
    score += 3;
    breakdown.experience = 3
    penalties.push('Experience not clearly labeled (-7)')
  } else {
    score -= 10;
    breakdown.experience = -10
    penalties.push('No experience section (-10)')
  }

  // Skills Section - Need MANY skills (5 points)
  const skillCount = (analysis.skills || []).length
  if (skillCount >= 10) {
    score += 5;
    breakdown.skills = 5
  } else if (skillCount >= 7) {
    score += 3;
    breakdown.skills = 3
    penalties.push('Only ' + skillCount + ' skills, need 10+ (-2)')
  } else if (skillCount >= 5) {
    score += 2;
    breakdown.skills = 2
    penalties.push('Only ' + skillCount + ' skills, need 10+ (-3)')
  } else if (skillCount >= 3) {
    score += 1;
    breakdown.skills = 1
    penalties.push('Only ' + skillCount + ' skills, need 10+ (-4)')
  } else {
    score -= 5;
    breakdown.skills = -5
    penalties.push('Critically low skills: ' + skillCount + ' (-5)')
  }

  // === CONTENT EXCELLENCE (30 points max, heavily penalized) ===

  // Measurable Achievements - MUST have many metrics (12 points)
  const metricsFound = (txt.match(/\d+%|\d+\+\s*(?:years?|months?)|\$\d+[KMB]?|[Ii]ncreased?|[Ii]mproved?|[Rr]educed?/g) || []).length
  if (metricsFound >= 8) {
    score += 12;
    breakdown.metrics = 12
  } else if (metricsFound >= 6) {
    score += 8;
    breakdown.metrics = 8
    penalties.push('Only ' + metricsFound + ' metrics, need 8+ (-4)')
  } else if (metricsFound >= 4) {
    score += 5;
    breakdown.metrics = 5
    penalties.push('Only ' + metricsFound + ' metrics, need 8+ (-7)')
  } else if (metricsFound >= 2) {
    score += 2;
    breakdown.metrics = 2
    penalties.push('Only ' + metricsFound + ' metrics, need 8+ (-10)')
  } else {
    score -= 8;
    breakdown.metrics = -8
    penalties.push('No quantifiable achievements (-8)')
  }

  // Resume Length - Very strict range (8 points)
  const wordCount = analysis.wordCount || 0
  if (wordCount >= 300 && wordCount <= 600) {
    score += 8;
    breakdown.length = 8
  } else if (wordCount >= 250 && wordCount < 300) {
    score += 5;
    breakdown.length = 5
    penalties.push('Resume a bit short (' + wordCount + ' words) (-3)')
  } else if (wordCount >= 200 && wordCount < 250) {
    score += 3;
    breakdown.length = 3
    penalties.push('Resume too short (' + wordCount + ' words) (-5)')
  } else if (wordCount > 600 && wordCount <= 700) {
    score += 4;
    breakdown.length = 4
    penalties.push('Resume a bit long (' + wordCount + ' words) (-4)')
  } else if (wordCount < 200) {
    score -= 5;
    breakdown.length = -5
    penalties.push('Resume critically short (' + wordCount + ' words) (-5)')
  } else {
    score += 1;
    breakdown.length = 1
    penalties.push('Resume too long (' + wordCount + ' words) (-7)')
  }

  // Formatting & Structure - Must be excellent (10 points)
  const sectionCount = Object.keys(analysis.sections || {}).length
  const lineCount = txt.split('\n').length

  if (sectionCount >= 5 && lineCount >= 20) {
    score += 10;
    breakdown.structure = 10
  } else if (sectionCount >= 4 && lineCount >= 15) {
    score += 6;
    breakdown.structure = 6
    penalties.push('Structure needs improvement (-7)')
  } else {
    score -= 5;
    breakdown.structure = -5
    penalties.push('Poor structure (-5)')
  }

  // === PROFESSIONAL POLISH (20 points max) ===

  // Role Targeting - Need clear specialization (5 points)
  const roleCount = (analysis.roles || []).length
  if (roleCount >= 3 && analysis.roles[0] !== 'General') {
    score += 5;
    breakdown.roles = 5
  } else if (roleCount >= 2 && analysis.roles[0] !== 'General') {
    score += 3;
    breakdown.roles = 3
    penalties.push('Limited role targeting (-2)')
  } else if (roleCount >= 1 && analysis.roles[0] !== 'General') {
    score += 1;
    breakdown.roles = 1
    penalties.push('Weak role targeting (-4)')
  } else {
    score -= 3;
    breakdown.roles = -3
    penalties.push('No clear role targeting (-3)')
  }

  // Education - MUST have formal education section (5 points)
  if (analysis.sections && analysis.sections['education']) {
    score += 5;
    breakdown.education = 5
  } else if (txt.toLowerCase().match(/bachelor|master|phd|b\.?s\.?|m\.?s\.?|degree/)) {
    score += 2;
    breakdown.education = 2
    penalties.push('Education mentioned but not in section (-3)')
  } else {
    score -= 3;
    breakdown.education = -3
    penalties.push('No education section (-3)')
  }

  // Keywords Density - Need MANY keywords (10 points)
  const topicCount = (analysis.topics || []).length
  if (topicCount >= 30) {
    score += 10;
    breakdown.keywords = 10
  } else if (topicCount >= 20) {
    score += 6;
    breakdown.keywords = 6
    penalties.push('Need more keywords (' + topicCount + '/30) (-4)')
  } else if (topicCount >= 15) {
    score += 3;
    breakdown.keywords = 3
    penalties.push('Low keyword count (' + topicCount + '/30) (-7)')
  } else {
    score -= 5;
    breakdown.keywords = -5
    penalties.push(' Very low keyword count (' + topicCount + '/30) (-5)')
  }

  // === BONUS PERFECTION POINTS (25 points max - very hard to get) ===

  // Professional Summary - Check for summary/objective section (5 points)
  if (analysis.sections && (analysis.sections['summary'] || analysis.sections['professional summary'] || analysis.sections['objective'])) {
    score += 5;
    breakdown.summary = 5
  } else {
    breakdown.summary = 0
  }

  // Certifications (5 points)
  if (analysis.sections && (analysis.sections['certification'] || analysis.sections['certifications'])) {
    score += 5;
    breakdown.certifications = 5
  } else if (txt.toLowerCase().match(/certified|certification|certificate/)) {
    score += 2;
    breakdown.certifications = 2
  } else {
    breakdown.certifications = 0
  }

  // Projects Section (5 points)
  if (analysis.sections && analysis.sections['projects']) {
    score += 5;
    breakdown.projects = 5
  } else {
    breakdown.projects = 0
  }

  // Action Verbs - Check for strong action verbs (5 points)
  const actionVerbs = (txt.match(/\b(Developed|Led|Implemented|Designed|Architected|Improved|Automated|Built|Optimized|Managed|Created|Launched|Spearheaded|Achieved|Delivered)\b/g) || []).length
  if (actionVerbs >= 10) {
    score += 5;
    breakdown.actionVerbs = 5
  } else if (actionVerbs >= 6) {
    score += 3;
    breakdown.actionVerbs = 3
  } else if (actionVerbs >= 3) {
    score += 1;
    breakdown.actionVerbs = 1
  } else {
    breakdown.actionVerbs = 0
  }

  // LinkedIn Present (5 points)
  if (analysis.contactInfo && analysis.contactInfo.linkedin) {
    score += 5;
    breakdown.linkedin = 5
  } else {
    breakdown.linkedin = 0
  }

  // Cap score at 100, but allow negative scores to show how bad a resume is
  const finalScore = Math.min(100, Math.max(-50, score))

  console.log('📊 STRICT ATS Score Breakdown:', breakdown)
  if (penalties.length > 0) {
    console.log('⚠️ Penalties Applied:', penalties)
  }
  console.log('📊 Final ATS Score:', finalScore, '/ 100')
  console.log('💡 Scoring Guide: 50+ = Excellent | 30-49 = Good | 10-29 = Fair | 0-9 = Poor | <0 = Very Poor')

  return Math.round(finalScore)
}

function summarizeText(txt) {
  // naive: first 3 sentences + top skills
  const sentences = txt.split(/[.!?]\s+/).filter(s => s.trim().length > 10)
  const top = (detectTopics(txt) || []).slice(0, 6).join(', ')
  return (sentences.slice(0, 3).join('. ') + '.\nTop topics: ' + top)
}

function generateStrategies(analysis, txt) {
  const strategies = []
  strategies.push('Add a clear one-paragraph summary at the top with role/years/impact')
  if (!analysis.contactInfo.email) strategies.push('Add email address');
  if (!analysis.contactInfo.phone) strategies.push('Add phone number');
  if (analysis.skills.length === 0) strategies.push('Add a bullet list of technical skills with keywords for the target role')
  strategies.push('Use metrics (percentages, count, dollar amounts) to quantify achievements')
  strategies.push('Use concise bullet points; start each with an action verb ("Developed", "Improved", "Automated")')
  strategies.push('Tailor resume keywords to the job description (match responsibilities & tech stack)')
  if (!analysis.sections['education']) strategies.push('Add an Education section if applicable')
  return strategies
}

// Compose the final analysis & render to UI. If API is enabled, call remote analysis.
async function analyzeAndRender() {
  console.log('🔍 analyzeAndRender called - state.rawText length:', state.rawText?.length, 'state.cleanedText length:', state.cleanedText?.length)
  // Ensure cleanedText is set from rawText if needed
  if (!state.cleanedText && state.rawText) {
    console.log('📝 Setting cleanedText from rawText')
    state.cleanedText = sanitizeText(state.rawText)
  }
  if (!state.cleanedText && !state.rawText) {
    console.error('❌ No resume data found in state!')
    console.error('Debug info:', {
      rawTextEmpty: !state.rawText,
      cleanedTextEmpty: !state.cleanedText,
      goAnalyzeDisabled: goAnalyze.disabled
    })
    alert('No resume loaded. Please upload a PDF or TXT file first.\n\nTip: Click the upload box to select a file, or try the "Try Demo Resume" button.')
    return
  }
  console.log('analyzeAndRender: starting analysis with cleanedText length', state.cleanedText?.length)
  const analysis = analyzeText(state.cleanedText)
  const normalizedLocal = normalizeAnalysis(analysis)
  // If API enabled, attempt remote analyze
  if (useApi && (((typeof GEMINI_API_KEY !== 'undefined' && GEMINI_API_KEY && GEMINI_API_KEY.length > 8 && GEMINI_API_KEY !== 'type your key here')) || apiKey || apiBaseUrl)) {
    setApiStatus('Analyzing via API...')
    try {
      console.log('analyzeAndRender: calling API with', useApi ? 'GEMINI or API' : 'local only')
      const res = await callAPI('/analyze', { text: state.cleanedText })
      const remote = res.analysis || res
      const merged = Object.assign({}, analysis, remote)
      const normalizedMerged = normalizeAnalysis(merged)
      // recompute ATS score on merged analysis to keep local heuristics consistent
      normalizedMerged.atsScore = computeATSSscore(normalizedMerged, state.cleanedText || state.rawText || '')
      state.analysis = normalizedMerged
      console.log('Remote analysis merged, normalized:', normalizedMerged)
      renderAnalysis(normalizedMerged)
      setApiStatus('Analysis from API')
      return merged
    } catch (e) {
      console.warn('API analyze failed', e)
      setApiStatus('API analyze failed, using local heuristics')
      // recompute ATS score for local analysis as well
      normalizedLocal.atsScore = computeATSSscore(normalizedLocal, state.cleanedText || state.rawText || '')
      state.analysis = normalizedLocal
    }
  } else {
    state.analysis = normalizedLocal
  }
  renderAnalysis(state.analysis)
}

function renderAnalysis(analysis) {
  console.log('renderAnalysis: analysis object:', analysis)
  atsScore.textContent = analysis.atsScore
  descriptionEl.innerText = analysis.description || analysis.summary || 'No description found.'
  // show scrollable panel if description is long
  try {
    const descPanel = descriptionEl.closest('.panel')
    if (analysis.description && analysis.description.length > 450) {
      descPanel.classList.add('scrollable')
      if (toggleScrollDesc) toggleScrollDesc.setAttribute('aria-pressed', 'true')
    } else {
      descPanel.classList.remove('scrollable')
      if (toggleScrollDesc) toggleScrollDesc.setAttribute('aria-pressed', 'false')
    }
  } catch (e) {/* no-op */ }
  rolesEl.innerText = (Array.isArray(analysis.roles) ? analysis.roles.join(', ') : (analysis.roles || '—'))
  issuesEl.innerHTML = '<ul>' + (Array.isArray(analysis.issues) ? analysis.issues.map(i => `<li>${i}</li>`).join('') : `<li>${analysis.issues || '—'}</li>`) + '</ul>'
  strategiesEl.innerHTML = '<ul>' + (Array.isArray(analysis.strategies) ? analysis.strategies.map(s => `<li>${s}</li>`).join('') : `<li>${analysis.strategies || '—'}</li>`) + '</ul>'
  // update description view depending on the Full toggle and scroll settings
  updateDescriptionView()
  // if debugPanel visible, show JSON
  try { if (debugPanel && debugPanel.style.display !== 'none') { showDebug(analysis) } } catch (e) { }
}

// Manage the full vs extracted view of description (Full = rawText)
function updateDescriptionView() {
  const descPanel = descriptionEl.closest('.panel')
  const isFull = toggleFullDesc && toggleFullDesc.getAttribute('aria-pressed') === 'true'
  if (isFull) {
    // show entire raw text in description
    descriptionEl.innerText = state.rawText || ''
    // ensure scrollable state
    try { descPanel.classList.add('scrollable'); if (toggleScrollDesc) toggleScrollDesc.setAttribute('aria-pressed', 'true') } catch (e) { }
  } else {
    descriptionEl.innerText = (state.analysis && state.analysis.description) || (state.analysis && state.analysis.summary) || (state.rawText || '')
    // remove scroll if not explicitly enabled
    try {
      if ((state.analysis && state.analysis.description || '').length > 450) {
        descPanel.classList.add('scrollable')
        if (toggleScrollDesc) toggleScrollDesc.setAttribute('aria-pressed', 'true')
      } else {
        descPanel.classList.remove('scrollable')
        if (toggleScrollDesc) toggleScrollDesc.setAttribute('aria-pressed', 'false')
      }
    } catch (e) { }
  }
}

// Enhanced resume generator
async function generateEnhanced() {
  const analysis = normalizeAnalysis(state.analysis || analyzeText(state.cleanedText))
  console.log('generateEnhanced: analysis present? ', !!analysis)
  const cleaned = state.cleanedText || ''
  // Basic header
  const header = generateHeader(analysis, cleaned)
  const skillLine = generateSkills(analysis)
  const experience = generateExperience(cleaned)
  const education = generateEducation(cleaned)

  const enhanced = header + '\n\n' + skillLine + '\n\n' + experience + '\n\n' + education
  // Allow optional remote generation (if API enabled)
  if (useApi && (((typeof GEMINI_API_KEY !== 'undefined' && GEMINI_API_KEY && GEMINI_API_KEY.length > 8 && GEMINI_API_KEY !== 'type your key here')) || apiKey || apiBaseUrl)) {
    setApiStatus('Generating enhanced resume via API...')
    try {
      const res = await callAPI('/enhance', { text: cleaned, analysis })
      const enhancedRemote = res.enhanced || res.enhancedText || res.result
      if (enhancedRemote) {
        state.enhanced = enhancedRemote
        enhancedEditor.innerText = enhancedRemote
        preview.innerHTML = formatPreview(enhancedRemote)
        setApiStatus('Enhanced resume generated by API')
        return
      }
    } catch (e) {
      console.warn('API enhance failed', e)
      setApiStatus('API enhance failed, using local generator')
    }
  }
  state.enhanced = enhanced
  enhancedEditor.innerText = enhanced
  preview.innerHTML = formatPreview(enhanced)
}

function formatPreview(txt) {
  if (!txt) return ''
  // Convert simple markers to HTML: headings starting 'Education:' or 'Experience:', bullets (- ) to lists
  const html = txt.split('\n').map(line => {
    const trimmed = line.trim()
    if (!trimmed) return ''
    if (/^[A-Z][a-z\s]+:\s*$/.test(trimmed) || trimmed.endsWith(':')) {
      return `<h4 style="margin:6px 0;">${escapeHtml(trimmed)}</h4>`
    }
    if (trimmed.startsWith('- ')) {
      return `<li>${escapeHtml(trimmed.substring(2))}</li>`
    }
    return `<p style="margin:6px 0;">${escapeHtml(trimmed)}</p>`
  }).join('\n')
  // Wrap contiguous <li> lines into <ul>
  return html.replace(/(<li>.*?<\/li>\s*)+/gs, m => `<ul style="margin-left:14px;">${m}</ul>`)
}

function generateHeader(analysis, txt) {
  const email = analysis.contactInfo.email || 'you@example.com'
  const phone = analysis.contactInfo.phone || '+1 555 555 5555'
  const roles = analysis.roles.join(' | ')
  const summaryShort = (analysis.summary || 'Experienced professional with a strong background...').split('\n')[0]
  return `Name: [Your Name]\nTitle: ${roles}\nContact: ${email} | ${phone}\n\nProfessional Summary:\n${summaryShort}`
}

function generateSkills(analysis) {
  const list = analysis.skills.length ? analysis.skills.slice(0, 12) : (analysis.topics || []).slice(0, 8)
  return 'Key Skills:\n- ' + list.join('\n- ')
}

function generateExperience(txt) {
  // Try to extract first 2-3 experience-like paragraphs
  const lines = txt.split('\n').map(s => s.trim()).filter(s => s)
  const ex = []
  for (const l of lines) {
    if (l.toLowerCase().includes('company') || l.match(/\b(generally|responsible|managed|developer|engineer|worked|built)\b/i)) {
      ex.push(l)
    }
    if (ex.length >= 3) break
  }
  if (ex.length === 0) {
    ex.push('Developed and maintained production-grade software and collaborated with cross-functional teams to deliver features and improvements.')
  }
  // Improve bullets: naive action verb normalization
  const bullets = ex.map(e => `- ${rewriteBullets(e)}`)
  return 'Experience:\n' + bullets.join('\n')
}

function generateEducation(txt) {
  const match = txt.match(/(Bachelor|Master|BA|BS|MS|PhD|B\.Sc|M\.Sc|Bachelor of|Master of).{0,60}/i)
  const ed = match?.[0] || 'B.Sc. in Computer Science — [University], [Year]'
  return 'Education:\n- ' + ed
}

function rewriteBullets(text) {
  // Replace generic words with action verbs and put metrics if present
  let t = text
  t = t.replace(/worked on|responsible for|involved in/ig, 'Developed')
  t = t.replace(/participated in|assisted/ig, 'Contributed to')
  t = t.replace(/led|lead/ig, 'Led')
  // ensure first char small tidy
  if (!t.startsWith('-')) t = t.replace(/^\s*-?\s*/, '')
  if (!t.match(/\b(Developed|Led|Implemented|Designed|Architected|Improved|Automated|Built|Optimized|Managed)\b/)) {
    t = 'Developed ' + t
  }
  return t
}

// Download functions
function downloadEnhanced() {
  const format = fileFormat.value
  const content = enhancedEditor.innerText || state.enhanced || 'No enhanced resume'
  const filename = 'enhanced_resume'
  if (format === 'txt') {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    saveBlob(blob, filename + '.txt')
  } else if (format === 'doc') {
    // generate a simple HTML -> Word doc
    const html = `<html><head><meta charset='utf-8' /></head><body><pre style='font-family:Calibri;'>${escapeHtml(content)}</pre></body></html>`
    const blob = new Blob([html], { type: 'application/msword' })
    saveBlob(blob, filename + '.doc')
  } else if (format === 'docx') {
    if (window.docx) {
      try {
        const { Document, Packer, Paragraph, TextRun } = window.docx
        const paraLines = content.split('\n')
        const children = paraLines.map(line =>
          new Paragraph({
            children: [new TextRun(line)]
          })
        )
        const doc = new Document({
          sections: [{
            properties: {},
            children: children
          }]
        })
        Packer.toBlob(doc).then(blob => saveBlob(blob, filename + '.docx'))
      } catch (e) {
        console.error('DOCX generation failed:', e)
        alert('DOCX generation failed. Falling back to DOC format.')
        // fallback to .doc
        const html = `<html><head><meta charset='utf-8' /></head><body><pre style='font-family:Calibri;'>${escapeHtml(content)}</pre></body></html>`
        const blob = new Blob([html], { type: 'application/msword' })
        saveBlob(blob, filename + '.doc')
      }
    } else {
      // fallback to .doc
      const html = `<html><head><meta charset='utf-8' /></head><body><pre style='font-family:Calibri;'>${escapeHtml(content)}</pre></body></html>`
      const blob = new Blob([html], { type: 'application/msword' })
      saveBlob(blob, filename + '.doc')
    }
  } else if (format === 'pdf') {
    // use jsPDF html rendering to generate PDF
    const { jsPDF } = window.jspdf
    const doc = new jsPDF({ unit: 'pt', format: 'a4' })
    doc.setFont('Helvetica')
    // render text; for better layout, we split lines and flow
    const lines = doc.splitTextToSize(content, 560)
    doc.text(lines, 40, 40)
    doc.save(filename + '.pdf')
  }
}

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function escapeHtml(s) {
  if (!s) return ''
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// --- small keyboard UX, animations
window.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape') startOverBtn.click()
})

  // Quick test: create fake demo if no input on page ready
  (function init() {
    document.querySelector('body').style.visibility = 'visible'
    // small animation for the start button
    setTimeout(() => {
      document.querySelectorAll('.btn.primary').forEach(b => b.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-4px)' }], { duration: 900, iterations: Infinity, direction: 'alternate' }))
    }, 700)
    // animate first visible step/card on load
    const firstStep = document.querySelector('.step.active')
    const firstCard = firstStep?.querySelector('.card')
    if (firstStep) { firstStep.classList.add('animate-in'); setTimeout(() => firstStep.classList.remove('animate-in'), 700) }
    if (firstCard) { firstCard.classList.add('animate-in'); setTimeout(() => firstCard.classList.remove('animate-in'), 700) }
  })();

// Ripple handler for buttons
document.querySelectorAll('.btn').forEach(btn => {
  btn.addEventListener('click', function (e) {
    // create ripple span
    const rect = btn.getBoundingClientRect()
    const r = document.createElement('span')
    r.className = 'ripple'
    const size = Math.max(rect.width, rect.height) * 0.9
    r.style.width = r.style.height = size + 'px'
    r.style.left = (e.clientX - rect.left - size / 2) + 'px'
    r.style.top = (e.clientY - rect.top - size / 2) + 'px'
    // clear previous ripples quickly
    const prev = btn.getElementsByClassName('ripple')
    while (prev[0]) prev[0].parentNode.removeChild(prev[0])
    btn.appendChild(r)
    // remove after animation
    setTimeout(() => { try { r.remove() } catch (e) { } }, 700)
  })
})

// Add ripple to upload box for consistent feel
const upBox = document.getElementById('uploadBox')
if (upBox) {
  upBox.addEventListener('click', function (e) {
    const rect = upBox.getBoundingClientRect()
    const r = document.createElement('span')
    r.className = 'ripple'
    const size = Math.max(rect.width, rect.height) * 0.12
    r.style.width = r.style.height = size + 'px'
    r.style.left = (e.clientX - rect.left - size / 2) + 'px'
    r.style.top = (e.clientY - rect.top - size / 2) + 'px'
    // remove previous
    const prev = upBox.getElementsByClassName('ripple')
    while (prev[0]) prev[0].parentNode.removeChild(prev[0])
    upBox.appendChild(r)
    setTimeout(() => { try { r.remove() } catch (e) { } }, 700)
  })
}

// Add event handler for description scroll toggle
if (toggleScrollDesc) {
  toggleScrollDesc.addEventListener('click', () => {
    const descPanel = descriptionEl.closest('.panel')
    const pressed = toggleScrollDesc.getAttribute('aria-pressed') === 'true'
    if (pressed) {
      descPanel.classList.remove('scrollable')
      toggleScrollDesc.setAttribute('aria-pressed', 'false')
    } else {
      descPanel.classList.add('scrollable')
      toggleScrollDesc.setAttribute('aria-pressed', 'true')
    }
  })
}

if (toggleFullDesc) {
  toggleFullDesc.addEventListener('click', () => {
    const pressed = toggleFullDesc.getAttribute('aria-pressed') === 'true'
    if (pressed) {
      toggleFullDesc.setAttribute('aria-pressed', 'false')
    } else {
      toggleFullDesc.setAttribute('aria-pressed', 'true')
    }
    updateDescriptionView()
  })
}

// expose some functions for debugging
async function selfTest() {
  console.log('Self-test running: setup sample resume and test local analysis & enhancement')
  const sample = `John Doe\nSoftware Developer\nEmails: john@example.com\nPhones: +1 555 5555\n\nProfessional Summary:\nExperienced developer with 5 years of experience in JavaScript, React and Node.js.\n\nExperience:\nCompany: Acme Inc\n- Developed web applications used by 20k users.\n\nSkills:\nJavaScript, React, Node.js, AWS\n\nEducation:\nB.Sc. Computer Science, ABC University`;
  state.rawText = sample
  completeLoad()
  // force local analysis during self test to avoid network calls
  const prevUseApi = useApi
  useApi = false
  await analyzeAndRender()
  console.log('Analysis result: ', state.analysis)
  await generateEnhanced()
  // restore useApi
  useApi = prevUseApi
  console.log('Enhanced resume sample: ', state.enhanced?.slice(0, 600))
  return { analysis: state.analysis, enhanced: state.enhanced }
}

// expose helper functions for debugging
window.resumeAnalyzer = { analyzeText, generateEnhanced, selfTest, validateGeminiKey }

// debug UI handlers (if present in DOM)
const runSelfTestBtn = document.getElementById('runSelfTest')
const debugPanel = document.getElementById('debugPanel')
const debugOutput = document.getElementById('debugOutput')
const hideDebug = document.getElementById('hideDebug')
const copyDebug = document.getElementById('copyDebug')

function showDebug(text) {
  if (debugOutput) { debugOutput.textContent = typeof text === 'string' ? text : JSON.stringify(text, null, 2) }
  if (debugPanel) debugPanel.style.display = 'block'
}

function hideDebugPanel() { if (debugPanel) debugPanel.style.display = 'none' }
if (runSelfTestBtn) { runSelfTestBtn.addEventListener('click', async () => { showDebug('Running self test...'); try { const res = await selfTest(); showDebug(res) } catch (e) { showDebug('SelfTest failed: ' + (e?.message || e)); console.error(e) } }) }
if (hideDebug) { hideDebug.addEventListener('click', hideDebugPanel) }
if (copyDebug) { copyDebug.addEventListener('click', () => { try { navigator.clipboard.writeText(debugOutput.textContent || ''); alert('Copied debug') } catch (e) { alert('Copy failed') } }) }
