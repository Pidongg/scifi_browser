let isEnabled = false;
const stateManager = null;
let restorableState = null;

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

async function createStarWarsOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'shadow-overlay';

    const shadow = overlay.attachShadow({ mode: 'open' });
  
    const cssURL = chrome.runtime.getURL('styles.css');
    const cssText = await fetch(cssURL).then(response => response.text());
    console.log("textstuff:");
    console.log(cssText);
    //TODO: use real page content
    shadow.innerHTML = `
        <style>${cssText}</style>
        <div id="star-wars-overlay">
            <div id="target">
                <div>
                    <h1>EPISODE IV</h1>
                    <h2>A NEW HOPE</h2>
                    <p>It is a period of civil war. Rebel spaceships, striking from a hidden base, have won their first victory against the evil Galactic Empire.</p>
                    <p>During the battle, Rebel spies managed to steal secret plans to the Empire's ultimate weapon, the DEATH STAR, an armored space station with enough power to destroy an entire planet.</p>
                    <p>Pursued by the Empire's sinister agents, Princess Leia races home aboard her starship, custodian of the stolen plans that can save her people and restore freedom to the galaxy....</p>
                    <p>The Empire's forces continue their pursuit, determined to recover the stolen plans and crush the Rebellion before it can gain further momentum.</p>
                    <p>As the chase intensifies across the vast expanse of space, the fate of countless worlds hangs in the balance, and the galaxy watches with bated breath...</p>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);

    const shadowOverlay = document.querySelector('#shadow-overlay');
    const shadowContent = shadowOverlay.shadowRoot;
    const content = shadowContent.querySelector('#target > div');
    const scrollFactor = 1.5; // Adjust this to change scroll sensitivity

    // Set initial position
    updatePosition(window.scrollY);

    // Update text position based on window scroll
    window.addEventListener('scroll', () => {
        updatePosition(window.scrollY);
    });

    function updatePosition(scrollPosition) {
        // Calculate new rotation and position
        const baseRotation = 45;  // Base rotation angle
        const translateY = -scrollPosition * scrollFactor;
        
        content.style.transform = `
            rotateX(${baseRotation}deg)
            translateY(${translateY}px)
            translateZ(0)
        `;
    };
  }
  
  function removeStarWarsOverlay() {
    const overlay = document.getElementById('shadow-overlay');
    if (overlay) overlay.remove();
  }