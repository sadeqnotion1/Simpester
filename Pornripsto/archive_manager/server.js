const express = require('express');
const fs = require('fs');
const path = require('path');
const https = require('https');
const scrapers = require('./scrapers');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DB_FILE = path.join(__dirname, 'db.json');
const DEFAULT_LIST_FILE = "E:\\Projects\\Prnripsto\\Database\\Bella Rolland\\telegramtxt.txt";
const API_TOKEN = "ZVU2BRaLcJxFaom8ZNdAEgrt0hj8CzeXS9Ctm9Rp4ed1af18";

// Ensure db.json exists
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({ scenes: {}, last_scan: null }, null, 2));
}

// Parse filename to extract performer, site, year, and scene title
function parseFilename(filename) {
  // Remove extension
  let name = filename.replace(/\.[a-zA-Z0-9]+$/, '');
  
  // Remove part indicator like .part000, _part1, -part01, part001, cd1, pt1, etc.
  name = name.replace(/[\.\-\_\s]+(?:part|cd|pt|part0|cd0)[\.\-\_\s]?\d+/i, '');
  
  // Split by dots or spaces or underscores
  let parts = name.split(/[\.\s_]+/);
  
  // Find the year index (e.g. 2019, 2020)
  let yearIdx = parts.findIndex(p => /^\d{4}$/.test(p));
  
  // Find the TLD index (com, co, net, xxx, us etc)
  let tldIdx = parts.findIndex(p => /^(?:com|co|net|xxx|us|org|info|tv)$/i.test(p));
  
  let performer = "";
  let site = "";
  let year = "";
  let title = "";
  
  if (yearIdx !== -1) {
    year = parts[yearIdx];
    title = parts.slice(yearIdx + 1).join(" ");
    if (tldIdx !== -1 && tldIdx < yearIdx) {
      site = parts.slice(tldIdx - 1, tldIdx + 1).join(".");
      performer = parts.slice(0, tldIdx - 1).join(" ");
    } else {
      site = parts.slice(0, yearIdx).join(" ");
    }
  } else {
    if (tldIdx !== -1) {
      site = parts.slice(tldIdx - 1, tldIdx + 1).join(".");
      performer = parts.slice(0, tldIdx - 1).join(" ");
      title = parts.slice(tldIdx + 1).join(" ");
    } else {
      title = parts.join(" ");
    }
  }
  
  // Fallback performer if empty (user is organizing Bella Rolland folder)
  if (!performer) performer = "Bella Rolland";
  
  return {
    performer: performer.trim(),
    site: site.trim(),
    year: year.trim(),
    title: title.trim()
  };
}

// Fetch helper from ThePornDB API
function fetchFromApi(query) {
  return new Promise((resolve) => {
    const encoded = encodeURIComponent(query);
    const url = `https://api.theporndb.net/scenes?q=${encoded}`;
    const options = {
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    };
    https.get(url, options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            const data = JSON.parse(body);
            resolve(data.data || []);
          } else {
            resolve([]);
          }
        } catch (e) {
          resolve([]);
        }
      });
    }).on('error', () => {
      resolve([]);
    });
  });
}

// Fetch helper from Eporner API
function fetchFromEporner(query) {
  return new Promise((resolve) => {
    const encoded = encodeURIComponent(query);
    const url = `https://www.eporner.com/api/v2/video/search/?query={encoded}&per_page=5&thumbsize=big&format=json`.replace('{encoded}', encoded);
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    };
    https.get(url, options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            const data = JSON.parse(body);
            resolve(data.videos || []);
          } else {
            resolve([]);
          }
        } catch (e) {
          resolve([]);
        }
      });
    }).on('error', () => {
      resolve([]);
    });
  });
}

// Extract default performer from file path directory
function getDefaultPerformerFromPath(filePath) {
  try {
    const dir = path.dirname(filePath);
    const parentDir = path.basename(dir);
    if (parentDir && parentDir !== '.' && parentDir !== '..' && parentDir !== 'Database') {
      return parentDir; // e.g. "Bella Rolland"
    }
  } catch (e) {}
  return "Bella Rolland";
}

// Validate that the returned scene features the expected performer
function verifyPerformerMatch(matchPerformers, expectedPerformer) {
  if (!expectedPerformer) return true;
  if (!matchPerformers || matchPerformers.length === 0) return true;
  const expectedL = expectedPerformer.toLowerCase().trim();
  return matchPerformers.some(p => {
    const nameL = p.name.toLowerCase().trim();
    return nameL.includes(expectedL) || expectedL.includes(nameL);
  });
}

function verifyEpornerPerformerMatch(video, expectedPerformer) {
  if (!expectedPerformer) return true;
  const expectedL = expectedPerformer.toLowerCase().trim();
  const titleL = video.title.toLowerCase();
  const keywordsL = video.keywords ? video.keywords.toLowerCase() : "";
  const expectedDash = expectedL.replace(/\s+/g, '-');
  
  return titleL.includes(expectedL) || 
         keywordsL.includes(expectedL) || 
         keywordsL.includes(expectedDash);
}

// Multi-stage matcher
async function getMetadataForScene(clean_key, parsed, defaultPerformer) {
  const title = parsed.title;
  const performer = parsed.performer || defaultPerformer || "Bella Rolland";
  const site = parsed.site ? parsed.site.replace(/\.[a-z]+$/i, '') : ""; // remove .com etc.
  
  const queries = [];
  if (performer && site && title) queries.push(`${performer} ${site} ${title}`);
  if (site && title) queries.push(`${site} ${title}`);
  if (performer && title) queries.push(`${performer} ${title}`);
  if (title) queries.push(title);
  
  // 1. Try ThePornDB API
  for (const q of queries) {
    const results = await fetchFromApi(q);
    if (results && results.length > 0) {
      // Find the first match that features our performer
      const match = results.find(s => verifyPerformerMatch(s.performers, performer));
      if (match) {
        // Try to fetch screenshots from Eporner as fallback
        let screenshots = [];
        try {
          const epSearch = `${performer} ${match.title}`;
          const epVideos = await fetchFromEporner(epSearch);
          if (epVideos && epVideos.length > 0) {
            const epMatch = epVideos.find(v => verifyEpornerPerformerMatch(v, performer));
            if (epMatch && epMatch.thumbs) {
              screenshots = epMatch.thumbs.map(t => t.src || t);
            }
          }
        } catch (e) {
          console.log(`Failed to fetch screenshots for: "${match.title}"`);
        }

        return {
          matched: true,
          source: "theporndb",
          title: match.title,
          date: match.date,
          description: match.description || "",
          site: {
            name: match.site?.name || site,
            logo: match.site?.logo || "",
            poster: match.site?.poster || "",
            network: match.site?.network?.name || ""
          },
          performers: (match.performers || []).map(p => ({
            name: p.name,
            image: p.image || p.face || "",
            thumbnail: p.thumbnail || ""
          })),
          tags: (match.tags || []).map(t => t.name),
          poster: match.posters?.large || match.poster || "",
          background: match.background || match.posters?.full || "",
          trailer: match.trailer || "",
          url: match.id ? `https://theporndb.net/scenes/${match.id}` : (match.url || ""),
          studio_url: match.url || "",
          screenshots: screenshots
        };
      }
    }
    await new Promise(r => setTimeout(r, 200)); // sleep to avoid rate limits
  }

  // 2. Try Eporner API as fallback
  console.log(`ThePornDB returned no match for: "${clean_key}". Querying Eporner...`);
  const epQueries = [];
  if (performer && title) epQueries.push(`${performer} ${title}`);
  if (site && title) epQueries.push(`${site} ${title}`);
  if (title) epQueries.push(title);

  for (const q of epQueries) {
    const videos = await fetchFromEporner(q);
    if (videos && videos.length > 0) {
      const match = videos.find(v => verifyEpornerPerformerMatch(v, performer));
      if (match) {
        console.log(`Found validated Eporner match: "${match.title}"`);
        
        let tags = [];
        if (match.keywords) {
          tags = match.keywords.split(',').map(t => t.trim().replace(/\b\w/g, c => c.toUpperCase())).filter(t => t.length > 0 && t.length < 20);
        }
        tags = [...new Set(tags)].slice(0, 12);
        
        let date = "";
        if (match.added) {
          date = match.added.split(' ')[0]; // YYYY-MM-DD
        }
        
        const poster = match.default_thumb?.src || "";
        let background = "";
        if (match.thumbs && match.thumbs.length > 0) {
          background = match.thumbs[Math.min(5, match.thumbs.length - 1)]?.src || poster;
        }
        
        return {
          matched: true,
          source: "eporner",
          title: match.title.replace(/\b\w/g, c => c.toUpperCase()),
          date: date,
          description: `Source: Eporner. Views: ${match.views}. Rating: ${match.rate}. Length: ${match.length_min}.`,
          site: {
            name: site ? site.toUpperCase() : "Eporner",
            logo: "",
            poster: "",
            network: ""
          },
          performers: [{ name: performer, image: "", thumbnail: "" }],
          tags: tags,
          poster: poster,
          background: background,
          trailer: "",
          url: match.url,
          studio_url: match.url,
          screenshots: match.thumbs ? match.thumbs.map(t => t.src || t) : []
        };
      }
    }
    await new Promise(r => setTimeout(r, 200));
  }
  
  // 3. Try custom web scrapers as fallback (HotPornFile, NaughtyBlog, SeaPorn)
  console.log(`Eporner returned no match for: "${clean_key}". Querying custom web scrapers...`);
  try {
    const blogQuery = performer && title ? `${performer} ${title}` : title;
    const blogMatch = await scrapers.getMetadataFromBlogs(blogQuery, performer);
    if (blogMatch) {
      console.log(`Found validated custom web scraper match from ${blogMatch.source}: "${blogMatch.title}"`);
      return blogMatch;
    }
  } catch (e) {
    console.error("Error querying custom web scrapers:", e);
  }
  
  // 4. Fallback to local parsed info
  return {
    matched: false,
    source: "local",
    title: title ? title.replace(/\b\w/g, c => c.toUpperCase()) : clean_key.replace(/\b\w/g, c => c.toUpperCase()),
    date: parsed.year ? `${parsed.year}-01-01` : "",
    description: "No metadata found on ThePornDB or Eporner. Local placeholder entry.",
    site: {
      name: site ? site.replace(/\b\w/g, c => c.toUpperCase()) : "Unknown Studio",
      logo: "",
      poster: "",
      network: ""
    },
    performers: [{ name: performer, image: "", thumbnail: "" }],
    tags: ["Local Archive"],
    poster: "",
    background: "",
    trailer: "",
    url: "",
    studio_url: "",
    screenshots: []
  };
}

// Scan file and fetch new items
async function scanAndParse(listFilePath = DEFAULT_LIST_FILE, progressCallback = null, force = false) {
  if (!fs.existsSync(listFilePath)) {
    throw new Error(`File not found: ${listFilePath}`);
  }
  
  const defaultPerformer = getDefaultPerformerFromPath(listFilePath);
  console.log(`Scanning. Default Performer expected: "${defaultPerformer}". Force mode: ${force}`);
  
  const content = fs.readFileSync(listFilePath, 'utf-8');
  const lines = content.split('\n');
  const filesFound = [];
  
  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    
    // Match timestamp and sender name prefix
    const m = line.match(/^\[[^\]]+\]\s+[^:]+:\s*(.*)$/);
    if (!m) continue;
    
    const filePart = m.group ? m.group(1).trim() : m[1].trim();
    if (filePart.startsWith('http://') || filePart.startsWith('https://')) {
      continue;
    }
    
    // Check for video extension
    if (/\.(mp4|mkv|avi|wmv|mov|flv)$/i.test(filePart)) {
      filesFound.push(filePart);
    }
  }
  
  // Group files by clean key
  const grouped = {};
  for (const file of filesFound) {
    const base = file.replace(/\.[a-zA-Z0-9]+$/, '');
    // Remove parts
    let clean_key = base.replace(/[\.\-\_\s]+(?:part|cd|pt|part0|cd0)[\.\-\_\s]?\d+/i, '');
    clean_key = clean_key.toLowerCase().replace(/[\.\-\_]+/g, ' ');
    clean_key = clean_key.replace(/\s+/g, ' ').trim();
    
    if (!grouped[clean_key]) {
      grouped[clean_key] = [];
    }
    grouped[clean_key].push(file);
  }
  
  // Load current DB
  const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
  const totalScenes = Object.keys(grouped).length;
  let processed = 0;
  
  for (const clean_key of Object.keys(grouped)) {
    processed++;
    const files = grouped[clean_key];
    
    if (progressCallback) {
      progressCallback(processed, totalScenes, clean_key);
    }
    
    // Check if key already exists
    if (!force && db.scenes[clean_key]) {
      // Just update the files list in case new files were added
      db.scenes[clean_key].files = files;
      
      // If it was already matched successfully, skip query
      if (db.scenes[clean_key].metadata && db.scenes[clean_key].metadata.matched) {
        continue;
      }
    }
    
    // Parse name for query details
    const parsed = parseFilename(files[0]);
    
    // Fetch metadata
    const metadata = await getMetadataForScene(clean_key, parsed, defaultPerformer);
    
    db.scenes[clean_key] = {
      clean_key,
      files,
      metadata,
      parsed
    };
    
    // Save state every 5 queries
    if (processed % 5 === 0) {
      fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    }
    
    // sleep between scenes to respect API rate limits
    await new Promise(r => setTimeout(r, 400));
  }
  
  db.last_scan = new Date().toISOString();
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  return { totalScenes, filesCount: filesFound.length };
}

// Socket/SSE for Progress Updates
let currentProgress = null;
app.get('/api/scan-progress', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  const sendProgress = () => {
    if (currentProgress) {
      res.write(`data: ${JSON.stringify(currentProgress)}\n\n`);
    }
  };
  
  const interval = setInterval(sendProgress, 500);
  req.on('close', () => clearInterval(interval));
});

// API Routes
app.get('/api/scenes', (req, res) => {
  const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
  const scenesArray = Object.values(db.scenes);
  res.json(scenesArray);
});

app.get('/api/stats', (req, res) => {
  const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
  const scenes = Object.values(db.scenes);
  
  const totalScenes = scenes.length;
  const totalFiles = scenes.reduce((sum, s) => sum + s.files.length, 0);
  
  const sites = new Set();
  const performers = new Set();
  let matchedCount = 0;
  
  scenes.forEach(s => {
    if (s.metadata.site?.name) sites.add(s.metadata.site.name);
    if (s.metadata.performers) {
      s.metadata.performers.forEach(p => performers.add(p.name));
    }
    if (s.metadata.matched) matchedCount++;
  });
  
  res.json({
    totalScenes,
    totalFiles,
    uniqueSites: sites.size,
    uniquePerformers: performers.size,
    matchedCount,
    lastScan: db.last_scan
  });
});

app.post('/api/scenes/rescan', async (req, res) => {
  const clean_key = req.body.clean_key;
  if (!clean_key) {
    return res.status(400).json({ error: "Missing clean_key" });
  }

  const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
  const scene = db.scenes[clean_key];
  if (!scene) {
    return res.status(404).json({ error: "Scene not found in database" });
  }

  try {
    const defaultPerformer = getDefaultPerformerFromPath(DEFAULT_LIST_FILE);
    const parsed = scene.parsed || parseFilename(scene.files[0]);
    console.log(`Re-scanning single scene: "${clean_key}". Expected Performer: "${defaultPerformer}"`);
    
    const metadata = await getMetadataForScene(clean_key, parsed, defaultPerformer);
    
    scene.metadata = metadata;
    scene.parsed = parsed; // update in case it was missing
    
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    res.json(scene);
  } catch (err) {
    console.error(`Error re-scanning scene "${clean_key}":`, err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/scan', async (req, res) => {
  const file_path = req.body.path || DEFAULT_LIST_FILE;
  const force = req.body.force || false;
  if (!fs.existsSync(file_path)) {
    return res.status(400).json({ error: `File not found: ${file_path}` });
  }
  
  res.json({ status: "started" });
  
  try {
    currentProgress = { status: "scanning", current: 0, total: 0, scene: "Parsing text file..." };
    await scanAndParse(file_path, (current, total, scene) => {
      currentProgress = { status: "fetching", current, total, scene };
    }, force);
    currentProgress = { status: "complete", current: 100, total: 100, scene: "Scan completed successfully!" };
  } catch (err) {
    console.error("Scan error:", err);
    currentProgress = { status: "error", error: err.message };
  }
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 Localhost Server started at http://localhost:${PORT}`);
  console.log(`====================================================`);
});
