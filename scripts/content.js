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
        const text = node.textContent.trim();
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
                        "content": `Transform the provided content into a humorous, Star Wars-themed science fiction version, but respect the original content's integrity. 

# Instructions
1. **Add Star Wars Elements:** Modify relevant sections and humorously introduce Star Wars elements such as character names (e.g., Luke Skywalker), memorable phrases (e.g., "Do or do not, there is no try"), and references to popular elements like planets, starships, or characters. 
2. **Add Humor, Keep Original Structure, and Names:** Insert light-hearted Star Wars-inspired jokes while maintaining the overall intent. Do NOT change individual personal names, and keep the original segment structure intact. Please do NOT insert new segments, or split existing segments.
3. **Maintain Spacing:** Keep the original spacing at the start and end of each segment.

# Output Format
Return the transformed text with the same partitioning structure using '---SPLIT---'.`
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

async function replaceTextContent(textNodes, funnyText) {
    const funnyParts = funnyText.split('---SPLIT---');
    textNodes.forEach((textNode, index) => {
        if (funnyParts[index]) {
            textNode.node.textContent = funnyParts[index];
        }
    });
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
    loadingDiv.textContent = 'Stand by... the Force is about to awaken on this page';
    document.body.appendChild(loadingDiv);
    return loadingDiv;
}

(async () => {
    try {
        // 1. Get main content
        const content = await getMainContent();
        if (!content) return;

        // Show loading indicator
        const loader = showLoading();

        // 2. Transform content
        const funnyVersion = await callOpenAI(content.fullText);
        if (!funnyVersion) {
            loader.remove();
            return;
        }

        // 3. Replace content
        await replaceTextContent(content.textNodes, funnyVersion);

        // Remove loading indicator
        loader.remove();

    } catch (error) {
        console.error('Error:', error);
        document.getElementById('funny-loader')?.remove();
    }
})();