let isEnabled = false;
let restorableState = null;

async function getMainContent() {
    const selectors = [
        'article',
        '[role="main"]',
        'main',
        '.post-content',
        '.article-content',
        '#article-content',
        '.entry-content',
        '#content'
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
                model: "gpt-4o",
                messages: [
                    {
                        "role": "system",
                        "content": `Craft the provided content into a humorous, Star Wars-themed science fiction version, but don't distort the original content/people names. 

# Instructions
1. **Add Star Wars Elements:** Reasonably modify relevant sections and humorously introduce Star Wars elements such as memorable phrases and references to popular elements like planets, starships, or references to characters.
2. **Keep Original Purpose, Segment Length, and Names:** PRESERVE the original purpose, LENGTH of each segment. Keep person names, and please do NOT insert new segments nor split existing segments. DO NOT CHANGE THE SEGMENT IF LENGTH IS LESS THAN 5. 
3. **Maintain Spacing:** MAINTAIN the same original whitespaces & punctuation at the start or end of each segment. NO ADDITION OF WHITESPACES IN EACH SEGMENT.

# Output Format
Return the transformed text with the same partitioning structure using '---SPLIT---'. Maintain one-to-one mapping between input segment and output segment. NO extra commentary/markdown, just the text.`
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

async function getImages() {
    const skipSelectors = [
        'nav img', 
        'header img', 
        'footer img',
        '.logo',
        '.avatar',
        '.icon',
        'button img'
    ];

    // Get all images except those matching skip selectors
    const images = Array.from(document.querySelectorAll('img'))
        .filter(img => {
            // Skip tiny images (likely icons)
            if (img.naturalWidth < 100 || img.naturalHeight < 100) return false;
            // Skip already processed images
            if (img.processed || img.in_queue) return false;
            // Skip images matching selectors
            return !skipSelectors.some(selector => img.matches(selector));
        });

    return images;
}

function resizeImage(img) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Calculate aspect ratio
    const aspectRatio = img.naturalWidth / img.naturalHeight;

    // Find the best matching allowed dimensions
    const allowedDimensions = [
        [1024, 1024],
        [1152, 896],
        [1216, 832],
        [1344, 768],
        [1536, 640],
        [640, 1536],
        [768, 1344],
        [832, 1216],
        [896, 1152]
    ];

    // Find best matching dimensions based on aspect ratio
    let bestDimensions = allowedDimensions[0];
    let bestRatioDiff = Math.abs(aspectRatio - (bestDimensions[0] / bestDimensions[1]));

    for (const dims of allowedDimensions) {
        const ratioDiff = Math.abs(aspectRatio - (dims[0] / dims[1]));
        if (ratioDiff < bestRatioDiff) {
            bestRatioDiff = ratioDiff;
            bestDimensions = dims;
        }
    }

    // Set canvas size to match chosen dimensions
    canvas.width = bestDimensions[0];
    canvas.height = bestDimensions[1];

    // Draw image with proper scaling
    ctx.drawImage(img, 0, 0, bestDimensions[0], bestDimensions[1]);
    
    return canvas;
}

async function imageToBase64(img) {
    return new Promise(async (resolve, reject) => {
        try {
            // Create a new image to handle CORS
            const corsImage = new Image();
            corsImage.crossOrigin = "anonymous";

            corsImage.onload = () => {
                try {
                    // Resize image to allowed dimensions
                    const canvas = resizeImage(corsImage);
                    const base64 = canvas.toDataURL('image/png').split(',')[1];
                    resolve(base64);
                } catch (err) {
                    reject(err);
                }
            };

            corsImage.onerror = () => {
                reject(new Error('Failed to load image'));
            };

            // Add a proxy if the image fails to load with CORS
            const tryWithProxy = () => {
                corsImage.src = `https://cors-anywhere.herokuapp.com/${img.src}`;
            };

            corsImage.src = img.src;
            corsImage.processed = true;
            corsImage.addEventListener('error', tryWithProxy);

        } catch (error) {
            reject(error);
        }
    });
}

async function transformImage(img) {
    try {
        // Skip if image is already processed or invalid
        if (img.processed || !img.complete || !img.naturalWidth || !img.src) {
            return;
        }
        img.processed = true;

        // Store original dimensions
        const originalWidth = img.width;
        const originalHeight = img.height;
        const originalStyle = img.style.cssText; // Store any original styling

        // Convert image to base64
        const base64Image = await imageToBase64(img);
        if (!base64Image) return;

        // Create FormData
        const formData = new FormData();
        
        // Convert base64 to blob
        const byteCharacters = atob(base64Image);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'image/png' });
        
        // Add all required fields to FormData
        formData.append('init_image', blob);
        formData.append('image_strength', '0.35');
        formData.append('init_image_mode', 'IMAGE_STRENGTH');
        formData.append('samples', '1');
        formData.append('steps', '30');
        formData.append('cfg_scale', '7');
        formData.append('text_prompts[0][text]', 'Convert to (Star Wars) style, same composition but add Star Wars elements like droids, spaceships, or alien species in background. Make it look like it was taken on Tatooine or a Star Wars planet. Add Star Wars alien features to people.');
        formData.append('text_prompts[0][weight]', '1.5');
        formData.append('text_prompts[1][text]', 'bad quality, blurry, distorted');
        formData.append('text_prompts[1][weight]', '-1.5');
        if (img.alt) {
            formData.append('text_prompts[2][text]', img.alt)
            formData.append('text_prompts[2][weight]', '0.5');
        }

        // Call Stability AI API
        const response = await fetch('https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/image-to-image', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${config.STABILITY_API_KEY}`
            },
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Stability API Error:', errorData);
            throw new Error(`API Error: ${errorData.message || response.statusText}`);
        }

        const data = await response.json();
        
        // Update image source while maintaining original dimensions
        if (data.artifacts && data.artifacts[0]) {
            const newImageBase64 = data.artifacts[0].base64;
            console.log(`Received new image data for ${img.src.substring(0, 50)}...`);
            
            // Create a new image to handle the load event
            img.removeAttribute('srcset');
            img.removeAttribute('sizes');
            img.width = originalWidth;
            img.height = originalHeight;
            img.style.cssText = originalStyle;
            
            // Force the new src and prevent srcset from being used
            img.src = `data:image/png;base64,${newImageBase64}`;
            img.dataset.processed = 'true';
            
            // Force a reload to ensure the new image is displayed
            const parent = img.parentNode;
            if (parent.tagName === 'PICTURE') {
                // Remove all source elements if within a picture element
                Array.from(parent.getElementsByTagName('source')).forEach(source => source.remove());
            }
            
            // Force browser to re-evaluate the image
            img.style.display = 'none';
            img.offsetHeight; // Trigger reflow
            img.style.display = '';
        } else {
            console.warn('No artifacts received from API for:', img.src);
        }
    } catch (error) {
        console.error('Image transformation error:', error);
        img.dataset.processingFailed = 'true';
        
        // Log detailed error information
        if (error.response) {
            const errorText = await error.response.text();
            console.error('API Response:', errorText);
        }
    }
}

// Check saved state on load
chrome.storage.local.get(['isEnabled'], function(result) {
  isEnabled = result.isEnabled || false;
  if (isEnabled) {
    createStarWarsOverlay();
  }
});

// Listen for toggle events
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'toggleStyle') {
    isEnabled = request.isEnabled;
    if (isEnabled) {
      createStarWarsOverlay();
    } else {
      removeStarWarsOverlay();
    }
  }
});

// Add rate limiting and retries
async function processImagesInParallel(images) {
    // Sort images by their vertical position (top to bottom)
    const sortedImages = Array.from(images).sort((a, b) => {
        const aRect = a.getBoundingClientRect();
        const bRect = b.getBoundingClientRect();
        return aRect.top - bRect.top;
    });
    
    sortedImages.forEach((image) => {image.in_queue = true;});
    const maxRetries = 3;
    
    const processWithRetry = async (img, retryCount = 0) => {
        try {
            await transformImage(img);
        } catch (error) {
            if (retryCount < maxRetries) {
                console.log(`Retrying image ${retryCount + 1}/${maxRetries}`);
                return processWithRetry(img, retryCount + 1);
            }
            throw error;
        }
    };
    
    // Process all images in parallel, but they'll be queued in order of vertical position
    await Promise.all(sortedImages.map(img => processWithRetry(img)));
    
    updateLoader(`Transformation complete!`);
}

function updateLoader(text) {
    const loader = document.getElementById('funny-loader');
    if (loader) {
        loader.textContent = text;
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

function changeMousePosition() {
    fetch('http://localhost:5000/mouse-position')
        .then(response => response.json())
        .then(data => {
            console.log('Mouse Position:', data);
            // You can do something with the coordinates here
        })
        .catch(error => console.error('Error:', error));
}

// Modify the main execution
(async () => {
    try {
        // const loader = showLoading();
        // Poll every 100ms (adjust this value as needed)
        // setInterval(changeMousePosition, 100);
        // Process text content
        const content = await getMainContent();
        console.log(content.fullText);
        if (content) {
            processContentInParallel(content);
        }
        

        const find_and_process_all_images = async () => {
            const images = await getImages();
            console.log(images.length)
            if (images.length > 0) {
                // updateLoader('Starting image transformation...');
                processImagesInParallel(images);
            }
        }
        
        find_and_process_all_images();
        let interval = setInterval(async () => {
            find_and_process_all_images()
        }, 5000);

        setTimeout(() => {clearInterval(interval)}, 60000);
        
        // loader.remove();
    } catch (error) {
        console.error('Error:', error);
        document.getElementById('funny-loader')?.remove();
    }
})();

function generateHTMLFromContent(mainContent) {
    const textNodes = mainContent.textNodes;
    let output = "";
    textNodes.forEach((node) => {
        someText = (node.text).replace(/(\r\n|\n|\r)/gm, "");
        if (node.isHeading) {
            output += `<h1>${someText}</h1>`;
        } else {
            output += `<p>${someText}</p>`;
        }
    })
    console.log(output);
    return output;
}

async function createStarWarsOverlay() {
    const blackBackground = document.createElement('div');
    blackBackground.id = 'black-bg';

    blackBackground.style.cssText = `
        z-index: 99998;
        background: black;
        position: fixed;  /* or absolute */
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        overflow: hidden;
    `;
    const overlay = document.createElement('div');
    overlay.id = 'shadow-overlay';

    const shadow = overlay.attachShadow({ mode: 'open' });
  
    const cssURL = chrome.runtime.getURL('styles.css');
    const cssText = await fetch(cssURL).then(response => response.text());
    
    const mainContent = await getMainContent();
    console.log("maincontent");
    console.log(mainContent);
    const textContent = generateHTMLFromContent(mainContent);

    shadow.innerHTML = `
        <style>${cssText}</style>
        <div id="star-wars-overlay">
            <div id="target">
                <div>
                    ${textContent}
                </div>
            </div>
        </div>
    `;
    
    console.log("overlay")
    console.log(overlay)
    document.body.appendChild(blackBackground);
    document.body.appendChild(overlay);

    const shadowOverlay = document.querySelector('#shadow-overlay');
    const shadowContent = shadowOverlay.shadowRoot;
    const content = shadowContent.querySelector('#target > div');
    const scrollMultiplier = 2; // Adjust this value to change scroll speed

    // Use passive event listener for better scroll performance
    window.addEventListener('scroll', function() {
        const scrollPosition = window.scrollY || document.documentElement.scrollTop;
        const translateY = -scrollPosition * scrollMultiplier;
        content.style.transform = `translateY(${translateY}px)`;
    });
}
  
function removeStarWarsOverlay() {
    const overlay = document.getElementById('shadow-overlay');
    if (overlay) overlay.remove();
    const blackbg = document.getElementById('black-bg');
    if (blackbg) blackbg.remove();
}
