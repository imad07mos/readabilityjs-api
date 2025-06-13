const express = require('express');
const { Readability, isProbablyReaderable } = require('@mozilla/readability');
const { JSDOM } = require('jsdom'); // Still needed for initial JSDOM creation
const createDOMPurify = require('dompurify');

const DOMPurify = createDOMPurify(new JSDOM('').window);

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_TOKEN = process.env.SECRET_TOKEN;

app.use(express.json({ limit: '10mb' }));

const authenticateToken = (req, res, next) => {
  const token = req.query.token;
  if (!token) {
    return res.status(401).json({ error: 'Authentication token is required. e.g., ?token=YOUR_TOKEN' });
  }
  if (token !== SECRET_TOKEN) {
    return res.status(403).json({ error: 'Invalid authentication token.' });
  }
  next();
};

const filterReadabilityOptions = (clientOptions) => {
  const allowedOptions = {};
  if (clientOptions && typeof clientOptions === 'object') {
    if (typeof clientOptions.debug === 'boolean') { allowedOptions.debug = clientOptions.debug; }
    if (typeof clientOptions.maxElemsToParse === 'number' && clientOptions.maxElemsToParse >= 0) { allowedOptions.maxElemsToParse = clientOptions.maxElemsToParse; }
    if (typeof clientOptions.nbTopCandidates === 'number' && clientOptions.nbTopCandidates >= 0) { allowedOptions.nbTopCandidates = clientOptions.nbTopCandidates; }
    if (typeof clientOptions.charThreshold === 'number' && clientOptions.charThreshold >= 0) { allowedOptions.charThreshold = clientOptions.charThreshold; }
    if (typeof clientOptions.keepClasses === 'boolean') { allowedOptions.keepClasses = clientOptions.keepClasses; }
    if (Array.isArray(clientOptions.classesToPreserve) && clientOptions.classesToPreserve.every(c => typeof c === 'string')) { allowedOptions.classesToPreserve = clientOptions.classesToPreserve; }
    if (typeof clientOptions.disableJSONLD === 'boolean') { allowedOptions.disableJSONLD = clientOptions.disableJSONLD; }
  }
  return allowedOptions;
};

const filterDOMPurifyOptions = (clientOptions) => {
  const allowedOptions = {};
  if (clientOptions && typeof clientOptions === 'object') {
    if (typeof clientOptions.USE_PROFILES === 'object') { allowedOptions.USE_PROFILES = clientOptions.USE_PROFILES; }
    if (Array.isArray(clientOptions.FORBID_TAGS) && clientOptions.FORBID_TAGS.every(t => typeof t === 'string')) { allowedOptions.FORBID_TAGS = clientOptions.FORBID_TAGS; }
    if (Array.isArray(clientOptions.FORBID_ATTR) && clientOptions.FORBID_ATTR.every(a => typeof a === 'string')) { allowedOptions.ADD_ATTR = clientOptions.ADD_ATTR; }
    if (typeof clientOptions.ADD_TAGS === 'object') { allowedOptions.ADD_TAGS = clientOptions.ADD_TAGS; }
    if (typeof clientOptions.ADD_ATTR === 'object') { allowedOptions.ADD_ATTR = clientOptions.ADD_ATTR; }
  }
  return allowedOptions;
};

/**
 * Converts a sanitized HTML string into a clean, LLM-friendly plain text string.
 * This strategically adds newlines for block elements and normalizes whitespace.
 * @param {string} htmlString - The sanitized HTML content.
 * @returns {string} The formatted plain text.
 */
const normalizeHtmlToLLMText = (htmlString) => {
  if (typeof htmlString !== 'string' || htmlString.trim().length === 0) return '';

  let text = htmlString;

  // Step 1: Replace common block-level closing tags with newlines
  // This helps separate paragraphs, headings, list items etc.
  text = text
    .replace(/<br[^>]*>/gi, '\n') // Line breaks
    .replace(/<\/h[1-6]>/gi, '\n\n') // Headings
    .replace(/<\/p>/gi, '\n\n') // Paragraphs
    .replace(/<\/li>/gi, '\n') // List items (single newline)
    .replace(/<\/div>/gi, '\n\n') // Divs (often used as containers, add paragraph break)
    .replace(/<\/(?:article|section|header|footer|aside|nav|figure|figcaption|blockquote|pre)>/gi, '\n\n') // Other block elements
    .replace(/<hr[^>]*>/gi, '\n---\n'); // Horizontal rules

  // Step 2: Strip all remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');

  // Step 3: Normalize whitespace
  text = text.trim(); // Trim leading/trailing whitespace
  text = text.replace(/\n\s*\n\s*\n/g, '\n\n'); // Collapse three or more newlines into two (for paragraphs)
  text = text.replace(/\n\s*(\n)?/g, '\n\n'); // Ensure at least two newlines between block elements. This is a bit aggressive, adjust as needed.
  text = text.replace(/ +/g, ' '); // Collapse multiple spaces to a single space
  text = text.replace(/(\n ?)+\n/g, '\n\n'); // Further collapse excessive blank lines
  text = text.replace(/([.?!])(\S)/g, '$1 $2'); // Ensure space after sentence-ending punctuation

  return text;
};


app.post('/readability', authenticateToken, (req, res) => {
  const { html, url, readabilityOptions, domPurifyOptions } = req.body;
  const stripHtml = String(req.query.strip).toLowerCase() === 'true';

  if (!html || typeof html !== 'string' || html.trim().length === 0) {
    console.warn(`[${new Date().toISOString()}] Bad Request: Missing or empty 'html' string in body.`);
    return res.status(400).json({ error: 'Request body must contain a non-empty "html" string.' });
  }

  const inputUrl = url && typeof url === 'string' && url.trim().length > 0 ? url : 'http://localhost/default_page';

  const filteredReadabilityOptions = filterReadabilityOptions(readabilityOptions);
  const filteredDOMPurifyOptions = filterDOMPurifyOptions(domPurifyOptions);

  try {
    const dom = new JSDOM(html, { url: inputUrl });
    const document = dom.window.document;

    if (!isProbablyReaderable(document)) {
      console.warn(`[${new Date().toISOString()}] Warning: isProbablyReaderable returned false for URL: ${inputUrl}. Content might not be a typical article.`);
    }

    const reader = new Readability(document, filteredReadabilityOptions);
    const article = reader.parse();

    if (!article) {
      console.warn(`[${new Date().toISOString()}] No article extracted from URL: ${inputUrl}. Content might be too short or not structured as an article.`);
      return res.status(404).json({ error: 'Could not extract an article from the provided HTML. The content might be too short or not structured as an an article.' });
    }

    let sanitizedContent = null;
    let finalLLMText = '';

    if (article.content) {
      sanitizedContent = DOMPurify.sanitize(article.content, {
        USE_PROFILES: { html: true },
        FORBID_TAGS: ['script', 'style'],
        FORBID_ATTR: ['onerror', 'onload'],
        ...filteredDOMPurifyOptions
      });

      console.log(`[${new Date().toISOString()}] Sanitized HTML content length: ${sanitizedContent.length}`);
      // console.log(`[${new Date().toISOString()}] Sanitized HTML (first 200 chars): ${sanitizedContent.substring(0, 200)}`);

      // --- NEW TEXT EXTRACTION LOGIC: Use direct regex conversion ---
      finalLLMText = normalizeHtmlToLLMText(sanitizedContent);
      console.log(`[${new Date().toISOString()}] Final LLM text content length: ${finalLLMText.length}`);
      // console.log(`[${new Date().toISOString()}] Final LLM text (first 200 chars): ${finalLLMText.substring(0, 200)}`);

    } else {
        console.warn(`[${new Date().toISOString()}] article.content was empty directly after Readability parse for URL: ${inputUrl}.`);
    }

    if (stripHtml) {
      // Send the normalized, LLM-friendly plain text
      res.type('text/plain').send(finalLLMText);
    } else {
      res.json({
          title: article.title,
          byline: article.byline,
          dir: article.dir,
          lang: article.lang,
          content: sanitizedContent, // The sanitized HTML content
          rawTextContent: article.textContent, // Original raw textContent from Readability (still concatenated)
          improvedTextContent: finalLLMText, // The newly generated, normalized text content for LLM
          length: article.length, // Note: length is based on rawTextContent by default Readability
          excerpt: article.excerpt,
          siteName: article.siteName,
          publishedTime: article.publishedTime
      });
    }

  } catch (error) {
    console.error(`[${new Date().toISOString()}] Internal Server Error during HTML processing for URL: ${inputUrl}. Details:`, error);
    res.status(500).json({ error: 'Internal server error during HTML processing.', details: error.message });
  }
});

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.listen(PORT, () => {
  console.log(`Readability API listening at http://localhost:${PORT}`);
  if (!SECRET_TOKEN) {
    console.warn(`[${new Date().toISOString()}] WARNING: SECRET_TOKEN environment variable is not set. API is not protected!`);
  }
});