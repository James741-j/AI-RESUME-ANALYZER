# AI Resume Analyzer — ResumeX (Frontend-only)

This is a client-side, multi-step, animated AI Resume Analyzer built using HTML/CSS/JavaScript.

Features:
- Multi-step fullscreen UI with animated transitions.
- Upload PDF or TXT resumes (text-based PDFs only; scanned PDFs are not supported) and analyze them entirely in the browser.
- ATS scoring (0–100), role detection, issue detection, and improvement strategies.
- Generate an enhanced resume, edit it live, and download as TXT / DOC / DOCX / PDF.
- No server or backend required; all processing occurs in your browser.

How to use:
1. Open `index.html` in a modern browser.
2. Upload a text-based PDF or TXT resume or try the demo.
3. Click "Analyze Resume" to view ATS score, roles, issues, and suggested improvements. The analysis screen includes a "Description" box that shows either the extracted profile (`About`/`Profile`/`Summary`) or the full resume text. You can toggle the `Full` button to view the entire uploaded file contents in the Description box.
4. Click "Generate Enhanced Resume" to create a reformatted resume; edit it live in the sidebar and preview it.
5. Choose a download format from the dropdown and click "Download" or "Finalize & Download" to save.

Notes:
- If your PDF is scanned (an image), PDF.js cannot extract text. Use a text-based PDF or paste a TXT resume instead.
- DOCX export uses the `docx` library client-side. If this library fails to load for any reason, a DOC fallback is used.

API Integration & Security:
- This project can call a remote API. In this version, the app removes the API key UI and uses an embedded key (set `GEMINI_API_KEY` in `script.js`) by default. You can still configure a custom `apiBaseUrl` inside the script if needed for other endpoints.
- For security, prefer storing secret API keys on a backend server or proxy (recommended). If you opt to store the key in the browser, the app will keep it in localStorage ONLY if you choose the "Remember" option — this is insecure for sensitive keys and is not recommended for production.
- The app contains `callAPI(path, payload)` as a helper function which sends calls to your `apiBase` with `Authorization: Bearer <API_KEY>`.
		- The app expects an `/analyze` endpoint that accepts { text } and returns { analysis } or analysis fields and an `/enhance` endpoint that accepts { text, analysis } and returns { enhanced } or enhancedText.
- The app also supports directly embedding a `GEMINI_API_KEY` constant into `script.js`. If present, calls to `callAPI('/analyze', {text})` and `callAPI('/enhance', ...)` will be routed to Google Generative Language (Gemini) `generateText` model calls.
	- To embed a key, edit `script.js` and set `GEMINI_API_KEY` and `GEMINI_MODEL` at the top of the file. The app will automatically hide the API settings UI when the key is embedded.
	Example (in `script.js`):

	```js
	// WARNING: storing a secret key here is insecure and for testing only
	const GEMINI_API_KEY = 'YOUR_GEMINI_API_KEY_HERE'
	const GEMINI_MODEL = 'models/text-bison-001' // or 'models/gemini-1.0'
	```

Libraries:
- pdf.js for parsing PDFs
- jsPDF for creating PDF documents
- docx for generating real `.docx` files (client-side)

Privacy & Security:
- All analysis and resume processing is done locally in your browser. No data is sent to a server.

License: MIT
