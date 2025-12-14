function copyToClipboard(elementId) {
    var copyText = document.getElementById(elementId);
    copyText.select();
    copyText.setSelectionRange(0, 99999); /* For mobile devices */
    navigator.clipboard.writeText(copyText.value).then(function () {
        alert("Copied to clipboard: " + copyText.value.substring(0, 10) + "...");
    }, function (err) {
        console.error('Async: Could not copy text: ', err);
    });
}

function checkBalance() {
    var addr = document.getElementById('addr-out').value;
    if (addr) {
        // Using mempool.space for a retro-compatible but modern backend feel, or blockchain.com
        window.open('https://www.blockchain.com/explorer/addresses/btc/' + addr, '_blank');
    }
}

// --- BASE58 & CRYPTO (Standard) ---
const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function to_b58(B) {
    var d = [], s = "", j, c, n;
    for (var i = 0; i < B.length; i++) {
        j = 0, c = B[i];
        s += c || s.length ^ i ? "" : 1;
        while (j < d.length || c) {
            n = d[j];
            n = n ? n * 256 + c : c;
            c = n / 58 | 0;
            d[j] = n % 58;
            j++;
        }
    }
    while (j--) s += ALPHABET[d[j]];
    return s;
}
function hexToBytes(hex) {
    for (var bytes = [], c = 0; c < hex.length; c += 2) bytes.push(parseInt(hex.substr(c, 2), 16));
    return bytes;
}
function sha256(hex) { return CryptoJS.SHA256(CryptoJS.enc.Hex.parse(hex)).toString(CryptoJS.enc.Hex); }
function ripemd160(hex) { return CryptoJS.RIPEMD160(CryptoJS.enc.Hex.parse(hex)).toString(CryptoJS.enc.Hex); }
function encodeBase58Check(hex) {
    const h1 = sha256(hex);
    const h2 = sha256(h1);
    return to_b58(hexToBytes(hex + h2.substring(0, 8)));
}

const ec = new elliptic.ec("secp256k1");

function generateWallet(randomBytes) {
    const privateKeyHex = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
    const key = ec.keyFromPrivate(privateKeyHex, "hex");
    const pub = key.getPublic(true, 'hex');
    const addr = encodeBase58Check("00" + ripemd160(sha256(pub))); // 00 = Mainnet
    const wif = encodeBase58Check("80" + privateKeyHex + "01");     // 80 = Mainnet Priv, 01 = Compressed
    return { privateKey: privateKeyHex, address: addr, wif: wif };
}


// --- ENTROPY & MS PAINT SPRAY FX ---
const entropyLimit = 400;
let entropyCollected = 0;
let rawEntropy = "";

const canvas = document.getElementById('paint-canvas');
const ctx = canvas.getContext('2d');
const rawStreamBox = document.getElementById('raw-entropy-stream');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

const SPRAY_COLORS = ['#000000', '#FF0000', '#0000FF', '#008000', '#800080'];

function sprayPaint(x, y) {
    // MS Paint spray style: random pixels within a radius
    const radius = 15;
    const density = 10;

    ctx.fillStyle = SPRAY_COLORS[Math.floor(Math.random() * SPRAY_COLORS.length)];

    for (let i = 0; i < density; i++) {
        const offsetX = (Math.random() - 0.5) * 2 * radius;
        const offsetY = (Math.random() - 0.5) * 2 * radius;

        // Circular constraint
        if (offsetX * offsetX + offsetY * offsetY <= radius * radius) {
            ctx.fillRect(x + offsetX, y + offsetY, 2, 2); // 2x2 pixels for chunky look
        }
    }
}

document.addEventListener('mousemove', (e) => {
    if (entropyCollected >= entropyLimit) return;

    // 1. Core Logic
    const pointData = e.screenX + "" + e.screenY + Date.now();
    rawEntropy += pointData;

    // 2. Visuals
    sprayPaint(e.clientX, e.clientY);

    // Raw Stream (DOS font)
    if (rawEntropy.length % 5 === 0) {
        const char = CryptoJS.MD5(pointData).toString().charAt(0);
        rawStreamBox.value += char;
        rawStreamBox.scrollTop = rawStreamBox.scrollHeight;
    }

    // 3. Progress
    if (rawEntropy.length % 3 === 0) {
        entropyCollected++;
        const p = Math.floor((entropyCollected / entropyLimit) * 100);
        const bar = document.getElementById('entropy-bar-fill');
        bar.style.width = p + "%";
        // Show percentage INSIDE the bar like Win95 defrag
        bar.innerText = p + "%";
        document.getElementById('entropy-percent').innerText = p + "%";
    }

    if (entropyCollected >= entropyLimit) finish();
});

function finish() {
    entropyCollected = entropyLimit + 1;

    // Cursor wait
    document.body.style.cursor = 'wait';

    const randomValues = new Uint8Array(32);
    window.crypto.getRandomValues(randomValues);
    const finalHash = CryptoJS.SHA256(rawEntropy + randomValues.join('')).toString();
    const wallet = generateWallet(hexToBytes(finalHash));

    setTimeout(() => {
        document.body.style.cursor = 'default';
        document.getElementById('entropy-phase').style.display = 'none';
        document.getElementById('wallet-output').style.display = 'block';

        // Fill inputs
        document.getElementById('wif-out').value = wallet.wif;
        document.getElementById('addr-out').value = wallet.address;
        document.getElementById('priv-hex-out').value = wallet.privateKey;

        // Clear canvas so user can read text easily? Or keep the art?
        // Let's fade it out just a bit or keep it as background art.
        // Keeping it is cooler.
    }, 1000);
}
