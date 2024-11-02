const y = document.getElementById('toggleButton');
const lengthButton = document.getElementById('lengthButton');
const formatButton = document.getElementById('formatButton');

document.addEventListener('DOMContentLoaded', function() {
    chrome.storage.local.get('active',async function(result) {
    let x = result.active;
    if (x == null || x) {
        y.textContent = 'click to turn off';
    } else {
        y.textContent = 'click to turn on';
    }
    });

    chrome.storage.local.get('longer',async function(result) {
        let x = result.longer;
        if (x == null || !x) {
            lengthButton.textContent = 'click for longer';
        } else {
            lengthButton.textContent = 'click for shorter';
        }
        });

    chrome.storage.local.get('bullet',async function(result) {
        let x = result.bullet;
        if (x == null || !x) {
            formatButton.textContent = 'click for bullet-points';
        } else {
            formatButton.textContent = 'click for sentences';
        }
        });
});

y.addEventListener('click', async function() {
    chrome.storage.local.get('active',async function(result) {
        let x = result.active;
    console.log("Button clicked"); // Check if the event listener is working
    if (x == null || x) {
        await chrome.storage.local.set({active: false});
        y.textContent = 'click to turn on';
    } else {
        await chrome.storage.local.set({active: true});
        y.textContent = 'click to turn off';
    }
});
});

lengthButton.addEventListener('click', async function() {
    chrome.storage.local.get('longer',async function(result) {
        let x = result.longer;
    console.log("Button clicked"); // Check if the event listener is working
    if (x == null || !x) {
        await chrome.storage.local.set({longer: true});
        lengthButton.textContent = 'click for shorter';
    } else {
        await chrome.storage.local.set({longer: false});
        lengthButton.textContent = 'click for longer';
    }
});
});

formatButton.addEventListener('click', async function() {
    chrome.storage.local.get('bullet',async function(result) {
    let x = result.bullet;
    console.log("Button clicked"); // Check if the event listener is working
    if (x == null || !x) {
        await chrome.storage.local.set({bullet: true});
        formatButton.textContent = 'click for sentences';
    } else {
        await chrome.storage.local.set({bullet: false});
        formatButton.textContent = 'click for bullet-points';
    }
});
});