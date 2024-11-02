async function getMainContent() {
    const selectors = [
        'article',
        '[role="main"]',
        'main',
        '.post-content',
        '.article-content',
        '#article-content',
        '.entry-content'
    ];

    let mainElement = null;
    let longestText = '';

    for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
            const text = element.textContent.trim();
            if (text.length > longestText.length && text.split(' ').length > 100) {
                mainElement = element;
                longestText = text;
            }
        }
    }

    if (!mainElement || longestText.split(' ').length < 100) {
        console.log('No main content found');
        return null;
    }

    const walker = document.createTreeWalker(
        mainElement,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: function(node) {
                // Skip if parent or ancestor is any of these elements
                const skipElements = [
                    'BUTTON',   // Buttons
                    'INPUT',    // Form inputs
                    'SELECT',   // Dropdowns
                    'TEXTAREA', // Text areas
                    'SCRIPT',   // JavaScript
                    'STYLE',    // CSS
                    'NAV',      // Navigation
                    'HEADER',   // Site header (not article headings)
                    'FOOTER',   // Footers
                    'PICTURE',  // Picture elements
                    'IMG',      // Images
                    'FIGURE',   // Figures
                    'FIGCAPTION', // Figure captions
                    'VIDEO',    // Videos
                    'AUDIO',    // Audio
                    'IFRAME'    // Embedded frames
                ];

                // Check if it's a heading or part of main content
                let parent = node.parentElement;
                while (parent) {
                    // Skip if it's in our skip list
                    if (skipElements.includes(parent.tagName)) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    
                    // Keep headings and main content
                    if (parent.tagName.match(/^H[1-6]$/)) {
                        return NodeFilter.FILTER_ACCEPT;
                    }
                    
                    parent = parent.parentElement;
                }

                // Skip empty or very short non-heading text
                const trimmedText = node.textContent.trim();
                if (!trimmedText || (trimmedText.length < 1 && !node.parentElement.tagName.match(/^H[1-6]$/))) {
                    return NodeFilter.FILTER_REJECT;
                }

                return NodeFilter.FILTER_ACCEPT;
            }
        }
    );

    let textNodes = [];
    let fullText = '';
    let node;
    
    while (node = walker.nextNode()) {
        const text = node.textContent;
        if (text.length > 0) {
            textNodes.push({
                node: node,
                text: text,
                startIndex: fullText.length,
                isHeading: node.parentElement.tagName.match(/^H[1-6]$/) !== null
            });
            fullText += text + '\n---SPLIT---\n';
        }
    }

    if (textNodes.length === 0 || fullText.split(' ').length < 100) {
        console.log('Not enough main content found');
        return null;
    }

    return { textNodes, fullText, element: mainElement };
}

async function callOpenAI(text) {
    console.log(text);
    // return null;
    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    {
                        "role": "system",
                        "content": `Craft the provided content into a humorous, Star Wars-themed science fiction version, but don't distort the original content/people names. 

# Instructions
1. **Add Star Wars Elements:** Modify relevant sections and humorously introduce Star Wars elements such as memorable phrases and references to popular elements like planets, starships, or references to characters. 
2. **Add Humor, Keep Original Structure, and Names:** Insert light-hearted Star Wars-inspired jokes while maintaining the overall intent. Keep person names, and keep the original segment structure intact.
3. **Maintain Spacing:** KEEP the original spaces at the start and end of each segment.

# Output Format
Return the transformed text with the same partitioning structure using '---SPLIT---'. Please do NOT insert new segments, or split existing segments. NO extra commentary, just the text.`
                    },
                    {
                        "role": "user",
                        "content": text
                    }
                ],
                temperature: 1.0,
                max_tokens: 2048
            })
        });

        const data = await response.json();
        if (data.error) {
            console.error('OpenAI API Error:', data.error);
            return null;
        }
        console.log(data.choices[0].message.content);
        return data.choices[0].message.content;
    } catch (error) {
        console.error('OpenAI API Error:', error);
        return null;
    }
}

async function splitContentIntoChunks(textNodes, maxChunkSize = 5) {
    let chunks = [];
    let currentChunk = [];
    
    const isEndOfSentence = (text) => {
        const trimmed = text.trim();
        return trimmed.endsWith('.') || 
               trimmed.endsWith('!') || 
               trimmed.endsWith('?') || 
               trimmed.endsWith('".');
    };

    const shouldStartNewChunk = (currentNode, nextNode) => {
        // Always start new chunk on heading
        if (nextNode && nextNode.isHeading) return true;
        
        // Start new chunk if we're at max size AND at end of sentence
        if (currentChunk.length >= maxChunkSize) {
            // Check if current chunk ends with a complete sentence
            const lastNodeText = currentNode.text;
            if (isEndOfSentence(lastNodeText)) {
                return true;
            }
            
            // If we're way over max size, force a new chunk
            if (currentChunk.length >= maxChunkSize * 1.5) {
                return true;
            }
        }
        
        return false;
    };
    
    textNodes.forEach((node, index) => {
        const nextNode = index < textNodes.length - 1 ? textNodes[index + 1] : null;
        
        if (currentChunk.length === 0) {
            // Start new chunk
            currentChunk.push(node);
        } else if (shouldStartNewChunk(node, nextNode)) {
            // Complete current chunk and start new one
            currentChunk.push(node);
            chunks.push(currentChunk);
            currentChunk = [];
        } else {
            // Add to current chunk
            currentChunk.push(node);
        }
    });
    
    // Add the last chunk if it exists
    if (currentChunk.length > 0) {
        chunks.push(currentChunk);
    }
    
    return chunks;
}

async function processAndUpdateChunk(chunk) {
    // Create text for this chunk
    const chunkText = chunk
        .map(node => node.text)
        .join('\n---SPLIT---\n');

    // Transform chunk
    const funnyVersion = await callOpenAI(chunkText);
    if (!funnyVersion) return;

    // Update DOM immediately for this chunk
    const funnyParts = funnyVersion.split('---SPLIT---');
    chunk.forEach((textNode, index) => {
        if (funnyParts[index]) {
            requestAnimationFrame(() => {
                textNode.node.textContent = funnyParts[index];
            });
        }
    });
}

async function processContentInParallel(content) {
    // Split content into manageable chunks
    const chunks = await splitContentIntoChunks(content.textNodes);
    
    // Process chunks in parallel with a concurrency limit
    const concurrencyLimit = 3; // Process 3 chunks at a time
    
    for (let i = 0; i < chunks.length; i += concurrencyLimit) {
        const batch = chunks.slice(i, i + concurrencyLimit);
        await Promise.all(batch.map(chunk => processAndUpdateChunk(chunk)));
    }
}

// Add a loading indicator
function showLoading() {
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'funny-loader';
    loadingDiv.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        padding: 10px;
        background: #333;
        color: white;
        border-radius: 5px;
        z-index: 10000;
    `;
    loadingDiv.textContent = 'Stand by... the Force is awakened on this page 💫';
    document.body.appendChild(loadingDiv);
    return loadingDiv;
}

// Modify the main execution
(async () => {
    try {
        const content = await getMainContent();
        if (!content) return;

        const loader = showLoading();
        
        await processContentInParallel(content);
        
        loader.remove();
    } catch (error) {
        console.error('Error:', error);
        document.getElementById('funny-loader')?.remove();
    }
})();