const https = require('https');
const url = require('url');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache'
};

// Helper to fetch HTML from a URL
function fetchHtml(targetUrl) {
  return new Promise((resolve, reject) => {
    const parsed = url.parse(targetUrl);
    const options = {
      hostname: parsed.hostname,
      path: parsed.path,
      headers: {
        ...HEADERS,
        'Host': parsed.hostname
      },
      timeout: 10000
    };

    https.get(options, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        // Handle redirect
        const redirectUrl = res.headers.location;
        if (redirectUrl) {
          fetchHtml(redirectUrl).then(resolve).catch(reject);
          return;
        }
      }
      
      if (res.statusCode !== 200) {
        reject(new Error(`Status Code: ${res.statusCode} for ${targetUrl}`));
        return;
      }

      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve(body));
    }).on('error', (err) => {
      reject(err);
    });
  });
}

// Convert thumbnail URLs to full size URLs
function resolveThumbUrl(thumb) {
  if (!thumb) return "";
  
  // Pixhost resolving
  // Pattern: https://t[SERVER].pixhost.to/thumbs/[FOLDER]/[FILE] -> https://img[SERVER].pixhost.to/images/[FOLDER]/[FILE]
  if (thumb.includes("pixhost.to")) {
    const m = thumb.match(/t(\d+)\.pixhost\.to\/thumbs\/(\d+)\/([^\/]+)/);
    if (m) {
      return `https://img${m[1]}.pixhost.to/images/${m[2]}/${m[3]}`;
    }
  }
  
  // ImageTwist resolving
  // Pattern: https://t[SERVER].imagetwist.com/th/[FOLDER]/[FILE] -> https://i[SERVER].imagetwist.com/[FOLDER]/[FILE]
  if (thumb.includes("imagetwist.com")) {
    const m = thumb.match(/(https?:\/\/i?)(\d+)(\.imagetwist\.com\/)(?:th\/)?([^\/]+)\/([^\/]+)/);
    if (m) {
      return `${m[1]}${m[2]}${m[3]}${m[4]}/${m[5]}`;
    }
  }
  
  return thumb;
}

// String similarity scorer (token-based overlap)
function getOverlapScore(str1, str2) {
  if (!str1 || !str2) return 0;
  const clean = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(w => w.length > 2);
  const words1 = clean(str1);
  const words2 = clean(str2);
  if (words1.length === 0 || words2.length === 0) return 0;
  
  const set2 = new Set(words2);
  let overlap = 0;
  for (const w of words1) {
    if (set2.has(w)) overlap++;
  }
  return overlap / Math.max(words1.length, words2.length);
}

// HotPornFile Scraper
async function searchHotPornFile(query, expectedPerformer) {
  try {
    const searchUrl = `https://www.hotpornfile.org/?s=${encodeURIComponent(query)}`;
    const html = await fetchHtml(searchUrl);
    
    // Find articles
    // Pattern: <div id="post-XXX" class="box columns">...<a href="[URL]"><img src="[THUMB]"></a>...<h2><a href="[URL]">[TITLE]</a></h2>
    const posts = [];
    const postRegex = /<div id="post-\d+"[^>]*>([\s\S]*?)<\/h2>/gi;
    let match;
    
    while ((match = postRegex.exec(html)) !== null) {
      const block = match[1];
      const urlMatch = block.match(/href="([^"]+)"/);
      const titleMatch = block.match(/<h2><a href="[^"]+">([^<]+)<\/a>/);
      const imgMatch = block.match(/<img[^>]+src="([^"]+)"/);
      
      if (urlMatch && titleMatch) {
        posts.push({
          title: titleMatch[1].trim(),
          url: urlMatch[1],
          thumbnail: imgMatch ? imgMatch[1] : ""
        });
      }
    }

    if (posts.length === 0) return null;
    
    // Score posts
    const scored = posts.map(p => ({
      ...p,
      score: getOverlapScore(query, p.title)
    })).sort((a, b) => b.score - a.score);
    
    const best = scored[0];
    if (best.score < 0.15) return null; // Too weak
    
    console.log(`[HotPornFile] Matched candidate: "${best.title}" (Score: ${best.score.toFixed(2)})`);
    
    // Fetch details
    const detailHtml = await fetchHtml(best.url);
    
    // Extract tags
    const tags = [];
    const tagRegex = /href="https:\/\/www\.hotpornfile\.org\/tag\/([^"]+)"/g;
    let tagMatch;
    while ((tagMatch = tagRegex.exec(detailHtml)) !== null) {
      const cleanTag = decodeURIComponent(tagMatch[1]).replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      tags.push(cleanTag);
    }
    
    // Extract screenshots
    const screenshots = [];
    const imgRegex = /href="([^"]+(?:pixhost\.to\/show|imagetwist\.com|picbaron\.com)[^"]+)"|src="([^"]+(?:pixhost\.to\/thumbs|imagetwist\.com\/th)[^"]+)"/gi;
    let imgLinkMatch;
    while ((imgLinkMatch = imgRegex.exec(detailHtml)) !== null) {
      const url = imgLinkMatch[1] || imgLinkMatch[2];
      if (url && !screenshots.includes(url)) {
        screenshots.push(url);
      }
    }
    
    // Convert screenshots to full size
    const resolvedScreenshots = screenshots.map(resolveThumbUrl).filter(u => u && !u.endsWith('.html'));

    // Extract studio and performer from filename or tags
    let studio = "";
    let performers = [];
    
    // Try to guess from post title
    // e.g. "BrazzersExxtra 26 05 11 Bella Rolland Delilah Dagger And Brooke Tilli..."
    const titleParts = best.title.split(/\s+/);
    if (titleParts.length > 0) {
      studio = titleParts[0];
    }
    
    if (expectedPerformer) {
      performers.push({ name: expectedPerformer, image: "", thumbnail: "" });
    }
    
    return {
      matched: true,
      source: "hotpornfile",
      title: best.title,
      date: "", // Guessing date from title or tags if needed
      description: `Source: HotPornFile. Details at ${best.url}`,
      site: {
        name: studio || "Unknown Studio",
        logo: "",
        poster: "",
        network: ""
      },
      performers: performers,
      tags: [...new Set(tags)].slice(0, 12),
      poster: resolveThumbUrl(best.thumbnail),
      background: resolvedScreenshots[0] || "",
      trailer: "",
      url: best.url,
      studio_url: "",
      screenshots: resolvedScreenshots.slice(0, 8)
    };
  } catch (err) {
    console.error(`[HotPornFile Scraper Error]: ${err.message}`);
    return null;
  }
}

// NaughtyBlog Scraper
async function searchNaughtyBlog(query, expectedPerformer) {
  try {
    const searchUrl = `https://www.naughtyblog.org/?s=${encodeURIComponent(query)}`;
    const html = await fetchHtml(searchUrl);
    
    // Parse post overviews
    const posts = [];
    const postRegex = /<div id="post-\d+" class="post-overview[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi;
    let match;
    
    while ((match = postRegex.exec(html)) !== null) {
      const block = match[1];
      const urlMatch = block.match(/href="([^"]+)"/);
      const titleMatch = block.match(/<h3 class="post-title[^>]*><a[^>]+>([^<]+)<\/a>/);
      const imgMatch = block.match(/<img[^>]+src="([^"]+)"/);
      const textMatch = block.match(/<span id="post-index-content"[^>]*>([\s\S]*?)<\/span>/i);
      
      if (urlMatch && titleMatch) {
        posts.push({
          title: titleMatch[1].trim(),
          url: urlMatch[1],
          thumbnail: imgMatch ? imgMatch[1] : "",
          snippet: textMatch ? textMatch[1].replace(/<[^>]+>/g, ' ').trim() : "",
          rawBlock: block
        });
      }
    }
    
    if (posts.length === 0) return null;
    
    // Score posts
    const scored = posts.map(p => ({
      ...p,
      score: getOverlapScore(query, p.title)
    })).sort((a, b) => b.score - a.score);
    
    const best = scored[0];
    if (best.score < 0.15) return null;
    
    console.log(`[NaughtyBlog] Matched candidate: "${best.title}" (Score: ${best.score.toFixed(2)})`);
    
    // Fetch details for full screens
    const detailHtml = await fetchHtml(best.url);
    
    // Extract tags
    const tags = [];
    const tagRegex = /href="https:\/\/www\.naughtyblog\.org\/tag\/([^"]+)"/g;
    let tagMatch;
    while ((tagMatch = tagRegex.exec(detailHtml)) !== null) {
      const cleanTag = decodeURIComponent(tagMatch[1]).replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      tags.push(cleanTag);
    }
    
    // Extract screenshots
    const screenshots = [];
    const imgRegex = /href="([^"]+(?:pixhost\.to\/show|imagetwist\.com|picbaron\.com)[^"]+)"|src="([^"]+(?:pixhost\.to\/thumbs|imagetwist\.com\/th)[^"]+)"/gi;
    let imgLinkMatch;
    while ((imgLinkMatch = imgRegex.exec(detailHtml)) !== null) {
      const url = imgLinkMatch[1] || imgLinkMatch[2];
      if (url && !screenshots.includes(url)) {
        screenshots.push(url);
      }
    }
    const resolvedScreenshots = screenshots.map(resolveThumbUrl).filter(u => u && !u.endsWith('.html'));
    
    // Parse Release Date, Performers, Studio from postinfo
    let studio = "";
    let performers = [];
    let date = "";
    
    // Match Site tag: <strong>Site: </strong><a href="...">Brazzers Exxtra</a>
    const siteMatch = detailHtml.match(/<strong>Site:\s*<\/strong>([\s\S]*?)<\/br>/i) || detailHtml.match(/<strong>Site:\s*<\/strong>([\s\S]*?)<br>/i);
    if (siteMatch) {
      const siteNames = siteMatch[1].replace(/<[^>]+>/g, ',').split(',').map(s => s.trim()).filter(s => s.length > 0);
      studio = siteNames[0] || "";
    }
    
    // Match Cast tag: <strong>Cast: </strong><a href="...">Brooke Tilli</a>
    const castMatch = detailHtml.match(/<strong>Cast:\s*<\/strong>([\s\S]*?)<\/br>/i) || detailHtml.match(/<strong>Cast:\s*<\/strong>([\s\S]*?)<br>/i);
    if (castMatch) {
      const castNames = castMatch[1].replace(/<[^>]+>/g, ',').split(',').map(s => s.trim()).filter(s => s.length > 0);
      performers = castNames.map(name => ({ name, image: "", thumbnail: "" }));
    }
    
    // Match Date: Posted <span class="...">May 11, 2026</span>
    const dateMatch = detailHtml.match(/Posted\s+<span[^>]*>([^<]+)<\/span>/i) || detailHtml.match(/Released:\s*([^<]+)/i);
    if (dateMatch) {
      const rawDate = dateMatch[1].trim();
      const parsedDate = Date.parse(rawDate);
      if (!isNaN(parsedDate)) {
        date = new Date(parsedDate).toISOString().split('T')[0];
      }
    }
    
    // Fallbacks
    if (!studio) {
      const titleParts = best.title.split(/\s+-\s+/);
      if (titleParts.length > 1) studio = titleParts[0];
    }
    if (performers.length === 0 && expectedPerformer) {
      performers.push({ name: expectedPerformer, image: "", thumbnail: "" });
    }
    
    // Match description
    let description = best.snippet || "";
    const descP = detailHtml.match(/Released:[^<]+<\/p>\s*<p>([\s\S]*?)<\/p>/i);
    if (descP) {
      description = descP[1].replace(/<[^>]+>/g, '').trim();
    }
    
    return {
      matched: true,
      source: "naughtyblog",
      title: best.title.split(/\s+-\s+/).pop().replace(/&amp;/g, '&'),
      date: date,
      description: description || `Source: NaughtyBlog. Details at ${best.url}`,
      site: {
        name: studio || "Unknown Studio",
        logo: "",
        poster: "",
        network: ""
      },
      performers: performers,
      tags: [...new Set(tags)].slice(0, 12),
      poster: resolveThumbUrl(best.thumbnail),
      background: resolvedScreenshots[0] || "",
      trailer: "",
      url: best.url,
      studio_url: "",
      screenshots: resolvedScreenshots.slice(0, 8)
    };
  } catch (err) {
    console.error(`[NaughtyBlog Scraper Error]: ${err.message}`);
    return null;
  }
}

// SeaPorn Scraper
async function searchSeaPorn(query, expectedPerformer) {
  try {
    const searchUrl = `https://www.seaporn.org/?s=${encodeURIComponent(query)}`;
    const html = await fetchHtml(searchUrl);
    
    const posts = [];
    const postRegex = /<h2 class="entry-title"><a href="([^"]+)"[^>]*>([^<]+)<\/a><\/h2>/gi;
    let match;
    
    while ((match = postRegex.exec(html)) !== null) {
      posts.push({
        url: match[1],
        title: match[2].trim()
      });
    }
    
    if (posts.length === 0) return null;
    
    // Score posts
    const scored = posts.map(p => ({
      ...p,
      score: getOverlapScore(query, p.title)
    })).sort((a, b) => b.score - a.score);
    
    const best = scored[0];
    if (best.score < 0.15) return null;
    
    console.log(`[SeaPorn] Matched candidate: "${best.title}" (Score: ${best.score.toFixed(2)})`);
    
    const detailHtml = await fetchHtml(best.url);
    
    // Extract screenshots
    const screenshots = [];
    const imgRegex = /href="([^"]+(?:pixhost\.to\/show|imagetwist\.com|picbaron\.com)[^"]+)"|src="([^"]+(?:pixhost\.to\/thumbs|imagetwist\.com\/th)[^"]+)"/gi;
    let imgLinkMatch;
    while ((imgLinkMatch = imgRegex.exec(detailHtml)) !== null) {
      const url = imgLinkMatch[1] || imgLinkMatch[2];
      if (url && !screenshots.includes(url)) {
        screenshots.push(url);
      }
    }
    const resolvedScreenshots = screenshots.map(resolveThumbUrl).filter(u => u && !u.endsWith('.html'));
    
    // Extract studio from title (e.g. "Brazzers Exxtra 26 01 10...")
    let studio = "";
    const titleParts = best.title.split(/\s+/);
    if (titleParts.length > 0) {
      studio = titleParts[0];
      if (titleParts[1] && isNaN(parseInt(titleParts[1]))) {
        studio += " " + titleParts[1];
      }
    }
    
    // Extract tags
    const tags = [];
    const tagRegex = /rel="tag">([^<]+)<\/a>/g;
    let tagMatch;
    while ((tagMatch = tagRegex.exec(detailHtml)) !== null) {
      tags.push(tagMatch[1].trim());
    }
    
    let performers = [];
    if (expectedPerformer) {
      performers.push({ name: expectedPerformer, image: "", thumbnail: "" });
    }
    
    return {
      matched: true,
      source: "seaporn",
      title: best.title,
      date: "",
      description: `Source: SeaPorn. Details at ${best.url}`,
      site: {
        name: studio || "Unknown Studio",
        logo: "",
        poster: "",
        network: ""
      },
      performers: performers,
      tags: [...new Set(tags)].slice(0, 12),
      poster: resolvedScreenshots[0] || "",
      background: resolvedScreenshots[1] || "",
      trailer: "",
      url: best.url,
      studio_url: "",
      screenshots: resolvedScreenshots.slice(0, 8)
    };
  } catch (err) {
    console.error(`[SeaPorn Scraper Error]: ${err.message}`);
    return null;
  }
}

// Combined orchestrator
async function getMetadataFromBlogs(query, expectedPerformer) {
  console.log(`[Blog Scraper] Starting search for query: "${query}", expectedPerformer: "${expectedPerformer}"`);
  
  // Try NaughtyBlog first (usually has the most detailed info)
  let result = await searchNaughtyBlog(query, expectedPerformer);
  if (result) return result;
  
  // Try HotPornFile second
  result = await searchHotPornFile(query, expectedPerformer);
  if (result) return result;
  
  // Try SeaPorn third
  result = await searchSeaPorn(query, expectedPerformer);
  if (result) return result;
  
  return null;
}

module.exports = {
  searchHotPornFile,
  searchNaughtyBlog,
  searchSeaPorn,
  getMetadataFromBlogs
};
